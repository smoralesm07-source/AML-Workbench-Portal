'use strict';

/* Complete explainability dictionary for all rule families currently present in v0.12/v0.16. */
FINDING_LABELS_V16.GOVERNED_AML_SIGNAL='Señal AML gobernada';
FINDING_RULES_V16.GOVERNED_AML_SIGNAL='Recupera una señal aprobada en el Signals Registry y la vincula al mismo Entity ID mediante evidencia trazable. La presencia de la señal eleva prioridad de revisión, pero no constituye una conclusión de LA/FT.';

Object.assign(PATTERN_RULES_V16,{
  CAIDA_ROS:'Cruce temporal sectorial: compara el volumen agregado de ROS 2025 con 2024 entre sectores con base comparable. La alerta identifica una caída ubicada en la cola inferior de la distribución; no implica que una entidad individual haya omitido reportar.',
  CAPACIDAD_TEMPORAL_PARCIAL:'Control de calidad del sistema: verifica qué familias disponen de series temporales comparables. La alerta se activa cuando la temporalidad robusta todavía no cubre todas las señales sectoriales o territoriales.',
  COBERTURA_BAJA:'Cruce de cobertura: compara entidades observadas/registradas frente al universo fuerte estimado del sector y su brecha material. Prioriza sectores ubicados en la cola inferior de cobertura; es una señal de supervisión agregada, no de incumplimiento individual.',
  CONVERGENCIA_3PLUS:'Cruce multifuente: exige que una misma entidad canónica aparezca en al menos tres productores independientes y posea contenido analítico adicional que justifique revisión conjunta.',
  HUB_TOPOLOGICO:'Algoritmo de grafos: calcula grado y condición de punto de articulación sobre relaciones publicadas. Se alerta una entidad con conectividad/topología destacada; centralidad no equivale a riesgo ni transmite señales de sus vecinos.',
  MATERIALIDAD_PENDIENTE:'Control metodológico: marca que la materialidad monetaria comparable aún no está gobernada en Fusion —por ejemplo, mientras Presupuesto Abierto no tenga adaptador canónico— y evita mezclarla indebidamente con IPA.',
  OUTLIER_ANOMALIAS:'Cruce sectorial normalizado: anomalías contextuales SII / tamaño del universo SII fuerte del sector. Se compara la densidad entre sectores y se alerta el extremo superior.',
  OUTLIER_BRECHA:'Cruce sectorial: calcula la brecha observable entre universo fuerte y cobertura UAF/ICP según la definición gobernada y compara su posición frente a pares. La cola superior se prioriza para screening.',
  SEÑAL_GOBERNADA:'Cruce con Signals Registry: verifica que el hallazgo esté respaldado por una señal AML gobernada, con identificador y evidencia trazable. La alerta prioriza revisión sin convertir la señal en conclusión de LA/FT.',
  SILENCIO_PERSISTENTE_ROS:'Cruce temporal agregado por sector: verifica que existan entidades registradas y que la serie pública agregada muestre cero ROS durante 2021–2025. Se denomina “silencio sectorial” y nunca permite afirmar que una entidad individual incumplió su deber de reportar.'
});
