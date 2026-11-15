/** Datos leídos del enlace de una tienda para llenar un regalo. */
export interface LinkPreview {
  title: string | null;
  price: number | null;
  currency: string | null;
  image: string | null;
  siteName: string | null;
  /**
   * page = se leyó la página de la tienda; url = la tienda no dejó leerla y el nombre
   * se sacó del mismo enlace (sin precio ni foto; conviene revisarlo).
   */
  source?: 'page' | 'url';
  /** Por qué no se pudo leer la página (para diagnóstico). */
  reason?: string;
}

export interface ILinkPreviewService {
  read(url: string): Promise<LinkPreview>;
}
