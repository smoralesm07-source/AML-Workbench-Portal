# Implementación 0.66

- Migración aplicada en Supabase: `atlas_v0660_potential_multisource_architecture`.
- Productores iniciales: `SII_ACTECO` y `RES`.
- SII conserva 79.449 como piso declarado hasta materialización individual.
- RES queda `ADAPTER_READY`; no se incorporan automáticamente los ~1,6 millones de RUT RES.
- Evidencias elegibles se consolidan por RUT y excluyen inscritos UAF.
- La vista de estado sólo declara autoritativo el total unificado cuando la línea base SII esté materializada.
