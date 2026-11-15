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

export interface IAuthService {
  getCurrentUser(): Promise<AuthUser | null>;
  onChange(listener: (user: AuthUser | null) => void): () => void;
  signIn(credentials: SignInCredentials): Promise<AuthUser>;
  /** Entra con un pase de un solo uso emitido por el servidor (enlace de la familia). */
  signInWithPass(pass: string): Promise<AuthUser>;
  signUpOrganizer(email: string, password: string): Promise<{ needsEmailConfirmation: boolean }>;
  requestPasswordReset(email: string): Promise<void>;
  changePassword(newPassword: string): Promise<void>;
  signOut(): Promise<void>;
}
