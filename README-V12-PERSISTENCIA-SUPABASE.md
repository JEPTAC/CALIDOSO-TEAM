# V12 - Persistencia Supabase

Problema corregido:
- Banner, mascota y equipo podían quedar solo en localStorage.
- Por eso se veían en un PC, pero desaparecían en otro.

Cambio:
- `saveHomeSettings()` ahora permite guardar en Supabase a `super_admin` y `admin`.
- Si Supabase falla, muestra aviso claro.
- Se sigue usando `system_settings` con key `portal_home_settings_v6`.
- Los assets se suben al bucket público `portal-assets`.

Archivos:
- index.html
- js/app.js
- supabase/sql-v12-persistencia-supabase.sql
