# Dream Team de Calidad — V6 Estable

Esta versión vuelve a una base estable y evita depender de tablas nuevas para banner, mascota y equipo.

## Principios de esta versión

- No usa `banners`, `mascot_items` ni `team_members` como tablas obligatorias.
- Banner, mascota, equipo y Visual Studio se guardan en `system_settings` y en localStorage como respaldo.
- Apps, noticias, auditorías, documentos y publicaciones se leen desde tus tablas existentes.
- Si Supabase falla en una tabla, la página no se cae.
- El banner permite imagen/GIF/video 4:1 y el texto queda abajo.
- Mascota permite carrusel hasta 15 archivos.
- Loader usa `Circle Loading Sticker by MotionIsland` si está disponible.
- Visual Studio permite opacidad de fondo y loop de video.
- No incluye Service Worker agresivo.

## Archivos principales

- `index.html`
- `css/styles.css`
- `js/app.js`
- `js/config.js`
- `supabase/sql-v6-seguro.sql`

## SQL

Ejecutar `supabase/sql-v6-seguro.sql`. No borra datos ni inserta datos demo.
