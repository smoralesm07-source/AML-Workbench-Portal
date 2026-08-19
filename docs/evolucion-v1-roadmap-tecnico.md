# Evolución a ATLAS AML v1.0 · roadmap técnico

**Restricción de la etapa:** operar a costo cero. Sin servidores propios, sin
licencias, sin base de datos administrada de pago.
**Objetivo de la etapa:** demostrar efectividad analítica para justificar, después,
la inversión en infraestructura propia.
**Base del diagnóstico:** medición directa sobre el corte v0.42.0.

---

## 1. Diagnóstico medido

Antes de recomendar, lo que se midió sobre el repositorio actual:

| Medición | Valor | Implicancia |
|---|---:|---|
| Archivos JS cargados por `index.html` | 81 | — |
| Archivos CSS cargados | 51 | — |
| Peso total sin comprimir | **1.555 KB** | Descarga completa en cada visita sin caché |
| Peticiones bloqueantes del render | **132** | Pantalla en blanco hasta resolverlas |
| Scripts clásicos sin `defer`/`async` | 76 | Cada uno detiene el parser del documento |
| Llamadas `select('*')` | 51 | Se traen columnas que la vista no usa |
| Conteos `count:'exact'` | 27 | Recorrido completo de tabla bajo RLS por carga |
| Descarga paginada de tablas completas al navegador | `v022FetchAll` | Vistas comuna × actividad traídas de a 1.000 filas en serie |
| **Reglas AML canónicas en el registro** | **6** | — |
| **Reglas AML efectivamente ejecutables** | **2** | El resto está diferido por bloqueos declarados |

### La conclusión incómoda

El sistema tiene **infraestructura de datos de nivel profesional y una capa analítica
mínima**. Ocho radares, once repositorios, contratos versionados, linaje completo,
validación semántica en CI — todo eso alimenta un catálogo de **dos reglas AML
ejecutables**.

La proporción está invertida. La próxima versión no necesita más plomería de datos:
necesita **explotar analíticamente los datos que ya tiene**.

Hay además un activo de alto valor completamente sin usar: Radar SII ya produce
`ownership_edges` —el grafo societario publicado por el SII, con socios persona
jurídica y porcentajes— y **ninguna vista del portal lo expone**. Es la diferencia
entre listar entidades con marcas y hacer análisis AML de verdad.

---

## 2. El principio que hace posible el costo cero

La restricción real no es GitHub: es **Supabase**. El plan gratuito acota tamaño de
base, transferencia y pausa el proyecto tras inactividad prolongada. GitHub Actions,
en cambio, es gratuito y sin límite de minutos en repositorios públicos, y GitHub
Pages sirve archivos estáticos por CDN sin costo.

De ahí el principio rector de esta etapa:

> **Mover el cómputo del momento de la consulta al momento de la construcción.**
> Lo que hoy calcula PostgreSQL cada vez que un analista abre una pantalla, debe
> calcularlo un workflow una sola vez y publicarse como artefacto estático.

Esto mejora simultáneamente tres cosas que normalmente se contraponen: rendimiento,
costo y presión sobre la base de datos.

### Cómo se reparte el dato según su sensibilidad

| Tipo de dato | Dónde vive | Por qué |
|---|---|---|
| Agregados, territorio, sectores, series, catálogos | **Parquet/JSON estático en Pages** | No identifica entidades. Se sirve por CDN, gratis y rápido |
| Entidad identificable, hallazgos, sanciones con RUT | **Supabase con RLS** | Requiere autorización por fila. No puede ser público |

La frontera es la misma que ya usa el modelo de datos: lo que no tiene llave de
entidad puede ser estático; lo que la tiene, no. **La regla de gobierno vigente se
convierte en la regla de despliegue.**

---

## 3. Fase 1 · Rendimiento

Sin cambios metodológicos. Riesgo bajo, efecto inmediato.

### 1.1 Empaquetado en el despliegue

El workflow `pages.yml` ya reescribe `index.html` en tiempo de despliegue. Agregar
allí un paso de `esbuild` que concatene y minifique **respetando el orden de carga
actual**, sin reestructurar el código fuente.

