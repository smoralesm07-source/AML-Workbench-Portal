# Universo SO · Potenciales sujetos obligados · build 0580

## Qué cambia

La sección **Sujetos Obligados** pasa a llamarse **Universo SO** y se mueve del
grupo *Radares* al grupo *Explorar*. El nombre importa porque la sección ya no
describe sólo el padrón: describe los dos lados del universo obligado.

| Superficie | Qué responde |
| --- | --- |
| Panorama | Dónde se concentra la carga fiscalizadora |
| Padrón inscrito | Los 9.782 inscritos, caracterizados y priorizados (IPF-1.0) |
| **Potenciales SO** | Entidades que Atlas observa comportándose como sujetos obligados sin figurar en el corte público del padrón, con gestión fiscalizadora |

## El guardarraíl que manda

El portal ya declaraba que *no observado en el corte público UAF ≠ no inscrito /
no obligado*. El padrón que Atlas lee es una publicación, no el registro vivo de
la UAF. Toda esta superficie se construyó sobre esa frase: nada afirma
incumplimiento. Afirma que hay evidencia suficiente para mirar, y muestra de qué
está hecha.

## Cómo se detecta, sin taxonomías escritas a mano

No existe una tabla de correspondencias entre giro económico y sector obligado:
sería frágil y no gobernada. La correspondencia se **mide sobre los propios
inscritos**. Si el 88 % de las entidades que declaran «COMPRA, VENTA Y ALQUILER
DE INMUEBLES» están inscritas en gestión inmobiliaria, ese giro caracteriza al
sector, y quienes lo declaran sin figurar en el padrón son candidatas. La
concentración observada es a la vez el criterio y la evidencia que se muestra en
pantalla.

### Tres clases de evidencia

| Clase | Casos | Qué significa |
| --- | --- | --- |
| `SANCION_UAF_SIN_INSCRIPCION` | 2 | La UAF la sancionó y no aparece en el corte del padrón. La autoridad ya la trató como sujeto obligado |
| `GIRO_PRINCIPAL_CARACTERISTICO` | 49 | Su giro principal SII caracteriza a un sector obligado |
| `GIRO_SECUNDARIO_CARACTERISTICO` | 13 | Uno de sus giros declarados lo hace. Señal más débil, y pondera 0,55 |

### Tres pruebas que existen porque las tres fallaron primero

La calibración fue el trabajo real de este build. Cada umbral corrige un error
concreto que apareció en los datos:

**1. Coherencia de actividad del sector (≥ 0,35).** «Usuarios de Zonas Francas»
agrupa 2.840 inscritos con **197 giros distintos** y un dominante que cubre sólo
25,8 %: es una condición territorial y operativa, no una actividad. Sin esta
prueba prestaba su alta precisión a decenas de giros del comercio de Iquique y el
listado proponía **sindicatos de taxis colectivos y el Instituto de Salud Pública**
como potenciales sujetos obligados.

**2. Soporte del giro dentro del sector (≥ 0,05).** Un giro puede tener 100 % de
precisión y explicar el 0,4 % del sector. Eso es ruido, no característica.

**3. Coherencia de tipo de entidad (≥ 0,05).** Un obispado que posee inmuebles
declara el mismo giro que una inmobiliaria. Las OSFL son el **0,13 %** del sector
de gestión inmobiliaria (3 de 2.244), y sin esta prueba el listado se llenaba de
congregaciones, sindicatos y corporaciones municipales.

Las tres son mediciones del propio padrón, no criterios de autor. El resultado
pasó de 1.027 candidatas con ruido grueso a **64 candidatas legibles**, entre
ellas varias administradoras de fondos de inversión fuera del registro —una lleva
el giro en su razón social.

## Dos índices, deliberadamente separados

Mezclar «qué tan plausible es que deba estar inscrito» con «cuánto pesa
incorporarlo» en un solo número los vuelve indistinguibles.

**IVO · Verosimilitud de obligación**

| Componente | Peso | Qué mide |
| --- | --- | --- |
| EVR | 40 | Sanción UAF sin inscripción observada |
| CGA | 45 | Concentración del giro característico (×0,55 si es secundario) |
| VIG | 15 | Vigencia operativa en el corte tributario |

**MAT · Materialidad de incorporación** — escala (45), dotación (25),
complejidad societaria (20) y cobertura de fuentes (10).

El cuadrante que los cruza es lo que ordena el trabajo de campo: a la derecha lo
plausible, arriba lo que pesa.

### Plausible no es incorporable

