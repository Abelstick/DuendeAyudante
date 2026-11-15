/**
 * Error de la aplicación con un código estable. La capa de presentación lo
 * traduce a un mensaje claro (ver shared/ui/errorMessages.ts).
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = 'AppError';
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