- 132 peticiones → 3 (un JS, un CSS, un módulo).
- ~1.555 KB → estimado 300-400 KB con gzip.
- Los archivos versionados siguen existiendo en el repositorio; solo el artefacto
  publicado se empaqueta.
- Compatible con la política de versión única: el guardián sigue validando el
  manifiesto, y el `?r={build}` se aplica al bundle.

Después de empaquetar, agregar `defer` al bundle. Los 76 scripts clásicos actuales no
pueden llevar `defer` individualmente porque dependen del orden de ejecución; una vez
concatenados, sí.

### 1.2 Eliminar los conteos exactos

Los 27 `count:'exact'` recorren tablas completas bajo RLS en cada carga. Reemplazar
por una tabla `aml_kpi_snapshot` de una fila, escrita por el job de sincronización.

- 27 recorridos de tabla → 1 lectura de una fila.
- Efecto secundario valioso: el KPI queda **sellado con el corte**, en vez de variar
  según lo que RLS deje ver a cada usuario. Hoy dos analistas pueden ver totales
  distintos en portada.

### 1.3 Convertir las vistas de tablero en tablas de snapshot

Las vistas `aml_v020_*` se calculan en vivo por sesión. El sistema **ya usa el patrón
correcto** en territorio (`aml_v032_geo_uaf_territory_snapshot` con función de
refresco). Generalizarlo al resto.

### 1.4 Sacar del navegador la descarga de tablas completas

`v022FetchAll` pagina de a 1.000 filas en serie para vistas comuna × actividad. Esas
vistas son agregadas y no identifican entidades: **son exactamente el caso de dato
estático**. Publicarlas como JSON/Parquet desde el workflow y leerlas por `fetch`.

- Decenas de viajes secuenciales a la base → una descarga desde CDN.
- Cero transferencia de Supabase para ese caso.

### 1.5 Disciplina de columnas

Eliminar los 51 `select('*')`. Es trabajo mecánico y de bajo riesgo, pero reduce
transferencia en el camino más caliente del sistema.

**Resultado esperado de la Fase 1:** primera carga de varios segundos a menos de uno,
y caída sustantiva del consumo del plan gratuito de Supabase.

---

## 4. Fase 2 · Motor analítico sin servidor

Aquí está el salto de capacidad, y sigue costando cero.

### 2.1 DuckDB en el workflow, DuckDB-WASM en el navegador

El stack ya usa DuckDB y Parquet en los radares. Extenderlo:

1. Un workflow calcula los agregados analíticos con DuckDB y publica **Parquet** en
   Pages.
2. El navegador carga **DuckDB-WASM** y consulta esos Parquet directamente, con
   peticiones HTTP por rango: descarga solo los bloques que la consulta necesita.

Esto da capacidad OLAP real —agrupaciones, ventanas, percentiles, cruces— sobre el
navegador del analista, sin base de datos y sin servidor.

**Ajuste requerido en la CSP.** La política actual es:

```
script-src 'self' https://cdn.jsdelivr.net
```

`jsdelivr` ya está permitido, de modo que la librería carga. Pero WebAssembly exige
además:

```
script-src 'self' https://cdn.jsdelivr.net 'wasm-unsafe-eval'
```

Los Parquet servidos desde Pages son `'self'`, así que `connect-src` no cambia.

### 2.2 Qué habilita esto que hoy no existe

- Exploración sectorial cruzando UAF, SII, sanciones y gasto sin sumar scores
  incompatibles — está en el backlog desde v0.20.
- Comparación contra pares calculada en el momento, en vez de precalculada por corte.
- Series longitudinales completas sin traer los hechos al navegador como JSON.

### 2.3 Índice de búsqueda estático

La búsqueda de entidades por nombre o RUT hoy golpea Supabase. Un índice invertido
precalculado y publicado como artefacto —solo con nombre, RUT y `entity_id`, que es
información pública del SII— responde en el navegador de forma instantánea. La ficha
completa sigue exigiendo sesión y RLS.

---

## 5. Fase 3 · Foco AML

**Esta es la fase que más importa.** Las dos anteriores hacen que el sistema sea
rápido; esta hace que sea útil.

