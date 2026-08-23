-- ATLAS AML 0.49.0 · retiro de los objetos huérfanos de las colas.
--
-- Las secciones Descubrimiento y Validación se retiraron de la aplicación: no
-- corresponden al espíritu del producto, que no es gestión de casos. Estos
-- objetos eran sus únicos consumidores y quedaron sin uso.
--
-- Verificado antes de eliminar:
--   aml_sanction_identity_validation  0 filas
--   aml_finding_role                  7 filas de catálogo, sin datos capturados
--   ningún dependiente fuera de este conjunto
--
-- Se elimina en orden inverso de dependencia y SIN CASCADE: si algo inesperado
-- dependiera de estos objetos, la migración falla en vez de arrastrarlo.
--
-- NO se tocan, porque siguen en uso:
--   aml_disposition                        captura de desenlace, lente 06
--   aml_v0460_entity_disposition_current   ídem
--   aml_v0460_score_calibration            bandas de score por percentil
--
-- La definición de los objetos eliminados queda en el historial de git, en los
-- archivos atlas_v0460_sanction_identity_candidate.sql,
-- atlas_v0470_identity_validation.sql y
-- atlas_v0480_finding_role_and_discovery_queue.sql, retirados en este commit.

drop view  if exists public.aml_v0480_discovery_queue;
drop view  if exists public.aml_v0480_finding_classified;
drop table if exists public.aml_finding_role;

drop view  if exists public.aml_v0470_identity_validation_queue;
drop view  if exists public.aml_v0470_identity_validation_current;
drop view  if exists public.aml_v0460_sanction_identity_candidate;
drop table if exists public.aml_sanction_identity_validation;
