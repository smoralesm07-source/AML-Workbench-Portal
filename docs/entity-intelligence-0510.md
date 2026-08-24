# Entidades 0.51.1 · build 0511

Reconstrucción de la sección **Entidades** del portal. Ninguna otra sección
cambia: las dos extensiones se montan al final del runtime compilado y envuelven
las autoridades vigentes del expediente en lugar de reemplazarlas.

## Qué estaba mal

**Exploración.** La sección abría en un espacio vacío con un solo campo de texto.
Para llegar a una entidad había que conocer de antemano su nombre exacto, su RUT
o su Entity ID. No existían facetas, ordenamiento, lectura del conjunto ni
previsualización: quien llegaba con una pregunta —"sociedades de Tarapacá con
sanciones y cobertura multi-fuente"— no tenía por dónde entrar. La búsqueda por
nombre exigía además coincidencia de subcadena continua y era sensible a tildes.

**Caracterización.** Varias tarjetas del expediente se rendían siempre vacías
porque leían campos que el esquema nunca materializó:

| Tarjeta | Leía | Resultado |
|---|---|---|
| Posición frente a pares | `profile.peer_context` | "Benchmark no materializado", siempre |
| Red de exposición | `profile.relaciones` | grafo vacío, siempre |
| Descomposición IPA3 | — | no existía en la ficha |

Mientras tanto el esquema sí calculaba percentiles de pares por año, sector,
tamaño y edad; un grafo gobernado de vínculos de identidad; y la descomposición
del score por marcas con su evidencia de cálculo.

**Rendimiento.** Consultar esas vistas por entidad recomputaba ventanas sobre
todo el universo. Medido con `explain analyze` sobre el corte del 24-08-2026:

| Vista | Por entidad | Filas recorridas |
|---|---:|---:|
| `aml_v_ipa3_entity_score_v0_4` | 5.985 ms | 50.516 |
| `aml_v_ipa3_mark_scores_v0_4` | 3.393 ms | 13.366 |
| `aml_v_entity_relations` | 2.316 ms | self-join de 50.516 para 20 filas |
| `aml_v_ipa3_sii_peer_benchmark` | 542 ms | 35.867, con orden en disco |

**Captura de desenlace.** El lente 06 escribía en `aml_disposition`, pero la
tabla no existía en la base: cada intento de registrar una disposición fallaba.

## Qué se construyó

### 1 · Explorador de entidades (`atlas-entity-explorer-0510`)

Reemplaza el espacio vacío por una superficie de exploración gobernada.

- **Consulta.** Detecta el modo por la forma del término: Entity ID por prefijo,
  RUT normalizado a la forma canónica `99999999-9` (acepta puntos, espacios y
  dígito verificador ausente), o razón social multi-token insensible a tildes —
  todos los términos deben aparecer, en cualquier orden. Se apoya en el índice
  trigrama `aml_entities_name_trgm_idx`.
- **Facetas materializadas.** Territorio (catálogo `aml_v019_gap_region` con el
  universo por región), tipo de entidad, cobertura mínima de fuentes, condición
  UAF y condición sancionatoria. Todas se aplican en el servidor.
- **Lectura del conjunto.** Cobertura observable, distribución territorial y
  composición de condición registral, siempre rotuladas *sobre las filas
  cargadas*. El total se muestra como estimación del planificador (`count:
  planned`) y se declara como tal: el único recuento exacto que se afirma es el
  de filas efectivamente cargadas.
- **Ficha rápida.** Panel lateral con identidad y procedencia, roles y
  productores, prioridad IPA3 con sus marcas principales, situación tributaria y
  recurrencia sancionatoria, antes de abrir el expediente completo.
- **Auditoría.** La consulta se registra con hash SHA-256 del término; nunca se
  almacena texto plano.

### 2 · Caracterización profunda (`atlas-entity-dossier-0510`)

Se injerta en los lentes ya aprobados, sin alterar su estructura.

| Lente | Bloques añadidos |
|---|---|
| 01 Identidad | Procedencia de la identidad (método, confianza, roles, productores, territorio, corte) · Vínculos de identidad gobernados con su método, confianza y condición de candidato |
| 02 Caracterización | Posición frente a pares (ventas, amplitud de domicilios, amplitud de giros) con el grupo y su tamaño · Trayectoria observada (saltos y caídas de tramo, dotación a la baja con ventas estables, cambios de actividad y región) · Estructura declarada · Registro UAF materializado · Perfil OSFL y FATF R8 cuando existe |
| 05 Señales | Descomposición IPA3 v0.4-shadow: anillo de puntaje, medidores de confianza y cobertura, composición por grupo con su marca conductora y cada marca con su barra de aporte |
| 06 Evidencia | Resolución de identidad de cada evento sancionatorio · Recurrencia por ventana · Última disposición vigente · Exportación `ATLAS_ENTITY_CHARACTERIZATION_V1` |

Cada marca abre una **ficha metodológica** con qué mide, cómo se calculó
—`aporte = min(intensidad_bruta, tope_individual) × confianza`—, la evidencia
del cálculo y su procedencia. El botón "Cómo se construyó esta ficha" declara
tabla, vista y corte de cada bloque.

### 3 · Snapshots de lectura (`sql/atlas_v0510_entity_intelligence.sql`)

Tres tablas nuevas que copian la vista gobernada vigente sin recalcular nada,
con la misma política RLS de usuarios habilitados que el resto del esquema:

