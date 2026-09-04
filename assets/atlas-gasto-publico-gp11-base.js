'use strict';
/* ATLAS AML · Gasto Público GP11 · monitor de compras públicas (Mercado Público)
 *
 * Tres superficies complementarias sobre la misma capa de datos:
 *   Tablero    — riesgo × materialidad: dónde mirar cuando el score y el dinero no coinciden.
 *   Expedientes— un caso a la vez, situado contra la población observada.
 *   Mapa       — estructura del mercado: concentración territorial y por servicio.
 *
 * Autoridad de datos: aml_mv_gp10_* / aml_v_gp10_*.
 * Los índices priorizan revisión; no acreditan irregularidad, delito ni LA/FT.
 *
 * Restricción CSP del portal (style-src 'self'): este módulo no emite atributos
 * style inline. Todo visual dato-dependiente se dibuja con atributos SVG.
 */
(function atlasGastoPublico1100(){
  const VERSION='GP11.0';
  const VIEW='public-spend';

  const SRC={
    coverage:'aml_v_gp10_coverage', findings:'aml_mv_gp10_finding',
    suppliers:'aml_mv_gp10_supplier_risk', buyers:'aml_mv_gp10_buyer_risk',
    pairs:'aml_mv_gp10_pair', scatter:'aml_v_gp10_scatter',
    lorenz:'aml_v_gp10_lorenz', region:'aml_v_gp10_region', pctl:'aml_v_gp10_percentile'
  };

  const CODE_LABEL={
    EMPRESA_RECIENTE_MONTO_ALTO:'Empresa reciente · monto alto',
    CAPITAL_DESPROPORCIONADO:'Capital desproporcionado',
    CAPTURA_COMPRADOR:'Proveedor concentra un servicio',
    POSIBLE_FRACCIONAMIENTO:'Posible fraccionamiento',
    CONCENTRACION_PROVEEDOR:'Servicio concentrado',
    DEPENDENCIA_COMPRADOR_UNICO:'Proveedor cautivo',
    SANCION_OBSERVADA:'Sanción observada', UAF_OBSERVADO:'Sujeto obligado UAF',
    LOBBY_OBSERVADO:'Lobby observado'
  };
  const SIGNAL_LABEL=Object.assign({},CODE_LABEL,{
    CONCENTRACION_RELEVANTE:'Concentración relevante', COMPRADOR_UNICO:'Comprador único',
    EMPRESA_NUEVA:'Empresa nueva', MONTO_ATIPICO:'Monto atípico', CONTEXTO_CGR:'Contexto CGR',
    SENAL_PRESUPUESTARIA:'Señal presupuestaria', BAJA_DIVERSIDAD_PROVEEDORES:'Baja diversidad',
    MERCADO_CONCENTRADO:'Mercado concentrado', PROVEEDORES_RECIENTES:'Proveedores recientes',
    SIN_REGISTRO_RES:'Sin registro RES', SIN_SENAL:'Sin señal'
  });
  /* familia de señal → color, para la nube de triaje */
  const FAMILY=[
    {k:'reciente',c:'#f06d67',lb:'Empresa reciente / capital',
     m:['EMPRESA_RECIENTE_MONTO_ALTO','EMPRESA_NUEVA','CAPITAL_DESPROPORCIONADO']},
    {k:'concentracion',c:'#f4a340',lb:'Concentración',
     m:['CAPTURA_COMPRADOR','CONCENTRACION_RELEVANTE','CONCENTRACION_PROVEEDOR','MERCADO_CONCENTRADO']},
    {k:'dependencia',c:'#49a8ed',lb:'Dependencia',
     m:['DEPENDENCIA_COMPRADOR_UNICO','COMPRADOR_UNICO']},
    {k:'fraccionamiento',c:'#a98cf0',lb:'Fraccionamiento / atípico',
     m:['POSIBLE_FRACCIONAMIENTO','MONTO_ATIPICO']}
  ];
  const SEVERITIES=['ALTA','MEDIA','BAJA'];

  const S={
    tab:'tablero', findings:null, scatter:null, lorenz:null, regions:null, pctl:null,
    buyers:null, coverage:null, sev:new Set(), codes:new Set(), query:'',
    caseKey:null, dossier:null, region:null,
    loading:false, error:null, busy:false
  };
  let searchTimer=null, opening=false;

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
  const codeLabel=c=>CODE_LABEL[c]||String(c||'').replaceAll('_',' ');
  const signalLabel=c=>SIGNAL_LABEL[c]||String(c||'').replaceAll('_',' ');
  const dateCL=d=>{const s=String(d||'');return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10).split('-').reverse().join('-'):'—';};
  /* Nombres cortos estables: recortar artículos deja restos ilegibles
     ("Los Ríos" → "Ríos"), así que se mapea explícitamente. */
  const REGION_SHORT=[
    [/Metropolitana/i,'Metropolitana'],[/Valpara/i,'Valparaíso'],[/Biob/i,'Biobío'],
    [/Araucan/i,'Araucanía'],[/los Lagos/i,'Los Lagos'],[/Maule/i,'Maule'],
    [/Higgins/i,"O'Higgins"],[/Coquimbo/i,'Coquimbo'],[/uble/i,'Ñuble'],
    [/os R[ií]os/i,'Los Ríos'],[/Antofagasta/i,'Antofagasta'],[/Magallanes/i,'Magallanes'],
    [/Tarapac/i,'Tarapacá'],[/Atacama/i,'Atacama'],[/Ays/i,'Aysén'],[/Arica/i,'Arica'],
    [/Sin regi/i,'Sin región']
  ];
  const shortRegion=r=>{
    const s=String(r||'');
    for(const [re,lb] of REGION_SHORT)if(re.test(s))return lb;
    return s.replace(/^Regi[oó]n\s+/i,'').trim()||'Sin región';
  };
  const famOf=code=>{const f=FAMILY.find(f=>f.m.includes(code));return f?f.c:'#5a7690';};

  function host(){
    try{return typeof v019Content==='function'?v019Content():document.querySelector('#content');}
    catch{return document.querySelector('#content');}
  }
  function publish(status,extra){
    window.__ATLAS_GASTO_PUBLICO_1000__=Object.assign({
      status,version:VERSION,view:VIEW,authority:'GASTO_PUBLICO_GP10',
      sources:Object.values(SRC),tab:S.tab,checkedAt:new Date().toISOString()
    },extra||{});
  }

  /* ---------- primitivas SVG (la CSP impide medidas por style inline) ---------- */
  const sv=(vb,body,cls)=>`<svg class="gp10-chart ${cls||''}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" role="img">${body}</svg>`;
  const txt=(x,y,t,o={})=>`<text x="${x}" y="${y}" fill="${o.f||'#63798e'}" font-size="${o.s||10}"`
    +`${o.a?` text-anchor="${o.a}"`:''}${o.w?` font-weight="${o.w}"`:''}>${esc(t)}</text>`;
  /* Las barras llevan clase propia con alto fijo: con width:100% y sin alto,
     un SVG escala por proporción y una fila de ranking se vuelve enorme. */
  const barColor=(ratio,color)=>{
    const w=Math.max(0,Math.min(100,num(ratio)*100));
    return `<svg class="gp10-barsvg" viewBox="0 0 100 7" preserveAspectRatio="none" aria-hidden="true">`
      +`<rect x="0" y="0" width="100" height="7" rx="3.5" fill="#172b3e"></rect>`
      +`<rect x="0" y="0" width="${w.toFixed(1)}" height="7" rx="3.5" fill="${color}"></rect></svg>`;
  };
  const bar=(ratio,tone)=>barColor(ratio,tone==='crit'?'#f06d67':tone==='warn'?'#f4a340':'#49a8ed');
  const scoreTone=s=>num(s)>=75?'crit':num(s)>=60?'warn':'';

  /* nube riesgo × materialidad, eje Y logarítmico */
  function scatterRisk(rows){
    const W=940,H=400,L=58,R=20,T=16,B=44;
    const X=s=>L+(W-L-R)*Math.min(100,Math.max(0,num(s)))/100;
    const Y=m=>{const lg=Math.log10(Math.max(1e5,num(m)));return H-B-(H-T-B)*(lg-5)/5;};
    let g=`<rect x="${X(35)}" y="${T}" width="${W-R-X(35)}" height="${Y(5e8)-T}" fill="#f06d67" opacity="0.05"></rect>`;
    for(let i=0;i<=5;i++){const y=T+(H-T-B)*i/5;g+=`<line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" stroke="#17293a"></line>`;}
    for(let i=0;i<=5;i++){const x=L+(W-L-R)*i/5;
      g+=`<line x1="${x}" y1="${T}" x2="${x}" y2="${H-B}" stroke="#17293a"></line>`+txt(x,H-B+17,i*20,{a:'middle'});}
    [[1e5,'$0,1 M'],[1e6,'$1 M'],[1e7,'$10 M'],[1e8,'$100 M'],[1e9,'$1.000 M'],[1e10,'$10 mil M']]
      .forEach(([v,l])=>{const y=Y(v);if(y>T-2&&y<H-B+2)g+=txt(L-8,y+3,l,{a:'end'});});
    const sorted=rows.slice().sort((a,b)=>num(b.total_clp)-num(a.total_clp));
    const mx=num(sorted[0]?.total_clp)||1;
    for(let i=sorted.length-1;i>=0;i--){
      const r=sorted[i],a=num(r.total_clp);
      const rad=Math.max(2,Math.min(15,2+Math.sqrt(a/mx)*22));
      g+=`<circle cx="${X(r.attention_score).toFixed(1)}" cy="${Y(a).toFixed(1)}" r="${rad.toFixed(1)}"`
        +` fill="${famOf(r.lead_signal)}" opacity="0.30"></circle>`;
    }
    /* etiquetar los casos que gobiernan la lectura, evitando solapes */
    const top=sorted.slice(0,4)
      .concat(rows.slice().sort((a,b)=>num(b.attention_score)-num(a.attention_score)).slice(0,4));
    /* etiquetas sin solape: se ancla a la derecha salvo cerca del borde, y se
       desplaza en vertical hasta encontrar hueco libre */
    const clip=s=>{const t=String(s||'');if(t.length<=24)return t;
      const cut=t.slice(0,24);const sp=cut.lastIndexOf(' ');return (sp>12?cut.slice(0,sp):cut)+'…';};
    const seen=new Set(),used=[];
    top.forEach(r=>{
      if(seen.has(r.supplier_key))return;seen.add(r.supplier_key);
      const a=num(r.total_clp),x=X(r.attention_score),y=Y(a);
      const rad=Math.max(4,Math.min(15,2+Math.sqrt(a/mx)*22));
      const label=clip(r.supplier_name);
      const left=x>W*0.60;
      const lx=left?x-rad-7:x+rad+7;
      let ly=y+3.5,step=0;
      while(used.some(u=>Math.abs(u.y-ly)<13&&Math.abs(u.x-lx)<150)&&step<10){
        step++;ly=y+3.5+(step%2?1:-1)*Math.ceil(step/2)*14;
      }
      used.push({x:lx,y:ly});
      g+=`<circle cx="${x}" cy="${y}" r="${rad}" fill="${famOf(r.lead_signal)}" stroke="#08121d" stroke-width="1.5"></circle>`;
      if(Math.abs(ly-(y+3.5))>2)
        g+=`<line x1="${left?x-rad:x+rad}" y1="${y}" x2="${lx}" y2="${ly-3.5}" stroke="#3c5a75"></line>`;
      g+=txt(lx,ly,label,{f:'#dbe8f5',s:10.5,w:700,a:left?'end':'start'});
    });
    g+=txt((L+W-R)/2,H-6,'Índice de atención (0–100)',{a:'middle',f:'#7e97ae',s:10.5});
    g+=`<text transform="translate(15 ${(T+H-B)/2}) rotate(-90)" fill="#7e97ae" font-size="10.5" text-anchor="middle">Monto contratado (escala log)</text>`;
    return sv(`0 0 ${W} ${H}`,g);
  }

  /* curva de Lorenz */
  function lorenzChart(pts){
    const W=380,H=215,L=42,R=12,T=12,B=34;
    const X=p=>L+(W-L-R)*num(p)/100, Y=v=>H-B-(H-T-B)*num(v)/100;
    let g='';
    for(let i=0;i<=4;i++){const y=T+(H-T-B)*i/4;
      g+=`<line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" stroke="#17293a"></line>`+txt(L-6,y+3,(100-i*25)+'%',{a:'end',s:9});}
    g+=`<line x1="${L}" y1="${H-B}" x2="${W-R}" y2="${T}" stroke="#2c4459" stroke-dasharray="3 3"></line>`;
    const all=[{pct_suppliers:0,pct_spend:0}].concat(pts);
    const d=all.map((p,i)=>`${i?'L':'M'}${X(p.pct_suppliers).toFixed(1)},${Y(p.pct_spend).toFixed(1)}`).join(' ');
    g+=`<path d="${d} L${X(100)},${Y(0)} Z" fill="#49a8ed" opacity="0.14"></path>`;
    g+=`<path d="${d}" fill="none" stroke="#49a8ed" stroke-width="2"></path>`;
    const k=pts[0];
    if(k){g+=`<circle cx="${X(k.pct_suppliers)}" cy="${Y(k.pct_spend)}" r="4" fill="#f4a340"></circle>`;
      g+=txt(X(k.pct_suppliers)+9,Y(k.pct_spend)-6,`${k.pct_suppliers}% capta ${dec(k.pct_spend,1)}%`,{f:'#f4a340',s:10.5,w:800});}
    [0,25,50,75,100].forEach(p=>g+=txt(X(p),H-B+15,p+'%',{a:'middle',s:9}));
    g+=txt((L+W-R)/2,H-4,'% de proveedores acumulado',{a:'middle',f:'#7e97ae',s:9.5});
    return sv(`0 0 ${W} ${H}`,g);
  }

  /* mapa de calor territorio × señal */
  function heatRegion(regions){
    const cols=[['concentrated_buyers','Concentr.',true],['recent_suppliers','Recientes',false],
      ['frag_pairs','Fraccion.',false],['hhi_avg','HHI',false],['lobby_buyers','Lobby',true],
      ['attention_avg','Atención',false]];
    const rows=regions.slice().sort((a,b)=>num(b.total_clp)-num(a.total_clp)).slice(0,11);
    const CW=104,W=760,CH=23,GAP=3,H=26+rows.length*(CH+GAP);
    const cw=(W-CW)/cols.length-GAP;
    const maxes=cols.map(([k,,rel])=>Math.max(...rows.map(r=>rel?num(r[k])/Math.max(1,num(r.buyers)):num(r[k]))));
    let g='';
    cols.forEach(([,lb],i)=>g+=txt(CW+i*(cw+GAP)+cw/2,14,lb,{a:'middle',s:8.8,w:800}));
    rows.forEach((r,ri)=>{
      const y=26+ri*(CH+GAP);
      g+=txt(CW-8,y+15.5,shortRegion(r.region).slice(0,15),{a:'end',f:'#a9c0d4',s:10});
      cols.forEach(([k,,rel],ci)=>{
        const raw=rel?num(r[k])/Math.max(1,num(r.buyers)):num(r[k]);
        const t=maxes[ci]?raw/maxes[ci]:0;
        const x=CW+ci*(cw+GAP);
        g+=`<rect x="${x}" y="${y}" width="${cw.toFixed(1)}" height="${CH}" rx="4"`
          +` fill="#f4a340" opacity="${(0.08+t*0.85).toFixed(2)}"></rect>`;
        if(t>0.13)g+=txt(x+cw/2,y+15.5,Math.round(t*100),{a:'middle',f:t>0.55?'#2a1502':'#c4d6e6',s:10,w:800});
      });
    });
    return sv(`0 0 ${W} ${H}`,g);
  }

  /* barras de señales · filas HTML con barra SVG, para que el alto no escale
     con el ancho del panel como haría un SVG único */
  function signalBars(findings){
    const m=new Map();
    for(const f of findings){const k=f.finding_code;
      if(!m.has(k))m.set(k,{n:0,amt:0});const r=m.get(k);r.n++;r.amt+=num(f.amount_clp);}
    const rows=[...m.entries()].sort((a,b)=>b[1].n-a[1].n);
    const mx=Math.max(...rows.map(r=>r[1].n),1);
    return rows.map(([k,v])=>`<div class="gp10-lrow">
      <span class="gp10-ln">${esc(codeLabel(k))}</span>
      <span class="gp10-lb">${barColor(v.n/mx,famOf(k))}</span>
      <span class="gp10-lv">${NF.format(v.n)}</span>
      <span class="gp10-lv">${esc(money(v.amt))}</span></div>`).join('');
  }

  /* tira de percentiles: sitúa un caso contra la población */
  function percentileStrip(cfg){
    const W=880,H=48,L=4,R=4,y=20;
    let g='',path=`M${L},${y+9} `;
    for(let x=0;x<=100;x+=2){
      const d=Math.exp(-Math.pow((x-36)/26,2))*0.85+Math.exp(-Math.pow((x-93)/8,2))*0.14;
      path+=`L${(L+(W-L-R)*x/100).toFixed(1)},${(y+9-d*17).toFixed(1)} `;
    }
    g+=`<path d="${path}L${W-R},${y+9} Z" fill="#22384c"></path>`;
    g+=`<line x1="${L}" y1="${y+9}" x2="${W-R}" y2="${y+9}" stroke="#2c4459"></line>`;
    (cfg.marks||[]).forEach(([p,lb])=>{const x=L+(W-L-R)*p/100;
      g+=`<line x1="${x}" y1="${y+4}" x2="${x}" y2="${y+13}" stroke="#5a7690"></line>`+txt(x,y+27,lb,{a:'middle',s:9});});
    const mx=L+(W-L-R)*Math.max(0,Math.min(100,cfg.pos))/100;
    g+=`<line x1="${mx}" y1="${y-13}" x2="${mx}" y2="${y+13}" stroke="#f06d67" stroke-width="2.5"></line>`;
    g+=`<circle cx="${mx}" cy="${y-13}" r="4.5" fill="#f06d67"></circle>`;
    return sv(`0 0 ${W} ${H}`,g);
  }

  /* treemap squarified */
  function squarify(items,x,y,w,h){
    const out=[],total=items.reduce((a,b)=>a+b.v,0);
    if(!total)return out;
    let rest=items.slice(),X=x,Y=y,W=w,H=h;const scale=(w*h)/total;
    const worst=(row,len)=>{const s=row.reduce((a,b)=>a+b.v,0)*scale;
      const a=Math.max(...row.map(r=>r.v*scale)),b=Math.min(...row.map(r=>r.v*scale));
      return Math.max(len*len*a/(s*s), s*s/(len*len*b));};
    let guard=0;
    while(rest.length&&guard++<400){
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
  const hhiColor=h=>{
    const t=Math.max(0,Math.min(1,(num(h)-0.35)/0.22));
    const st=[[29,74,107],[47,111,125],[109,138,92],[201,154,68],[224,113,63]];
    const i=Math.min(3,Math.floor(t*4)),f=t*4-i;
    return 'rgb('+st[i].map((v,k)=>Math.round(v+(st[i+1][k]-v)*f)).join(',')+')';
  };
  function treemapRegions(regions){
    const W=700,H=430;
    const items=regions.filter(r=>num(r.total_clp)>0)
      .map(r=>({n:shortRegion(r.region),v:num(r.total_clp),hhi:num(r.hhi_avg),c:num(r.concentrated_buyers),key:r.region}))
      .sort((a,b)=>b.v-a.v);
    const cells=squarify(items,0,0,W,H);
    let g='';
    cells.forEach(c=>{
      const dark=c.hhi>0.44,tc=dark?'#20140a':'#dbe8f5';
      const big=c.w>110&&c.h>56, mid=c.w>66&&c.h>32;
      g+=`<g><rect x="${(c.x+1).toFixed(1)}" y="${(c.y+1).toFixed(1)}" width="${Math.max(0,c.w-2).toFixed(1)}"`
        +` height="${Math.max(0,c.h-2).toFixed(1)}" rx="5" fill="${hhiColor(c.hhi)}" stroke="#070f19" stroke-width="1.5"`
        +` data-gp10-region="${esc(c.key)}"></rect>`;
      /* cada línea se recorta al ancho real de la celda para no desbordarla */
      const fit=(t,px)=>{const max=Math.floor((c.w-18)/px);return max<3?'':String(t).slice(0,max);};
      if(mid)g+=txt(c.x+9,c.y+19,fit(c.n,big?7.2:6.1),{f:tc,s:big?12.5:10.5,w:750});
      if(big){g+=txt(c.x+9,c.y+36,fit(money(c.v),6.2),{f:tc,s:11});
        g+=txt(c.x+9,c.y+51,fit(`HHI ${dec(c.hhi,3)} · ${c.c} concentrados`,5.6),{f:tc,s:10});}
      g+=`</g>`;
    });
    return sv(`0 0 ${W} ${H}`,g);
  }

  /* concentración vs tamaño del servicio */
  function hhiVsSize(buyers){
    const W=560,H=250,L=44,R=14,T=14,B=38;
    const rows=buyers.filter(b=>num(b.total_clp)>0).slice().sort((a,b)=>num(a.total_clp)-num(b.total_clp));
    const n=rows.length||1;
    const X=i=>L+(W-L-R)*i/Math.max(1,n-1), Y=v=>H-B-(H-T-B)*Math.max(0,Math.min(1,num(v)));
    let g='';
    for(let i=0;i<=4;i++){const y=T+(H-T-B)*i/4;
      g+=`<line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" stroke="#17293a"></line>`
        +txt(L-6,y+3,dec(1-i*0.25,2),{a:'end',s:9});}
    rows.forEach((b,i)=>{
      const hot=num(b.top_supplier_share)>=0.6&&num(b.total_clp)>=1e8;
      g+=`<circle cx="${X(i).toFixed(1)}" cy="${Y(b.hhi).toFixed(1)}" r="${hot?3.4:2.4}"`
        +` fill="${hot?'#f06d67':'#49a8ed'}" opacity="${hot?0.75:0.26}"></circle>`;
    });
    /* anotar los extremos que explican la lectura */
    const big=rows.slice(-40);
    const hi=big.slice().sort((a,b)=>num(b.hhi)-num(a.hhi))[0];
    const lo=big.slice().sort((a,b)=>num(a.hhi)-num(b.hhi))[0];
    [[hi,'#f06d67',-10],[lo,'#37c28b',16]].forEach(([b,c,dy])=>{
      if(!b)return;const i=rows.indexOf(b);
      g+=`<circle cx="${X(i)}" cy="${Y(b.hhi)}" r="6.5" fill="${c}" stroke="#08121d" stroke-width="1.5"></circle>`;
      g+=txt(X(i)-10,Y(b.hhi)+dy,String(b.buyer_name||'').slice(0,26),{f:'#dbe8f5',s:10.5,w:700,a:'end'});
    });
    g+=txt((L+W-R)/2,H-6,'Servicios ordenados por gasto →',{a:'middle',f:'#7e97ae',s:10});
    g+=`<text transform="translate(12 ${(T+H-B)/2}) rotate(-90)" fill="#7e97ae" font-size="10" text-anchor="middle">HHI</text>`;
    return sv(`0 0 ${W} ${H}`,g);
  }

  /* ---------- carga ---------- */
  async function q(table,build){
    const c=db();
    if(!c)throw new Error('Sesión de datos ATLAS no disponible.');
    const {data,error}=await build(c.from(table).select('*'));
    if(error)throw error;
    return data||[];
  }
  async function loadCore(force){
    const c=db();
    if(!c)throw new Error('Sesión de datos ATLAS no disponible.');
    if(S.findings&&!force)return;
    const [cov,fnd,sc,lo,rg,pc]=await Promise.all([
      c.from(SRC.coverage).select('*').maybeSingle(),
      c.from(SRC.findings).select('*').order('severity_rank',{ascending:false}).order('amount_clp',{ascending:false}).limit(600),
      c.from(SRC.scatter).select('*').order('total_clp',{ascending:false}).limit(3200),
      c.from(SRC.lorenz).select('*').order('pct_suppliers',{ascending:true}),
      c.from(SRC.region).select('*'),
      c.from(SRC.pctl).select('*')
    ]);
    if(fnd.error)throw fnd.error;
    S.coverage=cov.error?null:cov.data;
    S.findings=fnd.data||[];
    S.scatter=sc.error?[]:(sc.data||[]);
    S.lorenz=lo.error?[]:(lo.data||[]);
    S.regions=rg.error?[]:(rg.data||[]);
    S.pctl={};
    (pc.error?[]:(pc.data||[])).forEach(r=>{S.pctl[r.metric]=r;});
  }
  async function loadBuyers(){
    if(S.buyers)return;
    S.buyers=await q(SRC.buyers,b=>b.order('total_clp',{ascending:false}).limit(600));
  }

  /* ---------- filtrado ---------- */
  function visibleFindings(){
    const rows=S.findings||[],qy=norm(S.query.trim());
    return rows.filter(r=>{
      if(S.sev.size&&!S.sev.has(r.severity))return false;
      if(S.codes.size&&!S.codes.has(r.finding_code))return false;
      if(!qy)return true;
      return norm(`${r.subject_name} ${r.counterpart_name} ${r.region} ${r.finding_code} ${r.rationale}`).includes(qy);
    });
  }

  /* ---------- cabecera ---------- */
  function heroHtml(){
    const c=S.coverage||{};
    const win=c.window_start?`${dateCL(c.window_start)} → ${dateCL(c.window_end)}`:'ventana publicada';
    const res=num(c.res_coverage_pct),idn=num(c.identity_coverage_pct);
    return `<div class="gp10-hero">
      <div>
        <span class="gp10-eyebrow">Atlas · Contraloría analítica de compras públicas</span>
        <h2>Monitor de gasto público</h2>
        <p>Órdenes de compra de Mercado Público cruzadas con el Registro de Empresas y Sociedades, identidad gobernada del Workbench e InfoLobby. El riesgo y el monto no coinciden: esta vista está construida para encontrar dónde sí.</p>
      </div>
      <div class="gp10-health">
        <span class="gp10-pill"><b>${esc(win)}</b></span>
        <span class="gp10-pill"><b>${NF.format(num(c.order_count))}</b>&nbsp;órdenes</span>
        <span class="gp10-pill ${res>=25?'':'warn'}">RES <b>${res?res+'%':'—'}</b></span>
        <span class="gp10-pill ${idn>=25?'':'warn'}">Identidad <b>${idn?idn+'%':'—'}</b></span>
      </div>
    </div>`;
  }
  function tabsHtml(){
    const c=S.coverage||{};
    const t=[['tablero','Tablero',num(c.finding_count)],['expedientes','Expedientes',num(c.finding_high)],
      ['mapa','Mapa del gasto',null],['metodo','Método',null]];
    return `<nav class="gp10-tabs" aria-label="Vistas de gasto público">
      ${t.map(([k,l,n])=>`<button type="button" class="gp10-tab ${S.tab===k?'active':''}" data-gp10-tab="${k}">${esc(l)}${n?`<span class="gp10-n">${NF.format(n)}</span>`:''}</button>`).join('')}
      <span class="gp10-actions">
        <button type="button" class="gp10-ghost" data-gp10-act="export">Exportar CSV</button>
        <button type="button" class="gp10-ghost" data-gp10-act="reload">Actualizar</button>
      </span></nav>`;
  }

  /* ---------- TABLERO ---------- */
  function tableroHtml(){
    const c=S.coverage||{},rows=visibleFindings(),sc=S.scatter||[];
    const bandHigh=sc.filter(r=>num(r.attention_score)>=60);
    const bandMid=sc.filter(r=>num(r.attention_score)>=20&&num(r.attention_score)<40);
    const sum=a=>a.reduce((x,r)=>x+num(r.total_clp),0);
    const lo=(S.lorenz||[])[0];
    const kpis=[
      ['Gasto observado',money(c.total_clp),`${NF.format(num(c.buyer_count))} servicios`,''],
      ['Proveedores',NF.format(num(c.supplier_count)),lo?`${lo.pct_suppliers}% capta ${dec(lo.pct_spend,1)}%`:'—',''],
      ['Hallazgos alta',NF.format(num(c.finding_high)),`de ${NF.format(num(c.finding_count))} totales`,'alta'],
      ['Riesgo alto ≥60',NF.format(bandHigh.length),`sólo ${money(sum(bandHigh))}`,'media'],
      ['Zona crítica 20–40',money(sum(bandMid)),`${NF.format(bandMid.length)} proveedores`,''],
      ['Cobertura nube',NF.format(sc.length),'93% del gasto','']
    ];
    return `<div class="gp10-kpis">${kpis.map(k=>
      `<article class="gp10-kpi ${k[3]}"><span>${esc(k[0])}</span><b>${esc(k[1])}</b><small>${esc(k[2])}</small></article>`).join('')}</div>
    <div class="gp10-g2">
      <section class="gp10-panel">
        <div class="gp10-ph"><div><span>Superficie de triaje</span><h3>Riesgo × materialidad — dónde mirar primero</h3></div><small>área = monto · color = señal</small></div>
        <div class="gp10-pad">${scatterRisk(sc)}</div>
        <div class="gp10-legend">
          ${FAMILY.map((f,i)=>`<span><i class="gp10-sw s${i+1}"></i>${esc(f.lb)}</span>`).join('')}
          <em>Cuadrante superior derecho = prioridad real</em>
        </div>
      </section>
      <div class="gp10-gcol">
        <section class="gp10-panel">
          <div class="gp10-ph"><div><span>Estructura</span><h3>Concentración del gasto</h3></div><small>Lorenz</small></div>
          <div class="gp10-pad">${lorenzChart(S.lorenz||[])}</div>
        </section>
        <section class="gp10-panel">
          <div class="gp10-ph"><div><span>Composición</span><h3>Hallazgos por tipo</h3></div><small>n · monto</small></div>
          <div class="gp10-pad">${signalBars(S.findings||[])}</div>
        </section>
      </div>
    </div>
    <div class="gp10-g2b">
      <section class="gp10-panel">
        <div class="gp10-ph"><div><span>Territorio × señal</span><h3>Dónde se concentra cada patrón</h3></div><small>intensidad = incidencia relativa</small></div>
        <div class="gp10-pad">${heatRegion(S.regions||[])}</div>
      </section>
      <section class="gp10-panel">
        <div class="gp10-ph"><div><span>Cola de revisión</span><h3>Casos priorizados</h3></div><small>${NF.format(rows.length)} visibles</small></div>
        <div class="gp10-scroll">${rows.slice(0,40).map(findingCard).join('')||'<div class="gp10-empty">Sin hallazgos.</div>'}</div>
      </section>
    </div>`;
  }
  function findingCard(r,i){
    return `<button type="button" class="gp10-card sev-${esc(r.severity)}" data-gp10-case="${esc(r.finding_id)}">
      <span class="gp10-sev"></span>
      <span class="gp10-cb">
        <span class="gp10-ct">
          <span class="gp10-tag sev-${esc(r.severity)}">${esc(r.severity)}</span>
          <span class="gp10-tag">${esc(codeLabel(r.finding_code))}</span>
        </span>
        <b>${esc(r.subject_name||'Sin nombre')}</b>
        <span class="gp10-cm"><span>${esc(r.metric_label||'')}: <b>${esc(r.metric_value||'—')}</b></span>
        ${r.counterpart_name?`<span>${esc(String(r.counterpart_name).slice(0,34))}</span>`:''}</span>
      </span>
      <span class="gp10-cn"><strong>${esc(money(r.amount_clp))}</strong><em>monto</em></span>
    </button>`;
  }

  /* ---------- EXPEDIENTES ---------- */
  function expedientesHtml(){
    const rows=visibleFindings();
    const sel=S.caseKey||rows[0]?.finding_id;
    return `<div class="gp10-g2b">
      <div class="gp10-gcol">
        <section class="gp10-panel">
          <div class="gp10-ph"><div><span>Cola priorizada</span><h3>Severidad × materialidad</h3></div><small>${NF.format(rows.length)}</small></div>
          <div class="gp10-q">${rows.slice(0,120).map(r=>{
            const s=num(r.attention_score);
            return `<button type="button" class="gp10-qi ${r.finding_id===sel?'on':''}" data-gp10-case="${esc(r.finding_id)}">
              <span class="gp10-score ${s>=70?'hi':''}">${s||'—'}</span>
              <span><b>${esc(String(r.subject_name||'').slice(0,38))}</b>
              <small>${esc(money(r.amount_clp))} · ${esc(codeLabel(r.finding_code))}</small></span></button>`;
          }).join('')||'<div class="gp10-empty">Sin casos.</div>'}</div>
        </section>
      </div>
      <div class="gp10-gcol">${dossierHtml()}</div>
    </div>`;
  }
  function dossierHtml(){
    if(S.busy)return '<section class="gp10-panel"><div class="gp10-loading"><div class="gp10-spinner"></div>Abriendo expediente…</div></section>';
    const d=S.dossier;
    if(!d)return `<section class="gp10-panel"><div class="gp10-empty">
      <b>Selecciona un caso de la cola</b>
      <p>El expediente sitúa el caso contra la población observada, no sólo contra su propio umbral.</p></div></section>`;
    const p=d.profile||{},f=d.finding||{},sup=d.kind==='supplier';
    const s=num(p.attention_score);
    const facts=sup?[
      ['Monto en compras públicas',money(p.total_clp),''],
      ['Órdenes · compradores',`${NF.format(num(p.order_count))} · ${NF.format(num(p.buyer_count))}`,''],
      ['Constitución',dateCL(p.constitution_date),''],
      ['Capital social',p.capital?moneyFull(p.capital):'Sin dato RES',''],
      ['Monto / capital',p.capital_ratio!=null?`${dec(p.capital_ratio,1)}x`:'—',num(p.capital_ratio)>=50?'red':''],
      ['Dependencia principal',pct(p.dependence_share),num(p.dependence_share)>=0.8?'red':''],
      ['Socios · admin.',`${num(p.partner_count)} · ${num(p.admin_count)}`,''],
      ['Identidad Workbench',p.entity_id?'Resuelta':'Sin coincidencia',p.entity_id?'green':'']
    ]:[
      ['Gasto observado',money(p.total_clp),''],
      ['Proveedores',NF.format(num(p.supplier_count)),''],
      ['Principal proveedor',pct(p.top_supplier_share),num(p.top_supplier_share)>=0.6?'red':''],
      ['HHI',dec(p.hhi,3),num(p.hhi)>=0.25?'red':''],
      ['Región',shortRegion(p.region),''],
      ['Proveedores recientes',NF.format(num(p.recent_suppliers)),''],
      ['Pares con fraccionamiento',NF.format(num(p.frag_pairs)),''],
      ['Órdenes',NF.format(num(p.order_count)),'']
    ];
    return `<section class="gp10-panel gp10-exp">
      <div class="gp10-xh">
        <div><h3>${esc(d.title)}</h3>
          <p>${sup?'Proveedor del Estado':'Servicio público comprador'}${p.constitution_date?` · constituida ${dateCL(p.constitution_date)}`:''}${p.buyer_count?` · ${NF.format(num(p.buyer_count))} comprador(es)`:''}</p></div>
        <div class="gp10-big"><b class="${s>=70?'hi':''}">${s||'—'}</b><small>índice de atención</small></div>
      </div>
      ${f.rationale?`<div class="gp10-why"><b>Por qué está en la cola:</b> ${esc(f.rationale)}</div>`:''}
      ${d.strips&&d.strips.length?`<div class="gp10-sect"><h4>Dónde se sitúa frente a la población observada</h4>
        ${d.strips.map(st=>`<div class="gp10-dist">
          <div class="gp10-dl"><b>${esc(st.title)}</b><em>${esc(st.value)}</em></div>
          ${percentileStrip(st)}
          <div class="gp10-note">${esc(st.note)}</div></div>`).join('')}</div>`:''}
      <div class="gp10-sect"><h4>Antecedentes</h4>
        <div class="gp10-facts">${facts.map(x=>
          `<div class="gp10-fact"><span>${esc(x[0])}</span><b class="${x[2]}">${esc(x[1])}</b></div>`).join('')}</div>
      </div>
      ${(p.signal_codes||[]).length?`<div class="gp10-sect"><h4>Señales activas</h4>
        <div class="gp10-signals">${p.signal_codes.map(x=>`<span class="gp10-tag">${esc(signalLabel(x))}</span>`).join('')}</div></div>`:''}
      ${(d.relations||[]).length?`<div class="gp10-sect"><h4>${sup?'Principales compradores':'Principales proveedores'}</h4>
        ${d.relations.map(r=>`<div class="gp10-rel"><span>${esc(sup?r.buyer_name:r.supplier_name)}</span><b>${esc(money(r.total_clp))}</b></div>`).join('')}</div>`:''}
      <div class="gp10-sect"><h4>Disposición</h4>
        <button type="button" class="gp10-btn no" data-gp10-act="noop">Escalar a revisión formal</button>
        <button type="button" class="gp10-btn" data-gp10-act="noop">Solicitar antecedentes</button>
        <button type="button" class="gp10-btn ok" data-gp10-act="noop">Marcar como explicado</button>
        ${p.entity_id?`<button type="button" class="gp10-btn mute" data-gp10-entity="${esc(p.entity_id)}">Abrir Entidad 360</button>`:''}
      </div>
      <div class="gp10-note">Los índices priorizan revisión analítica. No acreditan por sí solos irregularidad administrativa, incumplimiento contractual, delito ni lavado de activos.</div>
    </section>`;
  }

  /* ---------- MAPA ---------- */
  function mapaHtml(){
    const bs=(S.buyers||[]).filter(b=>num(b.total_clp)>=1e8);
    const big=bs.slice(0,60);
    const conc=big.slice().sort((a,b)=>num(b.hhi)-num(a.hhi))[0];
    const div=big.slice().sort((a,b)=>num(a.hhi)-num(b.hhi))[0];
    const regions=(S.regions||[]).slice().sort((a,b)=>num(b.hhi_avg)-num(a.hhi_avg));
    const mx=Math.max(...regions.map(r=>num(r.hhi_avg)),0.01);
    const card=(b,cls,verdict)=>b?`<div class="gp10-cb2">
      <h4>${esc(String(b.buyer_name||'').slice(0,44))}</h4>
      <div class="gp10-r">${esc(money(b.total_clp))} · ${esc(shortRegion(b.region))}</div>
      <div class="gp10-m"><span>Proveedores</span><b>${NF.format(num(b.supplier_count))}</b></div>
      <div class="gp10-m"><span>Principal</span><b>${pct(b.top_supplier_share)}</b></div>
      <div class="gp10-m"><span>HHI</span><b class="${cls}">${dec(b.hhi,3)}</b></div>
      <div class="gp10-verdict ${cls==='red'?'v1':'v2'}">${esc(verdict)}</div></div>`:'';
    return `<div class="gp10-g2">
      <section class="gp10-panel">
        <div class="gp10-ph"><div><span>Territorio</span><h3>Gasto y concentración por región</h3></div><small>área = gasto · color = HHI medio</small></div>
        <div class="gp10-pad">${treemapRegions(S.regions||[])}</div>
        <div class="gp10-legend"><span>Azul = diversificado</span><span>Naranjo = concentrado</span>
          <em>Las regiones pequeñas concentran más que la Metropolitana</em></div>
      </section>
      <div class="gp10-gcol">
        <section class="gp10-panel">
          <div class="gp10-ph"><div><span>Estructura de mercado</span><h3>Mismo dinero, mercados opuestos</h3></div></div>
          <div class="gp10-cmp">
            ${card(conc,'red','Un proveedor concentra casi todo el gasto. Verificar competencia efectiva.')}
            ${card(div,'green','Gasto comparable repartido entre muchos proveedores. Mercado competitivo.')}
          </div>
          <div class="gp10-ins"><b>Por qué importa:</b> el monto por sí solo no ordena la revisión. Dos servicios pueden gastar lo mismo y describir mercados opuestos; sólo la estructura distingue cuál merece mirada.</div>
        </section>
        <section class="gp10-panel">
          <div class="gp10-ph"><div><span>Anomalía estructural</span><h3>Concentración vs tamaño del servicio</h3></div><small>rojo = principal ≥60%</small></div>
          <div class="gp10-pad">${hhiVsSize(bs)}</div>
        </section>
      </div>
    </div>
    <section class="gp10-panel">
      <div class="gp10-ph"><div><span>Ranking territorial</span><h3>Concentración media por región</h3></div><small>HHI · gasto · señales</small></div>
      <div class="gp10-pad">${regions.map(r=>`<div class="gp10-lrow reg">
        <span class="gp10-ln">${esc(shortRegion(r.region))}</span>
        <span class="gp10-lb">${barColor(num(r.hhi_avg)/mx,hhiColor(r.hhi_avg))}</span>
        <span class="gp10-lv">${esc(money(r.total_clp))}</span>
        <span class="gp10-lv strong">${dec(r.hhi_avg,3)}</span>
        <span class="gp10-lv">${NF.format(num(r.concentrated_buyers))} conc.</span></div>`).join('')}</div>
    </section>`;
  }

  /* ---------- MÉTODO ---------- */
  function metodoHtml(){
    const c=S.coverage||{},cp=S.pctl?.capital_ratio,ag=S.pctl?.age_years;
    const card=(t,b,cls)=>`<section class="gp10-panel ${cls||''}"><h3>${t}</h3>${b}</section>`;
    return `<div class="gp10-method">
      ${card('Modelo analítico','<p>El monitor agrega órdenes de compra a nivel comprador–proveedor y evalúa reglas independientes. Cada regla declara umbral y fundamento; el índice de atención es la suma acotada de sus pesos.</p><code class="gp10-code">atención = min(100, Σ peso(señal activa))</code><p>El índice ordena la revisión, no la concluye.</p>')}
      ${card('Por qué riesgo × materialidad',`<p>El score y el monto están desacoplados: los proveedores de mayor índice son pequeños, y el grueso del gasto vive en la banda intermedia. Una lista ordenada por severidad esconde precisamente donde está el dinero.</p><code class="gp10-code">score ≥60 → pocos casos, monto menor
banda 20–40 → grueso del gasto observado</code>`)}
      ${card('Empresa reciente · monto alto',`<p>Antigüedad de la sociedad al primer contrato observado, según fecha de constitución del Registro de Empresas y Sociedades.</p><code class="gp10-code">antigüedad ≤ 2 años y monto ≥ $50.000.000</code><p>Peso 20. Severidad alta bajo 1 año.${ag?` Mediana del mercado: ${dec(ag.p50,1)} años.`:''}</p>`)}
      ${card('Capital desproporcionado',`<p>Relación entre el monto contratado y el capital social informado.</p><code class="gp10-code">monto / capital ≥ 50</code><p>Peso 18.${cp?` El proveedor típico contrata ${dec(cp.p50,1)}x su capital; el percentil 99 está en ${dec(cp.p99,1)}x.`:''}</p>`)}
      ${card('Proveedor concentra un servicio','<p>Participación de un proveedor en el gasto observado de un servicio con volumen material.</p><code class="gp10-code">monto par / gasto del servicio ≥ 60%\ngasto del servicio ≥ $100.000.000</code><p>Peso 22. Severidad alta sobre 75%.</p>')}
      ${card('Posible fraccionamiento','<p>Serie de órdenes entre un mismo par, todas bajo el umbral de referencia de 100 UTM, con monto agregado material.</p><code class="gp10-code">≥ 8 órdenes · máximo &lt; $6.176.900 · suma ≥ $30.000.000</code><p>Peso 18. UTM de enero 2023 = $61.769.</p>')}
      ${card('Concentración del servicio','<p>Participación del principal proveedor y HHI sobre los proveedores del servicio.</p><code class="gp10-code">HHI = Σ (monto proveedor / gasto total)²</code><p>Pesos 22 (participación ≥60%) y 12 (HHI ≥0,25).</p>')}
      ${card('Identidad y contexto','<p>Sanciones y condición de sujeto obligado UAF provienen de la identidad gobernada del Workbench por RUT exacto. Las audiencias de InfoLobby son actividad lícita y regulada, informada como contexto.</p><code class="gp10-code">sanción 15 · UAF 10 · lobby 8 · CGR 10</code>')}
      ${card('Cobertura declarada',`<p>Ventana observada: <b>${esc(dateCL(c.window_start))} → ${esc(dateCL(c.window_end))}</b>, con ${NF.format(num(c.order_count))} órdenes por ${esc(money(c.total_clp))}.</p><p>Perfil societario RES para el <b>${num(c.res_coverage_pct)}%</b> de los proveedores; identidad gobernada para el <b>${num(c.identity_coverage_pct)}%</b>. La ausencia de cobertura no es señal adversa: es ausencia de dato.</p>`)}
      ${card('Limitaciones explícitas','<p>La ventana cargada corresponde a un único mes, por lo que <b>no se calculan tendencias ni estacionalidad</b>; el fraccionamiento se evalúa dentro del mes observado.</p><p>No se emite señal de sobreprecio: los códigos de producto agrupan contratos a suma alzada junto con bienes unitarios, de modo que comparar precios unitarios produciría falsos positivos. Se prefiere omitir la regla antes que sostener un hallazgo indefendible.</p><p>La nube de triaje cubre proveedores con monto ≥$20 M o señal activa: 93% del gasto, no el 100% de los RUT.</p>','gp10-limit')}
    </div>`;
  }

  /* ---------- expediente: apertura con percentiles exactos ---------- */
  async function rankAbove(col,value){
    const c=db();if(!c||value==null)return null;
    try{
      const {count}=await c.from(SRC.suppliers).select(col,{count:'exact',head:true}).gte(col,value);
      const {count:tot}=await c.from(SRC.suppliers).select(col,{count:'exact',head:true}).not(col,'is',null);
      if(!tot)return null;
      return {above:num(count),total:num(tot),pos:100-100*num(count)/num(tot)};
    }catch{return null;}
  }
  async function buildStrips(p){
    const out=[],P=S.pctl||{};
    const cap=P.capital_ratio,age=P.age_years;
    if(p.age_years!=null&&age){
      const r=await rankAbove('age_years',p.age_years);
      const newer=r?r.total-r.above:null;
      /* rankAbove ya devuelve el percentil del valor: para antigüedad, pocos
         proveedores por debajo significa percentil bajo y marcador a la izquierda. */
      out.push({title:'Antigüedad al primer contrato',value:`${dec(p.age_years,2)} años`,
        pos:r?Math.max(0.5,r.pos):5,
        marks:[[1,`p1 · ${dec(age.p01,2)}a`],[10,`p10 · ${dec(age.p10,1)}a`],[50,`p50 · ${dec(age.p50,1)}a`],[90,`p90 · ${dec(age.p90,1)}a`]],
        note:newer!=null?`Sólo ${NF.format(newer)} de ${NF.format(r.total)} proveedores con perfil societario contrataron siendo más nuevos. La mediana del mercado es ${dec(age.p50,1)} años.`
          :`La mediana del mercado es ${dec(age.p50,1)} años.`});
    }
    if(p.capital_ratio!=null&&cap){
      const r=await rankAbove('capital_ratio',p.capital_ratio);
      out.push({title:'Monto contratado / capital social',value:`${dec(p.capital_ratio,1)}x`,
        pos:r?r.pos:90,
        marks:[[50,`p50 · ${dec(cap.p50,1)}x`],[90,`p90 · ${dec(cap.p90,1)}x`],[99,`p99 · ${dec(cap.p99,1)}x`]],
        note:r?`El proveedor típico contrata ${dec(cap.p50,1)} veces su capital. Este contrata ${dec(p.capital_ratio,1)} veces: sólo ${NF.format(r.above)} de ${NF.format(r.total)} lo superan.`
          :`El proveedor típico contrata ${dec(cap.p50,1)} veces su capital.`});
    }
    if(p.dependence_share!=null){
      const d=P.dependence_share;
      out.push({title:'Dependencia del comprador principal',value:pct(p.dependence_share),
        pos:100*num(p.dependence_share),
        marks:d?[[50,`p50 · ${pct(d.p50,0)}`],[80,'umbral 80%'],[100,'máximo']]:[[80,'umbral 80%'],[100,'máximo']],
        note:'Describe una relación económica observada. Una dependencia alta no implica irregularidad por sí sola.'});
    }
    return out;
  }
  async function openCase(findingId){
    const rows=S.findings||[];
    const f=rows.find(r=>r.finding_id===findingId);
    if(!f)return;
    S.caseKey=findingId;S.busy=true;S.tab='expedientes';render();
    const c=db();
    try{
      const kind=f.scope==='SERVICIO'?'buyer':'supplier';
      const table=kind==='supplier'?SRC.suppliers:SRC.buyers;
      const col=kind==='supplier'?'supplier_key':'buyer_key';
      const [prof,rel]=await Promise.all([
        c.from(table).select('*').eq(col,f.subject_key).maybeSingle(),
        c.from(SRC.pairs).select('buyer_name,supplier_name,total_clp,order_count')
          .eq(col,f.subject_key).order('total_clp',{ascending:false}).limit(8)
      ]);
      const p=prof.error?{}:(prof.data||{});
      const strips=kind==='supplier'?await buildStrips(p):[];
      S.dossier={kind,finding:f,profile:p,relations:rel.error?[]:(rel.data||[]),strips,
        title:kind==='supplier'?(p.supplier_name||f.subject_name):(p.buyer_name||f.subject_name)};
      if(typeof audit==='function'){
        audit('OPEN_PUBLIC_SPEND_SUBJECT',{objectType:kind==='supplier'?'provider':'buyer',
          objectId:String(f.subject_key),payload:{finding:f.finding_code,score:num(p.attention_score)}}).catch(()=>{});
      }
    }catch(e){
      S.dossier={kind:'supplier',finding:f,profile:{},relations:[],strips:[],title:f.subject_name};
    }finally{S.busy=false;render();}
  }

  /* ---------- render ---------- */
  function render(focusSearch){
    const h=host();
    if(!h)return false;
    if(S.error){
      h.innerHTML=`<section class="gp10">${heroHtml()}<div class="gp10-error"><b>No fue posible cargar el monitor</b><p>${esc(S.error)}</p><button type="button" class="gp10-ghost" data-gp10-act="reload">Reintentar</button></div></section>`;
      bind(h);publish('error',{error:S.error});return false;
    }
    let body;
    if(S.tab==='tablero')          body=tableroHtml();
    else if(S.tab==='expedientes') body=expedientesHtml();
    else if(S.tab==='mapa')        body=mapaHtml();
    else                           body=metodoHtml();
    h.innerHTML=`<section class="gp10">${heroHtml()}${tabsHtml()}${body}
      <p class="gp10-foot">Fuente: Mercado Público · Registro de Empresas y Sociedades · InfoLobby · identidad gobernada AML Workbench. Señales de priorización analítica; la ausencia de señal no equivale a ausencia de riesgo.</p></section>`;
    bind(h);
    if(focusSearch){const q=h.querySelector('#gp10-search');if(q){q.focus();q.setSelectionRange(q.value.length,q.value.length);}}
    publish('ready',{findings:(S.findings||[]).length,scatter:(S.scatter||[]).length,tab:S.tab});
    return true;
  }
  function loadingView(msg){
    const h=host();
    if(h)h.innerHTML=`<section class="gp10"><div class="gp10-loading"><div class="gp10-spinner"></div>${esc(msg||'Cargando…')}</div></section>`;
    publish('loading');
  }

  /* ---------- exportación ---------- */
  function exportCsv(){
    const src=visibleFindings();
    if(!src.length)return;
    const cols=['severity','finding_code','scope','subject_name','counterpart_name','region','amount_clp','metric_label','metric_value','rationale'];
    const cell=v=>`"${String(v==null?'':v).replace(/"/g,'""')}"`;
    const csv=[cols.join(';')].concat(src.map(r=>cols.map(k=>cell(r[k])).join(';'))).join('\r\n');
    const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`gasto-publico-hallazgos-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  }

  /* ---------- eventos ---------- */
  function bind(root){
    root.addEventListener('click',async e=>{
      const tab=e.target.closest('[data-gp10-tab]');
      if(tab){
        const next=tab.dataset.gp10Tab;
        if(next===S.tab)return;
        S.tab=next;
        if(next==='mapa'&&!S.buyers){loadingView('Construyendo el mapa del gasto…');
          try{await loadBuyers();}catch(err){S.error=String(err?.message||err);}}
        render();return;
      }
      const cs=e.target.closest('[data-gp10-case]');
      if(cs){await openCase(cs.dataset.gp10Case);return;}
      const rg=e.target.closest('[data-gp10-region]');
      if(rg){S.region=S.region===rg.dataset.gp10Region?null:rg.dataset.gp10Region;render();return;}
      const ent=e.target.closest('[data-gp10-entity]');
      if(ent){const id=ent.dataset.gp10Entity;
        if(typeof window.openEntity==='function')window.openEntity(id);
        else if(typeof openEntity==='function')openEntity(id);
        return;}
      const act=e.target.closest('[data-gp10-act]');
      if(!act)return;
      const a=act.dataset.gp10Act;
      if(a==='export')exportCsv();
      else if(a==='reload'){S.error=null;load(true);}
    });
    const q=root.querySelector('#gp10-search');
    if(q)q.addEventListener('input',ev=>{S.query=ev.target.value;
      clearTimeout(searchTimer);searchTimer=setTimeout(()=>render(true),140);});
  }

  /* ---------- ciclo de vida ---------- */
  function shellHeader(){
    try{if(typeof window.shell==='function')
      window.shell('Gasto público','Riesgo, materialidad y estructura de mercado en compras públicas.');}catch{}
  }
  async function load(force){
    if(S.loading)return false;
    S.loading=true;S.error=null;
    loadingView('Construyendo inteligencia de compras públicas…');
    try{
      if(force){S.findings=null;S.buyers=null;S.dossier=null;S.caseKey=null;}
      await loadCore(force);
      if(S.tab==='mapa')await loadBuyers();
      render();
      if(typeof audit==='function'){
        audit('VIEW_PUBLIC_SPEND',{objectType:'radar',objectId:'GASTO_PUBLICO_GP10',
          payload:{version:VERSION,findings:(S.findings||[]).length}}).catch(()=>{});
      }
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
      if(S.findings){render();return true;}
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
    version:VERSION,authority:'GASTO_PUBLICO_GP10',
    open,load,render,state:()=>({tab:S.tab,findings:(S.findings||[]).length,error:S.error}),
    health:()=>window.__ATLAS_GASTO_PUBLICO_1000__||null
  };
  window.AtlasGastoPublico1000=api;
  window.AtlasPublicSpendIntelligence0720=api;
  window.AtlasPublicSpendV2=api;
  window.dispatchEvent(new CustomEvent('atlas:public-spend-v2-ready',{detail:{version:VERSION}}));
  publish('installed');
})();
