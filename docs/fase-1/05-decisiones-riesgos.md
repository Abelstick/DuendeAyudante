# 5. Decisiones y riesgos

## 5.1. Decisiones de arquitectura

| ID | Decisión | Alternativa descartada | Motivo |
|---|---|---|---|
| A1 | **v1 = solo frontend (Render Static Site) conectado directamente a Supabase.** Sin servidor Node. *(Decidido por el usuario el 2026-11-14.)* | API REST Node + SPA | Despliegue rápido y gratuito; el Static Site no se duerme. Se aparta del §2 del prompt maestro. |
| A2 | Clean Architecture **dentro del frontend**: dominio, casos de uso, contratos de repositorio y `Supabase*Repository` en `infrastructure/`. | Llamar a Supabase desde hooks o componentes | Permite agregar después una API (`Http*Repository`) cambiando solo `container.ts`. |
| A3 | Reglas en PostgreSQL: **RLS** (permisos), **restricciones y triggers** (validación y normalización) y **RPC** (amigo secreto, marcar responsabilidad, votar). | Todo en el frontend | El navegador no es de confianza. |
| A4 | **Cuentas creadas por el administrador** (usuario + contraseña) mediante **Edge Functions de Supabase** (`create-member`, `reset-member-password`, `disable-member`). *(Decidido por el usuario el 2026-11-14.)* | Registro libre por enlace / sesiones anónimas | Crear usuarios requiere la clave `service_role`, que solo puede vivir en el servidor. Las Edge Functions las aloja Supabase: no hay servidor que mantener. |
| A5 | Login por **usuario** (sin correo): internamente se usa un correo ficticio `usuario@usuarios.<dominio>` que nunca recibe mensajes. Queda encapsulado en `SupabaseAuthService`. | Pedir correo real | Los familiares no tienen correo o no lo usan. |
| A6 | Inyección de dependencias **manual** en `container.ts`. | InversifyJS / tsyringe | Suficiente para este tamaño. |
| A7 | Un solo proyecto Vite + carpeta `supabase/` (migraciones, funciones, pruebas). | Monorepo | No hay backend Node que comparta código. |
| A8 | Pruebas: Vitest (unitarias), Supabase local con distintos usuarios (integración), pgTAP (RLS y RPC), Playwright con viewports móviles (e2e). | — | Las pruebas de RLS son las pruebas de seguridad más importantes en esta arquitectura. |

## 5.2. Decisiones de negocio

### Decididas por el usuario (2026-11-14)

| ID | Decisión |
|---|---|
| D1 | El organizador (o un administrador) **crea los usuarios y contraseñas** y se los envía a cada familiar, por ejemplo por WhatsApp. No hay registro libre ni se pide correo a los familiares. |
| D2 | Roles: **organizador/administrador**, **editor** (apoya en la organización) y **participante**. |
| D3 | Los participantes **agregan sus regalos** (nombre, descripción y **varios enlaces**), **ven** las responsabilidades, **marcan las suyas como hechas** y **proponen** juegos o actividades. Solo administradores y editores crean responsabilidades. |
| D3b | **Sin fotos en la v1.** Se agregarán después. |
| D7 | Los niños pueden tener **usuario propio o no**; en ambos casos sus padres pueden ser **tutores** y manejar sus regalos. |
| D15 | Cada familiar **puede** cambiar su contraseña desde Perfil; no se le obliga. |
| D16 | Los editores **no** crean usuarios ni restablecen contraseñas. |
| D22 | **Código de la Navidad** *(2026-11-14)*: el organizador lo elige al crear la Navidad (la app sugiere uno a partir del nombre, ej. `GARCIA25`). Es único en la plataforma. **El organizador o un administrador puede cambiarlo** (Edge Function `change-join-code`, que también actualiza los accesos de los familiares); los códigos anteriores quedan guardados y siguen funcionando, así los mensajes ya enviados no se rompen. Los familiares entran con **código + usuario + contraseña**; el enlace de WhatsApp ya trae el código y el usuario. |
| D23 | **Usuarios cortos y únicos por Navidad** *(2026-11-14)*: `rosa`. Si ya existe en esa Navidad, se sugiere `rosa.garcia` y luego `rosa2`; el organizador puede escribir otro. Dos Navidades distintas pueden tener cada una su `rosa`. |
| D24 | **Identidad de color por familia** *(2026-11-14)*: nueve colores (incluido **blanco**, que en pantalla usa un gris azulado "nieve" para que se distinga). Toda la interfaz de cada persona —encabezado, menú, botones, cuenta regresiva y fondo— toma el color de su familia. Contraste de texto verificado con pruebas automáticas (≥ 4.5:1). **Pendiente:** mascotas e ilustraciones por familia. |
| D17 | Las ideas de juegos y actividades **entran directo, sin aprobación**. No se permiten dos juegos activos con el mismo nombre, y se sugieren los parecidos. Administradores y editores pueden **fusionar** juegos parecidos en uno existente o en uno nuevo que combine las dinámicas. |