| Tabla | Filas | Origen |
|---|---:|---|
| `aml_ipa3_mark_scores_snapshot_v0_4` | 13.366 | `aml_v_ipa3_mark_scores_v0_4` |
| `aml_entity_peer_position_snapshot` | 35.867 | `aml_v_ipa3_sii_peer_benchmark` |
| `aml_entity_identity_link_snapshot` | 20 | `aml_v_entity_relations` |

Latencia por entidad después del cambio: marcas 1 ms, pares 1 ms, vínculos 0 ms,
puntaje 4 ms contra el snapshot ya existente `aml_ipa3_entity_score_snapshot_v0_4`.

El refresco es condicional y con lock propio
(`refresh_aml_entity_intel_if_stale_0510`), programado cada 15 minutos por
pg_cron contra el sello de `aml_sync_state`. No se modificó
`refresh_aml_runtime_if_stale`, de modo que una falla aquí no puede arrastrar el
snapshot de overview del que depende el resto del portal.

### 4 · Restitución de `aml_disposition`

Se recrea con el contrato original de 0460, sin cambios semánticos: sólo
anexado, justificación obligatoria de 20 caracteres, contexto reproducible,
lectura para analistas habilitados y escritura sólo a nombre propio.

## Rediseño 0511 · gráfico primero

La primera versión resolvió el acceso al dato, pero lo explicaba con párrafos
donde el dato ya podía hablar. El rediseño cambia la proporción.

**Tres objetos gráficos, repetidos en todas las superficies.** Quien los aprende
en la lista los lee igual en la ficha rápida y en el expediente:

| Objeto | Qué muestra | De dónde sale |
|---|---|---|
| Huella | Un punto por productor con dato: SII, UAF, OSFL, Prensa, Sanciones | `profile.fuentes` — sólo productores que el perfil declara |
| Firma | Composición del puntaje entre marcas registrales, económicas y sancionatorias | grupos del snapshot IPA3 |
| Barra IPA3 | Posición en la cola de revisión, coloreada por banda | `ipa3_score` del snapshot |

**El conjunto se lee con gráficos, no con tarjetas de texto:** histograma de
banda de prioridad, matriz cobertura × condición registral y barras de
territorio, siempre rotulados sobre las filas cargadas.

**El expediente sustituye recuentos por series que ya existían:**

- *Trayectoria* — se dibuja desde `aml_sii_entity_year`: escalón de tramo de
  ventas, área de dotación, cambios declarados marcados sobre el eje y la caída
  de dotación con ventas estables resaltada. Las dos series se escalan por
  separado para no sugerir una relación que el dato no afirma.
- *Recurrencia sancionatoria* — cada evento resuelto sobre un eje temporal, con
  las ventanas de 36 y 60 meses dibujadas: la recurrencia se ve en vez de
  contarse.
- *Estructura* — domicilios y giros comparados contra el grupo de pares en
  rieles con percentil, en lugar de una lista de números.
- *Cada marca* — una cascada muestra dónde recorta el tope individual y dónde
  recorta la confianza, antes de la fórmula en texto.

**Los guardarraíles no se perdieron.** Dejaron de repetirse bajo cada tarjeta y
se concentran completos en dos paneles: "Reglas de lectura" en el explorador y
"Cómo se lee esta ficha" en el expediente, ambos verificados por el contrato de
prueba.

**Un defecto corregido de paso.** El ayudante numérico convertía `null` en cero
—`Number(null) === 0`—, de modo que un dato ausente podía pintarse como cero en
cualquier superficie de la sección. Ahora un ausente es un ausente.

## Semántica declarada

- Cobertura de fuentes describe alcance de observación, **no riesgo**.
- IPA3 v0.4-shadow ordena la cola de revisión del corte; **no es probabilidad de
  LA/FT**. Un puntaje cero significa que ninguna marca se activó y se muestra
  como `—`, nunca como banda baja.
- El percentil de pares es **posición relativa** dentro del grupo comparable del
  año. No es desempeño, no es anomalía y no es riesgo.
- Un vínculo con `requiere_revision` sigue siendo **candidato**: no promueve
  identidad ni transfiere atributos entre entidades.
- Una sanción administrativa **no acredita** lavado de activos, financiamiento
  del terrorismo ni delito.
- Candidata FATF R8 describe exposición estructural de un universo de OSFL; **no
  imputa** financiamiento del terrorismo a ninguna entidad.
- Una entidad ausente de un corte se lee como **no materializada**, nunca como
  cero.

## Seguridad y aislamiento

- Sólo lectura bajo la sesión y RLS existentes. Ninguna escritura contra
  PostgREST desde estos módulos.
- No se toca Auth, Entra ni el ciclo de refresh tokens.
- Sin `MutationObserver` y sin almacenamiento en el navegador: toda caché es en
  memoria y muere con la pestaña.
- Ninguna regla CSS usa selectores globales; el estilo vive bajo los prefijos
  `.aex-` y `.aed-`.
- El contrato se verifica en `tests/atlas-entity-intelligence-0510.mjs` y en el
  workflow `validate-entity-intelligence-0510`.

## Fuera de contrato por ahora

La extensión Personas y control (0500) no se cruza con el expediente: el corte
vigente del snapshot PEP entrega `cases.top` vacío y su estructura de caso no
está materializada. Cruzarla exigiría inventar campos, de modo que se deja
declarado y pendiente hasta que IFL materialice esos casos.