Banco Security aparece con IVO 76: es un banco, y un banco **es** sujeto
obligado. Pero registra término de giro publicado, así que no es candidato a
inscripción. En vez de castigar el índice —que estaría diciendo la verdad— se
declara aparte `is_actionable`, y la lista de trabajo filtra por defecto a las
incorporables. Cada número conserva un solo significado.

## Gestión fiscalizadora

`aml_uaf_potential_review` es de **sólo anexado**, con la misma disciplina de
`aml_disposition`. Un fiscalizador anexa su lectura; nadie edita ni borra la de
otro; el estado vigente de una candidata es simplemente su última anotación. Así
Atlas recuerda qué potenciales ya fueron vistos y por quién, entre sesiones y
entre fiscalizadores.

| Estado | Significado |
| --- | --- |
| `PENDIENTE` | Ningún fiscalizador la ha mirado en este corte |
| `REVISADO` | Vista, sin acción decidida |
| `SELECCIONADO_PARA_INSCRIPCION` | Hay que ir a buscarla para inscribir |
| `DESCARTADO` | No corresponde. **Exige motivo y fundamento** |

El descarte motivado no es una convención de interfaz: es una restricción de
tabla (`aml_uaf_potential_review_descarte_motivado`). Un juicio sin fundamento no
es auditable, así que la base lo rechaza.

La superficie está pensada para trabajar rápido: acciones en línea por fila,
selección múltiple con barra de acciones, casilla de «seleccionar todo lo
visible», y avance de revisión siempre a la vista. Tras cada anexado la fila se
relee desde la base en vez de asumirse, porque el estado vigente pudo haberlo
puesto otro fiscalizador entre medio.

### Seguridad de la escritura

Es la primera superficie de escritura de la sección, y el sólo anexado es
**estructural**, no una convención:

- `revoke update, delete ... from authenticated` — no depende de que exista o no
  una política.
- El `user_id` nunca viaja en el payload: lo pone la base desde `auth.uid()`, y
  la política de inserción sólo acepta anotaciones bajo la propia identidad.
- Lectura sólo para usuarios habilitados en `aml_allowed_users`; nada para `anon`.

## Capa de datos

| Objeto | Filas | Qué contiene |
| --- | --- | --- |
| `aml_uaf_sector_activity_profile` | 21 | Giros característicos, con precisión, soporte y coherencia del sector |
| `aml_uaf_potential_subject_snapshot` | 64 | Candidatas con IVO, MAT, evidencia y accionabilidad |
| `aml_uaf_potential_review` | append-only | Lectura fiscalizadora, con autor y momento |
| `aml_v_uaf_potential_current` | vista | Cada candidata con su última anotación |

Refresco: `refresh_aml_uaf_potential_subjects_0580()`, con disparo condicional
`refresh_aml_uaf_potential_if_stale_0580()` bajo `pg_cron` cada 20 minutos, con
bloqueo consultivo y sello propios en `aml_sync_state` (`UAF_POTENTIAL_0580`).

## Reglas de lectura

- **Ausencia del corte público ≠ no inscrito.** Es una publicación, no el
  registro vivo.
- **El giro característico describe al giro, no a la entidad.**
- **Verosimilitud no es materialidad**, y por eso se declaran por separado.
- **Plausible no es incorporable.**
- **Un descarte queda registrado con su motivo**, y ninguna anotación borra la de
  otro fiscalizador.
- **Seleccionar para inscripción no es una decisión institucional**, no es un
  requerimiento y no es un ROS. Es la lectura trazable de quien fiscaliza.

## Verificación

`tests/atlas-potential-subjects-0580.mjs` monta un DOM mínimo, ejecuta los tres
módulos de la sección y dibuja la superficie de gestión en sus estados reales
—lista, selección múltiple, descarte masivo, descarte de una fila, aviso, error
de escritura y sin resultados— sobre filas con la forma exacta de la vista,
incluida una ya revisada por otro fiscalizador, una no incorporable y una cargada
de nulos. Después revisa el marcado: nada de `undefined`, ningún estilo en línea,
etiquetas balanceadas y ningún atributo SVG numérico inválido.

El mismo archivo verifica el contrato: que la ruta viva en *Explorar* con la
etiqueta *Universo SO*, que el único verbo aplicado sobre una tabla sea leer o
anexar, que el `user_id` no viaje en el payload, que cada regla de lectura esté
literalmente presente, que los tres pesos del IVO sumen 100 en el SQL y en la
superficie, y que las tres pruebas de calibración sigan en su sitio.
