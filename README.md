# AML Analytical Workbench Portal

Frontend estático y autenticado del **AML Analytical Workbench**.

## v0.16

Entity 360 integra, bajo sesión + RLS:

- condición de sujeto obligado observada en el corte público UAF;
- reglas de reportabilidad ROS/ROE aplicables por sector, sin inferir reportes individuales;
- perfil tributario compacto del Radar SII para el universo Fusion: año comercial, tramo de ventas, trabajadores, actividad, vigencia, capital propio, domicilios y relaciones;
- hallazgos explicados como `hecho → algoritmo/cruce → evidencia → interpretación → guardrails`;
- sanciones administrativas diferenciando contexto regulatorio de vínculo LA/FT directo;
- Pattern Intelligence en español, mostrando tipo técnico, alcance y regla que origina cada alerta.

### Guardrails metodológicos

- prioridad analítica ≠ probabilidad de delito;
- `strength` de Pattern Intelligence = fuerza/posición comparativa de regla, no probabilidad;
- tramo de ventas SII ≠ monto exacto de ventas;
- ausencia de dato ≠ cero;
- no observado en el corte público UAF ≠ no inscrito / no obligado;
- información agregada ROS ≠ comportamiento de reporte de una entidad individual;
- sanción administrativa ≠ LA/FT;
- anomalía contextual ≠ señal AML;
- una relación o patrón sectorial no transmite riesgo a una entidad.

## Seguridad

- Este repositorio es público y **no contiene datos Fusion**.
- El frontend sólo contiene la URL del proyecto y la publishable key de Supabase, diseñada para uso en cliente.
- La autenticación se realiza mediante Microsoft Entra ID a través de Supabase Auth.
- La autorización se realiza en `aml_allowed_users` y las tablas AML están protegidas por Row Level Security (RLS).
- Los perfiles tributarios y reglas de reportabilidad son sólo lectura desde el navegador.
- El enriquecimiento SII entra por un workflow gobernado con GitHub OIDC; el navegador no posee credenciales privilegiadas.
- No se debe incluir aquí `service_role`, secret keys, client secrets de Entra, exports AML ni snapshots con datos.
- Las búsquedas se auditan como SHA-256 + longitud; el texto libre no se persiste por defecto.

## Publicación

GitHub Pages publica `main` desde la raíz del repositorio.
