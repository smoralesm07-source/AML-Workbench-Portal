'use strict';

/* v0.19.3 · Questions stays an entry point, not a duplicate UAF dashboard. */

const v0193BaseAnswerQuestion=v019AnswerQuestion;

v019LoadQuestions=async function(){
  state.view='questions';shell('Preguntas','Preguntas transversales para entrar al análisis. La dimensión regulatoria y de reportabilidad se resuelve en Inteligencia UAF.');
  try{
    const core=await v019LoadCore();
    const q=[
      ['priority','¿Qué entidades tienen mayor prioridad investigativa y por qué?','Disponible','Convergencia'],
      ['change','¿Qué cambió recientemente?','Disponible parcial','Temporalidad'],
      ['emerging','¿Dónde están emergiendo fenómenos nuevos?','Disponible','Territorio + Prensa'],
      ['multisource','¿Qué entidades tienen señales procedentes de 3 o más fuentes independientes?','Disponible','Convergencia'],
      ['uaf-intelligence','¿Qué sectores UAF muestran silencios, baja intensidad o brechas de cobertura?','Disponible','Inteligencia UAF'],
      ['sanctions','¿Qué sanciones o recurrencias merecen revisión primero?','Disponible','Sanciones'],
      ['territory','¿Qué regiones concentran mayor prioridad analítica no UAF?','Disponible','Territorio'],
      ['osfl','¿Qué OSFL aparecen en convergencia con otros radares?','Disponible','OSFL'],
      ['budget','¿Qué proveedores muestran gasto inusual y antecedentes en otros radares?','Pendiente de Fusion','Presupuesto Abierto'],
      ['cgr','¿Qué proveedores/organismos combinan hallazgos CGR con otras señales?','Pendiente de Fusion','CGR'],
      ['delictual','¿Qué cambios económicos coinciden con presión delictual comunal?','Pendiente de Fusion','Delictual']
    ];
    v019Content().innerHTML=`<section class="v019-grid"><article class="v019-card v019-full"><div class="v019-card-head"><div><h2>Matriz de preguntas</h2><p>Las preguntas UAF no replican resultados aquí: abren la sección única de Inteligencia UAF.</p></div><span class="hint">pregunta → evidencia</span></div><div class="v019-questions">${q.map(x=>`<button type="button" class="v019-question ${x[2].startsWith('Pendiente')?'pending':''}" data-question="${x[0]}"><b>${esc(x[1])}</b><span>${esc(x[3])} · ${esc(x[2])}</span></button>`).join('')}</div></article><article class="v019-card v019-full" id="v019-question-answer"><div class="v019-empty">Selecciona una pregunta para construir la respuesta.</div></article></section>`;
    document.querySelectorAll('[data-question]').forEach(b=>b.addEventListener('click',()=>v019AnswerQuestion(b.dataset.question,core,true)));
  }catch(e){v019Content().innerHTML=`<div class="v019-error">${esc(e?.message||String(e))}</div>`;}
};

v019AnswerQuestion=async function(id,core,inPage=false){
  if(['uaf-intelligence','gap','uaf-cross'].includes(id)){
    return v019LoadUaf();
  }
  if(id==='emerging'){
    const html=`<div class="v019-answer"><div class="q">Respuesta</div><h2>Fenómenos nuevos o en movimiento</h2><p>Pattern Intelligence aporta cambios estructurados no regulatorios; Radar Prensa agrega momentum periodístico sin modificar riesgo.</p></div>${v019PatternList(core.patterns.filter(p=>!v0193PatternIsUaf(p)&&['TERRITORIO','INTELIGENCIA'].includes(p.family)),8)}<div class="v019-section-gap">${v019PressCards(core.press)}</div>`;
    if(inPage){const box=document.querySelector('#v019-question-answer');if(box){box.innerHTML=html;v019BindQuestionResult(box,core);}return;}
    v019OpenDrawer(html);v019BindQuestionResult(document.querySelector('#v019-drawer-body'),core);return;
  }
  return v0193BaseAnswerQuestion(id,core,inPage);
};
