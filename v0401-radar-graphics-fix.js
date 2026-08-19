'use strict';

/* ATLAS AML · Radar Integrado graphics integrity patch v0.40.1
 * Root cause: Radar Integrado v0.36 rendered quantitative bars with inline
 * style attributes. ATLAS CSP intentionally keeps style-src 'self' and blocks
 * those attributes, so labels survived while widths/flex/backgrounds did not.
 * This patch keeps CSP strict and makes quantitative encoding runtime-safe.
 */
const V0401_GRAPHICS='0.40.1';
const V0401_SEG_TONE={FINANCIERO:'fin',APNFD:'apnfd',PUBLICO:'public'};
const V0401_RADAR_TONES=['accent','accent','crit','accent','info','warn','info','warn'];
let v0401RepairQueued=false;
let v0401Observer=null;

function v0401Clamp(v,min=0,max=100){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):min;}
function v0401Pct(text){
  const m=String(text||'').replace(/\s/g,'').match(/-?[\d.]+(?:,[\d]+)?(?=%)/);
  if(!m)return 0;
  return v0401Clamp(Number(m[0].replace(/\./g,'').replace(',','.')));
}
function v0401NumberCL(text){
  const s=String(text||'').trim().replace(/\s/g,'').replace(/\./g,'').replace(',','.').replace(/[^0-9+\-.]/g,'');
  const n=Number(s);return Number.isFinite(n)?n:0;
}
function v0401Css(name,fallback=''){
  const v=getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v||fallback;
}
function v0401Tone(name){
  const map={
    fin:v0401Css('--atlas-accent','#3b98e0'),
    apnfd:v0401Css('--atlas-warn','#dcb445'),
    public:v0401Css('--atlas-info','#a78bfa'),
    ros:v0401Css('--atlas-accent-border','#294f70'),
    active:v0401Css('--atlas-accent','#3b98e0'),
    terminated:v0401Css('--atlas-warn','#dcb445'),
    unmatched:v0401Css('--atlas-crit','#ef6b68'),
    accent:v0401Css('--atlas-accent','#3b98e0'),
    crit:v0401Css('--atlas-crit','#ef6b68'),
    warn:v0401Css('--atlas-warn','#dcb445'),
    info:v0401Css('--atlas-info','#a78bfa')
  };
  return map[name]||v0401Css('--atlas-accent','#3b98e0');
}
function v0401SegmentFromText(text){
  const t=String(text||'').toUpperCase();
  if(t.includes('FINANCIERO'))return 'fin';
  if(t.includes('PÚBLICO')||t.includes('PUBLICO'))return 'public';
  return 'apnfd';
}

function v0401RepairAsym(root){
  root.querySelectorAll('.v036-asym-row').forEach(row=>{
    const tone=v0401SegmentFromText(row.querySelector('.v036-asym-key')?.textContent);
    row.dataset.v0401Segment=tone;
    const key=row.querySelector('.v036-asym-key i');if(key)key.style.backgroundColor=v0401Tone(tone);
    const intensity=row.querySelector('.v036-asym-int b');if(intensity)intensity.style.color=v0401Tone(tone);
    const fills=[...row.querySelectorAll('.v036-fill')];
    fills.forEach((fill,i)=>{
      const pct=v0401Pct(fill.querySelector('b')?.textContent);
      fill.dataset.v0401Pct=String(pct);
      fill.style.width=`${pct}%`;
      fill.style.backgroundColor=i===0?v0401Tone(tone):v0401Tone('ros');
      fill.style.opacity=pct>0?'1':'0';
      fill.setAttribute('role','progressbar');
      fill.setAttribute('aria-valuemin','0');
      fill.setAttribute('aria-valuemax','100');
      fill.setAttribute('aria-valuenow',String(pct));
      fill.setAttribute('aria-label',`${i===0?'Participación en padrón':'Participación en flujo ROS'}: ${pct}%`);
    });
  });
}

function v0401RepairReconciliation(root){
  const buttons=[...root.querySelectorAll('.v036-flow button[data-v036-recon]')];
  const weights=buttons.map(btn=>{
    const parts=String(btn.dataset.v036Tip||'').split('|');
    return Math.max(0,v0401NumberCL(parts[1]));
  });
  const total=weights.reduce((a,b)=>a+b,0)||1;
  buttons.forEach((btn,i)=>{
    const key=btn.dataset.v036Recon||'active';
    const weight=weights[i];
    btn.style.flexGrow=String(weight||0.25);
    btn.style.flexShrink='1';
    btn.style.flexBasis='0px';
    btn.style.backgroundColor=v0401Tone(key);
    btn.dataset.v0401Weight=String(weight);
    btn.setAttribute('aria-label',`${key}: ${(100*weight/total).toFixed(1)}%`);
  });
  root.querySelectorAll('.v036-flowkey').forEach((box,i)=>{
    const key=buttons[i]?.dataset.v036Recon||'active';
    box.style.borderTopColor=v0401Tone(key);
  });
}

