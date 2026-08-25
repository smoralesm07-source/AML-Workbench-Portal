import fs from 'node:fs';

const src=fs.readFileSync('assets/atlas-radar-layout-so-history.js','utf8');
const checks=[
  ['canonical catalog is explicit',/CANONICAL_SECTORS=55/],
  ['requested title exists',/Sectores económicos sin representación/],
  ['represented count comes from total matrix state',/Mostrando\\s\+\[\\d\.\]\+\\s\+de/],
  ['gap is computed, not hardcoded',/CANONICAL_SECTORS-represented/],
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
console.log('atlas-sector-representation-0690: ok');
