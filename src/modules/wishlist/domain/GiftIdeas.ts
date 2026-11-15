/**
 * Ideas de regalo para quien no sabe qué pedir. Precios aproximados en soles
 * (PEN) para filtrar por el presupuesto del intercambio. Es una lista fija:
 * no consulta tiendas ni servicios externos.
 */
export type AgeGroup = 'baby' | 'kid' | 'preteen' | 'teen' | 'adult' | 'senior';

export interface GiftIdea {
  title: string;
  emoji: string;
  /** Sugerencia para el campo «Detalles». */
  detail: string;
  ages: readonly AgeGroup[];
  /** Precio aproximado en soles. */
  min: number;
  max: number;
}

export const AGE_GROUPS: { value: AgeGroup; label: string; emoji: string }[] = [
  { value: 'baby', label: 'Bebé (0–2)', emoji: '👶' },
  { value: 'kid', label: 'Niño (3–7)', emoji: '🧒' },
  { value: 'preteen', label: 'Niño (8–12)', emoji: '🧑' },
  { value: 'teen', label: 'Adolescente', emoji: '🎧' },
  { value: 'adult', label: 'Adulto', emoji: '🧑‍💼' },
  { value: 'senior', label: 'Abuelo/a', emoji: '👵' },
];

const ALL_GROWN: AgeGroup[] = ['teen', 'adult', 'senior'];