function v0401RepairLegends(root){
  root.querySelectorAll('.v036-legend i').forEach((el,i)=>{el.style.backgroundColor=i===0?v0401Tone('accent'):v0401Tone('ros');});
  root.querySelectorAll('.v036-chart-legend i').forEach(el=>{
    const txt=(el.parentElement?.textContent||'').toUpperCase();
    let tone='accent';
    if(txt.includes('ROE'))tone='warn';
    if(txt.includes('LA/FT'))tone='crit';
    if(txt.includes('EVENTOS TOTALES'))tone='accent';
    el.style.backgroundColor=v0401Tone(tone);
  });
}

function v0401RepairMatrix(root){
  root.querySelectorAll('.v036-mxname small').forEach(small=>{
    const dot=small.querySelector('i');if(dot)dot.style.backgroundColor=v0401Tone(v0401SegmentFromText(small.textContent));
  });
}

function v0401RepairRadarCards(root){
  root.querySelectorAll('.v036-rcard').forEach((card,i)=>{card.style.borderTopColor=v0401Tone(V0401_RADAR_TONES[i]||'accent');});
}

function v0401Audit(root=document.querySelector('.v036-real')){
  if(!root)return {ok:false,reason:'RADAR_NOT_RENDERED'};
  const fills=[...root.querySelectorAll('.v036-asym .v036-fill')];
  const fillChecks=fills.map(fill=>{
    const expected=v0401Pct(fill.querySelector('b')?.textContent);
    const actual=parseFloat(fill.style.width)||0;
    return {expected,actual,ok:Math.abs(expected-actual)<0.11};
  });
  const recon=[...root.querySelectorAll('.v036-flow button[data-v036-recon]')].map(btn=>({key:btn.dataset.v036Recon,weight:Number(btn.style.flexGrow)||0,visible:getComputedStyle(btn).backgroundColor!=='rgba(0, 0, 0, 0)'}));
  const sanctions=[...root.querySelectorAll('.v036-chart rect[data-v036-tip]')].map(r=>({value:v0401NumberCL(String(r.dataset.v036Tip||'').split('|')[1]),height:Number(r.getAttribute('height'))||0}));
  const ok=fillChecks.every(x=>x.ok)&&recon.every(x=>x.weight>0&&x.visible)&&sanctions.every(x=>x.value===0||x.height>0);
  root.dataset.v0401Graphics=ok?'ok':'degraded';
  return {ok,fillChecks,reconciliation:recon,sanctions};
}

function v0401Repair(root=document.querySelector('.v036-real')){
  if(!root)return null;
  v0401RepairAsym(root);
  v0401RepairReconciliation(root);
  v0401RepairLegends(root);
  v0401RepairMatrix(root);
  v0401RepairRadarCards(root);
  const result=v0401Audit(root);
  if(!result.ok)console.warn('[ATLAS v0.40.1] Radar Integrado graphics audit degraded',result);
  return result;
}
function v0401ScheduleRepair(){
  if(v0401RepairQueued)return;
  v0401RepairQueued=true;
  requestAnimationFrame(()=>{v0401RepairQueued=false;v0401Repair();});
}

/* Ensure every matrix refresh receives the same visual integrity pass. */
if(typeof v036RenderMatrix==='function'){
  const v0401BaseRenderMatrix=v036RenderMatrix;
  v036RenderMatrix=function(...args){const out=v0401BaseRenderMatrix(...args);v0401ScheduleRepair();return out;};
}

/* Radar Integrado can render after async source loading, so observe structural
 * insertions only. Attribute/style changes from this patch do not retrigger it. */
const v0401Root=document.querySelector('#app');
if(v0401Root){
  v0401Observer=new MutationObserver(mutations=>{
    if(!document.querySelector('.v036-real'))return;
    if(mutations.some(m=>m.addedNodes.length||m.removedNodes.length))v0401ScheduleRepair();
  });
  v0401Observer.observe(v0401Root,{childList:true,subtree:true});
}
window.addEventListener('atlas:themechange',v0401ScheduleRepair);
window.addEventListener('resize',v0401ScheduleRepair,{passive:true});

window.__ATLAS_RADAR_GRAPHICS_FIX__={
  version:V0401_GRAPHICS,
  cause:'CSP_BLOCKED_INLINE_QUANTITATIVE_STYLES',
  policy:'KEEP_STYLE_SRC_SELF',
  repair:v0401Repair,
  audit:v0401Audit
};
for(const ms of [0,120,350,800,1600])setTimeout(v0401ScheduleRepair,ms);
