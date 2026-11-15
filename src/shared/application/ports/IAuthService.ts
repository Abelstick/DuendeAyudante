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

/** Celebración que organizo: antes de borrar mi cuenta hay que pasarla a un administrador (o borrarla). */
export interface OwnedEvent {
  eventId: string;
  eventName: string;
  /** Administradores que pueden quedar como organizador. */
  successors: { userId: string; name: string }[];
}

/** Para cada celebración que organizo: el userId del nuevo organizador, o 'DELETE' para borrarla. */
export type OwnershipChoices = Record<string, string>;

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
  listOwnedEvents(): Promise<OwnedEvent[]>;
  /**
   * Borra la cuenta de quien tiene la sesión (su perfil queda en la celebración, sin usuario).
   * `confirm` debe ser BORRAR. Al terminar, cierra la sesión en este dispositivo.
   */
  deleteAccount(confirm: string, choices: OwnershipChoices): Promise<void>;
}
