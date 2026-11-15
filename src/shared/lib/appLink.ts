/** Enlace a una sección de la Navidad para poner en mensajes de WhatsApp. */
export function eventAppLink(eventId: string, path = ''): string {
  return `${window.location.origin}/e/${eventId}${path}`;
}
