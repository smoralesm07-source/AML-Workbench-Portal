'use strict';

/* v0.36.0 · semantic crosswalk only for sector labels that differ between
 * Radar UAF reportability and the governed sector-level Fusion cross view.
 * No fuzzy entity matching is introduced. */
const V036_SECTOR_CROSS_ALIASES=[
  ['COOPERATIVAS DE AHORRO Y CREDITO','COOPERATIVAS INSTITUCIONES FINANCIERAS'],
  ['ADMINISTRADORAS DE FONDOS DE PENSIONES','ADMINISTRADORES DE FONDOS DE PENSIONES AFP'],
  ['COMPANIAS DE SEGUROS','COMPANIAS DE SEGURO'],
  ['CORREDORES DE BOLSAS DE VALORES','CORREDORES DE BOLSA DE VALORES'],
  ['CORREDORES DE BOLSAS DE PRODUCTOS','CORREDORES DE BOLSAS DE PRODUCTOS'],
  ['EMPRESAS DE DEPOSITO DE VALORES REGIDAS POR LA LEY N 18 876','DEPOSITOS DE VALORES'],
  ['INSTITUCIONES FINANCIERAS','INSTITUCION FINANCIERA'],
  ['CASINOS FLOTANTES DE JUEGO','CASINOS FLOTANTES DE JUEGOS'],
  ['FINTEC OTROS FISCALIZADOS POR CMF','FINTEC OTROS FISCALIZADOS POR LA COMISION PARA EL MERCADO FINANCIERO CMF'],
  ['FINTEC INTERMEDIACION DE INSTRUMENTOS FINANCIEROS','FINTEC PRESTADORES DEL SERVICIO DE INTERMEDIACION DE INSTRUMENTOS FINANCIEROS']
];
const v036CrosswalkBaseEquivalent=v036SectorEquivalent;
v036SectorEquivalent=function(a,b){
  if(v036CrosswalkBaseEquivalent(a,b))return true;
  const x=v036Norm(a),y=v036Norm(b);
  if(V036_SECTOR_CROSS_ALIASES.some(([u,v])=>(x===u&&y===v)||(x===v&&y===u)))return true;
  if(x.startsWith('EMISORAS U OPERADORAS DE TARJETAS')&&(
    y.includes('EMISORAS DE TARJETAS DE CREDITO')||
    y.includes('OPERADORAS DE TARJETAS DE CREDITO')||
    y.includes('EMISORES DE TARJETAS DE PAGO')||
    y.includes('OPERADORES DE TARJETAS DE PAGO')
  ))return true;
  return false;
};

function v036DecorateNativeSpendCard(){
  if(!window.__AML_PUBLIC_SPEND__?.load)return;
  const card=document.querySelector('[data-v036-radar="budget"]');
  if(!card||card.dataset.v037Native==='1')return;
  card.dataset.v037Native='1';
  const state=card.querySelector('.v036-rcard-head span');
  const big=card.querySelector('strong');
  const copy=card.querySelector('p');
  const foot=card.querySelector('.v036-rcard-foot');
  if(state)state.textContent='v13.1 native';
  if(big)big.textContent='v13.1';
  if(copy)copy.textContent='Módulo nativo de Gasto Público conectado a Radar Presupuesto Abierto, Entity Hub y cruces exactos por RUT.';
  if(foot)foot.innerHTML='<span>Grano <b>partida/capítulo</b></span><span>Marcas <b>priorización</b></span>';
}

/* Workbench v0.37 introduced a native Gasto Público route after the v0.36
 * command center was built. Prefer that full module from Radar Integrado and
 * suppress the older preview action without changing any other radar card. */
document.addEventListener('click',e=>{
  const target=e.target.closest?.('[data-v036-radar="budget"]');
  if(!target||!window.__AML_PUBLIC_SPEND__?.load)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  void window.navigate?.('public-spend');
},true);

const v036SpendObserver=new MutationObserver(()=>{
  if(window.state?.view==='overview')v036DecorateNativeSpendCard();
});
v036SpendObserver.observe(document.documentElement,{childList:true,subtree:true});
queueMicrotask(v036DecorateNativeSpendCard);

window.__AML_V036_SECTOR_CROSSWALK__={
  mode:'EXPLICIT_SECTOR_ALIASES_ONLY',
  fuzzy:false,
  aliases:V036_SECTOR_CROSS_ALIASES.length,
  publicSpendBridge:'V037_NATIVE_ROUTE',
  publicSpendPresentation:'V13_1_NATIVE'
};