### 3.1 Activar el grafo societario

`ownership_edges` ya existe en Radar SII: sociedad, socio persona jurídica con RUT
válido, porcentaje publicado, y `PERSONAS_NATURALES` conservado como agregado de
fuente. Materializarlo y exponerlo habilita análisis que hoy es imposible:

- **Socios en común** entre entidades marcadas.
- **Cadenas de control** de varios niveles, resolubles con CTE recursivas en
  PostgreSQL o DuckDB — no se necesita base de grafos a esta escala.
- **Participación circular** entre sociedades.
- **Concentración societaria**: un mismo socio persona jurídica presente en muchas
  entidades de reciente constitución.

Guardrails que deben mantenerse intactos: no se infieren beneficiarios finales, no se
transforma `PERSONAS_NATURALES` en individuos, el riesgo no se hereda por el vínculo.
La red **muestra** relaciones; no las convierte en señal adversa por sí solas.

### 3.2 Ampliar el catálogo de tipologías

De 2 reglas ejecutables a un catálogo real. Todas las siguientes se construyen con
datos que el sistema **ya tiene materializados**:

| Tipología propuesta | Datos que ya existen | Semántica |
|---|---|---|
| Ventas altas con dotación nula o mínima | `sales_band_rank`, `workers_numeric` | Indicador clásico de sociedad instrumental |
| Constitución reciente con ventas altas | `activity_start_date`, tramo de ventas | Ya existe como marca en Presupuesto Abierto; falta como regla canónica |
| Domicilio compartido por muchas entidades | `address_count`, `communes`, `address_regions` | Concentración domiciliaria |
| Desalineación sector UAF ↔ actividad SII | conciliación UAF↔SII | Ya calculada, no promovida a regla |
| Proveedor del Estado con sanción vigente | `aml_v028_sanctions_with_identity` + gasto | Convergencia por RUT exacto |
| Salto de tramo con dotación estable | `sales_band_delta`, `workforce_ratio` | Ya en IPA3 como M03/M04 |
| Socio común entre entidades sancionadas | `ownership_edges` + sanciones | Requiere 3.1 |

Nótese el patrón: **la mayoría ya está calculada en algún módulo, pero no promovida a
regla canónica del registro AML**. El trabajo es de consolidación semántica, no de
ingeniería nueva.

### 3.3 Desbloquear las cuatro reglas diferidas

Cada regla diferida declara su bloqueo. Conviene tratarlos como tareas explícitas:

| Regla | Bloqueo declarado | Camino |
|---|---|---|
| SIG-AML-002 (CGR) | CGR conserva la mayoría de partes como candidatos no resueltos | Extraer RUT de los informes donde sí aparece; aceptar cobertura parcial declarada en vez de bloqueo total |
| SIG-AML-003 (territorial) | Frescura CEAD y calibración de categorías | Ya resuelto en parte por el pipeline CEAD semanal; recalibrar contra artículo 27 |
| SIG-AML-005 (SII) | Artefacto Parquet no duplicado en Git | Se resuelve solo con el patrón de Parquet en Pages de la Fase 2 |
| SIG-AML-006 (OSFL) | Pertenencia no es adversa | Redefinir el predicado sobre exposición observable, no sobre pertenencia |

### 3.4 Sacar IPA 3.0 de sombra, con protocolo

IPA3 lleva tiempo en `production_enabled=false`. Salir de sombra requiere evidencia,
no una decisión administrativa. Ver Fase 4.

---

## 6. Fase 4 · Demostrar efectividad

El objetivo declarado de esta etapa es probar que el sistema funciona. Eso exige
medirlo, y hoy no se mide.

### 4.1 Backtesting con las sanciones como etiqueta débil

Hay **974 sanciones materializadas**. Sirven como etiqueta imperfecta pero real:

1. Reconstruir el estado del sistema en un corte anterior a cada sanción.
2. Calcular en qué posición de la cola de prioridad estaba esa entidad *antes* del
   evento.
3. Reportar **precisión en los primeros K** y elevación sobre una selección aleatoria.

Si el sistema prioriza mejor que el azar, hay evidencia comunicable. Si no, hay un
resultado igualmente valioso: indica qué señales recalibrar.

