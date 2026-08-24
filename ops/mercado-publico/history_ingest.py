#!/usr/bin/env python3
from __future__ import annotations
import argparse,csv,datetime as dt,hashlib,json,os,re,shutil,subprocess,tempfile,time,unicodedata,urllib.error,urllib.parse,urllib.request
from pathlib import Path

HOST='transparenciachc.blob.core.windows.net'; PREFIX='/oc-da/'
INGEST='https://ldmtlwzqaqmegedktlxr.supabase.co/functions/v1/aml-mp-history-ingest'; AUD='atlas-mp-history'
R2_BUCKET='atlas-mercado-publico-raw'
ALIASES={
 'order_id':('Codigo','Código','CodigoOrdenCompra','Código Orden de Compra','Codigo OC','codigooc'),
 'tender_id':('CodigoLicitacion','CódigoLicitacion','Código Licitación','Codigo Licitacion','idlicitacion'),
 'status':('Estado','EstadoOC','Estado Orden de Compra','estado'),
 'created_at':('FechaCreacion','Fecha Creacion','Fecha de Creación','fechacreacion'),
 'accepted_at':('FechaAceptacion','Fecha Aceptacion','Fecha de Aceptación','fechaaceptacion'),
 'modified_at':('FechaUltimaModificacion','Fecha Última Modificación','FechaUltimaModificacionOC','fechaUltimaModificacion','fechaultimamodificacion'),
 'buyer_name':('OrganismoPublico','NombreOrganismo','Organismo','Nombre Organismo','nombreorganismo'),
 'buyer_rut':('RutUnidadCompra','RUT Unidad Compra','RutUnidad','RUT Unidad','RutOrganismo','RUT Organismo','rutunidad','rutorganismo'),
 'buyer_unit':('UnidadCompra','NombreUnidad','Unidad de Compra','nombreunidad'),
 'buyer_region':('RegionUnidadCompra','Región Unidad Compra','RegionUnidad','Región Unidad','Region Organismo','regionunidad'),
 'buyer_commune':('CiudadUnidadCompra','ComunaUnidadCompra','ComunaUnidad','Comuna Unidad','comunaunidad'),
 'supplier_name':('NombreProveedor','Sucursal','Proveedor','Nombre Proveedor','nombreproveedor'),
 'supplier_rut':('RutSucursal','RUT Sucursal','RutProveedor','RUT Proveedor','rutproveedor','rutsucursal'),
 'currency':('TipoMonedaOC','TipoMoneda','Moneda','tipo moneda','tipomoneda'),
 'net_amount':('TotalNetoOC','Neto','MontoNeto','Monto Neto','neto'),
 'tax_amount':('Impuestos','Iva','IVA','Impuesto','MontoIVA','montoiva'),
 'total_amount':('MontoTotalOC','Total','MontoTotal','Monto Total','total'),
 'total_amount_clp':('MontoTotalOC_PesosChilenos','Monto Total OC Pesos Chilenos','montototalocpesoschilenos'),
 'modality':('Tipo','DescripcionTipoOC','TipoCompra','Modalidad','MecanismoCompra','Mecanismo de Compra','tipocompra'),
 'item_line':('IDItem','Correlativo','Linea','Línea','NumeroLinea','numero linea'),
 'product_code':('codigoProductoONU','CodigoProducto','CódigoProducto','Código Producto','codigoproducto'),
 'product_name':('NombreroductoGenerico','NombreProductoGenerico','NombreProducto','Producto','Nombre Producto','nombreproducto'),
 'description':('EspecificacionComprador','Especificación Comprador','Descripcion','Descripción','descripcion'),
 'quantity':('Cantidad','cantidad'),'unit':('UnidadMedida','Unidad de Medida','unidadmedida'),
 'unit_price':('precioNeto','PrecioNeto','PrecioUnitario','Precio Neto','Precio Unitario','precioneto'),
 'line_total':('totalLineaNeto','TotalItem','Total Item','MontoLinea','Monto Línea','totalitem')}
TOK={'v':None,'at':0.0}

def norm(s): return unicodedata.normalize('NFD',str(s or '')).encode('ascii','ignore').decode().lower()
def key(s): return re.sub(r'[^a-z0-9]','',norm(s))
def resolve(fields):
 by={key(x):x for x in (fields or []) if x}; out={}
 for c,aliases in ALIASES.items():
  for a in aliases:
   if key(a) in by: out[c]=by[key(a)]; break
 return out

def rut(v): return re.sub(r'[^0-9Kk]','',str(v or '')).upper() or None
def num(v):
 s=str(v or '').strip().replace('\xa0','').replace(' ','')
 if not s:return None
 try:
  if ',' in s and '.' in s:s=s.replace('.','').replace(',','.') if s.rfind(',')>s.rfind('.') else s.replace(',','')
  elif ',' in s:s=s.replace(',','.')
  return float(s)
 except:return None

