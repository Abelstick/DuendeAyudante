import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { AuthUser, IAuthService, SignInCredentials } from '@/shared/application/ports/IAuthService';
import { fromPostgrestError } from '@/shared/infrastructure/supabase/errors';
import { AppError } from '@/shared/domain/errors';
import { normalizeJoinCode, normalizeUsername } from '@/shared/validation/names';

/**
 * Los familiares no tienen correo: su cuenta usa un correo interno ficticio
 * "<usuario>@<código>.<dominio .invalid>" que nunca ven (debe coincidir con la
 * Edge Function create-member). Esto queda encapsulado aquí.
 */
export class SupabaseAuthService implements IAuthService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly memberEmailDomain: string,
  ) {}

  /**
   * El código puede ser el actual o uno anterior (si el organizador lo cambió):
   * se traduce al código vigente, que es el que va en el correo interno.
   */
  private async toEmail({ eventCode, user }: SignInCredentials): Promise<string> {
    const value = user.trim();
    if (!eventCode || value.includes('@')) return value.toLowerCase();

    const { data, error } = await this.supabase.rpc('resolve_join_code', { p_code: normalizeJoinCode(eventCode) });
    if (error) throw new AppError('NETWORK');
    if (typeof data !== 'string' || !data) throw new AppError('EVENT_CODE_NOT_FOUND');
    return `${normalizeUsername(value)}@${data.toLowerCase()}.${this.memberEmailDomain}`;
  }

  private toAuthUser(user: User): AuthUser {
    const email = user.email ?? '';
    const isMember = email.endsWith(`.${this.memberEmailDomain}`);
    return { id: user.id, loginName: isMember ? email.split('@')[0] ?? email : email };
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const { data } = await this.supabase.auth.getSession();
    if (!data.session) return null;
    // Una cuenta inhabilitada no sigue dentro aunque tuviera la sesión abierta
    if (await this.isDisabled()) return null;
    return this.toAuthUser(data.session.user);
  }

  onChange(listener: (user: AuthUser | null) => void): () => void {
    const { data } = this.supabase.auth.onAuthStateChange((_event, session) => {
      listener(session ? this.toAuthUser(session.user) : null);
    });
    return () => data.subscription.unsubscribe();
  }

  async signIn(credentials: SignInCredentials): Promise<AuthUser> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: await this.toEmail(credentials),
      password: credentials.password,
    });
    if (error) {
      if (error.status === 400 || error.code === 'invalid_credentials') throw new AppError('INVALID_CREDENTIALS');
      if (error.code === 'email_not_confirmed') throw new AppError('EMAIL_NOT_CONFIRMED');
      if (error.status === 429) throw new AppError('TOO_MANY_ATTEMPTS');
      throw new AppError('NETWORK');
    }
    if (await this.isDisabled()) throw new AppError('ACCOUNT_DISABLED');
    return this.toAuthUser(data.user);
  }

  async signInWithPass(pass: string): Promise<AuthUser> {
    const { data, error } = await this.supabase.auth.verifyOtp({ token_hash: pass, type: 'magiclink' });
    if (error || !data.user) {
      if (error?.status === 429) throw new AppError('TOO_MANY_ATTEMPTS');
      throw new AppError(error?.status && error.status < 500 ? 'FAMILY_PASS_EXPIRED' : 'NETWORK');
    }
    if (await this.isDisabled()) throw new AppError('ACCOUNT_DISABLED');
    return this.toAuthUser(data.user);
  }

  async signUpOrganizer(email: string, password: string): Promise<{ needsEmailConfirmation: boolean }> {
    if (email.trim().toLowerCase().endsWith(this.memberEmailDomain)) throw new AppError('EMAIL_INVALID');
    const { data, error } = await this.supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/entrar?modo=organizador` },
    });
    if (error) {
      if (error.code === 'user_already_exists') throw new AppError('EMAIL_TAKEN');
      if (error.code === 'weak_password') throw new AppError('PASSWORD_INVALID');
      if (error.status === 429) throw new AppError('TOO_MANY_ATTEMPTS');
      throw new AppError('SIGNUP_FAILED');
    }
    return { needsEmailConfirmation: !data.session };
  }

  async requestPasswordReset(email: string): Promise<void> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/nueva-contrasena`,
    });
    if (error) throw new AppError(error.status === 429 ? 'TOO_MANY_ATTEMPTS' : 'NETWORK');
  }

  async changePassword(newPassword: string): Promise<void> {
    const { error } = await this.supabase.auth.updateUser({ password: newPassword });
    if (error) throw new AppError(error.code === 'same_password' ? 'SAME_PASSWORD' : 'PASSWORD_INVALID');
  }

  /** Vuelve a identificar a la misma cuenta: si la contraseña es correcta, la sesión simplemente se renueva. */
  async verifyPassword(password: string): Promise<void> {
    const { data } = await this.supabase.auth.getSession();
    const email = data.session?.user.email;
    if (!email) throw new AppError('NOT_AUTHENTICATED');
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.status === 429) throw new AppError('TOO_MANY_ATTEMPTS');
      if (error.status === 400 || error.code === 'invalid_credentials') throw new AppError('WRONG_PASSWORD');
      throw new AppError('NETWORK');
    }
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
  }

  async disableAccount(confirm: string): Promise<void> {
    const { error } = await this.supabase.rpc('disable_my_account', { p_confirm: confirm });
    if (error) throw fromPostgrestError(error);
    await this.supabase.auth.signOut();
  }

  /** Si la cuenta está inhabilitada, cierra la sesión y avisa. Sin conexión no se bloquea a nadie. */
  private async isDisabled(): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('my_account_disabled');
    if (error || data !== true) return false;
    await this.supabase.auth.signOut();
    return true;
  }
}
