# Sujetos Obligados · build 0560

## Por qué existe esta sección

El padrón público de sujetos obligados de la UAF vive en el esquema desde el
primer día: 9.782 RUT, cada uno con el sector por el cual quedó obligado bajo la
Ley 19.913. Hasta 0.55 ese padrón sólo se usaba como una bandera booleana
(`is_uaf_observed`) que teñía otras pantallas. Ninguna superficie respondía la
pregunta con la que un fiscalizador empieza su día:

> De estos 9.782 inscritos, ¿a cuál miro primero, qué sé de él, y qué no sé.

Tres hechos del corte del 25-08-2026 motivaron el diseño:

| Hecho | Magnitud | Por qué importa |
| --- | --- | --- |
| Término de giro publicado en SII con inscripción vigente en el padrón UAF | 429 | Dos registros públicos se contradicen sobre el mismo RUT |
| Sujetos obligados sin perfil tributario de empresa | 2.110 | Todos son personas naturales: el vacío es esperable, no una brecha |
| Eventos sancionatorios de la UAF con `entity_id` nulo | 324 de 324 | Ninguna pantalla podía decir a qué sujeto obligado corresponde una sanción |

El tercero es el que más capacidad agrega. La sección atribuye **243 de esos 324
eventos a 213 sujetos obligados concretos** por coincidencia única de nombre
normalizado contra el padrón, sin escribir una sola fila en `aml_sanctions` y sin
promover identidad canónica.

## Las tres superficies

**Panorama del padrón.** Dónde se concentra la carga fiscalizadora. El cuadrante
de vigilancia sectorial cruza vulnerabilidad estructural del sector contra
eventos UAF publicados por cada 100 inscritos; las líneas son las medianas del
propio padrón, no umbrales normativos. La zona sombreada —alta vulnerabilidad,
baja supervisión observada— reúne, entre otros, a Usuarios de Zonas Francas
(2.840 inscritos, vulnerabilidad 83,3, 0,74 eventos por 100) y a
Comercializadoras de Vehículos (538 inscritos, vulnerabilidad 83,3, cero
eventos). Completan la lectura la serie sancionatoria por año con su porción
atribuida, las brechas de coherencia registral, la distribución territorial y la
carga por sector repartida por banda.

**Padrón fiscalizable.** Exploración con facetas sobre el universo obligado:
sector, territorio, condición tributaria, naturaleza del sujeto, banda del
índice, historial sancionatorio, término de giro y giro atípico. Cada fila lleva
la barra del índice, la firma de sus cinco componentes y sus marcas registrales.

**Expediente de fiscalización.** Un sujeto a la vez. Abre con la identidad y el
dial del índice, y sigue con la descomposición del cálculo antes que con
cualquier otra lente: un fiscalizador no debería aceptar un número antes de ver
de qué está hecho. Después: inscripción y sector, coherencia registral UAF ↔ SII,
historial de supervisión en línea de tiempo, escala y trayectoria tributaria por
año comercial, posición frente a pares del propio sector, y lectura cruzada con
el IPA3 v0.4-shadow.

## IPF-1.0 · Índice de Priorización Fiscalizadora

| Componente | Peso | Qué mide | Cuándo queda sin evidencia |
| --- | --- | --- | --- |
| **VSE** Vulnerabilidad sectorial estructural | 25 | Vulnerabilidad del sector obligado (mapa IRG, escala 1–5 adaptada a 0–100) | El sector inscrito no está en el mapa |
| **HSU** Historial de supervisión UAF | 25 | Eventos atribuidos, ponderados por recencia (horizonte 6 años) y reiteración | Nunca: la ausencia de eventos en la ventana publicada es una observación |
| **CRG** Coherencia registral UAF ↔ SII | 20 | Término de giro, atipicidad del giro entre pares, cambios de región y de giro | Nunca: contrastar dos registros siempre es posible |
| **EEC** Escala, exposición y complejidad | 18 | Tramo de ventas, dotación, estructura societaria declarada, antigüedad | Persona natural, o sin perfil tributario observable |
| **OBS** Brecha de observabilidad | 12 | Cobertura de fuentes, territorio y vigencia del corte | Nunca |

El puntaje es el promedio ponderado **sólo de los componentes con evidencia**.
Un componente sin evidencia no aporta cero: sale del promedio y baja la
**credibilidad declarada**, que es la fracción del peso total respaldada por
evidencia y se muestra siempre junto al puntaje, nunca mezclada con él.

### Por qué las bandas son percentiles

El puntaje absoluto se comprime: la vulnerabilidad sectorial es casi constante
dentro de un sector (media 77,1 sobre 100) y los demás componentes son bajos para
la mayor parte del padrón. Con umbrales absolutos, el 99,5 % del padrón caía en
las dos bandas inferiores y el índice dejaba de discriminar. Un fiscalizador
necesita una lista de trabajo ordenada, no un medidor absoluto, así que la banda
se ancla en la posición dentro del padrón vigente:

| Banda | Percentil | Sujetos en el corte |
| --- | --- | --- |
| Muy alta | ≥ 99 | 99 |
| Alta | ≥ 95 | 391 |
| Media | ≥ 80 | 1.125 |
| Baja | ≥ 50 | 3.274 |
| Mínima | < 50 | 4.893 |

Esto se declara en pantalla: **la banda es posición, no nivel absoluto**. Si el
padrón cambia, la banda puede moverse sin que el sujeto haya cambiado. El
percentil dentro del propio sector se guarda aparte (`ipf_sector_percentile`) y
es el más accionable, porque descuenta la vulnerabilidad estructural que todos
los pares del sector comparten por igual.

