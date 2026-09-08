# ATLAS v2 · Sanciones command center

Rediseño nativo de la superficie `sanciones` inspirado en la referencia visual aprobada.

## Composición

- filtros globales por universo, supervisor, región, tipología, año, monto y búsqueda;
- KPIs de universo, entidades, eventos, montos y supervisores;
- tarjetas de universos UAF / SII / OSFL;
- distribución por supervisor;
- concentración regional;
- tipología de sanciones;
- evolución anual;
- tabla de priorización analítica;
- ficha lateral con evidencia, recurrencia, documento público y salto a Entidad 360.

## Guardrails

- UAF, SII y OSFL son membresías superpuestas y sus conteos no se suman.
- `REGULATORY_SANCTION_OBSERVED` se mantiene separado de `CGR_ENFORCEMENT_ACTION`.
- CLP y UF se muestran por separado.
- prioridad analítica es una ayuda explicable de revisión y no una probabilidad LA/FT.
- no se inventan montos, estados, regiones ni documentos cuando la fuente no los publica.
