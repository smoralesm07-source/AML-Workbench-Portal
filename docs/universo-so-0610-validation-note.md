# Validación de datos Universo SO 0.61

Validación ejecutada sobre Supabase el 25-08-2026:

- 9.782 sujetos obligados en `aml_uaf_entity_profile`.
- 512 entidades adicionales observadas por fuente UAF, todas `Organismo público` y sin perfil de sujeto obligado.
- 10.294 entidades UAF observadas = 9.782 SO + 512 organismos públicos.
- 52 grafías sectoriales en el padrón.
- 49 sectores canónicos poblados en el snapshot.
- 55 sectores/categorías en el catálogo canónico.
- 9.701 sujetos con regla de reportabilidad sectorial enlazada.
- 81 sujetos sin correspondencia exacta entre sector canónico y `aml_reporting_rules`.

Estos conteos se exponen mediante `aml_v_uaf_universe_integrity_0610` y `aml_v_uaf_reporting_obligation_0610`.
