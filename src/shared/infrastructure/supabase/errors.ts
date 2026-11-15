import { FunctionsHttpError, type PostgrestError } from '@supabase/supabase-js';
import { AppError } from '@/shared/domain/errors';

/** Convierte errores de PostgREST/Postgres en errores de la aplicación. */
export function fromPostgrestError(error: PostgrestError): AppError {
  const message = error.message ?? '';
  const code = message.match(/\b[A-Z][A-Z_]{3,}\b/)?.[0];

  if (error.code === '23505') {
    if (message.includes('JOIN_CODE_TAKEN') || message.includes('events_join_code_key')) return new AppError('JOIN_CODE_TAKEN');
    if (message.includes('participants_unique_name')) return new AppError('DUPLICATE_NAME');
    if (message.includes('games_unique_name')) return new AppError('GAME_NAME_TAKEN');
    if (message.includes('families_event_id_name_key')) return new AppError('DUPLICATE_FAMILY');
    return new AppError('DUPLICATE');
  }
  if (error.code === '23514') return new AppError(code ?? 'INVALID_DATA');
  if (error.code === '42501' || error.code === 'PGRST301') return new AppError(code ?? 'FORBIDDEN');
  if (error.code === 'PGRST116') return new AppError('NOT_FOUND');
  if (code) return new AppError(code);
  return new AppError('UNEXPECTED', { message });
}

/** Convierte la respuesta de error de una Edge Function en AppError. */
export async function fromFunctionError(error: unknown): Promise<AppError> {
  if (error instanceof FunctionsHttpError) {
    const status = (error.context as Response | undefined)?.status;
    try {
      const body = (await error.context.json()) as { error?: string; code?: string; message?: string } & Record<string, unknown>;
      if (body?.error) {
        const { error: code, ...details } = body;
        return new AppError(code, details);
      }
      // Respuesta de Supabase (no de nuestra función): la función no está publicada en el proyecto
      if (body?.code === 'NOT_FOUND' || /function was not found/i.test(body?.message ?? '')) return new AppError('FUNCTION_NOT_DEPLOYED');
    } catch {
      // respuesta sin JSON
    }
    // Hubo respuesta del servidor: no es un problema de internet
    if (status === 404) return new AppError('FUNCTION_NOT_DEPLOYED');
    if (status) return new AppError('UNEXPECTED', { status });
  }
  return new AppError('NETWORK');
}
