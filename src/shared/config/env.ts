const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const env = {
  supabaseUrl: url ?? '',
  supabasePublishableKey: publishableKey ?? '',
  memberEmailDomain: (import.meta.env.VITE_MEMBER_EMAIL_DOMAIN as string | undefined) ?? 'usuarios.navidad.invalid',
  // Si todavía está el texto de ejemplo, la app muestra "Falta configurar" en vez de errores confusos
  isConfigured: Boolean(url && publishableKey && !publishableKey.includes('PEGA_AQUI') && !url.includes('TU-PROYECTO')),
};
