/** Enlaces para llegar a una dirección escrita a mano (sin coordenadas). */
export function googleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}

export function wazeUrl(address: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(address.trim())}&navigate=yes`;
}
