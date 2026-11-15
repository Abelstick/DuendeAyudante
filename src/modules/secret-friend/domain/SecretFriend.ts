/** Lo que una persona anotó (en privado) sobre a quién le regala. */
export interface SecretFriendNote {
  giverId: string;
  receiverId: string;
}

export interface ISecretFriendRepository {
  /** Solo devuelve las notas propias y de las personas a cargo (lo garantiza la base de datos). */
  listMine(eventId: string): Promise<SecretFriendNote[]>;
  set(eventId: string, giverId: string, receiverId: string): Promise<void>;
  clear(giverId: string): Promise<void>;
}