### Pendientes de confirmar (se aplica la recomendación si no indicas otra cosa)

| ID | Pregunta | Recomendación | Alternativas |
|---|---|---|---|
| D4 | ¿Un participante pertenece a **una sola** familia? | **Sí, una.** | Varias familias. |
| D5 | Votación de juegos: ¿cuántos votos? | **Hasta 3 por persona, máximo 1 por juego.** % de aceptación = votos ÷ personas que votaron. | 1 voto por persona. |
| D6 | Fusionar responsabilidades y aportes. | **Sí**, una tabla con `kind`; en pantalla se ven como secciones distintas. | Dos tablas. |
| D8 | Sellado del amigo secreto. | Al sellar, ni el organizador ve las parejas (solo conteos); abrir el sello queda registrado. | El organizador siempre ve todo. |
| D9 | Color de vestimenta. | **Es el color de la familia**, más una nota opcional ("Polo rojo"). | Configuración aparte. |
| D10 | ¿Quién participa del intercambio? | **Todos los participantes activos** (incluidos niños); el organizador puede quitar a alguien. | Inscripción voluntaria. |
| D11 | Precio por encima del presupuesto (S/ 65). | **Aviso amable, no bloquea.** | Bloquear. |
| D12 | Varios intercambios por evento. | Modelo preparado; **la interfaz de la v1 maneja uno**. | — |
| D13 | Homónimos. | Duplicado exacto → el administrador agrega un dato que los diferencie (MADRE/HIJA). Usuarios distintos (`rosa.garcia`, `rosa.garcia2`). | — |
| D14 | Idioma, moneda y zona horaria. | Español (Perú), `PEN`, `America/Lima`; editable por evento. | — |
| D18 | Pantalla de inicio de sesión. | **"Mostrar contraseña" activado por defecto** y botón grande "Entrar". | Contraseña oculta. |
| D19 | Máximo de enlaces por regalo. | **5.** | Sin límite. |
| D20 | Al fusionar juegos, ¿qué pasa con los votos? | **Pasan al juego resultante**, y quien votó por varios de los fusionados cuenta una sola vez (se le devuelven los votos sobrantes). | Reiniciar los votos del juego fusionado. |
| D21 | ¿Quién puede editar o quitar una idea de juego? | **Quien la propuso** y los administradores y editores. | Solo administradores y editores. |

## 5.3. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Toda la seguridad depende de RLS, las RPC y las Edge Functions.** Un error en una política expone datos. | Alto | RLS en todas las tablas (prueba de CI), pgTAP por tabla y por rol, revisión de cada RPC y Edge Function. |
| El administrador conoce las contraseñas iniciales; se envían por WhatsApp. | Bajo (contexto familiar) | Enviar por chat individual; contraseña cambiable desde Perfil; restablecer cuando alguien la olvide. |
| Un familiar olvida o pierde su contraseña. | Medio | Mensaje claro: "Pídele una nueva a ‹organizador›"; el administrador la restablece en 2 toques; la sesión del teléfono dura mucho. |
| Correo ficticio interno: si el dominio perteneciera a alguien, podría recibir un enlace de "recuperar contraseña" y tomar la cuenta. | Alto si se elige mal | Se usa el dominio reservado **`.invalid`** (RFC 2606), que nunca recibe correo. Pendiente: confirmar en el proyecto real que Supabase lo acepta. |
| Sesión (JWT) en `localStorage`: un XSS podría robarla. | Medio | CSP estricta, nada de HTML de usuarios, sin scripts de terceros. |
| Plan gratuito de Supabase **pausa proyectos** tras 7 días sin actividad. | Medio | Plan Pro durante la temporada o actividad periódica. |
| Navegador interno de WhatsApp con comportamiento distinto. | Medio | Pruebas reales en Android e iPhone. |
| Alcance grande. | Alto | Entregar primero el flujo mínimo (ver 5.4) y sumar módulos después. |
| Migración futura a SQL Server. | Medio | Requiere primero una API Node que absorba RLS, RPC y Edge Functions; la SPA y los casos de uso no cambian. |

## 5.4. Primera entrega propuesta (flujo mínimo desplegable)

1. El organizador crea su cuenta y su evento.
2. Crea familias y familiares (usuario + contraseña) y les envía el acceso por WhatsApp.
3. El familiar entra, agrega sus regalos con descripción y enlaces, y los vuelve a consultar.
4. Todos ven las listas de todos.

Después: responsabilidades (ver y marcar), juegos y votación, amigo secreto, cronograma, anuncios y checklist.

## 5.5. Lo que necesito de ti

- Confirmar o ajustar las pendientes: D4–D6, D8–D14 y D18–D21.
- Proyecto de Supabase creado (o lo preparo para correr en local con **Docker + Supabase CLI** y lo subes después).
- Plan de Supabase para la temporada (el gratuito pausa el proyecto tras 7 días sin uso).