export const GIFT_IDEAS: readonly GiftIdea[] = [
  // Bebés
  { title: 'Juguete de estimulación', emoji: '🧸', detail: 'Con sonidos o texturas, para su edad', ages: ['baby'], min: 25, max: 70 },
  { title: 'Libro de tela o de cartón', emoji: '📘', detail: 'Con dibujos grandes y colores vivos', ages: ['baby'], min: 15, max: 40 },
  { title: 'Ropa de bebé', emoji: '👕', detail: 'Talla (en meses) y color preferido', ages: ['baby'], min: 30, max: 80 },
  { title: 'Mordedor y sonajero', emoji: '🍼', detail: 'Libre de BPA', ages: ['baby'], min: 15, max: 35 },
  { title: 'Cubos o bloques blandos', emoji: '🧩', detail: 'Para apilar', ages: ['baby', 'kid'], min: 30, max: 70 },

  // Niños 3–7
  { title: 'Plastilina o masa para modelar', emoji: '🎨', detail: 'Set con moldes', ages: ['kid'], min: 20, max: 50 },
  { title: 'Rompecabezas', emoji: '🧩', detail: 'Cantidad de piezas según la edad', ages: ['kid', 'preteen'], min: 20, max: 60 },
  { title: 'Muñeca o figura de acción', emoji: '🪆', detail: 'Personaje favorito', ages: ['kid', 'preteen'], min: 30, max: 90 },
  { title: 'Carro a control remoto', emoji: '🚗', detail: 'Con pilas recargables si se puede', ages: ['kid', 'preteen'], min: 50, max: 150 },
  { title: 'Libro de cuentos', emoji: '📚', detail: 'Tema o personaje favorito', ages: ['kid'], min: 20, max: 50 },
  { title: 'Kit de pintura o colores', emoji: '🖍️', detail: 'Colores, plumones y cuaderno de dibujo', ages: ['kid', 'preteen'], min: 25, max: 60 },
  { title: 'Pelota', emoji: '⚽', detail: 'Fútbol, vóley o básquet; número de pelota', ages: ['kid', 'preteen', 'teen'], min: 30, max: 90 },
  { title: 'Disfraz', emoji: '🦸', detail: 'Personaje y talla', ages: ['kid'], min: 40, max: 90 },

  // Niños 8–12
  { title: 'Juego de mesa', emoji: '🎲', detail: 'Para jugar en familia', ages: ['preteen', 'teen', 'adult', 'senior'], min: 40, max: 120 },
  { title: 'Bloques para construir', emoji: '🧱', detail: 'Set temático', ages: ['kid', 'preteen'], min: 50, max: 200 },
  { title: 'Kit de ciencia o experimentos', emoji: '🔬', detail: 'Volcanes, cristales, slime…', ages: ['preteen'], min: 40, max: 100 },
  { title: 'Patines o scooter', emoji: '🛴', detail: 'Talla de pie y protecciones', ages: ['preteen', 'teen'], min: 100, max: 250 },
  { title: 'Cómic o manga', emoji: '📖', detail: 'Serie y número del tomo', ages: ['preteen', 'teen'], min: 20, max: 50 },
  { title: 'Mochila o cartuchera', emoji: '🎒', detail: 'Color o personaje', ages: ['kid', 'preteen', 'teen'], min: 40, max: 120 },

  // Adolescentes
  { title: 'Audífonos', emoji: '🎧', detail: 'Bluetooth o con cable; color', ages: ALL_GROWN, min: 50, max: 200 },
  { title: 'Parlante bluetooth', emoji: '🔊', detail: 'Pequeño, resistente al agua', ages: ALL_GROWN, min: 60, max: 180 },
  { title: 'Polera o casaca', emoji: '🧥', detail: 'Talla y color', ages: ['preteen', 'teen', 'adult'], min: 60, max: 150 },
  { title: 'Gift card', emoji: '💳', detail: 'Tienda, juegos o música', ages: ['teen', 'adult'], min: 30, max: 200 },
  { title: 'Accesorios para celular', emoji: '📱', detail: 'Funda, cargador, soporte (modelo del celular)', ages: ALL_GROWN, min: 25, max: 80 },
  { title: 'Lámpara LED o luces para el cuarto', emoji: '💡', detail: 'Color o tira de luces', ages: ['preteen', 'teen'], min: 30, max: 80 },
  { title: 'Zapatillas', emoji: '👟', detail: 'Talla y marca', ages: ['kid', 'preteen', 'teen', 'adult'], min: 120, max: 350 },

  // Adultos
  { title: 'Taza o termo', emoji: '☕', detail: 'Para café o té; tamaño', ages: ['adult', 'senior', 'teen'], min: 20, max: 70 },
  { title: 'Billetera o monedero', emoji: '👛', detail: 'Color y material', ages: ['adult', 'senior', 'teen'], min: 40, max: 120 },
  { title: 'Perfume o colonia', emoji: '🌸', detail: 'Aroma o marca preferida', ages: ['teen', 'adult', 'senior'], min: 60, max: 250 },
  { title: 'Set de cuidado personal', emoji: '🧴', detail: 'Cremas, jabones o kit de afeitar', ages: ['adult', 'senior'], min: 40, max: 120 },
  { title: 'Libro', emoji: '📕', detail: 'Autor o género favorito', ages: ['teen', 'adult', 'senior'], min: 30, max: 80 },
  { title: 'Utensilios de cocina', emoji: '🍳', detail: 'Sartén, cuchillos, tablas…', ages: ['adult', 'senior'], min: 40, max: 150 },
  { title: 'Planta o macetero', emoji: '🪴', detail: 'De interior, fácil de cuidar', ages: ['adult', 'senior'], min: 25, max: 70 },
  { title: 'Bufanda, gorro o guantes', emoji: '🧣', detail: 'Color', ages: ['adult', 'senior', 'teen'], min: 30, max: 80 },
  { title: 'Polo o camisa', emoji: '👔', detail: 'Talla y color', ages: ['teen', 'adult', 'senior'], min: 40, max: 120 },
  { title: 'Organizador de escritorio o agenda', emoji: '🗂️', detail: 'Agenda del año que viene', ages: ['teen', 'adult'], min: 25, max: 60 },
  { title: 'Botella de vino o licor', emoji: '🍷', detail: 'Tipo preferido', ages: ['adult', 'senior'], min: 40, max: 150 },
  { title: 'Caja de chocolates o dulces', emoji: '🍫', detail: 'Sin azúcar si hace falta', ages: ['kid', 'preteen', 'teen', 'adult', 'senior'], min: 20, max: 60 },
  { title: 'Reloj', emoji: '⌚', detail: 'Digital o de agujas; color', ages: ['teen', 'adult', 'senior'], min: 60, max: 250 },
  { title: 'Herramientas', emoji: '🧰', detail: 'Set básico o una en especial', ages: ['adult', 'senior'], min: 50, max: 180 },

  // Abuelos
  { title: 'Manta o frazada', emoji: '🛋️', detail: 'Suave, tamaño individual', ages: ['senior', 'adult'], min: 50, max: 120 },
  { title: 'Pantuflas', emoji: '🥿', detail: 'Talla, con suela antideslizante', ages: ['senior', 'adult'], min: 30, max: 70 },
  { title: 'Marco de fotos con fotos familiares', emoji: '🖼️', detail: 'Con una foto de todos', ages: ['senior', 'adult'], min: 25, max: 70 },
  { title: 'Álbum de fotos', emoji: '📷', detail: 'Para llenar con recuerdos', ages: ['senior', 'adult'], min: 30, max: 80 },
  { title: 'Lupa con luz o lentes de lectura', emoji: '🔍', detail: 'Medida si la sabe', ages: ['senior'], min: 25, max: 60 },
  { title: 'Pastillero semanal', emoji: '💊', detail: 'Con días grandes y claros', ages: ['senior'], min: 15, max: 35 },
  { title: 'Bastón o cojín ortopédico', emoji: '🦯', detail: 'Altura o medida', ages: ['senior'], min: 40, max: 120 },
  { title: 'Radio portátil', emoji: '📻', detail: 'Con botones grandes', ages: ['senior'], min: 40, max: 120 },
];

/**
 * Ideas para una edad. Con presupuesto (en soles), solo las que se pueden
 * comprar con ese monto; las más baratas primero.
 */
export function giftIdeasFor(age: AgeGroup, budget: number | null, currency: string): GiftIdea[] {
  const usePrice = currency === 'PEN' && budget != null && budget > 0;
  return GIFT_IDEAS.filter((idea) => idea.ages.includes(age) && (!usePrice || idea.min <= budget)).sort(
    (a, b) => a.min - b.min || a.title.localeCompare(b.title, 'es'),
  );
}
