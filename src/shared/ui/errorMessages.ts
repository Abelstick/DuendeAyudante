import { isAppError } from '@/shared/domain/errors';

/**
 * Mensajes en lenguaje cotidiano que dicen exactamente qué hacer.
 * Nunca se muestran términos técnicos.
 */
const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'El código, el usuario o la contraseña no coinciden. Revisa el mensaje de WhatsApp que te enviaron e inténtalo de nuevo.',
  EMAIL_NOT_CONFIRMED: 'Todavía no confirmaste tu correo. Abre el correo que te enviamos y toca el enlace de confirmación.',
  WRONG_PASSWORD: 'Esa no es tu contraseña. Revísala e inténtalo de nuevo.',
  TOO_MANY_ATTEMPTS: 'Hubo demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.',
  NETWORK: 'No pudimos conectarnos. Revisa tu internet y vuelve a intentarlo.',
  NOT_AUTHENTICATED: 'Tu sesión terminó. Vuelve a entrar con tu usuario y contraseña.',
  EMAIL_TAKEN: 'Ya existe una cuenta con ese correo. Toca "Ya tengo cuenta" para entrar.',
  EMAIL_INVALID: 'Ese correo no es válido. Escribe tu correo personal.',
  SIGNUP_FAILED: 'No pudimos crear la cuenta. Revisa el correo y vuelve a intentarlo.',
  PASSWORD_INVALID: 'La contraseña debe tener al menos 8 caracteres.',
  SAME_PASSWORD: 'La nueva contraseña es igual a la anterior. Escribe una distinta.',

  FIRST_NAME_INVALID: 'Escribe el nombre usando solo letras (puede llevar tildes).',
  PATERNAL_SURNAME_INVALID: 'Escribe el apellido paterno usando solo letras.',
  MATERNAL_SURNAME_INVALID: 'Escribe el apellido materno usando solo letras, o déjalo vacío.',
  DISTINGUISHING_NOTE_INVALID: 'El dato para diferenciar es muy largo. Usa una o dos palabras (ej. HIJO).',
  DUPLICATE_NAME: 'Ya existe alguien con ese mismo nombre. Escribe un dato para diferenciarlos (por ejemplo HIJO o MADRE).',
  USERNAME_INVALID: 'El usuario debe tener entre 2 y 30 letras o números, sin espacios ni tildes (ej. rosa).',
  USERNAME_TAKEN: 'Ya hay alguien con ese usuario en esta Navidad. Agrega un número o el apellido (ej. rosa2 o rosa.garcia).',
  ACCOUNT_REQUIRED_FOR_ROLE: 'Para ser editor o administrador, la persona necesita su propio usuario.',
  ONLY_OWNER_CAN_CREATE_ADMINS: 'Solo el organizador puede nombrar administradores.',
  ACCOUNT_NOT_CREATED: 'No pudimos crear el usuario. Inténtalo de nuevo en un momento.',
  MEMBER_WITHOUT_ACCOUNT: 'Esta persona no tiene usuario propio.',
  GUARDIAN_NOT_FOUND: 'No encontramos al familiar responsable elegido. Vuelve a elegirlo.',
  FAMILY_NOT_FOUND: 'Esa familia ya no existe. Elige otra.',

  EVENT_CODE_NOT_FOUND: 'No encontramos una Navidad con ese código. Revisa el código en el mensaje de WhatsApp que te enviaron.',
  JOIN_CODE_NOT_CHANGED: 'No pudimos cambiar el código. No se cambió nada; inténtalo de nuevo en un momento.',
  JOIN_CODE_INVALID: 'El código debe tener entre 4 y 20 letras o números, sin espacios (ej. GARCIA25).',
  JOIN_CODE_TAKEN: 'Ese código ya lo usa otra Navidad. Prueba agregando un número o una palabra (ej. GARCIA25LIMA).',
  EVENT_NAME_INVALID: 'Escribe un nombre para tu Navidad.',
  DESCRIPTION_TOO_LONG: 'La descripción es muy larga (máximo 1000 letras).',
  BUDGET_INVALID: 'Escribe un presupuesto mayor a cero (ej. 65).',
  DATE_INVALID: 'Revisa la fecha y la hora.',
  TIMEZONE_INVALID: 'La zona horaria no es válida.',
  EVENT_LIMIT_REACHED: 'Llegaste al máximo de 10 celebraciones activas.',
  NOT_A_MEMBER: 'No formas parte de esta celebración. Pide al organizador que te agregue.',

  CHECKLIST_TITLE_INVALID: 'Escribe qué hay que hacer (ej. Confirma tu asistencia).',
  CHECKLIST_FAMILY_REQUIRED: 'Elige la familia a la que le corresponde esta tarea.',
  CHECKLIST_PERSON_REQUIRED: 'Elige la persona a la que le corresponde esta tarea.',
  RESPONSIBILITY_TITLE_INVALID: 'Escribe qué hay que llevar o hacer (ej. Pavo al horno).',
  RESPONSIBLE_REQUIRED: 'Elige al menos un responsable: una persona o una familia.',
  STATUS_INVALID: 'Ese estado no es válido.',
  GAME_NAME_INVALID: 'Escribe el nombre del juego o actividad.',
  GAME_NAME_TAKEN: 'Ese juego ya está en la lista 🙂. Búscalo y vótalo, o usa otro nombre si es distinto.',
  PLAYERS_RANGE_INVALID: 'El mínimo de participantes no puede ser mayor que el máximo.',
  NUMBER_INVALID: 'Escribe solo números enteros (ej. 15).',
  POLL_CLOSED: 'La votación no está abierta en este momento.',
  VOTE_LIMIT_REACHED: 'Ya usaste todos tus votos. Si quieres votar por otro, primero quita uno.',
  GAME_NOT_VOTABLE: 'Este juego ya no se puede votar.',
  MERGE_NEEDS_TWO_GAMES: 'Elige al menos dos juegos para unirlos.',
  MERGE_TARGET_INVALID: 'Elige con cuál de los juegos te quedas.',
  MAX_VOTES_INVALID: 'Elige entre 1 y 10 votos por persona.',
  SECRET_FRIEND_SELF: 'No puedes ser tu propio amigo secreto 🙂. Elige a otra persona.',
  SCHEDULE_TITLE_INVALID: 'Escribe el nombre de la actividad (ej. Cena navideña).',
  SCHEDULE_END_BEFORE_START: 'La hora de fin debe ser después de la hora de inicio.',
  ANNOUNCEMENT_TITLE_INVALID: 'Escribe un título corto para el anuncio.',
  ANNOUNCEMENT_BODY_INVALID: 'Escribe el mensaje del anuncio.',
  FAMILY_NAME_INVALID: 'Escribe el nombre de la familia (ej. GARCÍA).',
  DUPLICATE_FAMILY: 'Ya existe una familia con ese nombre.',

  WISH_TITLE_INVALID: 'Escribe qué regalo te gustaría (ej. Polo, Colonia, Billetera).',
  WISH_DESCRIPTION_TOO_LONG: 'Los detalles son muy largos. Resúmelos un poco.',
  PRICE_INVALID: 'Escribe el precio solo con números (ej. 45 o 45.50), o déjalo vacío.',
  PRICE_RANGE_INVALID: 'El precio «hasta» debe ser igual o mayor que el precio «desde».',
  TOO_MANY_BRANDS: 'Puedes poner hasta 8 marcas por regalo.',
  BRAND_TOO_LONG: 'El nombre de una marca es muy largo. Usa un nombre más corto.',
  TOO_MANY_LINKS: 'Puedes poner hasta 5 enlaces por regalo.',
  LINK_INVALID: 'Uno de los enlaces no es válido. Cópialo de nuevo desde la tienda.',

  TOO_MANY_PHOTOS: 'Puedes poner hasta 6 fotos por regalo.',
  PHOTO_TOO_LARGE: 'La foto es muy pesada. Prueba con otra o tómala de nuevo.',
  PHOTO_TYPE_INVALID: 'Ese archivo no es una foto. Elige una imagen (JPG o PNG).',
  PHOTO_READ_FAILED: 'No pudimos abrir esa foto. Prueba con otra.',
  DRIVE_NOT_CONNECTED: 'Todavía no hay un Google Drive para guardar fotos. Pide a quien organiza que lo conecte.',
  DRIVE_NEEDS_RECONNECT: 'El Google Drive donde se guardan las fotos perdió el acceso. Pide a quien organiza que lo vuelva a conectar.',
  DRIVE_UPLOAD_FAILED: 'Google Drive no aceptó la foto. Vuelve a intentarlo en un momento.',
  GOOGLE_ERROR: 'Google no respondió. Vuelve a intentarlo en un momento.',
  GOOGLE_NOT_CONFIGURED: 'Las fotos con Google Drive todavía no están configuradas en el servidor.',
  ORIGIN_NOT_ALLOWED: 'No pudimos preparar la conexión con Google desde esta dirección.',

  SECRET_WORD_INVALID: 'La palabra secreta debe tener entre 4 y 20 letras o números, sin espacios (ej. PANETON).',
  SECRET_WORD_WRONG: 'Esa no es la palabra secreta. Revisa el mensaje de WhatsApp que te enviaron e inténtalo de nuevo.',
  FAMILY_LINK_NOT_FOUND: 'Este enlace no existe. Pide a quien organiza tu Navidad que te lo envíe otra vez.',
  FAMILY_LINK_LOCKED: 'Hubo demasiados intentos con una palabra equivocada. Espera 15 minutos y vuelve a intentarlo.',
  MEMBER_NOT_ELIGIBLE: 'Esta persona no puede entrar con el enlace. Debe entrar con su usuario y contraseña.',
  FAMILY_PASS_EXPIRED: 'No pudimos terminar de entrar. Toca tu nombre otra vez.',

  DELETE_CONFIRMATION_REQUIRED: 'Para confirmar, escribe la palabra BORRAR.',
  OWNER_NEEDS_SUCCESSOR: 'Antes de borrar tu cuenta, elige quién queda a cargo de cada celebración que organizas (o bórrala).',
  SUCCESSOR_INVALID: 'La persona elegida ya no es administradora de esa celebración. Cierra esta ventana, vuelve a abrirla y elige de nuevo.',

  ADDRESS_TOO_LONG: 'La dirección es muy larga (máximo 300 letras). Deja solo calle, número, distrito y una referencia corta.',

  EXPENSE_DESCRIPTION_INVALID: 'Escribe en qué se gastó (ej. Pavo, Bebidas).',
  AMOUNT_INVALID: 'Escribe el monto solo con números, mayor a cero (ej. 45 o 45.50).',
  EXPENSE_SHARES_REQUIRED: 'Elige entre quiénes se divide el gasto.',
  PAYMENT_RECEIVER_INVALID: 'Elige a quién se le pagó (una persona distinta de quien paga).',
  EXPENSE_KIND_INVALID: 'Ese tipo de registro no es válido.',
  PARTICIPANT_NOT_FOUND: 'Una de las personas elegidas ya no está en esta Navidad. Vuelve a elegir.',

  MESSAGE_EMPTY: 'Escribe tu mensaje.',
  MESSAGE_TOO_LONG: 'El mensaje es muy largo (máximo 1000 letras).',
  MESSAGE_RECIPIENT_REQUIRED: 'Elige para quién es el mensaje.',
  MESSAGE_TO_SELF: 'El mensaje tiene que ser para otra persona 🙂.',
  TOO_MANY_MESSAGES: 'Llegaste al máximo de 30 mensajes. Puedes cambiar o quitar alguno.',

  FUNCTION_NOT_DEPLOYED: 'Esta opción todavía no está activada en el servidor. Avísale a quien organiza la Navidad.',
  LINK_PREVIEW_UNAVAILABLE: 'Leer el enlace todavía no está activado. Llena los datos a mano; el enlace sí se guarda.',
  LINK_NOT_ALLOWED: 'Ese enlace no se puede leer. Copia el enlace de la página de la tienda.',
  LINK_PREVIEW_FAILED: 'No pudimos leer esa página (algunas tiendas no lo permiten). Llena los datos a mano; el enlace sí se guarda.',
  LINK_PREVIEW_EMPTY: 'Esa página no tiene datos del producto. Llena los datos a mano; el enlace sí se guarda.',

  FORBIDDEN: 'No tienes permiso para hacer esto.',
  NOT_FOUND_OR_FORBIDDEN: 'No puedes cambiar este regalo.',
  NOT_FOUND: 'No encontramos lo que buscas.',
};

export function errorMessage(error: unknown): string {
  // Para quien organiza: dice qué secreto falta en Supabase (solo el nombre, nunca el valor)
  if (isAppError(error) && error.code === 'GOOGLE_NOT_CONFIGURED' && Array.isArray(error.details.missing) && error.details.missing.length > 0) {
    return `Falta configurar en Supabase (Edge Functions → Secrets): ${error.details.missing.join(', ')}. Después vuelve a intentarlo.`;
  }
  if (isAppError(error)) return MESSAGES[error.code] ?? 'Algo salió mal. Vuelve a intentarlo en un momento.';
  return 'Algo salió mal. Vuelve a intentarlo en un momento.';
}
