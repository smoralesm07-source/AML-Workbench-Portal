'use strict';
/* ATLAS AML · current sanctions interpretation layer. Presentation-only: reads the governed v12 DOM and never mutates source data. */
(function(){
  let scheduled=false,lastSig='';
  const n=(v)=>{const m=String(v||'').replace(/\./g,'').replace(',','.').match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):0};
  const pct=(a,b)=>b>0?Math.max(0,Math.min(100,a/b*100)):0;
  const fmtPct=(v)=>Number.isFinite(v)?`${v.toLocaleString('es-CL',{maximumFractionDigits:1})}%`:'—';
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function textFromCard(cards,needle){const c=cards.find(x=>x.innerText.toLowerCase().includes(needle));return c?c.innerText:''}
  function extractLeading(text){const m=String(text||'').match(/(?:^|\n)\s*([\d\.]+(?:,\d+)?)/);return m?n(m[1]):0}
  function extractNamed(text,re){const m=String(text||'').match(re);return m?n(m[1]):0}
  function sanitizeImpossibleCoverage(cards){
    const first=cards[0]; if(!first)return;
    const candidates=[...first.querySelectorAll('small,span,div,p')];
    for(const el of candidates){const t=el.textContent||'';const m=t.match(/([\d\.]+(?:,\d+)?)%\s+del registro UAF/i);if(!m)continue;const v=n(m[1]);if(v>100){el.textContent='Comparador de cobertura UAF no disponible para este corte';el.setAttribute('title','Se ocultó un porcentaje inválido superior a 100%; la cifra de entidades sancionadas se conserva.');}}
  }
  function build(root){
    const kpis=root.querySelector('.kpis'); if(!kpis)return;
    const cards=[...kpis.querySelectorAll('.kpi')]; if(cards.length<4)return;
    sanitizeImpossibleCoverage(cards);
    const allText=cards.map(c=>c.innerText).join('|');
    const so=extractLeading(textFromCard(cards,'so inscritos sancionados'));
    const other=extractLeading(textFromCard(cards,'otras entidades sancionadas'));
    const events=extractLeading(textFromCard(cards,'eventos sancionatorios'));
    const amount=extractLeading(textFromCard(cards,'magnitud publicada'));
    const potential=extractNamed(textFromCard(cards,'otras entidades sancionadas'),/(\d[\d\.]*)\s+marcadas como Potenciales SO/i);
    const laft=extractNamed(textFromCard(cards,'eventos sancionatorios'),/(\d[\d\.]*)\s+con materia ALA\/CFT directa/i);
    const coverage=extractNamed(textFromCard(cards,'magnitud publicada'),/disponible en\s+([\d\.,]+)%/i);
    const stats=root.querySelector('#listStats')?.innerText||'';
    const visible=extractNamed(stats,/(\d[\d\.]*)\s+entidades/i);
    const recurrent=extractNamed(stats,/(\d[\d\.]*)\s+recurrentes/i);
    const pPotential=pct(potential,other),pLaft=pct(laft,events),pRec=pct(recurrent,visible);
    const sig=[allText,stats].join('||'); if(sig===lastSig&&root.querySelector('.sv12-intel'))return; lastSig=sig;
    let deck=root.querySelector('.sv12-intel'); if(!deck){deck=document.createElement('section');deck.className='sv12-intel';kpis.insertAdjacentElement('afterend',deck)}
    const dominant=[['materia ALA/CFT',pLaft],['potenciales SO',pPotential],['recurrencia',pRec]].sort((a,b)=>b[1]-a[1])[0];
    const riskTone=pLaft>=40||pRec>=35?'alta':pLaft>=20||pRec>=20?'media':'acotada';
    const reading=`El universo visible contiene <strong>${events.toLocaleString('es-CL')} eventos</strong> sobre <strong>${(so+other).toLocaleString('es-CL')} entidades sancionadas</strong>. La señal proporcional más intensa es <em>${dominant[0]}</em> (${fmtPct(dominant[1])}). ${potential?`Entre las otras entidades, <strong>${potential.toLocaleString('es-CL')}</strong> están marcadas como Potenciales SO (${fmtPct(pPotential)}). `:''}${laft?`Los eventos con materia ALA/CFT directa representan ${fmtPct(pLaft)} del total visible. `:''}${recurrent?`La recurrencia alcanza ${fmtPct(pRec)} de las entidades actualmente listadas. `:''}La intensidad interpretativa del corte es <strong>${riskTone}</strong> y debe leerse como priorización analítica, no como conclusión de riesgo o ilicitud.`;
    deck.innerHTML=`<div class="sv12-intel-main"><div class="sv12-intel-head"><div><div class="sv12-intel-eyebrow">Lectura integrada · sanciones</div><h3>Señales que explican el corte actual</h3></div><span class="sv12-intel-badge">filtros activos</span></div><div class="sv12-intel-metrics">
      <div class="sv12-intel-metric purple"><span>Materia ALA/CFT directa</span><b>${fmtPct(pLaft)}</b><small>${laft.toLocaleString('es-CL')} de ${events.toLocaleString('es-CL')} eventos</small><div class="sv12-intel-track"><i style="width:${pLaft}%"></i></div></div>
      <div class="sv12-intel-metric teal"><span>Brecha potencial de perímetro</span><b>${fmtPct(pPotential)}</b><small>${potential.toLocaleString('es-CL')} potenciales SO</small><div class="sv12-intel-track"><i style="width:${pPotential}%"></i></div></div>
      <div class="sv12-intel-metric"><span>Recurrencia visible</span><b>${visible?fmtPct(pRec):'—'}</b><small>${visible?`${recurrent.toLocaleString('es-CL')} de ${visible.toLocaleString('es-CL')} entidades`:'se calcula al cargar listado'}</small><div class="sv12-intel-track"><i style="width:${pRec}%"></i></div></div>
      <div class="sv12-intel-metric warn"><span>Cobertura de monto UF</span><b>${coverage?fmtPct(coverage):'—'}</b><small>${amount?`${amount.toLocaleString('es-CL')} UF publicadas`:'monto no visible'}</small><div class="sv12-intel-track"><i style="width:${Math.min(100,coverage)}%"></i></div></div>
    </div></div><aside class="sv12-intel-side"><div class="sv12-intel-head"><div><div class="sv12-intel-eyebrow">Interpretación ejecutiva</div><h3>Qué mirar primero</h3></div></div><div class="sv12-intel-reading">${reading}</div><div class="sv12-intel-caution"><b>Regla de lectura.</b> Sanción, recurrencia e inscripción son evidencia administrativa observable. La convergencia de señales sirve para ordenar revisión; no acredita por sí sola lavado de activos, financiamiento del terrorismo ni incumplimiento vigente.</div></aside>`;
  }
  function scan(){scheduled=false;document.querySelectorAll('.sv12-approved').forEach(build)}
  function queue(){if(scheduled)return;scheduled=true;requestAnimationFrame(scan)}
  const obs=new MutationObserver(queue);obs.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue,{once:true});else queue();
  window.addEventListener('hashchange',queue);window.addEventListener('popstate',queue);
})();
