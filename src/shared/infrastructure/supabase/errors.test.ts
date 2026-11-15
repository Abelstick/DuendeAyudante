import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { fromFunctionError } from './errors';

const httpError = (status: number, body: unknown) => new FunctionsHttpError(new Response(JSON.stringify(body), { status }));

describe('errores de Edge Functions', () => {
  it('usa el código que devuelve nuestra función', async () => {
    expect((await fromFunctionError(httpError(422, { error: 'LINK_PREVIEW_FAILED' }))).code).toBe('LINK_PREVIEW_FAILED');
  });

  it('reconoce cuando la función no está publicada (no es un problema de internet)', async () => {
    const err = await fromFunctionError(httpError(404, { code: 'NOT_FOUND', message: 'Requested function was not found' }));
    expect(err.code).toBe('FUNCTION_NOT_DEPLOYED');
  });

  it('otro error del servidor no se confunde con falta de internet', async () => {
    expect((await fromFunctionError(httpError(500, { message: 'boom' }))).code).toBe('UNEXPECTED');
  });

  it('sin respuesta del servidor sí es un problema de conexión', async () => {
    expect((await fromFunctionError(new FunctionsFetchError(new Error('offline')))).code).toBe('NETWORK');
  });
});
