import fs from 'node:fs';

const pulse=fs.readFileSync('assets/atlas-strategic-pulse.js','utf8');
const css=fs.readFileSync('assets/atlas-strategic-pulse.css','utf8');
const history=fs.readFileSync('assets/atlas-radar-layout-so-history.js','utf8');
const index=fs.readFileSync('index.html','utf8');

const checks=[
  ['eight missing sectors declared in pulse',/MISSING_CANONICAL_2025=\[/],
  ['missing mutual funds',/Administradoras de Fondos Mutuos/],
  ['missing arms manufacturing',/Fabricación de Armas/],
  ['missing hunting clubs',/Clubes de Caza/],
  ['missing fishing clubs',/Clubes de Pesca/],
  ['missing fintech custody',/Fintec: Custodia de Instrumentos Financieros/],
  ['missing fintech crowdfunding',/Fintec: Plataformas de Financiamiento Colectivo/],
  ['missing fintech alternative trading',/Fintec: Sistemas Alternativos de Transacción/],
  ['missing fintech payment initiation',/Fintec: Iniciación de Pagos/],
  ['KPI title exists',/Sectores sin representación/],
  ['KPI is clickable',/data-pulse-missing/],
  ['KPI exposes eight',/<b>8<\/b>/],
  ['panel has methodological guardrail',/No implica que la actividad esté fuera de la Ley 19\.913/],
  ['legacy lower card hidden',/\.atlas-sector-representation\{display:none!important\}/],
];
for(const [label,re] of checks){if(!re.test(label==='legacy lower card hidden'?css:pulse))throw new Error(`Missing contract: ${label}`);}
const missing=(pulse.match(/MISSING_CANONICAL_2025=\[(.*?)\];/s)?.[1].match(/'/g)||[]).length/2;
if(missing!==8)throw new Error(`Expected 8 missing canonical sectors, got ${missing}`);
if(!/CANONICAL_SECTORS=55/.test(history)||!/CANONICAL_REPRESENTED_2025=47/.test(history))throw new Error('Underlying 55/47 sector contract must remain governed');
if(!/atlas-strategic-pulse\.js\?v=0693-1/.test(index))throw new Error('index.html must load strategic pulse 0.69.3 JS');
if(!/atlas-strategic-pulse\.css\?v=0693-1/.test(index))throw new Error('index.html must load strategic pulse 0.69.3 CSS');
console.log('atlas-sector-representation-0690: KPI placement ok');
