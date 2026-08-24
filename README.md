# AML Analytical Workbench Portal

Frontend estático y autenticado del **AML Analytical Workbench**.

## v0.51.1 — Entidades: exploración y caracterización profunda

La sección **Entidades** se reconstruyó completa (`docs/entity-intelligence-0510.md`).

- **Explorador gobernado:** búsqueda por razón social multi-token e insensible a
  tildes, RUT normalizado a forma canónica o Entity ID, con facetas de
  territorio, tipo, condición UAF, condición sancionatoria y cobertura mínima de
  fuentes; lectura del conjunto resultante y ficha rápida lateral por entidad.
- **Expediente 360 enriquecido:** procedencia de identidad y vínculos candidatos,
  posición frente a pares comparables, trayectoria observada, estructura
  declarada, registro UAF, perfil OSFL/FATF R8, descomposición IPA3 v0.4-shadow
  marca por marca con su evidencia de cálculo, y resolución de identidad de cada
  evento sancionatorio.
- **Lecturas por snapshot:** las consultas por entidad dejan de recomputar
  ventanas sobre todo el universo (de 6 s a 4 ms en el puntaje, de 3,4 s a 1 ms
  en las marcas).
- **Diseño gráfico primero (0511):** huella de productores, firma de marcas y
  barra IPA3 repetidas en todas las superficies; el conjunto se lee con
  histograma de prioridad y matriz cobertura × condición; el expediente dibuja
  la serie tributaria por año, la recurrencia sancionatoria sobre un eje
  temporal y la cascada de cálculo de cada marca. Los guardarraíles se
  concentran en paneles de reglas en vez de repetirse bajo cada tarjeta.

Las reglas de lectura no cambian: prioridad no es probabilidad, percentil es
posición y no desempeño, un vínculo candidato no promueve identidad, y una
entidad ausente de un corte se declara vacía y nunca como cero.

## v0.17 — experiencia orientada al analista

La capa visible deja de exponer el lenguaje interno del motor como elemento principal. La navegación se organiza en:

- **Panorama:** qué está pasando y qué merece atención inmediata;
- **Entidades:** perfil analítico y trazable por nombre, RUT o Entity ID;
- **Hallazgos:** señales priorizadas para Explorar, Fiscalizar o Investigar;
- **Sanciones:** eventos administrativos presentados como hechos y con su alcance explícito;
- **Fenómenos:** comportamientos agregados o comparativos útiles para orientar una línea de análisis.

### Explicabilidad

La regla de lectura es:

`hecho → cálculo → evidencia → interpretación`

Cada score o índice analítico puede abrir **Cómo se calculó**, mostrando fórmula, pesos, factores utilizados y aporte de cada componente. Las fuentes y Evidence IDs se consultan desde **Fuentes y evidencia**. Los identificadores técnicos se conservan para trazabilidad, pero no dominan la lectura principal.

Los scores operativos se muestran de a uno según el objetivo elegido:

- **Explorar:** primera detección de señales;
- **Fiscalizar:** cobertura regulatoria, reiteración y evidencia observable;
- **Investigar:** profundización de entidades, hechos y relaciones.

Un score ausente se representa como `—`, nunca como cero.

### Temporalidad y precisión

- Las métricas globales se consultan mediante conteos exactos bajo la sesión y RLS actuales.
- Cuando una tabla limita el número de tarjetas visibles, la interfaz indica explícitamente **mostrando N de total**.
- La serie de sanciones de cinco años se calcula desde `event_date` con conteos exactos por año.
- No se fabrica historia usando `updated_at` ni snapshots actuales. Otras series de cinco años se incorporarán cuando Fusion materialice temporalidad comparable y gobernada para esas familias.

### Exportación normalizada

- Hallazgos: exportación CSV de las filas visibles, conservando IDs y scores operativos.
- Entity 360: paquete JSON `AML_ANALYST_TRANSFER_V1` con entidad, perfil tributario, reglas de reportabilidad disponibles, hallazgos, hechos/factores de cálculo, productores, evidencia, sanciones y fenómenos, manteniendo separado el contexto sectorial.

### Guardrails metodológicos

- prioridad analítica ≠ probabilidad de delito;
- índice comparativo ≠ probabilidad de LA/FT;
- tramo de ventas SII ≠ monto exacto de ventas;
- ausencia de dato ≠ cero;
- no observado en el corte público UAF ≠ no inscrito / no obligado;
- información agregada ROS ≠ comportamiento de reporte de una entidad individual;
- sanción administrativa ≠ LA/FT;
- anomalía contextual ≠ señal AML;
- una relación o fenómeno sectorial no transmite riesgo a una entidad;
- confianza y cobertura describen calidad/alcance de evidencia, no riesgo.

## Seguridad

- Este repositorio es público y **no contiene datos Fusion**.
- El frontend sólo contiene la URL del proyecto y la publishable key de Supabase, diseñada para uso en cliente.
- La autenticación se realiza mediante Microsoft Entra ID a través de Supabase Auth.
- La autorización se realiza en `aml_allowed_users` y las tablas AML están protegidas por Row Level Security (RLS).
- Los perfiles tributarios y reglas de reportabilidad son sólo lectura desde el navegador.
- El enriquecimiento SII entra por un workflow gobernado con GitHub OIDC; el navegador no posee credenciales privilegiadas.
- No se debe incluir aquí `service_role`, secret keys, client secrets de Entra, exports AML ni snapshots con datos.
- Las búsquedas se auditan como SHA-256 + longitud; el texto libre no se persiste por defecto.

## Documentación UX

La especificación detallada de experiencia y reglas de presentación está en `UX_V017.md`.

## Publicación

GitHub Pages publica `main` desde la raíz del repositorio. La v0.17 permanece en una rama/PR hasta ser revisada y aprobada.
