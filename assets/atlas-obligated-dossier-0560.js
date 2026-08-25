'use strict';

/* ATLAS AML 0.56.0 · build 0560 · Expediente de fiscalización del sujeto obligado
 *
 * Superficie que responde, para un sujeto obligado concreto: qué sabemos, cómo
 * se calculó su prioridad, con qué evidencia, y qué no podemos ver.
 *
 * El orden de lectura del expediente no es decorativo. Va de lo que la UAF
 * declaró (inscripción), a lo que otro registro público dice del mismo sujeto
 * (SII), a lo que la propia UAF ya resolvió sobre él (historial sancionatorio),
 * a dónde queda frente a sus pares reales. La descomposición del índice va
 * primero porque un fiscalizador no debe aceptar un número antes de ver de qué
 * está hecho.
 *
 * Seguridad: sólo lectura bajo la sesión y RLS existentes. Gráficos en SVG con
 * atributos de presentación, sin estilos en línea.
 */
(function atlasObligatedDossier0560(){
  const RELEASE='0.56.0';
  const BUILD='0560';
  const CORE=window.__ATLAS_OBLIGATED__;
  if(!CORE||typeof CORE.esc!=='function'){
    window.__ATLAS_OBLIGATED_DOSSIER__={active:false,reason:'core-0560-unavailable'};
    return;
  }

  const {esc,fmt,pct,day,num,clamp,ipfBar,signature,flagset,BAND_LABEL,SII_STATUS}=CORE;
  const YEAR_TABLE='aml_sii_entity_year';
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const host=()=>document.querySelector('#so-dossier');

  const BASIS_LABEL={
    MAPA_SECTORIAL_IRG_V1:'Mapa sectorial de vulnerabilidad estructural (escala 1–5 adaptada a 0–100)',
    SECTOR_NO_MAPEADO:'El sector inscrito no está en el mapa de vulnerabilidad: el componente queda sin evidencia',
    EVENTOS_UAF_ATRIBUIDOS_CANDIDATO_UNICO:'Eventos sancionatorios UAF atribuidos por coincidencia única de nombre normalizado',
    SIN_EVENTOS_EN_LA_VENTANA_PUBLICADA:'Sin eventos atribuidos en la ventana publicada por la UAF',
    REGISTROS_PUBLICOS_CONTRASTADOS:'Padrón UAF contrastado con el registro tributario del SII',
    PERFIL_TRIBUTARIO_ULTIMO_CORTE:'Perfil tributario del último corte observado',
    SIN_PERFIL_TRIBUTARIO_OBSERVABLE:'Sin perfil tributario observable: el componente queda sin evidencia',
    PERSONA_NATURAL_SIN_PERFIL_DE_EMPRESA:'Persona natural obligada: no le corresponde perfil tributario de empresa, y el componente no se imputa',
    COBERTURA_DE_FUENTES_DEL_CORTE:'Cobertura de fuentes del corte vigente'
  };
  const PEER_BASIS={
    PARES_DEL_SECTOR_OBLIGADO:'Comparado con los pares de su propio sector obligado',
    BASE_SECTORIAL_INSUFICIENTE:'El sector tiene menos de 20 giros observados: no se afirma atipicidad',
    SIN_GIRO_OBSERVADO:'Sin giro económico observado en el corte'
  };
  const EVIDENCE_LABEL={
    sector:'Sector inscrito',sector_canonico:'Sector canónico',escala_origen_1_5:'Escala de origen (1–5)',
    eventos:'Eventos atribuidos',eventos_5a:'Eventos en 5 años',ultimo_evento:'Último evento',
    resoluciones:'Resoluciones',naturaleza:'Naturaleza del sujeto',estado_sii:'Condición tributaria',
    termino_giro:'Término de giro',atipicidad_giro:'Atipicidad del giro',base_atipicidad:'Base de comparación',
    cambio_region:'Cambio de región',cambio_giro:'Cambio de giro',tramo_ventas:'Tramo de ventas',
    tramo_rank:'Posición del tramo',trabajadores:'Trabajadores',aristas_propiedad:'Aristas de propiedad',
    socias_juridicas:'Socias personas jurídicas',participa_en_sociedades:'Participa en sociedades',
    antiguedad_anios:'Antigüedad (años)',fuentes:'Fuentes que lo observan',territorio:'Origen del territorio',
    perfil_sii:'Perfil tributario',corte_padron:'Corte del padrón'
  };
  const TERRITORY_BASIS={
    PADRON_ENTIDAD:'Declarado en el registro de entidades',
    PERFIL_SII:'Recuperado del perfil tributario',
    NO_OBSERVADO:'No observado en el corte'
  };

  function value(v){
    if(v===null||v===undefined||v==='')return '—';
    if(typeof v==='boolean')return v?'Sí':'No';
    if(Array.isArray(v))return v.length?v.map(x=>String(x)).join(' · '):'—';
    if(typeof v==='number')return fmt(v,Number.isInteger(v)?0:2);
    if(/^\d{4}-\d{2}-\d{2}/.test(String(v)))return day(v);
    return String(v);
  }

  /* Dial semicircular. La aguja es el puntaje absoluto; el pie declara la
     posición, porque la banda se ancla en percentiles y no en el puntaje. */
  function dial(subject){
    const score=num(subject.ipf_score);
    const band=subject.ipf_band||'MINIMA';
    const span=Math.PI*70;
    const filled=score===null?0:(clamp(score,0,100)/100)*span;
    return `<div class="so-dial b-${esc(band)}">
      <svg viewBox="0 0 170 100" role="img" aria-label="IPF ${score===null?'no calculable':fmt(score,1)} de 100">
        <path class="arc-track" d="M 15 88 A 70 70 0 0 1 155 88"></path>
        <path class="arc-fill" d="M 15 88 A 70 70 0 0 1 155 88" stroke-dasharray="${filled.toFixed(2)} ${span.toFixed(2)}"></path>
        <text class="val" x="85" y="76">${score===null?'—':fmt(score,1)}</text>
        <text class="cap" x="85" y="92">IPF · 0 A 100</text>
      </svg>
      <div class="so-dial-foot">
        <b>Prioridad ${esc(BAND_LABEL[band]||band)}</b><br>
        Percentil ${esc(fmt(subject.ipf_percentile,1))} del padrón · ${esc(fmt(subject.ipf_sector_percentile,0))} en su sector<br>
        Credibilidad del índice: ${esc(fmt(subject.ipf_credibility_pct,0))}%
      </div>
    </div>`;
  }

  function componentBar(code,value,weight,available){
    const v=num(value);
    if(v===null){
      return `<svg class="so-comp-bar c-${esc(code)}" viewBox="0 0 100 9" preserveAspectRatio="none" role="img" aria-label="Sin evidencia">
        <rect class="void" x="0.5" y="0.5" width="99" height="8" rx="4"></rect></svg>`;
    }
    return `<svg class="so-comp-bar c-${esc(code)}" viewBox="0 0 100 9" preserveAspectRatio="none" role="img" aria-label="${fmt(v,1)} de 100">
      <rect class="track" x="0" y="0" width="100" height="9" rx="4.5"></rect>
      <rect class="fill" x="0" y="0" width="${clamp(v,0,100).toFixed(2)}" height="9" rx="4.5"></rect>
    </svg>`;
  }

  function cascade(subject){
    const comps=Array.isArray(subject.ipf_components)?subject.ipf_components:[];
    if(!comps.length)return '<div class="so-empty">Este corte no materializó la descomposición del índice.</div>';
    const rows=comps.map(c=>{
      const v=num(c.value),contribution=num(c.contribution);
      const basis=BASIS_LABEL[c.basis]||c.basis||'';
      const evidence=c.evidence&&typeof c.evidence==='object'?c.evidence:{};
      const dl=Object.entries(evidence).map(([k,val])=>
        `<dt>${esc(EVIDENCE_LABEL[k]||k.replaceAll('_',' '))}</dt><dd>${esc(value(val))}</dd>`).join('');
      return `<div class="so-comp">
        <span class="name"><b>${esc(c.label||c.code)}</b><small>${esc(basis)}</small></span>
        ${componentBar(c.code,c.value,c.weight)}
        <span class="num${v===null?' dim':''}">${v===null?'sin dato':fmt(v,1)}</span>
        <span class="num weight${contribution===null?' dim':''}">${contribution===null?'—':`${fmt(contribution,1)}`}</span>
        <details class="so-evidence">
          <summary>Cómo se calculó · peso declarado ${esc(fmt(c.weight,0))} de 100</summary>
          <dl>${dl}<span class="reading">${esc(c.reading||'')}</span></dl>
        </details>
      </div>`;
    }).join('');
    return `<div class="so-comp-head"><span>Componente</span><span>Valor observado (0–100)</span><span class="num">Valor</span><span class="num weight">Aporte</span></div>
      <div class="so-waterfall">${rows}</div>
      <div class="so-legend"><span>El aporte es el valor del componente ponderado por su peso y renormalizado entre los componentes con evidencia. Los aportes suman el IPF; un componente sin evidencia no aporta cero, sale del promedio y baja la credibilidad.</span></div>`;
  }

  function fact(term,val,cls){
    return `<div class="so-fact${cls?` ${cls}`:''}"><dt>${esc(term)}</dt><dd${val===null||val===undefined||val===''?' class="dim"':''}>${esc(value(val))}</dd></div>`;
  }

  function registrationLens(subject,sector){
    const vuln=num(subject.sector_vulnerability);
    return `<section class="so-card">
      <header><div><h2>Inscripción y sector obligado</h2><p>Lo que la UAF declara sobre este sujeto y el contexto estructural del sector por el cual quedó obligado. La vulnerabilidad describe al sector: no afirma nada sobre la conducta de esta entidad.</p></div></header>
      <div class="so-facts">
        ${fact('Sector inscrito',subject.uaf_sector)}
        ${fact('Sector canónico',subject.uaf_sector_canonical)}
        ${fact('Naturaleza del sujeto',subject.subject_nature==='PERSONA_NATURAL'?'Persona natural obligada':'Persona jurídica')}
        ${fact('Vulnerabilidad estructural del sector',vuln===null?null:`${fmt(vuln,1)} de 100`)}
        ${fact('Inscritos en el sector',sector?fmt(sector.subject_count):null)}
        ${fact('Eventos UAF por 100 inscritos del sector',sector?fmt(sector.sanction_rate_per_100,2):null)}
        ${fact('Territorio',subject.region||null)}
        ${fact('Origen del territorio',TERRITORY_BASIS[subject.territory_basis]||subject.territory_basis)}
        ${fact('Comuna',subject.commune)}
        ${fact('Corte del padrón',subject.registry_observed_at)}
      </div>
      <div class="so-legend"><span>Documento de origen: ${esc((subject.registry_document_ids||[]).join(' · ')||'no declarado')} · ${esc(subject.registry_source_ref||'sin referencia')}</span></div>
    </section>`;
  }

  function coherenceLens(subject){
    const atyp=num(subject.activity_atypicality);
    const terminated=subject.sii_status==='TERMINATED_AS_PUBLISHED';
    return `<section class="so-card">
      <header><div><h2>Coherencia registral UAF ↔ SII</h2><p>Dos registros públicos hablando del mismo RUT. Una discrepancia entre ellos abre una pregunta de fiscalización; no acredita incumplimiento por sí sola.</p></div></header>
      <div class="so-facts">
        ${fact('Condición tributaria',SII_STATUS[subject.sii_status]||subject.sii_status,terminated?'alert':'')}
        ${fact('Fecha de término de giro',subject.sii_termination_date,terminated?'alert':'')}
        ${fact('Inicio de actividades',subject.sii_activity_start_date)}
        ${fact('Año comercial observado',subject.sii_commercial_year)}
        ${fact('Giro principal declarado',subject.sii_main_activity)}
        ${fact('Sector económico SII',subject.sii_economic_sector)}
        ${fact('Subsector económico SII',subject.sii_economic_subsector)}
        ${fact('Atipicidad del giro en su sector',atyp===null?null:`${fmt(atyp*100,0)}% (comparte giro con ${fmt((num(subject.activity_peer_share)||0)*100,1)}% de sus pares)`,atyp!==null&&atyp>=0.90?'alert':'')}
        ${fact('Base de comparación',PEER_BASIS[subject.activity_peer_basis]||subject.activity_peer_basis)}
        ${fact('Cambio de región declarado',subject.sii_region_changed)}
        ${fact('Cambio de giro declarado',subject.sii_activity_changed)}
        ${fact('Giros registrados',subject.sii_activity_count)}
      </div>
      ${terminated?`<div class="so-legend"><span>Este sujeto registra término de giro publicado en SII y permanece inscrito en el padrón UAF vigente. Es una discrepancia entre dos registros públicos: no es baja del registro ni acredita infracción.</span></div>`:''}
    </section>`;
  }

  function structureLens(subject,years){
    const natural=subject.subject_nature==='PERSONA_NATURAL';
    return `<section class="so-card">
      <header><div><h2>Escala, estructura y trayectoria</h2><p>${natural?'Persona natural obligada: no le corresponde perfil tributario de empresa, de modo que esta lente queda deliberadamente vacía en vez de mostrarse en cero.':'Exposición supervisable declarada ante el SII. El tramo de ventas es un rango publicado, nunca un monto exacto.'}</p></div></header>
      ${natural?'<div class="so-empty">Sin perfil tributario de empresa. La ausencia es esperable por la naturaleza del sujeto y no puntúa como brecha.</div>':`
      <div class="so-facts">
        ${fact('Tramo de ventas',subject.sii_sales_band)}
        ${fact('Posición del tramo',subject.sii_sales_band_rank===null?null:`${fmt(subject.sii_sales_band_rank)} de 13`)}
        ${fact('Trabajadores declarados',subject.sii_workers)}
        ${fact('Antigüedad',subject.entity_age_years===null?null:`${fmt(subject.entity_age_years)} años`)}
        ${fact('Tipo de contribuyente',subject.sii_taxpayer_type)}
        ${fact('Tipo societario',subject.society_type)}
        ${fact('Aristas de propiedad',subject.ownership_edge_count)}
        ${fact('Socias personas jurídicas',subject.legal_entity_partner_count)}
        ${fact('Participa en sociedades',subject.societies_as_partner_count)}
        ${fact('Domicilios registrados',subject.sii_address_count)}
      </div>
      ${trajectory(years)}`}
    </section>`;
  }

  /* Trayectoria: el tramo de ventas es ordinal (1 a 13), así que se dibuja como
     posición y no como monto. Un año sin observación se deja vacío. */
  function trajectory(years){
    const rows=(years||[]).filter(y=>num(y.commercial_year)!==null).sort((a,b)=>a.commercial_year-b.commercial_year);
    if(!rows.length)return '<div class="so-legend"><span>Sin trayectoria por año comercial en el corte vigente.</span></div>';
    const W=520,H=170,PAD={l:30,r:12,t:16,b:26};
    const pw=W-PAD.l-PAD.r,ph=H-PAD.t-PAD.b;
    const step=pw/rows.length,bw=Math.min(44,step*0.6);
    const cols=rows.map((y,i)=>{
      const cx=PAD.l+step*i+step/2;
      const rank=num(y.sales_band_rank);
      const h=rank===null?0:(rank/13)*ph;
      const cls=rank===null?'bar dim':'bar';
      const label=rank===null?'sin observación':`tramo ${rank} de 13`;
      const workers=num(y.workers_numeric);
      return `<g class="col">
        <rect class="${cls}" x="${(cx-bw/2).toFixed(1)}" y="${(PAD.t+ph-Math.max(h,3)).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h,3).toFixed(1)}" rx="2"><title>${esc(y.commercial_year)}: ${esc(label)}${workers===null?'':` · ${fmt(workers)} trabajadores`}</title></rect>
        <text class="val" x="${cx.toFixed(1)}" y="${(PAD.t+ph-Math.max(h,3)-5).toFixed(1)}">${rank===null?'—':rank}</text>
        <text class="lab" x="${cx.toFixed(1)}" y="${(PAD.t+ph+15).toFixed(1)}">${esc(y.commercial_year)}</text>
      </g>`;
    }).join('');
    return `<svg class="so-series" viewBox="0 0 ${W} ${H}" role="img" aria-label="Trayectoria del tramo de ventas por año comercial">
      <line class="axis" x1="${PAD.l}" y1="${PAD.t+ph}" x2="${PAD.l+pw}" y2="${PAD.t+ph}"></line>${cols}</svg>
      <div class="so-legend"><span>Altura = posición del tramo de ventas publicado (1 a 13). Un tramo es un rango, no un monto. Un año sin observación se dibuja vacío y no como cero.</span></div>`;
  }

  function supervisionLens(subject,events){
    const list=(events||[]);
    const attribution=subject.sanction_attribution==='CANDIDATO_POR_NOMBRE_NORMALIZADO';
    return `<section class="so-card">
      <header><div><h2>Historial de supervisión UAF</h2><p>Eventos sancionatorios publicados por la UAF y atribuidos a este sujeto por coincidencia única de nombre normalizado contra el padrón. La atribución es candidata: no promueve identidad canónica ni modifica el registro de sanciones.</p></div><span class="so-hint">${fmt(list.length)} eventos</span></header>
      ${list.length?`<div class="so-timeline">${list.map(e=>`
        <div class="so-event">
          <span class="when">${esc(day(e.event_date))}</span>
          <span class="rail"><i></i></span>
          <span class="body">
            <b>${esc(e.event_category||'Evento sancionatorio UAF')}${e.resolution_ref?` · Resolución ${esc(e.resolution_ref)}`:''}</b>
            <small>Estado publicado: ${esc(e.event_status||'no declarado')} · Nombre en la fuente: ${esc(e.source_entity_name||'—')}</small>
            <small>Atribución: ${esc(e.resolution_status==='CANDIDATO_UNICO'?'candidato único por nombre normalizado':e.resolution_status||'—')}${e.confidence?` · confianza declarada ${esc(fmt(Number(e.confidence)*100,0))}%`:''}</small>
          </span>
        </div>`).join('')}</div>`
      :`<div class="so-empty">Sin eventos sancionatorios de la UAF atribuidos a este sujeto en la ventana publicada. Ausencia de evento atribuido no es constancia de cumplimiento.</div>`}
      ${attribution?`<div class="so-legend"><span>Sanción administrativa no es delito. Estos eventos describen la relación de supervisión entre la UAF y el sujeto obligado, no una imputación penal.</span></div>`:''}
    </section>`;
  }

  /* Posición frente a pares: el percentil sectorial es lo que un fiscalizador
     puede accionar, porque descuenta la vulnerabilidad estructural que todos
     los pares comparten por igual. */
  function peerLens(subject,sector){
    const p=num(subject.ipf_sector_percentile);
    const g=num(subject.ipf_percentile);
    const marker=v=>v===null?'':`<g><line class="marker" x1="${(v).toFixed(1)}" y1="2" x2="${(v).toFixed(1)}" y2="26"></line><circle class="me" cx="${(v).toFixed(1)}" cy="14" r="3.4"></circle></g>`;
    const scale=(label,v)=>`<div class="so-row" role="group" aria-label="${esc(label)}">
        <span class="label">${esc(label)}</span>
        <svg class="so-peer" viewBox="0 0 100 28" preserveAspectRatio="none" role="img" aria-label="${v===null?'no calculable':`percentil ${fmt(v,1)}`}">
          <rect class="hist" x="0" y="12" width="100" height="4" rx="2"></rect>${marker(v)}
        </svg>
        <span class="num">${v===null?'—':`p${fmt(v,0)}`}</span>
      </div>`;
    return `<section class="so-card">
      <header><div><h2>Posición frente a pares</h2><p>Percentil es posición, no desempeño. La posición dentro del sector es la más accionable: descuenta la vulnerabilidad estructural que todos los pares del sector comparten por igual.</p></div></header>
      <div class="so-rows">
        ${scale('Dentro de su sector obligado',p)}
        ${scale('Dentro del padrón completo',g)}
      </div>
      <div class="so-facts">
        ${fact('Sector',subject.uaf_sector_canonical)}
        ${fact('Pares en el sector',sector?fmt(sector.subject_count):null)}
        ${fact('IPF medio del sector',sector?fmt(sector.ipf_mean,1):null)}
        ${fact('IPF percentil 90 del sector',sector?fmt(sector.ipf_p90,1):null)}
        ${fact('Sujetos del sector en prioridad alta',sector?fmt((num(sector.band_muy_alta)||0)+(num(sector.band_alta)||0)):null)}
        ${fact('Con término de giro en el sector',sector?fmt(sector.sii_terminated):null)}
      </div>
    </section>`;
  }

  function crossLens(subject){
    const ipa3=num(subject.ipa3_score);
    return `<section class="so-card">
      <header><div><h2>Lectura cruzada del Workbench</h2><p>El IPF prioriza fiscalización sobre el padrón obligado. El IPA3 v0.4-shadow prioriza revisión analítica sobre el universo completo de entidades. Son metodologías distintas y no se suman: cuando difieren, la diferencia es información.</p></div></header>
      <div class="so-facts">
        ${fact('IPF · prioridad fiscalizadora',subject.ipf_score===null?null:`${fmt(subject.ipf_score,1)} · ${BAND_LABEL[subject.ipf_band]||subject.ipf_band}`)}
        ${fact('IPA3 v0.4-shadow',ipa3===null?null:fmt(ipa3,1))}
        ${fact('Banda IPA3',subject.ipa3_band==='SIN_MARCA_SHADOW'?'Ninguna marca activada':subject.ipa3_band)}
        ${fact('Marca dominante IPA3',subject.ipa3_dominant_mark)}
        ${fact('Fuentes que lo observan',subject.source_count)}
        ${fact('ID de Entidad',subject.entity_id)}
      </div>
      ${subject.entity_id?`<div class="so-legend"><span><button type="button" class="so-back" id="so-open-entity">Abrir Entidad 360 de este sujeto →</button></span></div>`:''}
    </section>`;
  }

  function identity(subject){
    return `<div class="so-id">
      <div>
        <h1>${esc(subject.registry_name||subject.entity_name||subject.rut)}</h1>
        <div class="so-meta">
          <span>RUT <b>${esc(subject.rut)}</b></span>
          <span>${esc(subject.uaf_sector_canonical||'Sector no resuelto')}</span>
          <span>${esc(subject.region||'Sin territorio observado')}</span>
          <span>${esc(SII_STATUS[subject.sii_status]||subject.sii_status||'Condición no resuelta')}</span>
          <span>${esc(subject.subject_nature==='PERSONA_NATURAL'?'Persona natural obligada':'Persona jurídica')}</span>
        </div>
        ${flagset(subject.ipf_flags)}
      </div>
      ${dial(subject)}
    </div>`;
  }

  function readingRules(subject){
    return `<section class="so-rules">
      <h2>Qué afirma y qué no afirma este expediente</h2>
      <p>Todo lo anterior es lectura de registros públicos bajo el corte declarado. Ninguna cifra de esta ficha establece incumplimiento, y ninguna reemplaza la fiscalización.</p>
      <ul>
        <li><b>El IPF ordena, no acusa.</b> Prioriza esfuerzo de supervisión con la evidencia del corte; no estima probabilidad de LA/FT.</li>
        <li><b>La banda es posición en el padrón vigente.</b> Si el padrón cambia, la banda puede moverse sin que este sujeto haya cambiado.</li>
        <li><b>La vulnerabilidad sectorial es del sector.</b> No transmite conducta a este sujeto por estar inscrito en él.</li>
        <li><b>Los eventos sancionatorios están atribuidos como candidatos.</b> La coincidencia de nombre normalizado no promueve identidad canónica.</li>
        <li><b>Ausencia de dato no es cero.</b> Credibilidad declarada del índice: ${esc(fmt(subject.ipf_credibility_pct,0))}% del peso total respaldado por evidencia.</li>
        <li><b>Versión del índice:</b> ${esc(subject.ipf_version||'IPF-1.0')} · corte del cálculo ${esc(day(subject.refreshed_at))}.</li>
      </ul>
    </section>`;
  }

  async function loadYears(entityId){
    if(!entityId)return [];
    const client=db();
    if(!client)return [];
    const {data,error}=await client.from(YEAR_TABLE)
      .select('commercial_year,sales_band_rank,sales_band_code,workers_numeric,region,main_activity,sales_band_delta')
      .eq('entity_id',entityId).order('commercial_year',{ascending:true});
    if(error)return [];
    return data||[];
  }

  function shell(inner){
    const box=host();
    if(!box)return;
    box.innerHTML=`<button type="button" class="so-back" id="so-back">← Volver al padrón</button>${inner}`;
    document.querySelector('#so-back')?.addEventListener('click',()=>CORE.back());
    document.querySelector('#so-open-entity')?.addEventListener('click',()=>{
      const id=box.dataset.soEntity;
      if(!id)return;
      if(typeof window.navigate==='function')Promise.resolve(window.navigate('entities')).then(()=>{
        const entry=window.__ATLAS_ENTITY_ENTRY__;
        if(entry&&typeof entry.open==='function')entry.open(id);
      }).catch(()=>{});
    });
  }

  async function renderDossier(context){
    const box=host();
    if(!box)return;
    if(!context){shell('<div class="so-empty">Sin sujeto obligado seleccionado.</div>');return;}
    if(context.loading){box.innerHTML='<div class="so-loading">Abriendo expediente de fiscalización…</div>';return;}
    if(context.error||!context.subject){
      shell(`<div class="so-error"><b>No fue posible abrir el expediente.</b><br>${esc(context.error||'El sujeto obligado no está en el corte vigente.')}</div>`);
      return;
    }
    const subject=context.subject;
    const sector=context.sector||null;
    box.dataset.soEntity=subject.entity_id||'';
    shell(`${identity(subject)}
      <section class="so-card">
        <header><div><h2>Cómo se construye la prioridad de este sujeto</h2><p>Cinco componentes con peso declarado. Cada uno abre su evidencia de cálculo y su regla de lectura. Un fiscalizador no debería aceptar el número antes de ver de qué está hecho.</p></div><span class="so-hint">IPF-1.0</span></header>
        ${cascade(subject)}
      </section>
      <div class="so-grid g2">
        ${registrationLens(subject,sector)}
        ${coherenceLens(subject)}
      </div>
      ${supervisionLens(subject,context.events)}
      <div class="so-grid g2">
        <div id="so-structure"><div class="so-card"><div class="so-loading">Consultando trayectoria tributaria…</div></div></div>
        ${peerLens(subject,sector)}
      </div>
      ${crossLens(subject)}
      ${readingRules(subject)}`);

    const years=await loadYears(subject.entity_id);
    const slot=document.querySelector('#so-structure');
    if(slot)slot.innerHTML=structureLens(subject,years);
  }

  window.__ATLAS_OBLIGATED__=Object.assign(window.__ATLAS_OBLIGATED__||{},{renderDossier});
  window.__ATLAS_OBLIGATED_DOSSIER__={active:true,release:RELEASE,build:BUILD,installedAt:new Date().toISOString()};
})();