Advertencia metodológica que debe quedar escrita: una sanción administrativa no es
LA/FT, y el conjunto de sancionados está sesgado hacia sectores más supervisados. Es
una señal de validación, no una verdad de terreno.

### 4.2 Capturar el juicio del analista

La bitácora `aml_audit_log` ya existe y ya recibe inserciones del rol autenticado.
Extenderla para registrar el desenlace del triage: *revisado y útil*, *descartado*,
*falso positivo*, con el `finding_key`.

Es barato, respeta el modelo de privilegios vigente y produce lo único que hoy falta
por completo: **datos de calibración**. Cuando llegue el momento de una etapa con
servidor propio y métodos estadísticos, ese registro será el activo más valioso —y
solo se acumula si se empieza a capturar ahora.

### 4.3 Métricas de operación visibles

Duración de cada corrida, frescura por productor, tasa de fallo por radar, cobertura
de identidad. Publicadas como artefacto estático, igual que el estado de despliegue
actual.

---

## 7. Lo que NO conviene hacer en esta etapa

Tan importante como el roadmap:

| Tentación | Por qué esperar |
|---|---|
| Migrar el frontend a React o similar | Semanas de trabajo, riesgo alto de regresión, y no resuelve ninguno de los problemas medidos. El empaquetado sí los resuelve |
| Adoptar una base de datos de grafos | A esta escala las CTE recursivas bastan. Se justificaría con consultas de muchos saltos sobre millones de aristas |
| Incorporar modelos estadísticos o LLM para scoring | No hay etiquetas validadas ni protocolo de evaluación, y comprometería la explicabilidad que es el principal activo del sistema |
| Migrar a servidor propio ahora | Correcto postergarlo. Con el cómputo movido a Actions, el plan gratuito deja de ser el cuello de botella |
| Consolidar los once repositorios | La autonomía por dominio es una fortaleza real. Consolidar la orquestación, no los repositorios |

---

## 8. Techos del plan gratuito a vigilar

Los límites cambian; conviene verificarlos contra la documentación vigente de cada
proveedor antes de comprometer una decisión.

| Servicio | Límite relevante | Señal de alerta |
|---|---|---|
| Supabase | Tamaño de base y transferencia; el proyecto se pausa tras inactividad prolongada | El grafo societario y la historia SII son lo que más puede crecer. Mantener los agregados fuera de la base |
| GitHub Pages | Tamaño del sitio y ancho de banda mensual | Los Parquet publicados son el rubro que crece. Particionar por año o región |
| GitHub Actions | Gratuito en repositorios públicos; tope de duración por job | Los cálculos pesados deben particionarse en jobs, no correr como uno solo |

Mitigación transversal: **particionar los artefactos**. Un Parquet por año o por
región se descarga parcialmente por rango; un archivo único obliga a traerlo entero.

---

## 9. Secuencia recomendada

El orden importa: cada fase habilita la siguiente.

1. **Fase 1 — Rendimiento.** Riesgo bajo, efecto visible de inmediato, y libera
   presupuesto del plan gratuito para lo que viene.
2. **Fase 2 — Motor analítico.** El Parquet en Pages desbloquea de paso la regla
   SIG-AML-005.
3. **Fase 3 — Foco AML.** El grafo societario primero: es el que cambia
   cualitativamente lo que el sistema puede responder.
4. **Fase 4 — Medición.** Puede empezar en paralelo desde el primer día: la captura
   del juicio del analista solo acumula valor con el tiempo, así que conviene
   activarla cuanto antes.

### El criterio de éxito de la etapa

No es «el sistema es más rápido». Es:

> **Poder mostrar que la cola de prioridad ordena mejor que el azar, con evidencia
> reproducible, y que un analista encuentra en ella trabajo que efectivamente vale la
> pena hacer.**

Con eso, la conversación sobre servidor propio y tecnología de pago deja de ser una
apuesta y pasa a ser una decisión de escalamiento respaldada por datos.

---

*Preparado sobre el corte ATLAS AML v0.42.0. Las mediciones de la sección 1 son
reproducibles sobre el repositorio en ese estado.*
