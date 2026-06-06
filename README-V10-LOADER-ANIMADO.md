# V10 - Loader animado real

El archivo anterior `assets/notifications/loading.gif` tenía extensión `.gif`, pero internamente era un PNG estático.
Por eso el loader no se movía.

Esta versión reemplaza el archivo por un GIF animado real y agrega versión en las referencias para evitar caché del navegador.

Archivos principales:
- `assets/notifications/loading.gif`
- `index.html`
- `js/app.js`
