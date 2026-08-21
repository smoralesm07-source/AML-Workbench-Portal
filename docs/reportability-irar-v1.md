# ATLAS AML · IRAR v1

## 1. Propósito

IRAR (Índice de Rendimiento Analítico de ROS) reemplaza a ICR como denominación comparativa principal en ATLAS. La razón es metodológica: los agregados públicos de ROS enviados y ROS en los que los procesos de inteligencia detectaron indicios LA/FT no permiten afirmar que numerador y denominador constituyan exactamente la misma cohorte de recepción. Por ello, ATLAS evita interpretar el cociente como una probabilidad de “conversión” de un ROS individual.

ICR se conserva únicamente como denominación legacy para trazabilidad histórica.

## 2. Variables de base

Período vigente: 2021–2025.

- `ROS_s`: ROS enviados por el sector durante el período.
- `IND_s`: ROS asociados a indicios LA/FT informados para el sector durante el período.
- `SO_s`: sujetos obligados inscritos al corte 2025.
- `IIR_s`: participación del sector en ROS 2025 / participación del sector en SO 2025.

## 3. IRAR observado

`IRAR_observado_s = IND_s / ROS_s`

Es el cociente histórico agregado y se mantiene visible para auditoría. No constituye la medida comparativa principal cuando el volumen es bajo.

## 4. IRAR ajustado

ATLAS aplica credibilidad estadística con una referencia de pares leave-one-out:

`IRAR_ajustado_s = (IND_s + K × IRAR_pares_s) / (ROS_s + K)`

con `K = 100` en IRAR-1.0.

El sector no participa en el cálculo de su propia referencia.

### Suficiencia de pares

Se usa la familia comparable cuando, excluido el propio sector, existen al menos:

- 4 sectores con información utilizable; y
- 100 ROS acumulados en la referencia.

Si no se cumplen ambas condiciones, la referencia retrocede al rendimiento nacional leave-one-out. Esta regla evita que una familia pequeña quede dominada por un único sector extremo.

## 5. Familias comparables

IRAR-1.0 utiliza las siguientes familias analíticas:

- Sector público.
- Pagos, cambio y remesas.
- Intermediación y crédito.
- Mercado de capitales e inversión.
- Seguros y previsión.
- Inmobiliario y fe pública.
- Bienes de alto valor.
- Juego y apuestas.
- Comercio exterior y frontera.
- Otras APNFD.

Las familias son referencias analíticas de ATLAS y no categorías regulatorias ni niveles de riesgo.

## 6. Confianza

`confianza_s = ROS_s / (ROS_s + K)`

La confianza expresa cuánto depende el IRAR ajustado de datos propios frente al suavizamiento. En IRAR-1.0:

- baja: <50%;
- media: 50% a <80%;
- alta: ≥80%.

Los sectores con menos de 100 ROS acumulados quedan fuera del ranking comparativo principal, aunque sus valores y su incertidumbre permanecen visibles.

## 7. IRAR relativo y score para IRG

`IRAR_relativo_s = IRAR_ajustado_s / IRAR_pares_s`

Un valor 1,0 representa el rendimiento esperado de referencia.

Para alimentar el componente sectorial del IRG se utiliza una transformación neutralizada por credibilidad:

`señal_s = clamp(50 + 25 × log2(IRAR_relativo_s), 0, 100)`

`score_IRAR_s = 50 + confianza_s × (señal_s - 50)`

El resultado converge a 50 cuando la evidencia propia es escasa. De esta forma un porcentaje extremo producido por pocos ROS no puede ejercer la misma influencia territorial que un resultado respaldado por miles de observaciones.

El núcleo V/E mantiene sus ponderaciones:

- 35% vulnerabilidad estructural base;
- 25% exposición ENR Chile;
- 20% IRAR;
- 20% materialidad sectorial GAFILAT.

V/E territorial mantiene 85% núcleo sectorial y 15% materialidad económica SII. El IRG superior conserva 45% V/E, 20% densidad SO, 20% brecha potencial de cobertura y 15% amenaza territorial.

## 8. Perfil de reportabilidad IIR × IRAR

ATLAS no promedia IIR e IRAR en un score único. Mantiene ambas dimensiones:

- eje X: IIR;
- eje Y: IRAR ajustado relativo a pares;
- tamaño: ROS acumulados 2021–2025;
- opacidad: confianza estadística.

Perfiles:

- **Intensivo–productivo:** IIR >1,50 e IRAR relativo >1,25.
- **Intensivo–bajo rendimiento:** IIR >1,50 e IRAR relativo <0,80.
- **Selectivo–productivo:** IIR <0,75 e IRAR relativo >1,25.
- **Baja activación:** IIR <0,75 e IRAR relativo <0,80.
- **Comportamiento esperado:** resto de combinaciones en la zona intermedia.

Los nombres son descripciones analíticas, no juicios de cumplimiento.

## 9. Guardrails

IRAR:

- no es una probabilidad de conversión de una cohorte de ROS;
- no mide calidad de un ROS individual;
- no mide riesgo LA/FT de una entidad;
- no determina cumplimiento o incumplimiento;
- no prueba subreporte, reporte defensivo ni buena focalización;
- requiere contexto sobre exposición, modelo de negocio, concentración y cobertura;
- muestra explícitamente la confianza cuando el volumen es bajo.

El perfil IIR × IRAR es una herramienta de priorización y lectura comparativa. Cualquier hipótesis derivada debe validarse con evidencia adicional.

## 10. Autoridad técnica

- Método canónico: `assets/atlas-irar-current.js`.
- UI de reportabilidad: `assets/atlas-reportability-irar.js`.
- Contrato de metodología: `data/irar_methodology_v1.json`.
- Adaptador IRG: `assets/atlas-irg-irar-adapter.module.js`.
- Método IRG resultante: `IRG-LAFT-0.34.0`.
