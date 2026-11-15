# 🎄 Navidad en Familia

Plataforma web para organizar celebraciones navideñas familiares: listas de regalos, amigo secreto,
responsabilidades, juegos, votaciones, cronograma y anuncios.

**Estándar de calidad:** una persona recibe su usuario por WhatsApp, entra, agrega sus opciones de regalo y
participa sin aprender a usar una aplicación complicada.

## Estado

| Entrega | Estado |
|---|---|
| Análisis y arquitectura | ✅ [docs/](docs/README.md) |
| **Primera entrega**: evento, familias, familiares con usuario y contraseña, acceso por WhatsApp, regalos con enlaces | ✅ Código y pruebas listos · ⏳ falta conectar a tu proyecto de Supabase |
| Responsabilidades (ver y marcar) | ⏳ |
| Juegos, votación y ruleta | ⏳ |
| Amigo secreto | ⏳ |
| Cronograma, anuncios y checklist | ⏳ |
| Mascotas e ilustraciones por familia | ⏳ (la identidad de color por familia ya está) |

## Tecnología

React + TypeScript + Vite + Tailwind · TanStack Query · React Hook Form + Zod · Supabase (PostgreSQL con RLS, Auth y
Edge Functions) · Render Static Site.

## Empezar

Ver **[docs/puesta-en-marcha.md](docs/puesta-en-marcha.md)**.

```powershell
npm install
npm test
npm run dev
```
