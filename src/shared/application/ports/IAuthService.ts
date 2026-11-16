export interface AuthUser {
  id: string;
  /** Usuario corto para familiares ("rosa") o correo para organizadores. */
  loginName: string;
}

/** Familiares: código de la Navidad + usuario. Organizadores: correo (eventCode = null). */
export interface SignInCredentials {
  eventCode: string | null;
  user: string;
  password: string;
}

/** Palabra que se escribe para confirmar que se inhabilita la cuenta (también la valida la base). */
export const DISABLE_CONFIRMATION_WORD = 'INHABILITAR';

export function isDisableConfirmed(text: string): boolean {
  return text.trim().toUpperCase() === DISABLE_CONFIRMATION_WORD;
}

export interface IAuthService {
  getCurrentUser(): Promise<AuthUser | null>;
  onChange(listener: (user: AuthUser | null) => void): () => void;
  signIn(credentials: SignInCredentials): Promise<AuthUser>;
  /** Entra con un pase de un solo uso emitido por el servidor (enlace de la familia). */
  signInWithPass(pass: string): Promise<AuthUser>;
  signUpOrganizer(email: string, password: string): Promise<{ needsEmailConfirmation: boolean }>;
  requestPasswordReset(email: string): Promise<void>;
  changePassword(newPassword: string): Promise<void>;
  /** Comprueba la contraseña de quien tiene la sesión abierta (para ver datos privados). Falla con WRONG_PASSWORD. */
  verifyPassword(password: string): Promise<void>;
  signOut(): Promise<void>;
  /**
   * Inhabilita la cuenta de quien tiene la sesión: ya no puede entrar, pero no se borra nada
   * y quien administra su celebración puede reactivarla. `confirm` debe ser INHABILITAR.
   * Al terminar, cierra la sesión.
   */
  disableAccount(confirm: string): Promise<void>;
}
