import fs from 'node:fs';

const src=fs.readFileSync('assets/atlas-radar-layout-so-history.js','utf8');
const checks=[
  ['canonical catalog is explicit',/CANONICAL_SECTORS=55/],
  ['canonical represented count is explicit',/CANONICAL_REPRESENTED_2025=47/],
  ['statistical extra category is explicit',/Instituciones Públicas/],
  ['missing canonical count is eight',/MISSING_CANONICAL_2025=\[/],
  ['missing mutual funds',/Administradoras de Fondos Mutuos/],
  ['missing arms manufacturing',/Fabricación de Armas/],
  ['missing hunting clubs',/Clubes de Caza/],
  ['missing fishing clubs',/Clubes de Pesca/],
  ['missing fintech custody',/Fintec: Custodia de Instrumentos Financieros/],
  ['missing fintech crowdfunding',/Fintec: Plataformas de Financiamiento Colectivo/],
  ['missing fintech alternative trading',/Fintec: Sistemas Alternativos de Transacción/],
  ['missing fintech payment initiation',/Fintec: Iniciación de Pagos/],
  ['requested title exists',/Sectores económicos sin representación/],
  ['represented count comes from total matrix state',/Mostrando\\s\+\[\\d\.\]\+\\s\+de/],
  ['historical anchor is used',/Capacidad supervisiva frente al padrón/],
  ['methodological guardrail exists',/No implica que la actividad esté fuera de la Ley 19\.913/],
  ['render is idempotent',/dataset\.signature/],
  ['no browser persistence',/localStorage|sessionStorage/],
];

for(const [label,re] of checks){
  const hit=re.test(src);
  if(label==='no browser persistence'){
    if(hit)throw new Error(`${label}: unexpected persistence API`);
  }else if(!hit){
    throw new Error(`Missing contract: ${label}`);
  }
}

const missing=(src.match(/MISSING_CANONICAL_2025=\[(.*?)\];/s)?.[1].match(/'/g)||[]).length/2;
if(missing!==8)throw new Error(`Expected 8 missing canonical sectors, got ${missing}`);
console.log('atlas-sector-representation-0690: ok');
