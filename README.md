# AML Analytical Workbench Portal

Frontend estático del AML Analytical Workbench.

## Seguridad

- Este repositorio es público y **no contiene datos Fusion**.
- El frontend sólo contiene la URL del proyecto y la publishable key de Supabase, diseñada para uso en cliente.
- La autenticación se realiza mediante Microsoft Entra ID a través de Supabase Auth.
- La autorización se realiza en `aml_allowed_users` y las tablas AML están protegidas por Row Level Security (RLS).
- No se debe incluir aquí `service_role`, secret keys, client secrets de Entra, exports AML ni snapshots con datos.
- Las búsquedas se auditan como SHA-256 + longitud; el texto libre no se persiste por defecto.

## Publicación

GitHub Pages publica `main` desde la raíz del repositorio.
