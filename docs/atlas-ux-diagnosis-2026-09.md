# Atlas · diagnóstico de experiencia, diseño y rendimiento

**Corte:** 2026-09-06 · **Release revisado:** 0.96.2 build 0964
**Ámbito:** `AML-Workbench-Portal` + los 14 repositorios productores.
**Método:** lectura de código y medición del artefacto compilado por `tools/build_atlas_site.py`.

Demos operativas: `prototypes/atlas-2026/` (`consola.html`, `expediente.html`, `triage.html`, `diagnostico.html`).

---

## 1. Veredicto

El problema de Atlas no es de funcionalidad: es de **sedimentación**. Cada mejora se publicó como una
capa nueva sobre la anterior y ninguna se retiró.

El runtime compilado carga **169 fragmentos** de las versiones 0.16 a 1.00 antes de mostrar el primer
dato —600 KB comprimidos, 2,4 MB de código a interpretar— y **34 archivos se disputan la misma función
global `shell`**. Nadie es dueño de la pantalla.

La consecuencia visible para el fiscalizador no es la lentitud, aunque exista: es que Atlas no recuerda
dónde estaba, no se puede compartir un enlace, y el menú está ordenado por quién produce el dato en
lugar de por qué pregunta responde. Las tres se arreglan sin tocar el motor analítico.

`docs/ARCHITECTURE_V2.md` ya diagnostica el mismo cuadro y su regla nº 9 lo dice completo: *«un módulo
v2 no está completo mientras el renderizador antiguo siga siendo una autoridad competidora»*. La
eliminación es justamente el paso que nunca ocurre.

---

## 2. Mediciones

### 2.1 Acumulación de capas

| Generación | Fragmentos activos en el runtime |
|---|---:|
| v0.16 – v0.19 | 27 |
| v0.20 – v0.29 | 45 |
| v0.30 – v0.39 | 36 |
| v0.40 – v0.44 | 21 |
| v0.45 – v1.00 (`assets/`) | 36 |
| base (`styles.css`, `app.js`, …) | 4 |
| **Total** | **169** |

Todas se ejecutan en el mismo arranque. Los nombres declaran el patrón: `-hotfix`, `-hardening`,
`-recovery`, `-authority`, `-restore`, `-fix`, `-stability`, `-force-authority`.

| Indicador | Valor |
|---|---:|
| Archivos que redefinen `shell` | 34 |
| Globales asignados en `window` | 247 |
| `MutationObserver` simultáneos | 26 |
| Asignaciones `innerHTML` | 343 |
| Bloques `catch{}` vacíos | 42 |
| Workflows de CI | 59 |

Los 59 workflows (`validate-entity-explorer-0512.yml`, `validate-public-spend-guided-0570.yml`,
`validate-osfl-economic-0950.yml`, …) son el síntoma más elocuente: se valida funcionalidad por
funcionalidad porque no hay una arquitectura común que validar de una vez.

### 2.2 Rendimiento

Medido sobre el artefacto compilado, sin red:

| Recurso | Sin comprimir | gzip |
|---|---:|---:|
| `atlas-runtime-current-01.js` | 818.783 B | 218.189 B |
| `atlas-runtime-current-03.js` | 382.580 B | 109.052 B |
| `atlas-runtime-current-02.js` | 255.725 B | 75.471 B |
| `supabase-js-2.111.0.umd.js` | 210.547 B | 53.791 B |
| `atlas-runtime-current-04/05` + módulos | 115.229 B | ~24.000 B |
| `atlas-runtime-current.css` | 564.493 B | 105.482 B |
| **Total JS** | **1,82 MB** | **~496 KB** |

Sin minificación, sin división por ruta, sin carga diferida: todo usuario descarga el código de todas
las secciones aunque entre sólo a una.

Además:

- **220 consultas directas a la base desde el navegador**, 84 de ellas con `select('*')`. La regla nº 3
  de la arquitectura v2 —*navegador delgado*— aún no rige en las rutas vivas.
- **21 URLs de `raw.githubusercontent.com` usadas como base de datos en vivo** desde el cliente
  (sanciones, CEAD, SII, UAF, Presupuesto Abierto, Context Hub): sin autenticación, sin RLS, sin
  versionado del payload, sin límite de tamaño, con GitHub como dependencia dura.
- **Navegar destruye la pantalla completa.** `shell()` reasigna `app.innerHTML` en cada cambio de
  sección; acto seguido los 26 observadores reconstruyen barra lateral y encabezado. Cambiar de
  pestaña cuesta lo mismo que recargar.
- **Datos cocidos en el código.** Varios módulos llevan series anuales fijas en arreglos JavaScript
  (p. ej. `V036_ANNUAL`). Cuando la fuente se actualiza, la pantalla no.

### 2.3 Diseño gráfico

`v040-theme-system.css` define un sistema correcto —89 tokens, escala de superficies, semánticos
separados del acento, tema claro completo—. El problema es la adopción.

| Indicador | Valor |
|---|---:|
| Referencias a un token `var(--…)` | 2.239 |
| Literales de color escritos a mano | 4.138 |
| — de ellos, hexadecimales distintos | 2.460 |
| **Adopción de tokens** | **35 %** |
| Hojas sin ninguna regla de tema claro | **38 de 64** |
| Tamaños de fuente distintos | 85 |
| Radios de esquina distintos | 43 |
| Declaraciones `!important` | 1.094 |
| Formas distintas de hacer pestañas | 13 |
| Familias de panel lateral | ~20 |

**El dato más accionable es el de las 38 hojas.** Atlas ofrece un botón de tema claro que funciona en el
shell y en las superficies nuevas, y deja de funcionar en Territorio, OSFL, Gasto público, Radar
integrado y el tablero: texto claro sobre fondo claro en la mitad de la aplicación. Su reparación es
sustitución mecánica, no rediseño.

