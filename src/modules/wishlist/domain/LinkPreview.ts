/** Datos leídos del enlace de una tienda para llenar un regalo. */
export interface LinkPreview {
  title: string | null;
  price: number | null;
  currency: string | null;
  image: string | null;
  siteName: string | null;
}

export interface ILinkPreviewService {
  read(url: string): Promise<LinkPreview>;
}
