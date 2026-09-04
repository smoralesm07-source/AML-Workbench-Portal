'use strict';
/* ATLAS AML · Gasto Público GP12 · monitor analítico de compras públicas
 *
 * Cinco superficies sobre una misma capa filtrable en memoria:
 *   Panorama    — cómo se mueve el gasto: industria, territorio, concentración.
 *   Industrias  — estructura de cada mercado UNSPSC y su matriz territorial.
 *   Proveedores — universo caracterizado: sanciones, UAF, CGR, RES, antigüedad.
 *   Compradores — comportamiento de compra: diversidad, rotación, mecanismo.
 *   Anomalías   — hallazgos de caso y hallazgos estructurales de mercado.
 *
 * Autoridad de datos: aml_mv_gp12_* / aml_v_gp12_* / aml_mv_gp10_finding.
 * Los índices priorizan revisión; no acreditan irregularidad, delito ni LA/FT.
 *
 * CSP del portal (style-src 'self'): este módulo no emite atributos style inline.
 * Los tooltips se dibujan dentro del SVG, donde transform es atributo de
 * presentación y no estilo, de modo que el hover funciona sin violar la política.
 */
(function atlasGastoPublico1200(){
  const VERSION='GP12.0';
  const VIEW='public-spend';

  const SRC={
    coverage:'aml_v_gp10_coverage',
    suppliers:'aml_v_gp12_supplier_lite',
    buyers:'aml_mv_gp12_buyer',
    industry:'aml_mv_gp12_industry',
    indRegion:'aml_mv_gp12_industry_region',
    market:'aml_mv_gp12_market_finding',
    findings:'aml_v_gp12_finding',
    lorenz:'aml_v_gp10_lorenz',
    pairs:'aml_mv_gp10_pair',
    supplierFull:'aml_mv_gp12_supplier'
  };

  /* caracterización: la superficie de filtros */
  const TRAITS=[
    ['SUJETO_OBLIGADO','Sujeto obligado UAF'],
    ['CON_SANCION','Con sanción'],
    ['CON_CGR','Con evento CGR'],
    ['UAF_OBSERVADO','UAF observado'],
    ['CON_LOBBY','Con lobby'],
    ['EMPRESA_NUEVA','Empresa nueva (≤2 años)'],
    ['SIN_PERFIL_RES','Sin perfil societario'],
    ['CONCENTRA_SERVICIO','Concentra un servicio'],
    ['FRACCIONAMIENTO','Fraccionamiento'],
    ['MULTI_INDUSTRIA','Multi-industria'],
    ['CAUTIVO','Cautivo de un comprador'],
    ['IDENTIDAD_RESUELTA','Identidad resuelta']
  ];
  const TRAIT_LABEL=Object.fromEntries(TRAITS);
  const CODE_LABEL={
    EMPRESA_RECIENTE_MONTO_ALTO:'Empresa reciente · monto alto',
    CAPITAL_DESPROPORCIONADO:'Capital desproporcionado',
    CAPTURA_COMPRADOR:'Proveedor concentra un servicio',
    POSIBLE_FRACCIONAMIENTO:'Posible fraccionamiento',
    CONCENTRACION_PROVEEDOR:'Servicio concentrado',
    DEPENDENCIA_COMPRADOR_UNICO:'Proveedor cautivo',
    SANCION_OBSERVADA:'Sanción observada', UAF_OBSERVADO:'Sujeto obligado UAF',
    LOBBY_OBSERVADO:'Lobby observado',
    MERCADO_MONOPOLIZADO:'Mercado monopolizado', MERCADO_CONCENTRADO:'Mercado concentrado',
    MERCADO_ATOMIZADO:'Mercado atomizado'
  };
  /* categóricas en orden fijo, nunca cicladas */
  const CAT=['#3f8fd6','#bf7a2e','#9f7ae8','#1c9b8d'];
  const SEQ=['#24303f','#4a3a1c','#7a5a22','#ab7b28','#e0a445'];
  const ST={crit:'#e05561',warn:'#d98324',good:'#2ea043'};

  const S={
    tab:'panorama',
    coverage:null, suppliers:null, buyers:null, industry:null, indRegion:null,
    market:null, findings:null, lorenz:null,
    fIndustry:'ALL', fRegion:'ALL', fTraits:new Set(), query:'',
    sortSup:'total_clp', sortBuy:'total_clp', sortInd:'total_clp', sortDir:-1,
    detail:null, busy:false, loading:false, error:null
  };
  let searchTimer=null, opening=false, tipSeq=0;

  /* ---------- utilidades ---------- */
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch{return window.sb||null;}};
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
  const NF=new Intl.NumberFormat('es-CL');
  const money=v=>{const n=num(v),a=Math.abs(n);
    if(a>=1e12)return '$'+(n/1e12).toLocaleString('es-CL',{maximumFractionDigits:2})+' bill.';
    if(a>=1e9) return '$'+(n/1e9).toLocaleString('es-CL',{maximumFractionDigits:1})+' mil M';
    if(a>=1e6) return '$'+(n/1e6).toLocaleString('es-CL',{maximumFractionDigits:1})+' M';
    return '$'+NF.format(Math.round(n));};
  const moneyFull=v=>'$'+NF.format(Math.round(num(v)));
  const DIACRITICS=new RegExp('[\\u0300-\\u036f]','g');
  const norm=v=>String(v||'').normalize('NFD').replace(DIACRITICS,'').toUpperCase();
  const pct=(v,d=1)=>Number.isFinite(Number(v))?(100*Number(v)).toLocaleString('es-CL',{maximumFractionDigits:d})+'%':'—';
  const dec=(v,d=3)=>Number.isFinite(Number(v))?Number(v).toLocaleString('es-CL',{maximumFractionDigits:d}):'—';
  const dateCL=d=>{const s=String(d||'');return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10).split('-').reverse().join('-'):'—';};
  const codeLabel=c=>CODE_LABEL[c]||String(c||'').replaceAll('_',' ');
  const traitLabel=t=>TRAIT_LABEL[t]||String(t||'').replaceAll('_',' ');
  const clip=(s,n)=>{const t=String(s||'');return t.length<=n?t:t.slice(0,n-1)+'…';};

  const REGION_SHORT=[[/Metropolitana/i,'Metropolitana'],[/Valpara/i,'Valparaíso'],[/Biob/i,'Biobío'],
    [/Araucan/i,'Araucanía'],[/los Lagos/i,'Los Lagos'],[/Maule/i,'Maule'],[/Higgins/i,"O'Higgins"],
    [/Coquimbo/i,'Coquimbo'],[/uble/i,'Ñuble'],[/os R[ií]os/i,'Los Ríos'],[/Antofagasta/i,'Antofagasta'],
    [/Magallanes/i,'Magallanes'],[/Tarapac/i,'Tarapacá'],[/Atacama/i,'Atacama'],[/Ays/i,'Aysén'],
    [/Arica/i,'Arica'],[/Sin regi/i,'Sin región']];
  const shortRegion=r=>{const s=String(r||'');
    for(const [re,lb] of REGION_SHORT)if(re.test(s))return lb;
    return s.replace(/^Regi[oó]n\s+/i,'').trim()||'Sin región';};

  function host(){
    try{return typeof v019Content==='function'?v019Content():document.querySelector('#content');}
    catch{return document.querySelector('#content');}
  }
  function publish(status,extra){
    window.__ATLAS_GASTO_PUBLICO_1000__=Object.assign({
      status,version:VERSION,view:VIEW,authority:'GASTO_PUBLICO_GP12',
      sources:Object.values(SRC),tab:S.tab,checkedAt:new Date().toISOString()
    },extra||{});
  }

  /* ---------- primitivas SVG ---------- */
  const svg=(vb,body,extra)=>`<svg class="gp10-chart" viewBox="${vb}" preserveAspectRatio="xMidYMid meet"`
    +` role="img"${extra||''}>${body}</svg>`;
  const T=(x,y,t,o)=>{o=o||{};return `<text x="${x}" y="${y}" class="${o.c||'gp10-axis'}"`
    +`${o.a?` text-anchor="${o.a}"`:''}${o.f?` fill="${o.f}"`:''}${o.s?` font-size="${o.s}"`:''}`
    +`${o.w?` font-weight="${o.w}"`:''}>${esc(t)}</text>`;};
  /* tooltip dentro del SVG: transform es atributo de presentación, no estilo */
  const TIP=id=>`<g class="gp10-tip hide" id="${id}" transform="translate(0,0)" pointer-events="none">`
    +`<rect x="0" y="0" width="10" height="10" rx="6"></rect><text x="0" y="0"></text></g>`;
  const seqColor=t=>SEQ[Math.max(0,Math.min(4,Math.round(num(t)*4)))];

  const barSvg=(ratio,color)=>{
    const w=Math.max(0,Math.min(100,num(ratio)*100));
    return `<svg class="gp10-barsvg" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">`
      +`<rect x="0" y="0" width="100" height="8" rx="4" class="gp10-track"></rect>`
      +`<rect x="0" y="0" width="${w.toFixed(2)}" height="8" rx="4" fill="${color}"></rect></svg>`;
  };

  /* barras horizontales con hover */
  function barChart(rows,opt){
    opt=opt||{};
    const n=rows.length, RH=opt.rh||26, W=760, L=opt.left||178, R=104;
    const H=Math.max(40,n*RH+10);
    const mx=Math.max(...rows.map(r=>num(r.value)),1);
    const id='tip'+(++tipSeq);
    let g='';
    rows.forEach((r,i)=>{
      const y=i*RH+4, bw=(W-L-R)*num(r.value)/mx;
      g+=T(L-10,y+13,clip(r.label,Math.floor((L-14)/6.4)),{a:'end',f:'#c4d6e6',s:11});
      g+=`<rect x="${L}" y="${y+4}" width="${W-L-R}" height="12" rx="4" class="gp10-track"></rect>`;
      g+=`<rect class="gp10-mark" x="${L}" y="${y+4}" width="${Math.max(2,bw).toFixed(1)}" height="12" rx="4"`
        +` fill="${r.color||CAT[0]}" data-tip="${esc(r.tip||(r.label+'|'+money(r.value)))}"`
        +`${r.key?` data-gp10-pick="${esc(r.pick||'')}" data-key="${esc(r.key)}"`:''}></rect>`;
      g+=T(W,y+14,r.right||money(r.value),{a:'end',f:'#93a9be',s:11});
    });
    return svg(`0 0 ${W} ${H}`,g+TIP(id),` data-tip-host="${id}"`);
  }

  /* Magnitud y estructura en un solo lienzo: mismas filas, dos escalas
     independientes lado a lado. Separarlos en dos SVG los desalinea y cada uno
     escala distinto con el ancho de su panel. */
  function compareChart(rows,opt){
    opt=opt||{};
    const n=rows.length, RH=opt.rh||27, W=1000, L=opt.left||214;
    const BW=opt.bw||380, GAP=118, DL=L+BW+GAP, DW=W-DL-46;
    const H=Math.max(60,n*RH+34);
    const mxV=Math.max(...rows.map(r=>num(r.value)),1);
    const mxD=opt.maxDot||1;
    const id='tip'+(++tipSeq);
    let g='';
    /* rejilla del eje derecho */
    [0,.25,.5,.75,1].forEach(t=>{const x=DL+DW*t;
      g+=`<line x1="${x}" y1="16" x2="${x}" y2="${H-22}" class="gp10-grid"></line>`;
      g+=T(x,H-8,dec(mxD*t,2),{a:'middle',s:9});});
    g+=T(L+BW/2,11,opt.leftTitle||'Gasto observado',{a:'middle',s:9.5,w:800});
    g+=T(DL+DW/2,11,opt.rightTitle||'Concentración HHI',{a:'middle',s:9.5,w:800});
    rows.forEach((r,i)=>{
      const y=22+i*RH, cy=y+11;
      g+=T(L-12,cy+4,clip(r.label,Math.floor((L-16)/6.3)),{a:'end',f:'#c4d6e6',s:11});
      g+=`<rect x="${L}" y="${y+5}" width="${BW}" height="12" rx="4" class="gp10-track"></rect>`;
      g+=`<rect class="gp10-mark" x="${L}" y="${y+5}" width="${Math.max(2,BW*num(r.value)/mxV).toFixed(1)}"`
        +` height="12" rx="4" fill="${r.color||CAT[0]}" data-tip="${esc(r.tip||'')}"`
        +`${r.key?` data-gp10-pick="${esc(r.pick||'')}" data-key="${esc(r.key)}"`:''}></rect>`;
      g+=T(DL-14,cy+4,r.right||money(r.value),{a:'end',f:'#93a9be',s:10.5});
      const dx=DL+DW*Math.min(1,num(r.dot)/mxD);
      g+=`<line x1="${DL}" y1="${cy}" x2="${dx}" y2="${cy}" stroke="#243b50" stroke-width="1"></line>`;
      g+=`<circle class="gp10-dot" cx="${dx.toFixed(1)}" cy="${cy}" r="5.5" fill="${r.dotColor||CAT[1]}"`
        +` stroke="#0d1b2a" stroke-width="2" data-tip="${esc(r.dotTip||r.tip||'')}"></circle>`;
      g+=T(W,cy+4,dec(r.dot,3),{a:'end',f:'#93a9be',s:10.5});
    });
    return svg(`0 0 ${W} ${H}`,g+TIP(id),` data-tip-host="${id}"`);
  }

  /* nube riesgo × materialidad, eje Y logarítmico */
  function scatterChart(rows){
    const W=940,H=420,L=62,R=22,Tp=16,B=46;
    const X=s=>L+(W-L-R)*Math.min(100,Math.max(0,num(s)))/100;
    const Y=m=>{const lg=Math.log10(Math.max(1e5,num(m)));return H-B-(H-Tp-B)*Math.min(1,(lg-5)/6);};
    const id='tip'+(++tipSeq);
    let g=`<rect x="${X(35)}" y="${Tp}" width="${W-R-X(35)}" height="${Y(5e8)-Tp}" fill="${ST.crit}" opacity="0.05"></rect>`;
    for(let i=0;i<=5;i++){const y=Tp+(H-Tp-B)*i/5;g+=`<line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" class="gp10-grid"></line>`;}
    for(let i=0;i<=5;i++){const x=L+(W-L-R)*i/5;
      g+=`<line x1="${x}" y1="${Tp}" x2="${x}" y2="${H-B}" class="gp10-grid"></line>`+T(x,H-B+17,i*20,{a:'middle'});}
    [[1e5,'$0,1 M'],[1e6,'$1 M'],[1e7,'$10 M'],[1e8,'$100 M'],[1e9,'$1.000 M'],[1e10,'$10 mil M'],[1e11,'$100 mil M']]
      .forEach(([v,l])=>{const y=Y(v);if(y>Tp-2&&y<H-B+2)g+=T(L-8,y+3,l,{a:'end'});});
    const sorted=rows.slice().sort((a,b)=>num(b.total_clp)-num(a.total_clp));
    const mx=num(sorted[0]?.total_clp)||1;
    const famColor=r=>{
      const t=r.traits||[];
      if(t.includes('CON_SANCION')||t.includes('SUJETO_OBLIGADO'))return CAT[2];
      if(t.includes('EMPRESA_NUEVA'))return CAT[1];
      if(t.includes('CONCENTRA_SERVICIO')||t.includes('FRACCIONAMIENTO'))return CAT[3];
      return CAT[0];
    };
    for(let i=sorted.length-1;i>=0;i--){
      const r=sorted[i],a=num(r.total_clp);
      const rad=Math.max(2.2,Math.min(16,2+Math.sqrt(a/mx)*24));
      g+=`<circle class="gp10-dot" cx="${X(r.attention_score).toFixed(1)}" cy="${Y(a).toFixed(1)}" r="${rad.toFixed(1)}"`
        +` fill="${famColor(r)}" opacity="0.34" data-gp10-sup="${esc(r.supplier_key)}"`
        +` data-tip="${esc(clip(r.supplier_name,34)+'|'+money(a)+' · atención '+num(r.attention_score)+'|'
          +clip(r.segment_label||'Sin clasificar',30)+' · '+num(r.buyer_count)+' comprador(es)')}"></circle>`;
    }
    /* los que gobiernan la lectura llevan etiqueta directa */
    const top=sorted.slice(0,4).concat(rows.slice().sort((a,b)=>num(b.attention_score)-num(a.attention_score)).slice(0,4));
    const seen=new Set(),used=[];
    top.forEach(r=>{
      if(seen.has(r.supplier_key))return;seen.add(r.supplier_key);
      const a=num(r.total_clp),x=X(r.attention_score),y=Y(a);
      const rad=Math.max(4,Math.min(16,2+Math.sqrt(a/mx)*24));
      const left=x>W*0.60, lx=left?x-rad-7:x+rad+7;
      let ly=y+3.5,step=0;
      while(used.some(u=>Math.abs(u.y-ly)<13&&Math.abs(u.x-lx)<150)&&step<10){
        step++;ly=y+3.5+(step%2?1:-1)*Math.ceil(step/2)*14;}
      used.push({x:lx,y:ly});
      g+=`<circle cx="${x}" cy="${y}" r="${rad}" fill="${famColor(r)}" stroke="#08121d" stroke-width="2"></circle>`;
      if(Math.abs(ly-(y+3.5))>2)g+=`<line x1="${left?x-rad:x+rad}" y1="${y}" x2="${lx}" y2="${ly-3.5}" stroke="#3c5a75"></line>`;
      g+=T(lx,ly,clip(r.supplier_name,24),{f:'#dbe8f5',s:10.5,w:700,a:left?'end':'start'});
    });
    g+=T((L+W-R)/2,H-6,'Índice de atención (0–100)',{a:'middle',c:'gp10-axlab'});
    g+=`<text transform="translate(16 ${(Tp+H-B)/2}) rotate(-90)" class="gp10-axlab" text-anchor="middle">Monto contratado (escala log)</text>`;
    return svg(`0 0 ${W} ${H}`,g+TIP(id),` data-tip-host="${id}"`);
  }

  /* treemap squarified */
  function squarify(items,x,y,w,h){
    const out=[],total=items.reduce((a,b)=>a+b.v,0);
    if(!total||w<=0||h<=0)return out;
    let rest=items.slice(),X=x,Y=y,W=w,H=h;const scale=(w*h)/total;
    const worst=(row,len)=>{const s=row.reduce((a,b)=>a+b.v,0)*scale;
      const a=Math.max(...row.map(r=>r.v*scale)),b=Math.min(...row.map(r=>r.v*scale));
      return Math.max(len*len*a/(s*s),s*s/(len*len*b));};
    let guard=0;
    while(rest.length&&guard++<500){
      const vert=W<H,len=vert?W:H;
      if(len<=0)break;
      let row=[rest[0]],i=1;
      while(i<rest.length&&worst(row.concat(rest[i]),len)<=worst(row,len)){row.push(rest[i]);i++;}
      const s=row.reduce((a,b)=>a+b.v,0)*scale,thick=s/len;
      let off=vert?X:Y;
      row.forEach(r=>{const sz=(r.v*scale)/thick;
        out.push(Object.assign({},r,vert?{x:off,y:Y,w:sz,h:thick}:{x:X,y:off,w:thick,h:sz}));off+=sz;});
      if(vert){Y+=thick;H-=thick;}else{X+=thick;W-=thick;}
      rest=rest.slice(row.length);
    }
    return out;
  }
  function treemap(items,opt){
    opt=opt||{};
    const W=opt.w||700,H=opt.h||400;
    const cells=squarify(items.filter(i=>i.v>0).sort((a,b)=>b.v-a.v),0,0,W,H);
    const id='tip'+(++tipSeq);
    let g='';
    cells.forEach(c=>{
      const dark=num(c.t)>0.80, tc=dark?'#1a1206':'#f2f7fc';
      const big=c.w>108&&c.h>54, mid=c.w>62&&c.h>30;
      const fit=(t,px)=>{const m=Math.floor((c.w-20)/px);return m<4?'':clip(String(t),m);};
      g+=`<g><rect class="gp10-mark" x="${(c.x+1).toFixed(1)}" y="${(c.y+1).toFixed(1)}"`
        +` width="${Math.max(0,c.w-2).toFixed(1)}" height="${Math.max(0,c.h-2).toFixed(1)}" rx="5"`
        +` fill="${seqColor(c.t)}" stroke="#070f19" stroke-width="2"`
        +`${c.key?` data-gp10-pick="${esc(opt.pick||'')}" data-key="${esc(c.key)}"`:''}`
        +` data-tip="${esc(c.tip||c.n)}"></rect>`;
      if(mid)g+=T(c.x+9,c.y+19,fit(c.n,big?7.2:6.1),{f:tc,s:big?12.5:10.5,w:750});
      if(big){g+=T(c.x+9,c.y+36,fit(money(c.v),6.6),{f:tc,s:11});
        if(c.sub)g+=T(c.x+9,c.y+51,fit(c.sub,6.0),{f:tc,s:10});}
      g+=`</g>`;
    });
    return svg(`0 0 ${W} ${H}`,g+TIP(id),` data-tip-host="${id}"`);
  }

  /* matriz industria × región */
  function matrix(rows,cols,cells,opt){
    opt=opt||{};
    const CW=190,RH=22,GAP=2,W=980,HEAD=52;
    const cw=(W-CW)/cols.length-GAP;
    const H=HEAD+rows.length*(RH+GAP);
    const mx=Math.max(...cells.map(c=>num(c.v)),1);
    const id='tip'+(++tipSeq);
    let g='';
    cols.forEach((c,i)=>{
      const x=CW+i*(cw+GAP)+cw/2;
      g+=`<text x="${x}" y="${HEAD-8}" class="gp10-axis" text-anchor="start" font-size="8.8" transform="rotate(-42 ${x} ${HEAD-8})">${esc(clip(c.label,14))}</text>`;
    });
    const index=new Map(cells.map(c=>[c.r+'|'+c.c,c]));
    rows.forEach((r,ri)=>{
      const y=HEAD+ri*(RH+GAP);
      g+=T(CW-8,y+15,clip(r.label,26),{a:'end',f:'#c4d6e6',s:10.5});
      cols.forEach((c,ci)=>{
        const cell=index.get(r.key+'|'+c.key);
        const v=cell?num(cell.v):0, t=mx?v/mx:0, x=CW+ci*(cw+GAP);
        g+=`<rect class="gp10-mark" x="${x.toFixed(1)}" y="${y}" width="${cw.toFixed(1)}" height="${RH}" rx="3"`
          +` fill="${v?seqColor(Math.sqrt(t)):'#111e2b'}"`
          +` data-tip="${esc(r.label+' · '+c.label+'|'+(v?money(v):'sin gasto observado'))}"></rect>`;
      });
    });
    return svg(`0 0 ${W} ${H}`,g+TIP(id),` data-tip-host="${id}"`);
  }

  /* curva de Lorenz */
  function lorenzChart(pts){
    const W=380,H=220,L=42,R=12,Tp=12,B=34;
    const X=p=>L+(W-L-R)*num(p)/100, Y=v=>H-B-(H-Tp-B)*num(v)/100;
    const id='tip'+(++tipSeq);
    let g='';
    for(let i=0;i<=4;i++){const y=Tp+(H-Tp-B)*i/4;
      g+=`<line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" class="gp10-grid"></line>`+T(L-6,y+3,(100-i*25)+'%',{a:'end',s:9});}
    g+=`<line x1="${L}" y1="${H-B}" x2="${W-R}" y2="${Tp}" stroke="#2c4459" stroke-dasharray="3 3"></line>`;
    const all=[{pct_suppliers:0,pct_spend:0}].concat(pts||[]);
    const d=all.map((p,i)=>`${i?'L':'M'}${X(p.pct_suppliers).toFixed(1)},${Y(p.pct_spend).toFixed(1)}`).join(' ');
    g+=`<path d="${d} L${X(100)},${Y(0)} Z" fill="${CAT[0]}" opacity="0.16"></path>`;
    g+=`<path d="${d}" fill="none" stroke="${CAT[0]}" stroke-width="2"></path>`;
    (pts||[]).forEach(p=>{g+=`<circle class="gp10-dot" cx="${X(p.pct_suppliers)}" cy="${Y(p.pct_spend)}" r="6"`
      +` fill="transparent" data-tip="${esc(p.pct_suppliers+'% de proveedores|'+dec(p.pct_spend,1)+'% del gasto')}"></circle>`;});
    const k=(pts||[])[0];
    if(k){g+=`<circle cx="${X(k.pct_suppliers)}" cy="${Y(k.pct_spend)}" r="4" fill="${CAT[1]}"></circle>`;
      g+=T(X(k.pct_suppliers)+11,Y(k.pct_spend)+16,`${k.pct_suppliers}% capta ${dec(k.pct_spend,1)}%`,{f:CAT[1],s:10.5,w:800});}
    [0,25,50,75,100].forEach(p=>g+=T(X(p),H-B+15,p+'%',{a:'middle',s:9}));
    g+=T((L+W-R)/2,H-4,'% de proveedores acumulado',{a:'middle',c:'gp10-axlab',s:9.5});
    return svg(`0 0 ${W} ${H}`,g+TIP(id),` data-tip-host="${id}"`);
  }

  /* ---------- carga ---------- */
  async function loadAll(force){
    const c=db();
    if(!c)throw new Error('Sesión de datos ATLAS no disponible.');
    if(S.suppliers&&!force)return;
    const [cov,sup,buy,ind,ir,mk,fnd,lo]=await Promise.all([
      c.from(SRC.coverage).select('*').maybeSingle(),
      c.from(SRC.suppliers).select('*').order('total_clp',{ascending:false}).limit(14000),
      c.from(SRC.buyers).select('*').order('total_clp',{ascending:false}).limit(1600),
      c.from(SRC.industry).select('*'),
      c.from(SRC.indRegion).select('*'),
      c.from(SRC.market).select('*'),
      c.from(SRC.findings).select('*').order('severity_rank',{ascending:false}).order('amount_clp',{ascending:false}).limit(700),
      c.from(SRC.lorenz).select('*').order('pct_suppliers',{ascending:true})
    ]);
    if(sup.error)throw sup.error;
    S.coverage=cov.error?null:cov.data;
    S.suppliers=sup.data||[];
    S.buyers=buy.error?[]:(buy.data||[]);
    S.industry=(ind.error?[]:(ind.data||[])).filter(x=>x.segment!=='ND');
    S.indRegion=ir.error?[]:(ir.data||[]);
    S.market=mk.error?[]:(mk.data||[]);
    S.findings=fnd.error?[]:(fnd.data||[]);
    S.lorenz=lo.error?[]:(lo.data||[]);
  }

  /* ---------- motor de filtro ---------- */
  function activeFilters(){
    const a=[];
    if(S.fIndustry!=='ALL'){
      const i=S.industry.find(x=>x.segment===S.fIndustry);
      a.push(['industry',i?i.segment_label:S.fIndustry]);
    }
    if(S.fRegion!=='ALL')a.push(['region',shortRegion(S.fRegion)]);
    S.fTraits.forEach(t=>a.push(['trait:'+t,traitLabel(t)]));
    if(S.query.trim())a.push(['query','"'+S.query.trim()+'"']);
    return a;
  }
  const hasFilter=()=>S.fIndustry!=='ALL'||S.fRegion!=='ALL'||S.fTraits.size>0||!!S.query.trim();

  function filteredSuppliers(){
    const q=norm(S.query.trim());
    return (S.suppliers||[]).filter(s=>{
      if(S.fIndustry!=='ALL'&&s.segment!==S.fIndustry)return false;
      if(S.fRegion!=='ALL'&&s.region!==S.fRegion)return false;
      if(S.fTraits.size){const t=s.traits||[];for(const x of S.fTraits)if(!t.includes(x))return false;}
      if(q&&!norm(`${s.supplier_name} ${s.segment_label} ${s.top_buyer_name||''}`).includes(q))return false;
      return true;
    });
  }
  function filteredBuyers(){
    const q=norm(S.query.trim());
    return (S.buyers||[]).filter(b=>{
      if(S.fIndustry!=='ALL'&&b.segment!==S.fIndustry)return false;
      if(S.fRegion!=='ALL'&&b.region!==S.fRegion)return false;
      if(q&&!norm(`${b.buyer_name} ${b.segment_label||''}`).includes(q))return false;
      return true;
    });
  }
  function filteredFindings(){
    const q=norm(S.query.trim());
    return (S.findings||[]).filter(f=>{
      if(S.fIndustry!=='ALL'&&f.segment!==S.fIndustry)return false;
      if(S.fRegion!=='ALL'&&f.subject_region!==S.fRegion)return false;
      if(S.fTraits.size){const t=f.traits||[];for(const x of S.fTraits)if(!t.includes(x))return false;}
      if(q&&!norm(`${f.subject_name} ${f.counterpart_name} ${f.rationale}`).includes(q))return false;
      return true;
    });
  }
  /* gasto exacto a nivel orden para el alcance activo (industria × región) */
  function scopedSpend(){
    const rows=(S.indRegion||[]).filter(r=>
      (S.fIndustry==='ALL'||r.segment===S.fIndustry)&&(S.fRegion==='ALL'||r.region===S.fRegion));
    return rows.reduce((a,r)=>a+num(r.total_clp),0);
  }

  /* ---------- cabecera y filtros ---------- */
  function heroHtml(){
    const c=S.coverage||{};
    const win=c.window_start?`${dateCL(c.window_start)} → ${dateCL(c.window_end)}`:'ventana publicada';
    return `<div class="gp10-hero">
      <div><span class="gp10-eyebrow">Atlas · Monitor analítico de compras públicas</span>
        <h2>Gasto público</h2></div>
      <div class="gp10-health">
        <span class="gp10-pill"><b>${esc(win)}</b></span>
        <span class="gp10-pill"><b>${NF.format(num(c.order_count))}</b>&nbsp;órdenes</span>
        <span class="gp10-pill"><b>${NF.format((S.industry||[]).length)}</b>&nbsp;industrias</span>
        <span class="gp10-pill ${num(c.res_coverage_pct)>=25?'':'warn'}">RES <b>${num(c.res_coverage_pct)}%</b></span>
      </div></div>`;
  }
  function tabsHtml(){
    const t=[['panorama','Panorama',null],['industrias','Industrias',(S.industry||[]).length],
      ['proveedores','Proveedores',(S.suppliers||[]).length],['compradores','Compradores',(S.buyers||[]).length],
      ['anomalias','Anomalías',(S.findings||[]).length],['metodo','Método',null]];
    return `<nav class="gp10-tabs" aria-label="Vistas del monitor">
      ${t.map(([k,l,n])=>`<button type="button" class="gp10-tab ${S.tab===k?'active':''}" data-gp10-tab="${k}">${esc(l)}${n?`<span class="gp10-n">${NF.format(n)}</span>`:''}</button>`).join('')}
      <span class="gp10-actions">
        <button type="button" class="gp10-ghost" data-gp10-act="export">Exportar CSV</button>
        <button type="button" class="gp10-ghost" data-gp10-act="reload">Actualizar</button>
      </span></nav>`;
  }
  function filtersHtml(){
    const inds=(S.industry||[]).slice().sort((a,b)=>String(a.segment_label).localeCompare(String(b.segment_label),'es'));
    const regs=[...new Set((S.indRegion||[]).map(r=>r.region))].sort((a,b)=>shortRegion(a).localeCompare(shortRegion(b),'es'));
    const counts=new Map();
    (S.suppliers||[]).forEach(s=>(s.traits||[]).forEach(t=>counts.set(t,(counts.get(t)||0)+1)));
    const act=activeFilters();
    return `<div class="gp10-filters">
      <div class="gp10-frow">
        <span class="gp10-flabel">Alcance</span>
        <select class="gp10-select" id="gp10-ind"><option value="ALL">Todas las industrias</option>
          ${inds.map(i=>`<option value="${esc(i.segment)}" ${S.fIndustry===i.segment?'selected':''}>${esc(i.segment_label)}</option>`).join('')}</select>
        <select class="gp10-select" id="gp10-reg"><option value="ALL">Todas las regiones</option>
          ${regs.map(r=>`<option value="${esc(r)}" ${S.fRegion===r?'selected':''}>${esc(shortRegion(r))}</option>`).join('')}</select>
        <input class="gp10-search" id="gp10-q" type="search" value="${esc(S.query)}" placeholder="Buscar proveedor, servicio o industria…" autocomplete="off">
      </div>
      <div class="gp10-frow">
        <span class="gp10-flabel">Caracteriza</span>
        ${TRAITS.filter(([k])=>counts.get(k)).map(([k,l])=>
          `<button type="button" class="gp10-chip ${S.fTraits.has(k)?'on':''}" data-gp10-trait="${k}">${esc(l)}<i>${NF.format(counts.get(k))}</i></button>`).join('')}
      </div>
      ${act.length?`<div class="gp10-scope"><b>Alcance activo:</b>
        ${act.map(([k,v])=>`<span class="gp10-crumb">${esc(v)}<button type="button" data-gp10-clear="${esc(k)}" aria-label="Quitar">×</button></span>`).join('')}
        <button type="button" class="gp10-chip" data-gp10-act="clear">Limpiar todo</button></div>`:''}
    </div>`;
  }

  /* ---------- PANORAMA ---------- */
  function panoramaHtml(){
    const sup=filteredSuppliers(), buy=filteredBuyers();
    const spend=hasFilter()&&(S.fIndustry!=='ALL'||S.fRegion!=='ALL')?scopedSpend():num((S.coverage||{}).total_clp);
    const supSpend=sup.reduce((a,s)=>a+num(s.total_clp),0);
    const newSup=sup.filter(s=>(s.traits||[]).includes('EMPRESA_NUEVA'));
    const soSup=sup.filter(s=>(s.traits||[]).includes('SUJETO_OBLIGADO'));
    const conc=(S.market||[]).filter(m=>m.severity==='ALTA');
    const kpis=[
      ['Gasto en alcance',money(spend),`${NF.format(buy.length)} servicios`,''],
      ['Proveedores',NF.format(sup.length),`${money(supSpend)} atribuido`,''],
      ['Mercados monopolizados',NF.format(conc.length),'HHI ≥ 0,50','crit'],
      ['Empresas nuevas',NF.format(newSup.length),`${money(newSup.reduce((a,s)=>a+num(s.total_clp),0))}`,'warn'],
      ['Sujetos obligados UAF',NF.format(soSup.length),`${money(soSup.reduce((a,s)=>a+num(s.total_clp),0))}`,''],
      ['Industrias activas',NF.format(new Set(sup.map(s=>s.segment).filter(Boolean)).size),'clasificación UNSPSC','']
    ];
    /* gasto por industria y concentración: dos gráficos, un eje cada uno */
    const ind=(S.industry||[]).slice();
    const scoped=S.fRegion!=='ALL'
      ? (()=>{const m=new Map();(S.indRegion||[]).filter(r=>r.region===S.fRegion)
            .forEach(r=>m.set(r.segment,num(r.total_clp)));
          return ind.map(i=>Object.assign({},i,{total_clp:m.get(i.segment)||0}));})()
      : ind;
    const topInd=scoped.filter(i=>i.total_clp>0).sort((a,b)=>b.total_clp-a.total_clp).slice(0,14);
    const cmpRows=topInd.map(i=>({label:i.segment_label,value:num(i.total_clp),dot:num(i.hhi),
      key:i.segment,pick:'industry',
      color:S.fIndustry===i.segment?CAT[1]:CAT[0],
      dotColor:num(i.hhi)>=0.5?ST.crit:num(i.hhi)>=0.25?ST.warn:CAT[3],
      tip:`${i.segment_label}|${money(i.total_clp)} · ${NF.format(i.supplier_count)} proveedores|HHI ${dec(i.hhi,3)} · principal ${pct(i.top_supplier_share)}`,
      dotTip:`${i.segment_label}|HHI ${dec(i.hhi,3)} · principal ${pct(i.top_supplier_share)}|${NF.format(i.supplier_count)} proveedores · ${NF.format(i.buyer_count)} servicios`}));
    /* territorio · el área codifica el gasto y el color su orden de magnitud,
       para que la rampa se reparta en vez de agolparse en un solo paso */
    const regAgg=new Map();
    (S.indRegion||[]).filter(r=>S.fIndustry==='ALL'||r.segment===S.fIndustry)
      .forEach(r=>{const k=r.region;const cur=regAgg.get(k)||{v:0,s:0};cur.v+=num(r.total_clp);cur.s+=num(r.supplier_count);regAgg.set(k,cur);});
    const regSorted=[...regAgg.entries()].sort((a,b)=>b[1].v-a[1].v);
    const rn=Math.max(1,regSorted.length-1);
    const regItems=regSorted.map(([k,x],i)=>({n:shortRegion(k),v:x.v,key:k,t:1-i/rn,
      sub:`${NF.format(x.s)} prov.`,tip:`${shortRegion(k)}|${money(x.v)}|${NF.format(x.s)} proveedores`}));
    return `<div class="gp10-kpis">${kpis.map(k=>
      `<article class="gp10-kpi ${k[3]}"><span>${esc(k[0])}</span><b>${esc(k[1])}</b><small>${esc(k[2])}</small></article>`).join('')}</div>
    <section class="gp10-panel">
      <div class="gp10-ph"><div><span>Industrias</span><h3>Dónde se mueve el gasto y cómo está estructurado</h3></div><small>clic en barra = filtrar</small></div>
      <div class="gp10-pad">${compareChart(cmpRows)}</div>
      <div class="gp10-legend"><span>HHI 0 = atomizado · 1 = un solo proveedor</span>
        <em>punto rojo ≥ 0,50 monopolizado · ámbar ≥ 0,25 concentrado</em></div>
    </section>
    <div class="gp10-g2">
      <section class="gp10-panel">
        <div class="gp10-ph"><div><span>Territorio</span><h3>Gasto por región</h3></div><small>área = gasto · color = orden de magnitud</small></div>
        <div class="gp10-pad">${treemap(regItems,{pick:'region',w:700,h:390})}</div>
      </section>
      <div class="gp10-gcol">
        <section class="gp10-panel">
          <div class="gp10-ph"><div><span>Distribución</span><h3>Concentración del gasto</h3></div><small>Lorenz</small></div>
          <div class="gp10-pad">${lorenzChart(S.lorenz)}</div>
        </section>
        <section class="gp10-panel">
          <div class="gp10-ph"><div><span>Mercados</span><h3>Estructura observada</h3></div><small>${NF.format((S.market||[]).length)}</small></div>
          <div class="gp10-pad">${marketMini()}</div>
        </section>
      </div>
    </div>`;
  }
  function marketMini(){
    const rows=(S.market||[]).slice().sort((a,b)=>num(b.hhi)-num(a.hhi)).slice(0,8);
    const mx=1;
    return rows.map(m=>`<div class="gp10-lrow reg click" data-gp10-pick="industry" data-key="${esc(m.segment)}">
      <span class="gp10-ln">${esc(clip(m.segment_label,20))}</span>
      <span class="gp10-lb">${barSvg(num(m.hhi)/mx,num(m.hhi)>=0.5?ST.crit:num(m.hhi)>=0.25?ST.warn:CAT[3])}</span>
      <span class="gp10-lv">${esc(money(m.total_clp))}</span>
      <span class="gp10-lv strong">${dec(m.hhi,3)}</span>
      <span class="gp10-lv">${NF.format(num(m.supplier_count))} prov.</span></div>`).join('');
  }

  /* ---------- INDUSTRIAS ---------- */
  function industriasHtml(){
    const ind=(S.industry||[]).slice().sort((a,b)=>(num(b[S.sortInd])-num(a[S.sortInd]))*(S.sortDir<0?1:-1));
    const rows=ind.slice(0,16);
    const regTot=new Map();
    (S.indRegion||[]).forEach(r=>regTot.set(r.region,(regTot.get(r.region)||0)+num(r.total_clp)));
    const cols=[...regTot.entries()].sort((a,b)=>b[1]-a[1])
      .map(([r])=>({key:r,label:shortRegion(r)}));
    const cells=(S.indRegion||[]).map(r=>({r:r.segment,c:r.region,v:num(r.total_clp)}));
    return `<section class="gp10-panel">
      <div class="gp10-ph"><div><span>Matriz</span><h3>Industria × territorio</h3></div><small>intensidad = gasto (escala raíz)</small></div>
      <div class="gp10-pad gp10-tw">${matrix(rows.map(i=>({key:i.segment,label:i.segment_label})),cols,cells)}</div>
    </section>
    <section class="gp10-panel">
      <div class="gp10-ph"><div><span>Estructura de mercado</span><h3>Las ${NF.format(ind.length)} industrias observadas</h3></div><small>clic en fila = filtrar · clic en encabezado = ordenar</small></div>
      <div class="gp10-tw"><table class="gp10-table">
        <thead><tr>
          <th data-gp10-sort="segment_label">Industria</th>
          <th class="num" data-gp10-sort="total_clp">Gasto</th>
          <th class="num" data-gp10-sort="supplier_count">Proveedores</th>
          <th class="num" data-gp10-sort="buyer_count">Servicios</th>
          <th class="num" data-gp10-sort="hhi">HHI</th>
          <th class="num" data-gp10-sort="top_supplier_share">Principal</th>
          <th class="num" data-gp10-sort="new_share">Nuevas</th>
          <th class="num" data-gp10-sort="median_order_clp">OC mediana</th>
          <th>Estructura</th>
        </tr></thead>
        <tbody>${ind.map(i=>{
          const h=num(i.hhi);
          const tag=h>=0.5?'<span class="gp10-tag crit">Monopolizado</span>':h>=0.25?'<span class="gp10-tag warn">Concentrado</span>':'<span class="gp10-tag mute">Atomizado</span>';
          return `<tr data-gp10-pick="industry" data-key="${esc(i.segment)}">
            <td class="name">${esc(i.segment_label)}<small>UNSPSC ${esc(i.segment)}</small></td>
            <td class="num">${esc(money(i.total_clp))}</td>
            <td class="num">${NF.format(num(i.supplier_count))}</td>
            <td class="num">${NF.format(num(i.buyer_count))}</td>
            <td class="num">${dec(i.hhi,3)}</td>
            <td class="num">${pct(i.top_supplier_share)}</td>
            <td class="num">${pct(i.new_share)}</td>
            <td class="num">${esc(money(i.median_order_clp))}</td>
            <td>${tag}</td></tr>`;}).join('')}</tbody>
      </table></div>
    </section>`;
  }

  /* ---------- PROVEEDORES ---------- */
  function proveedoresHtml(){
    const sup=filteredSuppliers();
    const sorted=sup.slice().sort((a,b)=>(num(b[S.sortSup])-num(a[S.sortSup]))*(S.sortDir<0?1:-1));
    const counts=new Map();
    sup.forEach(s=>(s.traits||[]).forEach(t=>counts.set(t,(counts.get(t)||0)+1)));
    const traitRows=TRAITS.filter(([k])=>counts.get(k)).map(([k,l])=>({
      label:l,value:counts.get(k),color:CAT[0],right:NF.format(counts.get(k)),
      tip:`${l}|${NF.format(counts.get(k))} proveedores`}));
    return `<div class="gp10-g2">
      <section class="gp10-panel">
        <div class="gp10-ph"><div><span>Universo</span><h3>Riesgo × materialidad</h3></div><small>clic = abrir proveedor</small></div>
        <div class="gp10-pad">${scatterChart(sup.slice(0,3000))}</div>
        <div class="gp10-legend">
          <span><i class="gp10-sw k1"></i>Sin marca dominante</span>
          <span><i class="gp10-sw k2"></i>Empresa nueva</span>
          <span><i class="gp10-sw k3"></i>Sanción / sujeto obligado</span>
          <span><i class="gp10-sw k4"></i>Concentración / fraccionamiento</span>
          <em>${NF.format(sup.length)} proveedores en alcance</em>
        </div>
      </section>
      <div class="gp10-gcol">
        <section class="gp10-panel">
          <div class="gp10-ph"><div><span>Caracterización</span><h3>Cómo se compone el universo</h3></div></div>
          <div class="gp10-pad">${barChart(traitRows,{left:196,rh:24})}</div>
        </section>
        <section class="gp10-panel gp10-side">${detailHtml()}</section>
      </div>
    </div>
    <section class="gp10-panel">
      <div class="gp10-ph"><div><span>Detalle</span><h3>${NF.format(sorted.length)} proveedores en alcance</h3></div><small>clic en encabezado = ordenar</small></div>
      <div class="gp10-tw gp10-scroll"><table class="gp10-table">
        <thead><tr>
          <th data-gp10-sort="supplier_name">Proveedor</th>
          <th class="num" data-gp10-sort="total_clp">Monto</th>
          <th class="num" data-gp10-sort="order_count">OC</th>
          <th class="num" data-gp10-sort="buyer_count">Compradores</th>
          <th class="num" data-gp10-sort="industry_count">Industrias</th>
          <th class="num" data-gp10-sort="age_years">Antigüedad</th>
          <th class="num" data-gp10-sort="capital_ratio">M/Capital</th>
          <th class="num" data-gp10-sort="attention_score">Atención</th>
          <th>Caracterización</th>
        </tr></thead>
        <tbody>${sorted.slice(0,300).map(s=>`<tr data-gp10-sup="${esc(s.supplier_key)}">
          <td class="name">${esc(clip(s.supplier_name,52))}<small>${esc(clip(s.segment_label||'Sin clasificar',34))} · ${esc(shortRegion(s.region))}</small></td>
          <td class="num">${esc(money(s.total_clp))}</td>
          <td class="num">${NF.format(num(s.order_count))}</td>
          <td class="num">${NF.format(num(s.buyer_count))}</td>
          <td class="num">${NF.format(num(s.industry_count))}</td>
          <td class="num">${s.age_years!=null?dec(s.age_years,1)+' a':'—'}</td>
          <td class="num">${s.capital_ratio!=null?dec(s.capital_ratio,1)+'x':'—'}</td>
          <td class="num">${num(s.attention_score)||'—'}</td>
          <td>${(s.traits||[]).slice(0,3).map(t=>{
            const cls=t==='CON_SANCION'||t==='CON_CGR'?'crit':t==='EMPRESA_NUEVA'||t==='SUJETO_OBLIGADO'?'warn':'mute';
            return `<span class="gp10-tag ${cls}">${esc(traitLabel(t))}</span>`;}).join('')}</td>
        </tr>`).join('')||'<tr><td colspan="9">Sin proveedores en el alcance actual.</td></tr>'}</tbody>
      </table></div>
    </section>`;
  }

  /* ---------- COMPRADORES ---------- */
  function compradoresHtml(){
    const buy=filteredBuyers();
    const sorted=buy.slice().sort((a,b)=>(num(b[S.sortBuy])-num(a[S.sortBuy]))*(S.sortDir<0?1:-1));
    const top=buy.slice().sort((a,b)=>num(b.total_clp)-num(a.total_clp)).slice(0,12);
    const cmpRows=top.map(b=>({label:b.buyer_name,value:num(b.total_clp),dot:num(b.hhi),
      color:num(b.top_supplier_share)>=0.6?ST.warn:CAT[0],
      dotColor:num(b.hhi)>=0.5?ST.crit:num(b.hhi)>=0.25?ST.warn:CAT[3],
      tip:`${b.buyer_name}|${money(b.total_clp)} · ${NF.format(b.supplier_count)} proveedores|HHI ${dec(b.hhi,3)} · principal ${pct(b.top_supplier_share)}`,
      dotTip:`${b.buyer_name}|HHI ${dec(b.hhi,3)} · principal ${pct(b.top_supplier_share)}|${NF.format(b.industry_count)} industrias`}));
    const newTop=buy.filter(b=>num(b.new_supplier_share)>0&&num(b.total_clp)>=5e7)
      .sort((a,b)=>num(b.new_supplier_share)-num(a.new_supplier_share)).slice(0,10);
    return `<section class="gp10-panel">
      <div class="gp10-ph"><div><span>Compradores</span><h3>Magnitud del gasto y concentración de su cartera</h3></div><small>barra ámbar = principal proveedor ≥60%</small></div>
      <div class="gp10-pad">${compareChart(cmpRows,{left:250,bw:360,leftTitle:'Gasto observado',rightTitle:'HHI de su cartera'})}</div>
    </section>
    <div class="gp10-g11">
      <section class="gp10-panel">
        <div class="gp10-ph"><div><span>Rotación</span><h3>Gasto en empresas nuevas</h3></div><small>servicios ≥ $50 M</small></div>
        <div class="gp10-pad">${newTop.length?newTop.map(b=>`<div class="gp10-lrow click" data-gp10-buy="${esc(b.buyer_key)}">
          <span class="gp10-ln">${esc(clip(b.buyer_name,34))}</span>
          <span class="gp10-lb">${barSvg(num(b.new_supplier_share),CAT[1])}</span>
          <span class="gp10-lv strong">${pct(b.new_supplier_share)}</span>
          <span class="gp10-lv">${esc(money(b.new_supplier_clp))}</span></div>`).join('')
          :'<div class="gp10-empty">Sin servicios con gasto en empresas nuevas en este alcance.</div>'}</div>
      </section>
      <section class="gp10-panel gp10-side">${detailHtml()}</section>
    </div>
    <section class="gp10-panel">
      <div class="gp10-ph"><div><span>Detalle</span><h3>${NF.format(sorted.length)} servicios en alcance</h3></div><small>clic en encabezado = ordenar</small></div>
      <div class="gp10-tw gp10-scroll"><table class="gp10-table">
        <thead><tr>
          <th data-gp10-sort="buyer_name">Servicio público</th>
          <th class="num" data-gp10-sort="total_clp">Gasto</th>
          <th class="num" data-gp10-sort="supplier_count">Proveedores</th>
          <th class="num" data-gp10-sort="industry_count">Industrias</th>
          <th class="num" data-gp10-sort="hhi">HHI</th>
          <th class="num" data-gp10-sort="top_supplier_share">Principal</th>
          <th class="num" data-gp10-sort="new_supplier_share">Nuevas</th>
          <th class="num" data-gp10-sort="so_suppliers">SO UAF</th>
          <th class="num" data-gp10-sort="order_count">OC</th>
        </tr></thead>
        <tbody>${sorted.slice(0,300).map(b=>`<tr data-gp10-buy="${esc(b.buyer_key)}">
          <td class="name">${esc(clip(b.buyer_name,52))}<small>${esc(shortRegion(b.region))} · ${esc(clip(b.segment_label||'Sin clasificar',30))}</small></td>
          <td class="num">${esc(money(b.total_clp))}</td>
          <td class="num">${NF.format(num(b.supplier_count))}</td>
          <td class="num">${NF.format(num(b.industry_count))}</td>
          <td class="num">${dec(b.hhi,3)}</td>
          <td class="num">${pct(b.top_supplier_share)}</td>
          <td class="num">${pct(b.new_supplier_share)}</td>
          <td class="num">${NF.format(num(b.so_suppliers))}</td>
          <td class="num">${NF.format(num(b.order_count))}</td>
        </tr>`).join('')||'<tr><td colspan="9">Sin servicios en el alcance actual.</td></tr>'}</tbody>
      </table></div>
    </section>`;
  }

  /* ---------- ANOMALÍAS ---------- */
  function anomaliasHtml(){
    const f=filteredFindings();
    const mk=(S.market||[]).filter(m=>S.fIndustry==='ALL'||m.segment===S.fIndustry)
      .sort((a,b)=>num(b.hhi)-num(a.hhi));
    return `<div class="gp10-g2b">
      <section class="gp10-panel">
        <div class="gp10-ph"><div><span>Hallazgos de caso</span><h3>${NF.format(f.length)} en alcance</h3></div><small>clic = abrir sujeto</small></div>
        <div class="gp10-scroll">${f.slice(0,120).map(r=>`<button type="button" class="gp10-card sev-${esc(r.severity)}"
            data-gp10-${r.scope==='SERVICIO'?'buy':'sup'}="${esc(r.subject_key)}">
          <span class="gp10-sev"></span>
          <span class="gp10-cb">
            <span class="gp10-ct"><span class="gp10-tag ${r.severity==='ALTA'?'crit':r.severity==='MEDIA'?'warn':'mute'}">${esc(r.severity)}</span>
              <span class="gp10-tag">${esc(codeLabel(r.finding_code))}</span>
              ${r.segment_label?`<span class="gp10-tag mute">${esc(clip(r.segment_label,24))}</span>`:''}</span>
            <b>${esc(r.subject_name||'')}</b>
            <p>${esc(r.rationale||'')}</p>
            <span class="gp10-cm"><span>${esc(r.metric_label||'')}: <b>${esc(r.metric_value||'—')}</b></span></span>
          </span>
          <span class="gp10-cn"><strong>${esc(money(r.amount_clp))}</strong><em>monto</em></span>
        </button>`).join('')||'<div class="gp10-empty">Sin hallazgos en el alcance actual.</div>'}</div>
      </section>
      <section class="gp10-panel">
        <div class="gp10-ph"><div><span>Hallazgos de mercado</span><h3>Estructura por industria</h3></div><small>${NF.format(mk.length)}</small></div>
        <div class="gp10-scroll">${mk.map(m=>`<button type="button" class="gp10-card sev-${esc(m.severity)}" data-gp10-pick="industry" data-key="${esc(m.segment)}">
          <span class="gp10-sev"></span>
          <span class="gp10-cb">
            <span class="gp10-ct"><span class="gp10-tag ${m.severity==='ALTA'?'crit':m.severity==='MEDIA'?'warn':'mute'}">${esc(codeLabel(m.finding_code))}</span></span>
            <b>${esc(m.segment_label)}</b>
            <p>${esc(m.rationale)}</p>
            <span class="gp10-cm"><span>HHI <b>${dec(m.hhi,3)}</b></span><span>Principal <b>${pct(m.top_supplier_share)}</b></span></span>
          </span>
          <span class="gp10-cn"><strong>${esc(money(m.total_clp))}</strong><em>${NF.format(num(m.supplier_count))} prov.</em></span>
        </button>`).join('')}</div>
      </section>
    </div>`;
  }

  /* ---------- ficha lateral ---------- */
  function detailHtml(){
    if(S.busy)return '<div class="gp10-loading"><div class="gp10-spinner"></div>Abriendo…</div>';
    const d=S.detail;
    if(!d)return `<div class="gp10-empty-side"><div><b>Selecciona un elemento</b>
      <p>Cualquier punto, barra o fila abre su ficha con caracterización y contrapartes observadas.</p></div></div>`;
    const p=d.profile||{}, sup=d.kind==='supplier';
    const facts=sup?[
      ['Monto', money(p.total_clp),''],
      ['Órdenes', NF.format(num(p.order_count)),''],
      ['Compradores', NF.format(num(p.buyer_count)),''],
      ['Industrias', NF.format(num(p.industry_count)),''],
      ['Constitución', dateCL(p.constitution_date),''],
      ['Antigüedad', p.age_years!=null?dec(p.age_years,2)+' años':'Sin RES', num(p.age_years)<=2&&p.age_years!=null?'crit':''],
      ['Capital', p.capital?moneyFull(p.capital):'—',''],
      ['Monto/Capital', p.capital_ratio!=null?dec(p.capital_ratio,1)+'x':'—', num(p.capital_ratio)>=50?'crit':''],
      ['Dependencia', pct(p.dependence_share), num(p.dependence_share)>=0.8?'crit':''],
      ['Trabajadores SII', p.sii_workers!=null?NF.format(num(p.sii_workers)):'—',''],
      ['Sanciones', NF.format(num(p.uaf_sanction_count)), num(p.uaf_sanction_count)>0?'crit':''],
      ['Eventos CGR', NF.format(num(p.cgr_events)), num(p.cgr_events)>0?'crit':'']
    ]:[
      ['Gasto', money(p.total_clp),''],
      ['Proveedores', NF.format(num(p.supplier_count)),''],
      ['Industrias', NF.format(num(p.industry_count)),''],
      ['HHI', dec(p.hhi,3), num(p.hhi)>=0.25?'crit':''],
      ['Principal', pct(p.top_supplier_share), num(p.top_supplier_share)>=0.6?'crit':''],
      ['Nuevas', pct(p.new_supplier_share), num(p.new_supplier_share)>=0.1?'crit':''],
      ['SO UAF', NF.format(num(p.so_suppliers)),''],
      ['Órdenes', NF.format(num(p.order_count)),'']
    ];
    return `<h3>${esc(d.title)}</h3>
      <p class="gp10-sub">${sup?'Proveedor':'Servicio público'}${p.segment_label?' · '+esc(p.segment_label):''}${p.region?' · '+esc(shortRegion(p.region)):''}</p>
      <div class="gp10-facts">${facts.map(x=>
        `<div class="gp10-fact"><span>${esc(x[0])}</span><b class="${x[2]}">${esc(x[1])}</b></div>`).join('')}</div>
      ${(p.traits||[]).length?`<div class="gp10-block"><h4>Caracterización</h4>
        ${p.traits.map(t=>{const cls=t==='CON_SANCION'||t==='CON_CGR'?'crit':t==='EMPRESA_NUEVA'||t==='SUJETO_OBLIGADO'?'warn':'mute';
          return `<span class="gp10-tag ${cls}">${esc(traitLabel(t))}</span>`;}).join('')}</div>`:''}
      ${p.uaf_sector||p.sii_sector?`<div class="gp10-block"><h4>Clasificación externa</h4>
        ${p.uaf_sector?`<div class="gp10-rel"><span>Sector UAF</span><b>${esc(clip(p.uaf_sector,26))}</b></div>`:''}
        ${p.sii_sector?`<div class="gp10-rel"><span>Sector SII</span><b>${esc(clip(p.sii_sector,26))}</b></div>`:''}
        ${p.ipf_band?`<div class="gp10-rel"><span>Banda IPF</span><b>${esc(p.ipf_band)}</b></div>`:''}</div>`:''}
      ${(d.relations||[]).length?`<div class="gp10-block"><h4>${sup?'Principales compradores':'Principales proveedores'}</h4>
        ${d.relations.map(r=>`<div class="gp10-rel"><span>${esc(clip(sup?r.buyer_name:r.supplier_name,30))}</span><b>${esc(money(r.total_clp))}</b></div>`).join('')}</div>`:''}
      ${p.entity_id?`<button type="button" class="gp10-btn" data-gp10-entity="${esc(p.entity_id)}">Abrir Entidad 360</button>`:''}`;
  }

  /* ---------- MÉTODO ---------- */
  function metodoHtml(){
    const c=S.coverage||{};
    const card=(t,b,cls)=>`<section class="gp10-panel ${cls||''}"><h3>${t}</h3>${b}</section>`;
    return `<div class="gp10-method">
      ${card('Dimensión de industria','<p>Cada orden se clasifica por el segmento UNSPSC dominante en monto entre sus ítems. La clasificación cubre el <b>89,5%</b> del gasto observado; el resto queda como «Sin clasificar» y no se imputa.</p><code class="gp10-code">industria(orden) = segmento UNSPSC de mayor monto en la orden</code>')}
      ${card('Concentración de mercado','<p>HHI sobre la participación de cada proveedor dentro de la industria. Es la medida que distingue mercados con el mismo gasto y estructura opuesta.</p><code class="gp10-code">HHI = Σ (monto proveedor / gasto industria)²\n≥0,50 monopolizado · ≥0,25 concentrado</code>')}
      ${card('Caracterización del proveedor',`<p>Cada proveedor se cruza por RUT exacto contra el registro de sujetos obligados UAF, eventos CGR, sanciones materializadas, InfoLobby, el Registro de Empresas y Sociedades y la identidad gobernada del Workbench.</p><p>Cobertura observada: <b>207</b> sujetos obligados, <b>14</b> con sanción, <b>0</b> con evento CGR coincidente, <b>${num(c.res_coverage_pct)}%</b> con perfil societario.</p>`)}
      ${card('Atribución de proveedor','<p>Un proveedor puede vender en varias industrias y regiones. En listados y nubes se le atribuye su <b>industria y región dominantes por monto</b>; los agregados de gasto por industria o territorio se calculan a nivel de orden, no por atribución.</p><p>Por eso la suma de montos de proveedores filtrados puede diferir del gasto del alcance: son dos preguntas distintas.</p>')}
      ${card('Índice de atención','<p>Suma acotada de señales con peso explícito: empresa reciente con monto alto (20), capital desproporcionado (18), concentración de un servicio (22), fraccionamiento (18), dependencia (12), sanción (15), UAF (10), lobby (8).</p><code class="gp10-code">atención = min(100, Σ peso(señal activa))</code><p>Ordena la revisión; no la concluye.</p>')}
      ${card('Umbrales legales de referencia','<p>Los cortes de fraccionamiento usan la UTM de enero 2023.</p><code class="gp10-code">1 UTM = $61.769\n100 UTM = $6.176.900 (referencia de licitación)\n30 UTM = $1.853.070 (tope Compra Ágil)</code>')}
      ${card('Color y accesibilidad','<p>La paleta categórica está validada para superficie oscura: banda de luminosidad OKLCH 0,48–0,67, separación en deuteranopía ΔE 13,3 y en visión normal ΔE 22,9 sobre el peor par adyacente.</p><p>La severidad nunca se codifica sólo por color: siempre lleva etiqueta de texto. La magnitud usa una rampa de un solo tono, no un arcoíris.</p>')}
      ${card('Cobertura declarada',`<p>Ventana: <b>${esc(dateCL(c.window_start))} → ${esc(dateCL(c.window_end))}</b>, ${NF.format(num(c.order_count))} órdenes por ${esc(money(c.total_clp))}.</p><p>El cliente carga los proveedores que representan el <b>99,5%</b> del gasto; la cola de proveedores marginales se omite del filtrado en memoria.</p>`)}
      ${card('Limitaciones explícitas','<p>La ventana es de <b>un solo mes</b>: no se calculan tendencias ni estacionalidad, y el fraccionamiento se evalúa dentro del mes observado.</p><p>No se emite señal de sobreprecio: los códigos UNSPSC agrupan contratos a suma alzada junto con bienes unitarios, de modo que comparar precios unitarios produciría falsos positivos.</p><p>«Cautivo de un comprador» alcanza al 74% de los proveedores porque en una ventana mensual la mayoría vende a un solo servicio: es un descriptor, no una anomalía.</p><p>El cruce con CGR no arroja coincidencias en esta ventana; el campo se mantiene para cuando el pipeline amplíe cobertura.</p>','gp10-limit')}
    </div>`;
  }

  /* ---------- render ---------- */
  function render(focus){
    const h=host();
    if(!h)return false;
    if(S.error){
      h.innerHTML=`<section class="gp10">${heroHtml()}<div class="gp10-error"><b>No fue posible cargar el monitor</b><p>${esc(S.error)}</p><button type="button" class="gp10-ghost" data-gp10-act="reload">Reintentar</button></div></section>`;
      bind(h);return false;
    }
    let body;
    if(S.tab==='panorama')          body=panoramaHtml();
    else if(S.tab==='industrias')   body=industriasHtml();
    else if(S.tab==='proveedores')  body=proveedoresHtml();
    else if(S.tab==='compradores')  body=compradoresHtml();
    else if(S.tab==='anomalias')    body=anomaliasHtml();
    else                            body=metodoHtml();
    const showFilters=S.tab!=='metodo';
    h.innerHTML=`<section class="gp10">${heroHtml()}${tabsHtml()}${showFilters?filtersHtml():''}${body}
      <p class="gp10-foot">Fuente: Mercado Público · UNSPSC · Registro de Empresas y Sociedades · registro UAF · sanciones y CGR · InfoLobby · identidad gobernada AML Workbench. Señales de priorización analítica; la ausencia de señal no equivale a ausencia de riesgo.</p></section>`;
    bind(h);
    if(focus){const q=h.querySelector('#gp10-q');if(q){q.focus();q.setSelectionRange(q.value.length,q.value.length);}}
    publish('ready',{tab:S.tab,suppliers:(S.suppliers||[]).length,industries:(S.industry||[]).length});
    return true;
  }
  function loadingView(msg){
    const h=host();
    if(h)h.innerHTML=`<section class="gp10"><div class="gp10-loading"><div class="gp10-spinner"></div>${esc(msg||'Cargando…')}</div></section>`;
    publish('loading');
  }

  /* ---------- apertura de ficha ---------- */
  async function openSubject(kind,key){
    const c=db();
    if(!c)return;
    S.busy=true;render();
    try{
      const table=kind==='supplier'?SRC.supplierFull:SRC.buyers;
      const col=kind==='supplier'?'supplier_key':'buyer_key';
      const [prof,rel]=await Promise.all([
        c.from(table).select('*').eq(col,key).maybeSingle(),
        c.from(SRC.pairs).select('buyer_name,supplier_name,total_clp').eq(col,key)
          .order('total_clp',{ascending:false}).limit(8)
      ]);
      const p=prof.error?{}:(prof.data||{});
      S.detail={kind,profile:p,relations:rel.error?[]:(rel.data||[]),
        title:kind==='supplier'?(p.supplier_name||key):(p.buyer_name||key)};
      if(typeof audit==='function')audit('OPEN_PUBLIC_SPEND_SUBJECT',
        {objectType:kind,objectId:String(key),payload:{score:num(p.attention_score)}}).catch(()=>{});
    }catch(e){S.detail=null;}
    finally{S.busy=false;render();}
  }

  /* ---------- exportación ---------- */
  function exportCsv(){
    let rows=[],cols=[];
    if(S.tab==='compradores'){rows=filteredBuyers();
      cols=['buyer_name','region','segment_label','total_clp','supplier_count','industry_count','hhi','top_supplier_share','new_supplier_share','so_suppliers','order_count'];}
    else if(S.tab==='industrias'){rows=S.industry||[];
      cols=['segment','segment_label','total_clp','supplier_count','buyer_count','hhi','top_supplier_share','new_share','median_order_clp'];}
    else if(S.tab==='anomalias'){rows=filteredFindings();
      cols=['severity','finding_code','subject_name','counterpart_name','segment_label','amount_clp','metric_label','metric_value','rationale'];}
    else {rows=filteredSuppliers();
      cols=['supplier_name','segment_label','region','total_clp','order_count','buyer_count','industry_count','age_years','capital','capital_ratio','attention_score','traits'];}
    if(!rows.length)return;
    const cell=v=>`"${String(Array.isArray(v)?v.join(' '):(v==null?'':v)).replace(/"/g,'""')}"`;
    const csv=[cols.join(';')].concat(rows.map(r=>cols.map(k=>cell(r[k])).join(';'))).join('\r\n');
    const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`gasto-publico-${S.tab}-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  }

  /* ---------- tooltips SVG ---------- */
  function wireTips(root){
    root.querySelectorAll('svg[data-tip-host]').forEach(sv=>{
      const tip=sv.querySelector('#'+sv.getAttribute('data-tip-host'));
      if(!tip)return;
      const rect=tip.querySelector('rect'), txt=tip.querySelector('text');
      const vb=(sv.getAttribute('viewBox')||'0 0 100 100').split(/\s+/).map(Number);
      const hide=()=>tip.classList.add('hide');
      sv.addEventListener('mouseleave',hide);
      sv.addEventListener('mousemove',ev=>{
        const el=ev.target.closest('[data-tip]');
        if(!el){hide();return;}
        const lines=String(el.getAttribute('data-tip')).split('|').filter(Boolean);
        if(!lines.length){hide();return;}
        const box=sv.getBoundingClientRect();
        const sx=vb[2]/(box.width||1), sy=vb[3]/(box.height||1);
        let x=(ev.clientX-box.left)*sx, y=(ev.clientY-box.top)*sy;
        const w=Math.max(...lines.map(l=>l.length))*5.9+18;
        const h=lines.length*14+12;
        txt.textContent='';
        lines.forEach((l,i)=>{
          const t=document.createElementNS('http://www.w3.org/2000/svg','tspan');
          t.setAttribute('x','9');t.setAttribute('y',String(17+i*14));
          if(i)t.setAttribute('class','t-dim');
          t.textContent=l;txt.appendChild(t);
        });
        rect.setAttribute('width',String(w));rect.setAttribute('height',String(h));
        if(x+w+14>vb[2])x-=w+12; else x+=12;
        if(y+h+8>vb[3])y-=h+8; else y+=8;
        tip.setAttribute('transform',`translate(${Math.max(2,x).toFixed(1)},${Math.max(2,y).toFixed(1)})`);
        tip.classList.remove('hide');
      });
    });
  }

  /* ---------- eventos ---------- */
  function bind(root){
    wireTips(root);
    root.addEventListener('click',async e=>{
      const tab=e.target.closest('[data-gp10-tab]');
      if(tab){if(tab.dataset.gp10Tab!==S.tab){S.tab=tab.dataset.gp10Tab;S.detail=null;render();}return;}
      const pick=e.target.closest('[data-gp10-pick]');
      if(pick){
        const kind=pick.dataset.gp10Pick, key=pick.dataset.key;
        if(kind==='industry')S.fIndustry=S.fIndustry===key?'ALL':key;
        else if(kind==='region')S.fRegion=S.fRegion===key?'ALL':key;
        render();return;
      }
      const sup=e.target.closest('[data-gp10-sup]');
      if(sup){await openSubject('supplier',sup.dataset.gp10Sup);return;}
      const buy=e.target.closest('[data-gp10-buy]');
      if(buy){await openSubject('buyer',buy.dataset.gp10Buy);return;}
      const tr=e.target.closest('[data-gp10-trait]');
      if(tr){const k=tr.dataset.gp10Trait;S.fTraits.has(k)?S.fTraits.delete(k):S.fTraits.add(k);render();return;}
      const cl=e.target.closest('[data-gp10-clear]');
      if(cl){const k=cl.dataset.gp10Clear;
        if(k==='industry')S.fIndustry='ALL';
        else if(k==='region')S.fRegion='ALL';
        else if(k==='query')S.query='';
        else if(k.startsWith('trait:'))S.fTraits.delete(k.slice(6));
        render();return;}
      const so=e.target.closest('[data-gp10-sort]');
      if(so){const k=so.dataset.gp10Sort;
        const slot=S.tab==='compradores'?'sortBuy':S.tab==='industrias'?'sortInd':'sortSup';
        if(S[slot]===k)S.sortDir=-S.sortDir; else {S[slot]=k;S.sortDir=-1;}
        render();return;}
      const ent=e.target.closest('[data-gp10-entity]');
      if(ent){const id=ent.dataset.gp10Entity;
        if(typeof window.openEntity==='function')window.openEntity(id);
        else if(typeof openEntity==='function')openEntity(id);
        return;}
      const act=e.target.closest('[data-gp10-act]');
      if(!act)return;
      const a=act.dataset.gp10Act;
      if(a==='clear'){S.fIndustry='ALL';S.fRegion='ALL';S.fTraits.clear();S.query='';render();}
      else if(a==='export')exportCsv();
      else if(a==='reload'){S.error=null;load(true);}
    });
    const ind=root.querySelector('#gp10-ind');
    if(ind)ind.addEventListener('change',e=>{S.fIndustry=e.target.value;render();});
    const reg=root.querySelector('#gp10-reg');
    if(reg)reg.addEventListener('change',e=>{S.fRegion=e.target.value;render();});
    const q=root.querySelector('#gp10-q');
    if(q)q.addEventListener('input',e=>{S.query=e.target.value;
      clearTimeout(searchTimer);searchTimer=setTimeout(()=>render(true),160);});
  }

  /* ---------- ciclo de vida ---------- */
  function shellHeader(){
    try{if(typeof window.shell==='function')
      window.shell('Gasto público','Industria, territorio, comportamiento de proveedores y compradores, y detección de anomalías.');}catch{}
  }
  async function load(force){
    if(S.loading)return false;
    S.loading=true;S.error=null;
    loadingView('Construyendo el monitor de compras públicas…');
    try{
      if(force){S.suppliers=null;S.detail=null;}
      await loadAll(force);
      render();
      if(typeof audit==='function')audit('VIEW_PUBLIC_SPEND',
        {objectType:'radar',objectId:'GASTO_PUBLICO_GP12',
         payload:{version:VERSION,suppliers:(S.suppliers||[]).length}}).catch(()=>{});
      return true;
    }catch(e){S.error=String(e?.message||e);render();return false;}
    finally{S.loading=false;}
  }
  async function open(){
    if(opening)return false;
    opening=true;
    try{
      window.AtlasMobileNav?.close?.();
      shellHeader();
      if(S.suppliers){render();return true;}
      return await load(false);
    }finally{opening=false;}
  }

  /* Captura de ruta.
   * atlas-public-spend-v2.js escucha el clic en fase de captura sobre document y
   * llama stopImmediatePropagation(), abriendo su propia función interna sin pasar
   * por window.AtlasPublicSpendV2. Como se registra antes que route-authority-0578,
   * se queda con el clic y ningún módulo posterior corre. La fase de captura
   * recorre window antes que document, así que escuchar en window es lo único que
   * permite a este módulo tomar la ruta sin modificar GP2 ni el resto de la cadena. */
  window.addEventListener('click',event=>{
    const target=event.target?.closest?.('[data-view="public-spend"],[data-atlas-mobile-view="public-spend"]');
    if(!target)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open().catch(err=>{S.error=String(err?.message||err);render();});
  },true);

  const api={
    version:VERSION,authority:'GASTO_PUBLICO_GP12',
    open,load,render,state:()=>({tab:S.tab,suppliers:(S.suppliers||[]).length,error:S.error}),
    health:()=>window.__ATLAS_GASTO_PUBLICO_1000__||null
  };
  window.AtlasGastoPublico1000=api;
  window.AtlasPublicSpendIntelligence0720=api;
  window.AtlasPublicSpendV2=api;
  window.dispatchEvent(new CustomEvent('atlas:public-spend-v2-ready',{detail:{version:VERSION}}));
  publish('installed');
})();
