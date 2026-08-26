'use strict';
/* ATLAS AML · Universo SO Intelligence 0.80
 * Mesa analítica centrada en entidad. Integra padrón UAF, SII, reportabilidad,
 * supervisión, RES, Mercado Público y contexto de prensa disponible.
 * Semántica: hechos + contexto + hipótesis de revisión; nunca imputación LA/FT.
 */
(function atlasUniversoSOIntelligence0800(){
  if(window.AtlasUniversoSO0800)return;
  const VERSION='0.80.0',VIEW='sujetos-obligados';
  const T={
    subjects:'aml_uaf_obligated_subject_snapshot',
    reporting:'aml_v_uaf_entity_reporting_behavior_0620',
    obligation:'aml_v_uaf_reporting_obligation_0620',
    mp:'aml_entity_mp_summary_v0680',
    lifecycle:'aml_entity_lifecycle_v0680',
    potential:'aml_v_uaf_potential_current',
    universe:'aml_v_uaf_universe_current_v0671'
  };
  const S={mode:'inscritos',rows:[],total:0,selected:null,detail:null,loading:false,error:null,filters:{q:'',sector:'',region:'',focus:''},options:{sectors:[],regions:[]},universe:null,request:0};
  const PRESS_FEED='https://raw.githubusercontent.com/smoralesm07-source/Monitor/atlas-press-state/atlas_prensa.json';
  let pressCache=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
  const fmt=(v,d=0)=>num(v)==null?'No observado':num(v).toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d});
  const pct=v=>num(v)==null?'No observado':`${(num(v)*100).toLocaleString('es-CL',{maximumFractionDigits:0})}%`;
  const date=v=>v?String(v).slice(0,10):'No observado';
  const money=v=>num(v)==null?'No observado':new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(num(v));
  const normRut=v=>String(v||'').toUpperCase().replace(/[^0-9K]/g,'');
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(s\.?a\.?|spa|ltda|eirl|limitada)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null)}catch{return window.sb||null}};
  const host=()=>document.querySelector('#content');
  const labelStatus=v=>({ACTIVE_AS_PUBLISHED:'Vigente según SII',TERMINATED_AS_PUBLISHED:'Término de giro publicado',NOT_OBSERVED:'No observado en SII'}[v]||v||'No observado');
  const band=v=>({MUY_ALTA:'Muy alta',ALTA:'Alta',MEDIA:'Media',BAJA:'Baja',MINIMA:'Mínima'}[v]||v||'No calculada');
  function queryText(q,text,cols){const s=String(text||'').replace(/[%,()]/g,' ').trim();return s.length<2?q:q.or(cols.map(c=>`${c}.ilike.%${s}%`).join(','));}
  function setView(){try{if(window.state)window.state.view=VIEW}catch{}}

  async function loadUniverse(){const c=db();if(!c)return;const r=await c.from(T.universe).select('*').maybeSingle();if(!r.error)S.universe=r.data||null;}
  async function loadOptions(){const c=db();if(!c)return;const r=await c.from(T.subjects).select('uaf_sector_canonical,region').limit(12000);if(r.error)return;S.options.sectors=[...new Set((r.data||[]).map(x=>x.uaf_sector_canonical).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));S.options.regions=[...new Set((r.data||[]).map(x=>x.region).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));}
  async function loadRows(){
    const c=db();if(!c)throw new Error('Sesión de datos no disponible');
    if(S.mode==='potenciales'){
      let q=c.from(T.potential).select('*',{count:'estimated'}),f=S.filters;
      q=queryText(q,f.q,['entity_name','rut']);if(f.sector)q=q.eq('implied_sector',f.sector);if(f.region)q=q.eq('region',f.region);
      const r=await q.order('ivo_score',{ascending:false,nullsFirst:false}).order('materiality_score',{ascending:false,nullsFirst:false}).limit(150);if(r.error)throw r.error;S.rows=r.data||[];S.total=r.count||S.rows.length;return;
    }
    let q=c.from(T.subjects).select('*',{count:'estimated'}),f=S.filters;
    q=queryText(q,f.q,['registry_name','entity_name','rut']);if(f.sector)q=q.eq('uaf_sector_canonical',f.sector);if(f.region)q=q.eq('region',f.region);
    if(f.focus==='terminated')q=q.eq('sii_status','TERMINATED_AS_PUBLISHED');
    if(f.focus==='sanctioned')q=q.gt('sanction_event_count',0);
    if(f.focus==='reporting-gap')q=q.lt('source_count',2);
    if(f.focus==='complex')q=q.gt('ownership_edge_count',0);
    if(f.focus==='high-ipf')q=q.in('ipf_band',['MUY_ALTA','ALTA']);
    const r=await q.order('ipf_score',{ascending:false,nullsFirst:false}).limit(150);if(r.error)throw r.error;S.rows=r.data||[];S.total=r.count||S.rows.length;
  }

  async function loadPress(name){
    if(!name)return null;
    try{
      if(!pressCache){const r=await fetch(`${PRESS_FEED}?_atlas=${Date.now()}`,{cache:'no-store',credentials:'omit'});if(!r.ok)throw new Error(`HTTP ${r.status}`);pressCache=await r.json();}
      const entities=Array.isArray(pressCache?.entities)?pressCache.entities:[],mentions=Array.isArray(pressCache?.mentions)?pressCache.mentions:[],articles=Array.isArray(pressCache?.articles)?pressCache.articles:[];
      const target=norm(name),tt=target.split(' ').filter(x=>x.length>2),rank=[];
      for(const e of entities){for(const raw of [e?.name,...(Array.isArray(e?.aliases)?e.aliases:[])].filter(Boolean)){const n=norm(raw);if(!n)continue;const et=n.split(' ').filter(x=>x.length>2),inter=tt.filter(x=>et.includes(x)).length,dice=(2*inter)/Math.max(1,tt.length+et.length),exact=n===target;const coverage=inter/Math.max(1,Math.min(tt.length,et.length));if(exact||(dice>=.88&&inter>=3&&coverage>=.82))rank.push({e,score:exact?1:dice,exact});}}
      rank.sort((a,b)=>b.score-a.score);if(!rank.length)return null;const top=rank[0],second=rank[1];if(!top.exact&&top.score<.93)return null;if(!top.exact&&second&&top.score-second.score<.07)return null;
      const aid=new Map(articles.map(a=>[String(a.id),a]));const items=mentions.filter(m=>String(m.press_entity_id||'')===String(top.e.press_entity_id||'')).map(m=>({m,a:aid.get(String(m.article_id))||{}})).sort((x,y)=>String(y.a.date||'').localeCompare(String(x.a.date||'')));
      return {entity:top.e,items,match:top.exact?'EXACT_NOMINAL':'STRICT_UNAMBIGUOUS'};
    }catch(e){return {error:String(e?.message||e),items:[]};}
  }

  async function loadDetail(row){
    if(!row)return null;const c=db(),rut=String(row.rut||''),rutKey=normRut(rut),entityId=row.entity_id||null,name=row.registry_name||row.entity_name||row.name||'';
    const queries=[];
    const get=(table,select='*')=>c.from(table).select(select).eq('rut',rut).maybeSingle();
    if(S.mode==='inscritos'){
      queries.push(get(T.reporting));queries.push(get(T.obligation));
      queries.push(c.from(T.mp).select('*').eq('rut_key',rutKey).maybeSingle());
      queries.push(entityId?c.from(T.lifecycle).select('*').eq('entity_id',entityId).order('event_date',{ascending:false}).limit(40):Promise.resolve({data:[],error:null}));
    }
    const pressP=loadPress(name);
    const settled=await Promise.allSettled(queries);const val=i=>settled[i]?.status==='fulfilled'&&!settled[i].value?.error?settled[i].value.data:null;
    return {row,reporting:val(0),obligation:val(1),mp:val(2),lifecycle:Array.isArray(val(3))?val(3):[],press:await pressP};
  }

  function finding(level,title,body,source){return {level,title,body,source};}
  function deriveFindings(d){
    if(!d)return[];const r=d.row||{},rep=d.reporting||{},mp=d.mp||{},p=d.press||{},out=[];
    if(r.sii_status==='TERMINATED_AS_PUBLISHED')out.push(finding('high','Registro UAF vigente con término de giro SII',`SII publica término de giro${r.sii_termination_date?' el '+date(r.sii_termination_date):''}; la entidad continúa observada en el padrón UAF del corte. Es una discrepancia registral a revisar, no una conclusión de incumplimiento.`,'UAF + SII'));
    if((r.subject_nature||'').toUpperCase().includes('JUR')&&!r.sii_status)out.push(finding('med','Perfil tributario no observado','Para una persona jurídica inscrita no se materializó estado tributario SII en el snapshot actual. Debe tratarse como brecha de observabilidad, nunca como inactividad.','UAF + SII'));
    if(num(r.sanction_event_count)>0)out.push(finding('high','Antecedente supervisor publicado',`${fmt(r.sanction_event_count)} evento(s) sancionatorio(s) UAF vinculados; la atribución por nombre puede ser candidata y debe conservar su estatus de identidad.`,'Radar Sanciones UAF'));
    if(r.sii_activity_changed||r.sii_region_changed)out.push(finding('med','Cambios registrales observados',[r.sii_activity_changed?'cambio de actividad/giro':'',r.sii_region_changed?'cambio de región':''].filter(Boolean).join(' + ')+'. Se presenta como contexto de trayectoria tributaria.','SII'));
    if(rep.behavior_source_state==='OBSERVED'){
      if(num(rep.ros_12m)===0)out.push(finding('med','Sin ROS observados en 12 meses','El contrato de reportabilidad materializado registra 0 ROS en los últimos 12 meses. Esta lectura depende de cobertura y corte de la fuente; no equivale por sí sola a incumplimiento.','Reportabilidad UAF'));
      if(num(rep.ros_12m_sector_percentile)!=null&&num(rep.ros_12m_sector_percentile)>=.9)out.push(finding('ctx','Reportabilidad ROS alta frente a pares',`La entidad se ubica aproximadamente en el percentil ${Math.round(num(rep.ros_12m_sector_percentile)*100)} de ROS 12m dentro de su sector. Es comparación de comportamiento, no calidad del reporte.`,'Reportabilidad UAF'));
    }
    if(num(mp.order_count)>0){const direct=num(mp.direct_order_count)||0,total=num(mp.order_count)||1,share=direct/total;out.push(finding(share>=.5?'med':'ctx','Relación con gasto público',`${fmt(mp.order_count)} orden(es), ${fmt(mp.buyer_count)} comprador(es) y ${money(mp.total_clp)} entre 2023–2026${direct?`; ${fmt(direct)} por mecanismo directo (${Math.round(share*100)}%)`:''}. Requiere lectura en contexto de sector y contratación.`,'Mercado Público'));}
    if(Array.isArray(p.items)&&p.items.length)out.push(finding('ctx','Figuración en prensa abierta',`${fmt(p.items.length)} mención(es) asociadas mediante ${p.match==='EXACT_NOMINAL'?'coincidencia nominal exacta':'matching nominal fuerte no ambiguo'}. La prensa es contexto OSINT y no acredita identidad, delito ni conducta.`,'Radar Prensa'));
    if(num(r.ownership_edge_count)>0||num(r.legal_entity_partner_count)>0)out.push(finding('ctx','Estructura societaria observable',`${fmt(r.ownership_edge_count)} vínculo(s) de propiedad y ${fmt(r.legal_entity_partner_count)} socio(s) persona jurídica observados en la caracterización disponible.`,'RES / estructura'));
    if(!out.length)out.push(finding('ctx','Sin combinación destacada materializada','Las fuentes consultadas no levantan una combinación prioritaria para esta entidad en el corte actual. Esto no significa ausencia de antecedentes; solo refleja lo materializado.','Atlas multifuente'));
    return out;
  }

  function top(){const reg=S.universe?.obligated_ruts, pot=S.universe?.potential_ruts;return `<section class="uso80-top"><div><span>UNIVERSO SO · INTELLIGENCE 360</span><h1>De padrón a conocimiento analítico</h1><p>Selecciona un sujeto obligado para reconstruir su situación registral, tributaria, reportabilidad, supervisión y contexto inter-radar.</p></div><div class="uso80-universe"><b>${fmt(reg??10294)}</b><small>SO inscritos</small><b>${fmt(pot)}</b><small>potenciales SO</small></div></section>`;}
  function nav(){return `<div class="uso80-tabs"><button type="button" data-uso80-mode="inscritos" class="${S.mode==='inscritos'?'active':''}">SO inscritos <small>perfil 360</small></button><button type="button" data-uso80-mode="potenciales" class="${S.mode==='potenciales'?'active':''}">Potenciales SO <small>screening</small></button></div>`;}
  function filters(){const o=(v,l,c)=>`<option value="${esc(v)}"${v===c?' selected':''}>${esc(l)}</option>`;return `<section class="uso80-filters"><div class="uso80-filtertitle"><b>Explorar universo</b><span>${fmt(S.total)} resultado(s) · sin filtros implícitos</span></div><label>Buscar<input id="uso80-q" type="search" value="${esc(S.filters.q)}" placeholder="RUT o razón social"></label><label>Sector<select id="uso80-sector">${o('','Todos los sectores',S.filters.sector)}${S.options.sectors.map(x=>o(x,x,S.filters.sector)).join('')}</select></label><label>Región<select id="uso80-region">${o('','Todas las regiones',S.filters.region)}${S.options.regions.map(x=>o(x,x,S.filters.region)).join('')}</select></label>${S.mode==='inscritos'?`<label>Situación analítica<select id="uso80-focus">${o('','Sin filtro analítico',S.filters.focus)}${o('terminated','Término de giro SII',S.filters.focus)}${o('sanctioned','Antecedentes UAF',S.filters.focus)}${o('complex','Estructura observable',S.filters.focus)}${o('high-ipf','IPF alto / muy alto',S.filters.focus)}</select></label>`:''}<button type="button" data-uso80-clear>Limpiar filtros</button><div class="uso80-chips">${activeChips()}</div></section>`;}
  function activeChips(){const f=S.filters,a=[];if(f.q)a.push(`Búsqueda: ${f.q}`);if(f.sector)a.push(`Sector: ${f.sector}`);if(f.region)a.push(`Región: ${f.region}`);if(f.focus)a.push(`Foco: ${f.focus}`);return a.length?a.map(x=>`<span>${esc(x)}</span>`).join(''):'<em>Sin filtros activos. La lista corresponde al corte completo accesible.</em>';}
  function rowTitle(r){return r.registry_name||r.entity_name||r.name||'Entidad sin nombre materializado';}
  function list(){if(!S.rows.length)return'<div class="uso80-empty">No hay resultados para los filtros actuales.</div>';return `<div class="uso80-list">${S.rows.map((r,i)=>{const selected=S.selected===i;const tags=S.mode==='inscritos'?[labelStatus(r.sii_status),r.ipf_band?`IPF ${band(r.ipf_band)}`:null,num(r.sanction_event_count)>0?`${fmt(r.sanction_event_count)} ant. UAF`:null].filter(Boolean):[r.implied_sector||'Sector por screening',r.review_status||'Pendiente de revisión'];return `<button type="button" class="uso80-item ${selected?'selected':''}" data-uso80-row="${i}"><div><strong>${esc(rowTitle(r))}</strong><small>${esc(r.rut||'RUT no materializado')}</small></div><p>${esc(r.uaf_sector_canonical||r.implied_sector||'Sector no materializado')}</p><div>${tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div></button>`}).join('')}</div>`;}
  function fact(label,value,help=''){return `<div class="uso80-fact"><span>${esc(label)}${help?` <i title="${esc(help)}">?</i>`:''}</span><b>${esc(value==null||value===''?'No observado':value)}</b></div>`;}
  function section(title,sub,body,klass=''){return `<section class="uso80-section ${klass}"><header><div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div></header>${body}</section>`;}
  function tax(d){const r=d.row||{};return section('Situación tributaria y actividad','Caracterización SII del sujeto obligado; ausencia de dato se muestra como no observado.',`<div class="uso80-factgrid">${fact('Estado SII',labelStatus(r.sii_status))}${fact('Inicio de actividades',date(r.sii_activity_start_date))}${fact('Término de giro',date(r.sii_termination_date))}${fact('Giro principal',r.sii_main_activity)}${fact('Sector económico',r.sii_economic_sector)}${fact('Subsector',r.sii_economic_subsector)}${fact('Tipo contribuyente',r.sii_taxpayer_type)}${fact('Tramo de ventas',r.sii_sales_band)}${fact('Trabajadores',fmt(r.sii_workers))}${fact('Actividades observadas',fmt(r.sii_activity_count))}${fact('Direcciones observadas',fmt(r.sii_address_count))}${fact('Antigüedad',num(r.entity_age_years)!=null?`${fmt(r.entity_age_years)} años`:'No observado')}</div><div class="uso80-evidence">${r.sii_activity_changed?'<span>Cambio de giro/actividad observado</span>':''}${r.sii_region_changed?'<span>Cambio de región observado</span>':''}${num(r.activity_atypicality)!=null?`<span>Atipicidad de actividad ${fmt(r.activity_atypicality,1)}</span>`:''}</div>`);}
  function reporting(d){const x=d.reporting||{},o=d.obligation||{};return section('Reportabilidad UAF','Obligación sectorial y comportamiento por entidad cuando existe observación materializada.',`<div class="uso80-reporthero"><div><span>Estado de observación</span><b>${esc(x.behavior_source_state==='OBSERVED'?'Comportamiento materializado':'No materializado')}</b><small>${x.last_period_end?`Último período ${date(x.last_period_end)}`:'No se interpreta como cero'}</small></div><div><span>ROS 12 meses</span><b>${fmt(x.ros_12m)}</b><small>${num(x.ros_12m_sector_percentile)!=null?`percentil sectorial ${Math.round(num(x.ros_12m_sector_percentile)*100)}`:'percentil no observado'}</small></div><div><span>ROE 12 meses</span><b>${fmt(x.roe_12m)}</b><small>${num(x.roe_12m_sector_percentile)!=null?`percentil sectorial ${Math.round(num(x.roe_12m_sector_percentile)*100)}`:'percentil no observado'}</small></div><div><span>Operaciones ROE 12m</span><b>${fmt(x.roe_operations_12m)}</b><small>volumen de operaciones observado</small></div></div><div class="uso80-factgrid compact">${fact('ROS exigible',o.ros_required==null?'No mapeado':o.ros_required?'Sí':'No')}${fact('ROE exigible',o.roe_required==null?'No mapeado':o.roe_required?'Sí':'No')}${fact('Frecuencia ROE',o.roe_frequency)}${fact('Umbral ROE USD',fmt(o.roe_threshold_usd))}${fact('ROS acumulados',fmt(x.ros_total))}${fact('ROE acumulados',fmt(x.roe_total))}${fact('Períodos observados',fmt(x.observed_periods))}${fact('Corte fuente',date(x.source_cutoff_date))}</div>`);}
  function supervision(d){const r=d.row||{};return section('Supervisión y prioridad fiscalizadora','IPF ordena esfuerzo de fiscalización; no es probabilidad LA/FT ni imputación de incumplimiento.',`<div class="uso80-scoreline"><div><span>IPF</span><b>${fmt(r.ipf_score,1)}</b><small>${esc(band(r.ipf_band))} · credibilidad ${num(r.ipf_credibility_pct)!=null?fmt(r.ipf_credibility_pct,0)+'%':'no observada'}</small></div><div><span>Eventos sancionatorios</span><b>${fmt(r.sanction_event_count)}</b><small>último ${date(r.sanction_last_event_date)}</small></div><div><span>Percentil padrón</span><b>${num(r.ipf_percentile)!=null?Math.round(num(r.ipf_percentile)*100):'—'}</b><small>posición relativa</small></div><div><span>Percentil sector</span><b>${num(r.ipf_sector_percentile)!=null?Math.round(num(r.ipf_sector_percentile)*100):'—'}</b><small>comparación entre pares</small></div></div><div class="uso80-components">${[['VSE','sector_vulnerability','Vulnerabilidad sectorial'],['HSU','ipf_supervision_history','Historial supervisor'],['CRG','ipf_registry_coherence','Coherencia registral'],['EEC','ipf_scale_complexity','Escala / complejidad'],['OBS','ipf_observability_gap','Brecha observabilidad']].map(([c,k,l])=>`<div><b>${c}</b><span>${esc(l)}</span><strong>${fmt(r[k],1)}</strong></div>`).join('')}</div>`);}
  function context(d){const r=d.row||{},mp=d.mp||{};const life=Array.isArray(d.lifecycle)?d.lifecycle:[];return section('Estructura, Estado y trayectoria','Conexiones documentadas que ayudan a caracterizar la entidad sin convertir contexto en sospecha.',`<div class="uso80-factgrid">${fact('Tipo societario',r.society_type)}${fact('Vínculos de propiedad',fmt(r.ownership_edge_count))}${fact('Socios persona jurídica',fmt(r.legal_entity_partner_count))}${fact('Sociedades como socio',fmt(r.societies_as_partner_count))}${fact('Órdenes Mercado Público',fmt(mp.order_count))}${fact('Compradores públicos',fmt(mp.buyer_count))}${fact('Monto 2023–2026',money(mp.total_clp))}${fact('Trato directo',fmt(mp.direct_order_count))}</div>${life.length?`<div class="uso80-timeline"><h3>Línea de vida multifuente</h3>${life.map(e=>`<article><time>${esc(date(e.event_date))}</time><div><b>${esc(e.event_label||e.event_type||'Evento')}</b><p>${esc(e.source_detail||'Sin detalle adicional')}</p><span>${esc(e.source_system||'Fuente no materializada')} · ${esc(e.evidence_status||'evidencia')}</span></div></article>`).join('')}</div>`:'<div class="uso80-note">Línea de vida multifuente no materializada para esta identidad.</div>'}`);}
  function press(d){const p=d.press||{};if(p.error)return section('Prensa y contexto abierto','Radar Prensa no disponible en esta consulta.',`<div class="uso80-note">${esc(p.error)}</div>`);if(!Array.isArray(p.items)||!p.items.length)return section('Prensa y contexto abierto','Matching estricto para minimizar falsos positivos.',`<div class="uso80-note">Sin menciones de prensa aceptadas para esta identidad bajo la política nominal estricta actual. No equivale a ausencia de cobertura periodística.</div>`);return section('Prensa y contexto abierto',`${fmt(p.items.length)} menciones aceptadas · ${p.match==='EXACT_NOMINAL'?'coincidencia nominal exacta':'matching nominal fuerte no ambiguo'}`,`<div class="uso80-news">${p.items.slice(0,12).map(({m,a})=>`<article><div><time>${esc(date(a.date))}</time><span>${esc(a.media||'Medio no materializado')}</span></div><h3>${esc(a.title||'Publicación')}</h3><p>${esc(m.role||'Entidad mencionada')}</p>${Array.isArray(a.phenomena)&&a.phenomena.length?`<div>${a.phenomena.slice(0,5).map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}${a.url?`<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">Abrir fuente ↗</a>`:''}</article>`).join('')}</div><p class="uso80-disclaimer">La presencia en prensa es contexto OSINT; no acredita identidad, delito ni modifica por sí sola la prioridad fiscalizadora.</p>`);}
  function findings(d){const fs=deriveFindings(d);return `<aside class="uso80-findings"><header><span>LECTURA INTER-RADAR</span><h2>Situaciones que merecen contexto</h2><p>Hallazgos determinísticos construidos con evidencia disponible. Cada uno conserva su fuente y su semántica.</p></header>${fs.map(f=>`<article class="${f.level}"><div><b>${esc(f.title)}</b><span>${esc(f.source)}</span></div><p>${esc(f.body)}</p></article>`).join('')}<div class="uso80-method"><b>Regla de lectura</b><p>“Prioritario” significa prioridad de revisión o fiscalización según la señal descrita. Nunca equivale a sospecha de LA/FT, culpabilidad ni incumplimiento acreditado.</p></div></aside>`;}
  function identity(d){const r=d.row||{};return `<header class="uso80-identity"><div><span>${esc(r.uaf_sector_canonical||r.implied_sector||'Sector no materializado')}</span><h1>${esc(rowTitle(r))}</h1><p>${esc(r.rut||'RUT no materializado')} · ${esc(r.entity_type||r.subject_nature||'Naturaleza no materializada')} · ${esc(r.region||'Territorio no observado')}${r.commune?` / ${esc(r.commune)}`:''}</p></div>${S.mode==='inscritos'?`<div class="uso80-state ${r.sii_status==='TERMINATED_AS_PUBLISHED'?'warn':''}"><span>Estado tributario</span><b>${esc(labelStatus(r.sii_status))}</b><small>${r.registry_observed_at?`Padrón UAF observado ${date(r.registry_observed_at)}`:'Padrón UAF vigente del corte'}</small></div>`:''}</header>`;}
  function profile(){if(S.selected==null)return'<section class="uso80-welcome"><div><span>PERFIL ANALÍTICO 360</span><h2>Selecciona un sujeto obligado</h2><p>La ficha no resume a la entidad en un único score. Reconstruye sus dimensiones tributarias, de reportabilidad, supervisión y contexto para facilitar una lectura fundada.</p></div><div class="uso80-sourcelegend"><b>Fuentes que puede integrar</b><span>UAF</span><span>SII</span><span>Reportabilidad</span><span>Sanciones</span><span>RES</span><span>Mercado Público</span><span>Territorio</span><span>Prensa</span></div></section>';if(!S.detail)return'<div class="uso80-loading">Construyendo perfil 360 y consultando radares…</div>';if(S.mode==='potenciales')return potentialProfile(S.detail);const d=S.detail;return `${identity(d)}<div class="uso80-profilegrid"><main>${tax(d)}${reporting(d)}${supervision(d)}${context(d)}${press(d)}</main>${findings(d)}</div>`;}
  function potentialProfile(d){const r=d.row||{};return `${identity(d)}<div class="uso80-profilegrid"><main>${section('Hipótesis de potencial SO','Screening: ACTECO candidate_use=SI + SII vigente + RUT no observado en UAF. No constituye obligación jurídica probada.',`<div class="uso80-factgrid">${fact('Sector inferido',r.implied_sector)}${fact('ACTECO',r.activity_code||r.acteco)}${fact('Estado SII',labelStatus(r.sii_status||r.current_status))}${fact('IVO',fmt(r.ivo_score,1))}${fact('Materialidad',fmt(r.materiality_score,1))}${fact('Región',r.region)}${fact('RES disponible',r.res_available==null?'No observado':r.res_available?'Sí':'No')}${fact('Estado revisión',r.review_status)}</div>`)}${press(d)}</main>${findings(d)}</div>`;}
  function render(){const h=host();if(!h)return;setView();h.innerHTML=`<div class="uso80">${top()}${nav()}${filters()}<div class="uso80-work"><aside class="uso80-roster"><header><b>${S.mode==='inscritos'?'Padrón fiscalizable':'Screening potencial'}</b><span>Mostrando ${fmt(S.rows.length)} de ${fmt(S.total)}</span></header>${list()}</aside><article class="uso80-dossier">${profile()}</article></div></div>`;bind();}
  function renderLoading(){const h=host();if(h)h.innerHTML='<div class="uso80 uso80-loadingpage"><span>UNIVERSO SO · INTELLIGENCE 360</span><b>Cargando universo y contratos analíticos…</b></div>';}
  function bind(){
    document.querySelectorAll('[data-uso80-mode]').forEach(b=>b.addEventListener('click',async()=>{S.mode=b.dataset.uso80Mode;S.selected=null;S.detail=null;S.filters={q:'',sector:'',region:'',focus:''};await refreshRows();}));
    const debounce=(fn,ms=350)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}};
    document.querySelector('#uso80-q')?.addEventListener('input',debounce(e=>{S.filters.q=e.target.value;void refreshRows();}));
    document.querySelector('#uso80-sector')?.addEventListener('change',e=>{S.filters.sector=e.target.value;void refreshRows();});
    document.querySelector('#uso80-region')?.addEventListener('change',e=>{S.filters.region=e.target.value;void refreshRows();});
    document.querySelector('#uso80-focus')?.addEventListener('change',e=>{S.filters.focus=e.target.value;void refreshRows();});
    document.querySelector('[data-uso80-clear]')?.addEventListener('click',()=>{S.filters={q:'',sector:'',region:'',focus:''};S.selected=null;S.detail=null;void refreshRows();});
    document.querySelectorAll('[data-uso80-row]').forEach(b=>b.addEventListener('click',async()=>{const i=Number(b.dataset.uso80Row);S.selected=i;S.detail=null;render();const req=++S.request;const d=await loadDetail(S.rows[i]);if(req!==S.request)return;S.detail=d;render();}));
  }
  async function refreshRows(){S.loading=true;try{await loadRows();S.error=null;if(S.selected!=null&&S.selected>=S.rows.length){S.selected=null;S.detail=null}}catch(e){S.error=String(e?.message||e)}finally{S.loading=false;render();}}
  async function open(mode='inscritos'){
    setView();S.mode=mode==='potenciales'?'potenciales':'inscritos';S.loading=true;renderLoading();
    try{await Promise.all([loadUniverse(),loadOptions()]);await loadRows();S.error=null;}catch(e){S.error=String(e?.message||e)}finally{S.loading=false;render();}
    return true;
  }
  window.AtlasUniversoSO0800={active:true,version:VERSION,open,refresh:refreshRows,state:S,semantics:'ENTITY_CENTRIC_MULTI_RADAR_ANALYTICS_NOT_LAFT_ASSERTION'};
  window.__ATLAS_UNIVERSO_SO_0800__={active:true,version:VERSION,authority:'SINGLE_RENDERER',sources:['UAF','SII','REPORTABILITY','SANCTIONS','RES','MERCADO_PUBLICO','PRESS'],loadedAt:new Date().toISOString()};
})();
