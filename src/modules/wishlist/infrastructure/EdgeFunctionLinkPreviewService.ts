import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/shared/domain/errors';
import { fromFunctionError } from '@/shared/infrastructure/supabase/errors';
import type { ILinkPreviewService, LinkPreview } from '../domain/LinkPreview';
import { isValidHttpUrl, normalizeUrl } from '../domain/WishlistItem';

/** Lee el enlace con la Edge Function link-preview (el navegador no puede leer otras páginas por CORS). */
export class EdgeFunctionLinkPreviewService implements ILinkPreviewService {
  constructor(private readonly supabase: SupabaseClient) {}

  async read(rawUrl: string): Promise<LinkPreview> {
    const url = normalizeUrl(rawUrl);
    if (!isValidHttpUrl(url)) throw new AppError('LINK_INVALID');
    const { data, error } = await this.supabase.functions.invoke<LinkPreview>('link-preview', { body: { url } });
    if (error || !data) throw await fromFunctionError(error);
    return data;
  }
}
