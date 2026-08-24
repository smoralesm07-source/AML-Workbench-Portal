-- ATLAS AML 0.50.0 · retiro de la captura de desenlace del analista.
--
-- Mismo criterio que en 0.49.0 con las colas de Validación y Descubrimiento: la
-- aplicación no hace gestión de casos. Registrar el veredicto del analista sobre
-- una entidad es precisamente eso, así que la captura cae con ellas.
--
-- Esto deja sin etiqueta al score. Es una consecuencia asumida, no un descuido:
-- el desenlace era la única fuente de etiqueta viable identificada, y sin él la
-- calibración se sostiene sólo sobre la distribución observada (percentiles),
-- que es lo que la vista aml_v0460_score_calibration sigue entregando.
--
-- Verificado antes de eliminar:
--   aml_disposition   0 filas
--   dependientes fuera de este conjunto: ninguno (revisado en pg_depend)
--
-- Se elimina en orden inverso de dependencia y SIN CASCADE.
--
-- NO se toca, porque sigue en uso:
--   aml_v0460_score_calibration   bandas de score por percentil, en la interfaz
--
-- Corrige además la nota de atlas_v0490_drop_orphaned_queue_objects.sql, que
-- listaba estos dos objetos como "en uso": lo estaban en ese momento y dejan de
-- estarlo aquí. Ese archivo no se edita: registra lo que hizo su migración.
--
-- La definición retirada queda en el historial de git, en el archivo
-- atlas_v0460_analyst_disposition.sql, renombrado en este commit a
-- atlas_v0460_score_calibration.sql con sólo la vista que sobrevive.

drop view  if exists public.aml_v0460_entity_disposition_current;
drop table if exists public.aml_disposition;
