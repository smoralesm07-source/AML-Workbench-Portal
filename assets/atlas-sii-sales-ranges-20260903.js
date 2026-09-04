'use strict';

/* ATLAS AML · Presentación transversal de rangos de ventas SII en UF · 2026-09-03
 * Fuente metodológica: SII, nómina de empresas personas jurídicas (13 tramos).
 * Esta capa es sólo de presentación: conserva códigos/rangos originales para filtros,
 * consultas, series históricas y trazabilidad; nunca reescribe datos en Supabase.
 */
(function atlasSiiSalesRanges20260903(){
  const BUILD='20260903-sii-sales-uf-1';
  if(window.__ATLAS_SII_SALES_RANGES__?.build===BUILD)return;

  const RANGES=Object.freeze({
    1:Object.freeze({code:1,size:'Sin información',range:'Sin información de ventas'}),
    2:Object.freeze({code:2,size:'Micro 1',range:'0,01–200 UF/año'}),
    3:Object.freeze({code:3,size:'Micro 2',range:'200,01–600 UF/año'}),
    4:Object.freeze({code:4,size:'Micro 3',range:'600,01–2.400 UF/año'}),
    5:Object.freeze({code:5,size:'Pequeña 1',range:'2.400,01–5.000 UF/año'}),
    6:Object.freeze({code:6,size:'Pequeña 2',range:'5.000,01–10.000 UF/año'}),
    7:Object.freeze({code:7,size:'Pequeña 3',range:'10.000,01–25.000 UF/año'}),
    8:Object.freeze({code:8,size:'Mediana 1',range:'25.000,01–50.000 UF/año'}),
    9:Object.freeze({code:9,size:'Mediana 2',range:'50.000,01–100.000 UF/año'}),
    10:Object.freeze({code:10,size:'Grande 1',range:'100.000,01–200.000 UF/año'}),
    11:Object.freeze({code:11,size:'Grande 2',range:'200.000,01–600.000 UF/año'}),
    12:Object.freeze({code:12,size:'Grande 3',range:'600.000,01–1.000.000 UF/año'}),
    13:Object.freeze({code:13,size:'Grande 4',range:'Más de 1.000.000 UF/año'})
  });

  const fold=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const explicitCode=v=>{const s=String(v??'').trim();return /^(?:[1-9]|1[0-3])$/.test(s)?Number(s):null;};

  function resolveCode(raw){
    const exact=explicitCode(raw);if(exact)return exact;
    const s=fold(raw);if(!s)return null;
    if(/\b(?:sin informacion|sin ventas)\b/.test(s))return 1;
    const tramo=s.match(/\b(?:tramo|rango(?: de ventas)?|codigo(?: sii)?)\s*(?:n[°ºo.]?\s*)?(1[0-3]|[1-9])\b/);if(tramo)return Number(tramo[1]);
    const micro=s.match(/\bmicro(?: empresa)?\s*([123])\b/);if(micro)return Number(micro[1])+1;
    const pequena=s.match(/\bpequena(?: empresa)?\s*([123])\b/);if(pequena)return Number(pequena[1])+4;
    const mediana=s.match(/\bmediana(?: empresa)?\s*([12])\b/);if(mediana)return Number(mediana[1])+7;
    const grande=s.match(/\bgran(?:de)?(?: empresa)?\s*([1234])\b/);if(grande)return Number(grande[1])+9;
    const ordinalMicro=s.match(/\b([123])(?:er|ro|do)?\s+rango\s+micro\b/);if(ordinalMicro)return Number(ordinalMicro[1])+1;
    const ordinalSmall=s.match(/\b([123])(?:er|ro|do)?\s+rango\s+pequena\b/);if(ordinalSmall)return Number(ordinalSmall[1])+4;
    const ordinalMedium=s.match(/\b([12])(?:er|do)?\s+rango\s+mediana\b/);if(ordinalMedium)return Number(ordinalMedium[1])+7;
    const ordinalLarge=s.match(/\b([1234])(?:er|ro|do|to)?\s+rango\s+gran\b/);if(ordinalLarge)return Number(ordinalLarge[1])+9;
    return null;
  }

  function format(raw,options={}){
    const s=String(raw??'').trim();if(!s)return '—';
    if(/\bUF\b/i.test(s))return s;
    const code=resolveCode(raw);if(!code||!RANGES[code])return s;
    const item=RANGES[code];
    if(options.rangeOnly)return item.range;
    if(options.categoryOnly)return item.size;
    return code===1?item.range:`${item.size} · ${item.range}`;
  }

  const isSalesLabel=text=>/^(?:tramo\s+(?:de\s+)?ventas?|tramo\s+segun\s+ventas|rango\s+(?:de\s+)?ventas?|ventas\s+anuales(?:\s*\(uf\))?)$/i.test(fold(text));
  const isTaxSalesLabel=text=>/^(?:ventas|ventas anuales|tramo\s+(?:de\s+)?ventas?|rango\s+(?:de\s+)?ventas?)$/i.test(fold(text));

  function setText(el,text){if(!el||el.textContent===text)return false;el.textContent=text;return true;}
  function presentValue(el){
    if(!el)return false;const raw=el.textContent?.trim();const code=resolveCode(raw);if(!code)return false;
    const shown=format(raw);if(shown===raw)return false;
    el.dataset.siiSalesBandCode=String(code);el.dataset.siiSalesRangeUf='1';
    return setText(el,shown);
  }

  function rewriteInline(el){
    if(!el||el.children.length)return false;const raw=el.textContent||'';let changed=false;
    const next=raw.replace(/\b(?:tramo|rango)\s+(?:de\s+)?ventas?\s*:?[ ]*(1[0-3]|[1-9])\b/gi,(m,code)=>{changed=true;return `ventas anuales ${format(code)}`;});
    return changed?setText(el,next):false;
  }

  function relabelAndFormatRow(label){
    const parent=label?.parentElement;if(!parent)return false;let changed=false;
    const taxContext=!!parent.closest('#e360-tax,.e360-tax-lead,.e360-facts,.eh-character,.v038-entity,.a45,.aed-dossier');
    if(isSalesLabel(label.textContent)||taxContext&&isTaxSalesLabel(label.textContent)){
      changed=setText(label,'Ventas anuales (UF)')||changed;
      const candidates=[...parent.querySelectorAll(':scope > b,:scope > strong,:scope > code,:scope > dd,:scope > .value,:scope > [data-value]')];
      const target=candidates.find(el=>resolveCode(el.textContent));
      if(target)changed=presentValue(target)||changed;
      if(parent.matches('.e360-fact,.eh-character-row')){
        const nested=parent.querySelector('b,strong,code,dd');if(nested)changed=presentValue(nested)||changed;
      }
    }
    return changed;
  }

  function formatTable(table){
    let changed=false;const heads=[...table.querySelectorAll('thead th')];
    heads.forEach((th,index)=>{
      if(!isSalesLabel(th.textContent))return;
      changed=setText(th,'Ventas anuales (UF)')||changed;
      table.querySelectorAll('tbody tr').forEach(tr=>{const td=tr.children[index];if(td)changed=presentValue(td)||changed;});
    });
    return changed;
  }

  function formatSelect(select){
    const own=[select.id,select.name,select.getAttribute('aria-label'),select.dataset?.field].filter(Boolean).join(' ');
    const parentText=select.closest('label,.filter,.field,.control')?.textContent||'';
    if(!/(tramo|rango).{0,12}venta|venta.{0,12}(tramo|rango)|sales[_ -]?band/i.test(own+' '+fold(parentText)))return false;
    let changed=false;
    [...select.options].forEach(option=>{const code=resolveCode(option.value)||resolveCode(option.textContent);if(!code)return;const shown=format(code);if(option.textContent!==shown){option.textContent=shown;option.dataset.siiSalesBandCode=String(code);changed=true;}});
    return changed;
  }

  function formatKnown360(root){
    let changed=false;
    root.querySelectorAll('.e360-fact,.eh-character-row').forEach(row=>{const label=row.querySelector(':scope > span');if(label)changed=relabelAndFormatRow(label)||changed;});
    root.querySelectorAll('.eh-compare-body > div > b').forEach(el=>{changed=presentValue(el)||changed;});
    root.querySelectorAll('.e360-chart-legend .sales').forEach(el=>{changed=setText(el,'ventas anuales (UF)')||changed;});
    return changed;
  }

  function apply(scope=document){
    const root=scope?.querySelectorAll?scope:document;let changed=false;
    root.querySelectorAll('table').forEach(table=>{changed=formatTable(table)||changed;});
    root.querySelectorAll('select').forEach(select=>{changed=formatSelect(select)||changed;});
    root.querySelectorAll('span,label,dt,th,small,b,strong,p,title').forEach(el=>{
      if(isSalesLabel(el.textContent))changed=relabelAndFormatRow(el)||changed;
      changed=rewriteInline(el)||changed;
    });
    changed=formatKnown360(root)||changed;
    return changed;
  }

  let timer=null;let observer=null;
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>apply(document),35);}
  function install(){
    apply(document);
    const app=document.querySelector('#app')||document.body;
    if(app&&!observer){observer=new MutationObserver(schedule);observer.observe(app,{subtree:true,childList:true,characterData:true});}
    document.addEventListener('atlas:entity-workspace-ready',schedule);
    document.addEventListener('atlas:entity-entry-ready',schedule);
    window.addEventListener('load',schedule,{once:true});
  }

  const api=Object.freeze({build:BUILD,source:'SII · nómina de empresas personas jurídicas · clasificación de 13 tramos',ranges:RANGES,resolveCode,format,apply});
  window.__ATLAS_SII_SALES_RANGES__=api;
  window.ATLAS_SII_SALES_RANGES=api;
  if(typeof document!=='undefined')install();
})();