def date_iso(v):
 s=str(v or '').strip()
 if not s:return None
 s=s.replace('Z','+00:00')
 for f in (None,'%d-%m-%Y','%d/%m/%Y','%Y-%m-%d','%d-%m-%Y %H:%M:%S','%d/%m/%Y %H:%M:%S'):
  try:
   d=dt.datetime.fromisoformat(s) if f is None else dt.datetime.strptime(s,f)
   return d.isoformat()
  except:pass
 return None

def stable(x): return hashlib.sha256(json.dumps(x,sort_keys=True,ensure_ascii=False,separators=(',',':'),default=str).encode()).hexdigest()
def default_url(y,m): return f'https://{HOST}/oc-da/{y}-{m}.zip'
def valid_url(url):
 p=urllib.parse.urlsplit(url)
 if p.scheme!='https' or (p.hostname or '').lower()!=HOST or not p.path.startswith(PREFIX): raise ValueError('unexpected ChileCompra bulk URL')
def token():
 now=time.time()
 if TOK['v'] and now-TOK['at']<210:return TOK['v']
 base=os.environ.get('ACTIONS_ID_TOKEN_REQUEST_URL',''); secret=os.environ.get('ACTIONS_ID_TOKEN_REQUEST_TOKEN','')
 if not base or not secret:raise RuntimeError('GitHub OIDC unavailable')
 sep='&' if '?' in base else '?'; req=urllib.request.Request(base+sep+'audience='+urllib.parse.quote(AUD),headers={'Authorization':'bearer '+secret,'Accept':'application/json'})
 with urllib.request.urlopen(req,timeout=30) as r:t=json.load(r).get('value')
 if not t:raise RuntimeError('OIDC token missing')
 TOK.update(v=t,at=now);return t

def api(payload,timeout=180):
 raw=json.dumps(payload,separators=(',',':')).encode()
 for _ in range(2):
  req=urllib.request.Request(INGEST,data=raw,headers={'Authorization':'Bearer '+token(),'Content-Type':'application/json','User-Agent':'Atlas-MP-History/1.2'},method='POST')
  try:
   with urllib.request.urlopen(req,timeout=timeout) as r:o=json.load(r)
   if not o.get('ok'):raise RuntimeError(o.get('error') or 'ingest rejected')
   return o
  except urllib.error.HTTPError as e:
   if e.code==401:TOK.update(v=None,at=0);continue
   raise RuntimeError(f'Ingest HTTP {e.code}: {e.read().decode("utf-8","replace")[:500]}') from e
 raise RuntimeError('OIDC authentication failed')

def dl(url,dst):
 valid_url(url);req=urllib.request.Request(url,headers={'User-Agent':'Atlas-MP-History/1.2'})
 with urllib.request.urlopen(req,timeout=600) as r,dst.open('wb') as f:shutil.copyfileobj(r,f,1024*1024)
def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def upload_r2(path:Path,year:int,month:int)->str:
 key_name=f'mercado-publico/raw/{year}/{month:02d}/{path.name}'
 target=f'{R2_BUCKET}/{key_name}'
 subprocess.run(['npx','wrangler@4.125.0','r2','object','put',target,f'--file={path}','--remote','--content-type=application/zip'],check=True)
 return f'r2://{target}'
def enc(path):
 raw=path.open('rb').read(65536)
 try:raw.decode('utf-8-sig');return 'utf-8-sig'
 except:return 'latin-1'
def sniff(text):
 try:return csv.Sniffer().sniff(text[:12000],delimiters=';,\t|')
 except:
  class Semi(csv.excel):delimiter=';'
  return Semi()
def batches(rows,n):
 for i in range(0,len(rows),n):yield rows[i:i+n]