### 2.4 Navegación

La navegación actual (`atlas-current-ui.js`): *Explorar* (Radar integrado, Entidades, Universo SO,
Territorio) · *Analítica* (Empresas RES, OSFL, Gasto público) · *Radares* (Sanciones) · *Análisis*
(Preguntas).

Ocho de las nueve etiquetas nombran una fuente o un radar. Ninguna nombra lo que el fiscalizador quiere
hacer. «Explorar», «Analítica» y «Análisis» no distinguen nada entre sí. La organización interna quedó
impresa en la pantalla.

Cuatro ausencias, con su evidencia:

| Falta | Evidencia | Costo | Esfuerzo |
|---|---|---|---|
| Estado en la URL | 0 usos de `pushState` / `location.hash` / `URLSearchParams` | no se comparte un caso; «atrás» sale de la app; recargar vuelve al inicio | bajo |
| Buscador de comandos | 0 atajos de teclado en 169 fragmentos | toda navegación con mouse | bajo |
| Estados de carga | 2 «skeleton» vs 15 «Cargando…» | no se distingue lento de caído | bajo |
| Captura de la decisión | existe en Universo SO, no en el resto | Atlas casi nunca aprende de lo que el fiscalizador concluye | medio |

---

## 3. La brecha que el propio Atlas documentó

`atlas-aml-methodology/README.md` publica su backtest con su propia refutación:

- precisión@10 del catálogo completo: **30,0 %**;
- precisión@10 sin las tipologías de historial sancionatorio: **0,0 %**.

El 100 % del poder predictivo viene de «ya fue sancionado» — autocorrelación de atención supervisora.
Las tipologías estructurales no quedan invalidadas: queda demostrado que la sanción administrativa es
la etiqueta equivocada para ellas. Y la conclusión del propio documento es una especificación de
producto: **capturar el desenlace del triage pasa de deseable a prerrequisito**.

La próxima pantalla importante de Atlas no es otro tablero: es la mesa donde el fiscalizador decide y
su decisión queda registrada. Universo SO ya lo hace para sus candidatos; falta convertirlo en columna
vertebral.

---

## 4. Arquitectura de información propuesta

| Grupo | Entradas | Por qué |
|---|---|---|
| **Mi trabajo** | Turno · Cola de revisión · Bitácora | lo que hoy no existe: el estado del fiscalizador |
| **Preguntar al universo** | Entidad · Universo SO · Territorio · Gasto público | exploración dirigida por pregunta, no por productor |
| **Vigilancia continua** | Alertas | reglas guardadas que avisan solas |
| **Método y datos** | Fuentes y frescura · Cómo se calcula | la explicabilidad deja de estar escondida bajo cada tarjeta |

---

## 5. Plan por olas

### Ola 1 · deuda visible que se paga rápido (2–3 semanas)

1. **Reparar el tema claro.** Sustituir los literales de color de las 38 hojas sin reglas de tema por
   los tokens de `v040-theme-system.css`. Mecánico; elimina el defecto más visible.
2. **Poner la ruta en la URL.** `#/seccion/id` con `pushState`/`popstate`. Habilita compartir un caso,
   volver atrás y recargar sin perder el sitio.
3. **Buscador de comandos.** `⌘K` sobre entidades, secciones y preguntas frecuentes.
4. **Minificar y comprimir el bundle.** Sin cambiar lógica: ~40 % menos de bytes.
5. **Cerrar los 42 `catch{}` vacíos** con un canal de error visible y un identificador de traza.

### Ola 2 · reordenar la experiencia (4–6 semanas)

1. Adoptar la arquitectura de información de la sección 4.
2. **Inicio = Turno**: qué cambió desde la última sesión y qué casos esperan, en vez del mosaico de
   indicadores.
3. Unificar pestañas (de 13 a 1) y paneles laterales (de ~20 familias a 1).
4. Congelar la escala tipográfica y de espaciado: de 85 tamaños a 7, de 43 radios a 4.
5. Extender la captura de decisión desde Universo SO a Entidad, Sanciones y OSFL, con la bitácora como
   objeto de primera clase.

### Ola 3 · retirar capas, no agregarlas (un trimestre)

1. **Un dueño por pantalla.** Aplicar la regla nº 9 de la arquitectura v2 y borrar la autoridad antigua
   al migrar cada módulo. Meta: `shell` con un solo autor, no 34.
2. Retirar los 26 `MutationObserver` a medida que cada módulo deja de necesitar que otro le arregle el
   DOM.
3. Cortar las 21 dependencias de `raw.githubusercontent.com` llevándolas al contrato `atlas-v2-read`,
   que ya tiene ETag, traza y autorización.
4. División de código por ruta: entrar a Sanciones no debe cargar OSFL, Territorio y Gasto público.
5. Consolidar los 59 workflows en un contrato de validación por módulo, siguiendo la estructura de
   módulo ya definida en la arquitectura v2.

---

## 6. Qué no se cuestiona

Los guardarraíles de Atlas —prioridad analítica no es probabilidad de delito, ausencia de dato no es
cero, el contexto no se hereda, sanción administrativa no acredita LA/FT, percentil es posición y no
desempeño— son mejores que los de la mayoría de las plataformas comerciales del rubro. Publicar un
backtest junto a su propia refutación es una señal de seriedad poco frecuente.

Ese rigor está envuelto en 44 capas que compiten entre sí. La propuesta es una sola capa, con dueño,
que se pueda enlazar, buscar por teclado y leer en cualquier tema — y una mesa donde el juicio del
fiscalizador quede registrado, porque el propio backtest ya demostró que ese es el dato que falta.
