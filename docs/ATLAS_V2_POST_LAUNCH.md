# ATLAS 2.0 · Estado post-lanzamiento y decommission

## Estado de autoridad

Desde el lanzamiento de ATLAS v2, la entrada productiva `index.html` tiene una única autoridad: `ATLAS_V2_ANALYTICS`.

La identidad productiva formal es:

- Release: `2.0.0`
- Build: `2000`
- Contrato de producto: `ANALYTICS_FIRST`
- Seguimiento: opcional, no workflow obligatorio
- Boundary de datos: `ATLAS_V2_READ_GATEWAY`
- Boundary de autenticación: Entra + Supabase Auth + allowlist con usuario verificado
- Política de superficies estructurales: `FAIL_CLOSED`

`legacy.html` conserva de manera explícita el runtime `0.96.4 / 0964` únicamente como rollback congelado. No compite por rutas, navegación ni autoridad en la entrada productiva.

## Superficies productivas v2

La autoridad v2 está compuesta por las superficies analíticas nativas:

- Explorar
- Universos
- Entidad 360
- Gasto Público
- Territorio
- Relaciones
- Vigilancia
- Guardados
- Método y datos

Las fuentes SII, UAF/SO, OSFL, RES y Sanciones se consumen como lentes/contratos analíticos y no como aplicaciones independientes dentro de la shell.

## Principio analítico

ATLAS no se convierte en gestor obligatorio de casos. El ciclo principal sigue siendo:

`PREGUNTA → UNIVERSO → SEÑAL → EVIDENCIA → RELACIÓN → PROFUNDIZACIÓN → NUEVA PREGUNTA`

Guardar, seguir o registrar una nota puede existir como continuidad opcional, pero no condiciona la exploración.

Guardarraíles obligatorios:

- Prioridad ≠ probabilidad.
- Faltante ≠ cero.
- No observado ≠ inexistente.
- IGR territorial ≠ riesgo de la entidad.
- CEAD es contexto territorial, no atribución individual.
- Sanción administrativa ≠ evidencia AML/FT por sí sola.
- Una relación no transfiere riesgo entre nodos.
- Una hipótesis no crea una arista documentada.
- `REMOVED` en Vigilancia ≠ resuelto o cerrado.

## Componentes de transición retirados

Después del lanzamiento se retiraron las autoridades creadas sólo para migración o preview:

- shadow preview de v2;
- preview config de v2;
- takeover adapter de Gasto Público y sus estilos;
- route bridge de Gasto Público;
- shadow runtime de Gasto Público;
- builder de cutover histórico;
- E2E específico del cutover de Gasto Público;
- workflow de shadow preview;
- workflow E2E del cutover de Gasto Público;
- workflow de validación del cutover histórico.

La superficie `public-spend-surface` y los contratos gobernados permanecen como implementación productiva.

## E2E y seguridad post-lanzamiento

El principal E2E productivo se crea únicamente desde el workflow `e2e-atlas-runtime-smoke.yml` ejecutado sobre `refs/heads/main`, mediante GitHub OIDC con audiencia `atlas-v2-e2e`.

El broker no admite PRs, refs de pull request ni ramas de arquitectura histórica. Los principales E2E son efímeros y el workflow ejecuta limpieza al finalizar.

El E2E productivo comprueba:

- autenticación y autorización;
- nueve rutas v2;
- lecturas gobernadas y trace IDs;
- Entidad 360 con single-read real;
- responsive móvil/tablet;
- supervivencia de la shell ante una falla de red;
- autoridad v2 en el artefacto primario;
- fallback legacy disponible pero inactivo en `/`.

## Qué se conserva deliberadamente

Los fragmentos CSS/JS y el builder del runtime histórico necesarios para construir `legacy.html` se conservan mientras el rollback siga formalmente habilitado.

Su presencia en el repositorio o artefacto no les otorga autoridad productiva: `index.html` no los carga.

No se deben eliminar por etapas aisladas, porque un rollback parcialmente desmantelado es peor que un rollback explícitamente congelado.

## Criterios para retirar definitivamente `legacy.html`

La eliminación final del runtime 0.96.4 sólo corresponde cuando se cumplan conjuntamente estas condiciones:

1. ATLAS 2.0 mantiene gates estáticos verdes en `main`.
2. E2E autenticado post-merge permanece verde con todas las superficies críticas.
3. El deploy y smoke live verifican de forma estable la autoridad v2.
4. No existen rutas funcionales que requieran volver a legacy para completar una tarea analítica soportada por v2.
5. La organización ya no requiere el rollback operativo como contingencia.

Hasta entonces el rollback se considera `FROZEN_ROLLBACK_ONLY`: disponible, verificable y sin evolución funcional.

## Deuda de plataforma separada

Hay controles de hosting/plataforma que no deben confundirse con la arquitectura funcional de ATLAS:

- En GitHub Pages, `frame-ancestors` no obtiene protección efectiva cuando sólo se declara mediante meta CSP; una política anti-framing fuerte requiere headers HTTP en un origen controlado.
- La protección de contraseñas filtradas de Supabase debe evaluarse como hardening de plataforma; el acceso ordinario de ATLAS utiliza Microsoft Entra.

Estas observaciones no autorizan a relajar autenticación, RLS, gateway ni allowlist en ATLAS v2.

## Regla de evolución

Toda nueva capacidad entra en v2. No se agregan nuevos parches al runtime 0.96.4.

Cuando una autoridad v2 reemplaza una transición o compatibilidad histórica y sus gates pasan, la pieza reemplazada se elimina en lugar de quedar superpuesta.