def main():
 p=argparse.ArgumentParser();p.add_argument('--year',type=int,required=True);p.add_argument('--month',type=int,required=True);p.add_argument('--url');a=p.parse_args()
 if a.year not in range(2023,2027) or a.month not in range(1,13):raise SystemExit('period outside 2023-2026')
 url=a.url or default_url(a.year,a.month);valid_url(url);api({'action':'health'})
 try:
  with tempfile.TemporaryDirectory() as td0:
   td=Path(td0);z=td/f'{a.year}-{a.month}.zip';x=td/'x';dl(url,z);sha=digest(z);size=z.stat().st_size
   obj=upload_r2(z,a.year,a.month)
   shutil.unpack_archive(str(z),str(x));files=sorted(x.rglob('*.csv'),key=lambda q:q.stat().st_size,reverse=True)
   if not files:raise RuntimeError('archive has no CSV')
   src=files[0];orders={};rows_read=0;raw_fields=[]
   with src.open('r',encoding=enc(src),newline='') as fh:
    sample=fh.read(12000);fh.seek(0);reader=csv.DictReader(fh,dialect=sniff(sample));raw_fields=list(reader.fieldnames or []);m=resolve(reader.fieldnames)
    required={'order_id','buyer_name','supplier_name'}
    if not required.issubset(m):raise RuntimeError('required columns unresolved: '+','.join(sorted(required-set(m))))
    def g(row,k):return row.get(m.get(k)) if m.get(k) else None
    for row in reader:
     rows_read+=1;oid=str(g(row,'order_id') or '').strip()
     if not oid:continue
     o=orders.get(oid)
     if o is None:
      parsed=date_iso(g(row,'accepted_at') or g(row,'created_at') or g(row,'modified_at')); od=(parsed or '')[:10]
      try:yy,mm,_=map(int,od.split('-'))
      except:continue
      if (yy,mm)!=(a.year,a.month):continue
      cur=str(g(row,'currency') or '').strip() or None;clp=num(g(row,'total_amount_clp'));total=num(g(row,'total_amount'))
      if clp in (None,0) and str(cur or '').upper() in {'CLP','PESO CHILENO','PESOS CHILENOS','$'}:clp=total
      o={'order_id':oid,'order_code':oid,'tender_code':str(g(row,'tender_id') or '').strip() or None,'order_date':od,'accepted_at':date_iso(g(row,'accepted_at')),'status':str(g(row,'status') or '').strip() or None,'purchase_mechanism':str(g(row,'modality') or '').strip() or None,'buyer_unit_code':None,'buyer_unit_name':str(g(row,'buyer_unit') or '').strip() or None,'buyer_org_name':str(g(row,'buyer_name') or '').strip() or None,'buyer_rut':rut(g(row,'buyer_rut')),'buyer_region':str(g(row,'buyer_region') or '').strip() or None,'buyer_commune':str(g(row,'buyer_commune') or '').strip() or None,'supplier_code':None,'supplier_name':str(g(row,'supplier_name') or '').strip() or None,'supplier_rut':rut(g(row,'supplier_rut')),'supplier_size':None,'currency':cur,'net_amount':num(g(row,'net_amount')),'tax_amount':num(g(row,'tax_amount')),'total_amount':total,'clp_amount':clp,'item_count':0,'raw_object_path':obj,'source_record_hash':None,'items':[],'used':set()};orders[oid]=o
     try:ln=int(float(str(g(row,'item_line')).replace(',','.'))) if g(row,'item_line') not in (None,'') else len(o['items'])+1
     except:ln=len(o['items'])+1
     while ln in o['used']:ln+=1
     o['used'].add(ln);line_total=num(g(row,'line_total'));line_clp=line_total if line_total not in (None,0) and str(o['currency'] or '').upper() in {'CLP','PESO CHILENO','PESOS CHILENOS','$'} else None
     item={'order_date':o['order_date'],'order_id':oid,'line_no':ln,'product_code':str(g(row,'product_code') or '').strip() or None,'category_code':None,'description':str(g(row,'description') or g(row,'product_name') or '').strip() or None,'quantity':num(g(row,'quantity')),'unit':str(g(row,'unit') or '').strip() or None,'unit_price':num(g(row,'unit_price')),'line_total':line_total,'currency':o['currency'],'clp_line_amount':line_clp,'source_record_hash':None}
     if any(item[k] not in (None,'') for k in ('product_code','description','quantity','unit_price','line_total')):o['items'].append(item)
   facts=[];items=[]
   for o in orders.values():
    its=o.pop('items');o.pop('used');o['item_count']=len(its);o['source_record_hash']=stable(o);facts.append(o)
    for it in its:it['source_record_hash']=stable(it);items.append(it)
   if not facts:raise RuntimeError('no in-scope orders parsed')
   for b in batches(facts,300):api({'action':'orders_batch','year':a.year,'month':a.month,'rows':b})
   for b in batches(items,500):api({'action':'items_batch','year':a.year,'month':a.month,'rows':b})
   n=max(len(facts),1);ni=max(len(items),1);identified=sum(1 for o in facts if (o['buyer_rut'] or o['buyer_org_name']) and (o['supplier_rut'] or o['supplier_name']));clp=sum(1 for o in facts if o['clp_amount'] not in (None,0));prod=sum(1 for i in items if i['product_code'] or i['description']);priced=sum(1 for i in items if i['unit_price'] not in (None,0) or i['line_total'] not in (None,0))
   cov={'orders':len(facts),'items':len(items),'identity_coverage':round(identified/n,6),'clp_amount_coverage':round(clp/n,6),'product_coverage':round(prod/ni,6),'price_coverage':round(priced/ni,6),'resolved_columns':sorted(m),'raw_column_count':len(raw_fields)}
   final=api({'action':'finalize','year':a.year,'month':a.month,'object_path':obj,'source_url':url,'sha256':sha,'bytes':size,'rows_observed':rows_read,'metadata':{'orders':len(facts),'items':len(items),'coverage':cov,'raw_backend':'cloudflare_r2'}},timeout=240)
   print(json.dumps({'ok':True,'year':a.year,'month':a.month,'rows_read':rows_read,'orders':len(facts),'items':len(items),'raw_bytes':size,'coverage':cov,'raw_object':obj,'final':final},ensure_ascii=False))
 except Exception as e:
  msg=str(e)
  if 'token=' in msg:msg=msg.split('token=',1)[0]+'token=[REDACTED]'
  try:api({'action':'fail','year':a.year,'month':a.month,'error':msg[:900]})
  except:pass
  raise
if __name__=='__main__':main()
