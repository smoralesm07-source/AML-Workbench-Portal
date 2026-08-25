import fs from 'node:fs';
const wf=fs.readFileSync('.github/workflows/sync-public-spend-context-0571.yml','utf8');
const must=(c,m)=>{if(!c)throw new Error(m)};
must(wf.includes('aml-public-spend-context-sync'),'sin sincronizador contextual');
must(wf.includes('aml-public-spend-context-links-refresh'),'crosswalk no se refresca tras sincronizar');
must(wf.includes('audience=atlas-public-spend-context'),'audiencia OIDC incorrecta');
must(wf.includes('id-token: write'),'OIDC sin permiso id-token');
must(!wf.includes('SUPABASE_SERVICE_ROLE_KEY')&&!wf.includes('MERCADO_PUBLICO_TICKET'),'workflow no debe exponer secretos de aplicación');
console.log('ATLAS Public Spend Context Links 0572 OK');