### Una corrección que cambió el resultado

La primera calibración ponía en el tope de la lista a notarios personas
naturales, por no tener perfil tributario de empresa. Es un error metodológico:
un notario persona natural **no debe tener** perfil tributario de empresa, y
castigarlo por ello convierte una característica del sujeto en una brecha
inexistente. En el corte, los 2.110 sujetos sin perfil SII son exactamente los
2.110 con RUT de persona natural: la ausencia estaba completamente explicada por
la naturaleza jurídica.

La corrección introduce `subject_nature`, derivada de la estructura del RUT
chileno (cuerpo bajo 50.000.000 = persona natural), y:

- **CRG** ya no penaliza la ausencia de perfil SII en personas naturales;
- **EEC** queda nulo para ellas, con base declarada `PERSONA_NATURAL_SIN_PERFIL_DE_EMPRESA`;
- **OBS** deja de imputarles la brecha de perfil tributario.

Tras la corrección, personas naturales y jurídicas puntúan de forma comparable
(28,8 contra 27,8 de media) y el tope de la lista lo ocupan sujetos con historial
sancionatorio real y complejidad societaria declarada.

## Atribución de eventos sancionatorios

`aml_uaf_sanction_subject_link_snapshot` cruza los 324 eventos UAF contra los
nombres del padrón usando `aml_entity_resolution_key_v1`, la misma función de
normalización que el resto del esquema.

| Estado | Eventos | Confianza declarada |
| --- | --- | --- |
| `CANDIDATO_UNICO` | 243 | 0,72 |
| `CANDIDATO_AMBIGUO` | 8 | 0,35 |
| `SIN_CANDIDATO_EN_PADRON` | 73 | — |

Sólo los candidatos únicos alimentan el componente HSU. `promotes_identity` es
`false` por definición de tabla: la atribución no escribe `entity_id` en
`aml_sanctions`, no crea vínculos de identidad y no altera ninguna otra lectura
del portal.

## Atipicidad de giro

En vez de una tabla de correspondencias hecha a mano entre sector UAF y actividad
económica —frágil y no gobernada— la atipicidad se calcula contra los propios
pares: es `1 − (proporción de inscritos del mismo sector obligado que declaran el
mismo subsector económico)`. Sólo se afirma cuando el sector tiene 20 o más giros
observados; bajo ese umbral la base se declara insuficiente y el dato queda
vacío. Un giro atípico es una rareza observada entre pares, nunca un
incumplimiento.

## Capa de datos

Todo se lee desde snapshots gobernados, nunca desde las vistas pesadas.

| Objeto | Filas | Qué contiene |
| --- | --- | --- |
| `aml_uaf_obligated_subject_snapshot` | 9.782 | Caracterización e IPF por sujeto, con `ipf_components` y su evidencia |
| `aml_uaf_obligated_sector_snapshot` | 49 | Lectura del padrón por sector canónico |
| `aml_uaf_sanction_subject_link_snapshot` | 324 | Atribución candidata de eventos UAF |
| `aml_uaf_sector_vulnerability_ref` | 74 claves | Mapa de vulnerabilidad estructural (55 sectores + alias) |
| `aml_uaf_obligated_overview_snapshot` | 1 | Panorama completo en una sola consulta |

Las cinco tablas quedan bajo la misma política de RLS que el resto de los objetos
analíticos: lectura para `authenticated` sólo si existe fila habilitada en
`aml_allowed_users`; nada para `anon`. El refresco es
`refresh_aml_uaf_obligated_subjects_0560()`, con disparo condicional
`refresh_aml_uaf_obligated_if_stale_0560()` bajo `pg_cron` cada 20 minutos, con
bloqueo consultivo propio y sello propio en `aml_sync_state`
(`UAF_OBLIGATED_0560`), de modo que una falla aquí no puede arrastrar los
snapshots de los que depende el resto del portal.

Las 52 grafías de sector que usa el padrón cruzan las 74 claves del mapa de
vulnerabilidad sin residuo: no hay ningún sector sin vulnerabilidad asignada.

## Reglas de lectura

- El IPF ordena esfuerzo de fiscalización. **No** es probabilidad de LA/FT ni
  imputación de incumplimiento, y no es una decisión institucional.
- La banda es posición dentro del padrón vigente, no un nivel absoluto.
- La vulnerabilidad sectorial describe al sector; no transmite conducta a la
  entidad inscrita en él.
- Sanción administrativa no es delito, y una atribución por nombre normalizado
  es candidata: no promueve identidad.
- Término de giro publicado en SII no es baja del registro UAF.
- Giro atípico no es incumplimiento.
- Ausencia de dato no es cero: el componente sale del promedio y baja la
  credibilidad declarada.
- Una persona natural obligada no tiene perfil tributario de empresa; esa
  ausencia no puntúa como brecha registral.
- Ausencia de evento sancionatorio atribuido no es constancia de cumplimiento.

## Verificación

`tests/atlas-obligated-subjects-0560.mjs` monta un DOM mínimo, ejecuta los dos
módulos y dibuja las cinco superficies con filas que tienen la forma exacta de
las tablas —incluida una persona natural sin perfil tributario y una fila cargada
de nulos—. Después revisa el marcado producido: nada de `undefined`, ningún
estilo en línea (la CSP del portal los bloquea), etiquetas balanceadas y ningún
atributo SVG numérico inválido. El mismo archivo verifica el contrato: rutas
registradas en ambas navegaciones, lectura desde snapshots, presencia literal de
cada regla de lectura, ausencia de manipulación de sesión o almacenamiento en el
navegador, y que los cinco pesos del índice sumen 100 tanto en el SQL como en la
superficie.
