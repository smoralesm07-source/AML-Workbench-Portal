#!/usr/bin/env python3
"""ATLAS AML · carga gobernada del padrón público SII de personas jurídicas.

Carga tres insumos:
- PUB_NOMBRES_PJ.zip: identidad tributaria, inicio y término de giro.
- PUB_NOM_ACTECOS.zip: sólo actividades relevantes para screening UAF.
- Radar_SII/config/uaf_sii_screening_policy.csv: política explicable A/B/C.

Identidad exclusivamente por RUT chileno válido. GitHub OIDC autentica contra la
Edge Function; no se almacena service_role en GitHub.
"""
from __future__ import annotations
import argparse,csv,datetime as dt,hashlib,io,json,os,re,tempfile,time,unicodedata,urllib.request,zipfile
from pathlib import Path

EDGE="https://ldmtlwzqaqmegedktlxr.supabase.co/functions/v1/aml-sii-registry-ingest"
AUD="atlas-sii-registry-ingest"
UA="Atlas-SII-Registry/0.65 (+official SII open data)"
NAMES_URL="https://www.sii.cl/estadisticas/nominas/PUB_NOMBRES_PJ.zip"
ACT_URL="https://www.sii.cl/estadisticas/nominas/PUB_NOM_ACTECOS.zip"
POLICY_URL="https://raw.githubusercontent.com/smoralesm07-source/Radar_SII/main/config/uaf_sii_screening_policy.csv"
TOK={"value":None,"at":0.0}

def norm(s):
    x=unicodedata.normalize("NFKD",str(s or "")).encode("ascii","ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+","_",x).strip("_")
def upper_norm(s):
    return re.sub(r"\s+"," ",unicodedata.normalize("NFKD",str(s or "")).encode("ascii","ignore").decode().upper()).strip()
def iso_date(v):
    s=str(v or "").strip()
    if not s:return None
    for f in ("%Y-%m-%d","%d-%m-%Y","%d/%m/%Y"):
        try:return dt.datetime.strptime(s,f).date().isoformat()
        except ValueError:pass
    return None
def rut_valid(body,dv):
    b=re.sub(r"\D","",str(body or "")).lstrip("0"); d=re.sub(r"[^0-9Kk]","",str(dv or "")).upper()[:1]
    if not b or not d:return None
    total=0;factor=2
    for ch in reversed(b):
        total+=int(ch)*factor;factor=2 if factor==7 else factor+1
    r=11-(total%11); exp="0" if r==11 else "K" if r==10 else str(r)
    return f"{int(b)}-{d}" if d==exp else None
def pick(row,*names):
    for name in names:
        if name in row:return row.get(name)
    return None
def token():
    now=time.time()
    if TOK["value"] and now-TOK["at"]<210:return TOK["value"]
    base=os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL",""); secret=os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN","")
    if not base or not secret:raise RuntimeError("GitHub OIDC unavailable")
    sep="&" if "?" in base else "?"
    req=urllib.request.Request(base+sep+"audience="+AUD,headers={"Authorization":"bearer "+secret,"Accept":"application/json"})
    with urllib.request.urlopen(req,timeout=30) as r:value=json.load(r).get("value")
    if not value:raise RuntimeError("OIDC token missing")
    TOK.update(value=value,at=now);return value
def api(payload,timeout=240):
    raw=json.dumps(payload,ensure_ascii=False,separators=(",",":"),default=str).encode()
    for attempt in range(4):
        try:
            req=urllib.request.Request(EDGE,data=raw,headers={"Authorization":"Bearer "+token(),"Content-Type":"application/json","User-Agent":UA},method="POST")
            with urllib.request.urlopen(req,timeout=timeout) as r:out=json.load(r)
            if not out.get("ok"):raise RuntimeError(out.get("error") or "SII ingest rejected")
            return out
        except Exception:
            if attempt==3:raise
            TOK.update(value=None,at=0.0);time.sleep(1.5*(2**attempt))
def download(url,path):
    last=None
    for attempt in range(3):
        try:
            req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept":"*/*"})
            sha=hashlib.sha256();size=0
            with urllib.request.urlopen(req,timeout=900) as r,path.open("wb") as out:
                headers=dict(r.headers.items())
                while True:
                    b=r.read(1024*1024)
                    if not b:break
                    out.write(b);sha.update(b);size+=len(b)
            return sha.hexdigest(),size,headers
        except Exception as e:
            last=e
            if attempt<2:time.sleep(2*(attempt+1))
    raise last
def open_zip_text(path,preferred):
    z=zipfile.ZipFile(path)
    names=z.namelist(); member=next((n for n in names if Path(n).name.upper()==preferred.upper()),None)
    if not member:raise RuntimeError(f"{preferred} missing; members={names[:8]}")
    raw=z.open(member)
    sample=raw.read(120000);raw.close()
    enc="utf-8-sig"
    try:sample.decode(enc)
    except UnicodeDecodeError:enc="cp1252"
    stream=io.TextIOWrapper(z.open(member),encoding=enc,errors="replace",newline="")
    first=stream.read(12000);stream.seek(0)
    try:dia=csv.Sniffer().sniff(first,delimiters=";\t|,")
    except csv.Error:
        class Semi(csv.excel):delimiter=";"
        dia=Semi()
    return z,stream,dia
def canonical_reader(stream,dialect):
    reader=csv.DictReader(stream,dialect=dialect)
    fields=[norm(x) for x in (reader.fieldnames or [])]
    for raw in reader:
        yield {fields[i]:v for i,v in enumerate(raw.values()) if i<len(fields)}
def batches(rows,n=2000):
    buf=[]
    for row in rows:
        buf.append(row)
        if len(buf)>=n:yield buf;buf=[]
    if buf:yield buf
def snapshot(kind,url,sha,size,headers):
    sid=f"sii:{kind}:{sha}"
    status=api({"action":"snapshot_status","source_kind":kind,"source_hash":sha})
    if status.get("exists") and (status.get("snapshot") or {}).get("status")=="NORMALIZED":return sid,True
    api({"action":"snapshot","row":{"snapshot_id":sid,"source_kind":kind,"source_url":url,"source_hash":sha,"status":"INGESTING","metadata":{"bytes":size,"last_modified":headers.get("Last-Modified"),"identity":"RUT_EXACT_ONLY"}}})
    return sid,False
def load_policy(path):
    raw=path.read_bytes();sha=hashlib.sha256(raw).hexdigest();sid=f"sii:POLICY:{sha}"
    status=api({"action":"snapshot_status","source_kind":"POLICY","source_hash":sha})
    eligible=set();rows=[]
    text=raw.decode("utf-8-sig",errors="replace");reader=csv.DictReader(io.StringIO(text),delimiter=";")
    for r in reader:
        code=re.sub(r"\D","",str(r.get("sii_acteco") or ""));sector=str(r.get("uaf_sector") or "").strip()
        if not code or not sector:continue
        priority=str(r.get("screening_priority") or "").strip().upper();use=str(r.get("candidate_use") or "").strip().upper()
        if priority in {"A","B","C"} and use in {"SI","COMPLEMENTARIO","NO_SOLO"}:eligible.add(code)
        rid="UAF-SII-"+hashlib.sha1((sector+"|"+code).encode()).hexdigest()[:24]
        rows.append({"rule_id":rid,"uaf_sector":sector,"sii_acteco":code,"sii_glosa":r.get("sii_glosa") or None,"screening_class":r.get("screening_class") or None,"candidate_use":use or None,"screening_priority":priority or None,"legal_interpretation":r.get("legal_interpretation") or None,"manual_equivalence":r.get("tipo_equivalencia") or None,"manual_confidence":r.get("confianza_manual") or None,"source_hash":sha})
    if not (status.get("exists") and (status.get("snapshot") or {}).get("status")=="NORMALIZED"):
        api({"action":"snapshot","row":{"snapshot_id":sid,"source_kind":"POLICY","source_url":POLICY_URL,"source_hash":sha,"status":"INGESTING","metadata":{"rules":len(rows)}}})
        for b in batches(rows,1200):api({"action":"policy_batch","rows":b})
        api({"action":"finalize","source_kind":"POLICY","snapshot_id":sid,"source_hash":sha,"record_count":len(rows),"accepted_count":len(rows),"metadata":{"eligible_codes":len(eligible)}})
    return eligible,sha
def load_names(zip_path,sha,size,headers):
    sid,skip=snapshot("NAMES",NAMES_URL,sha,size,headers)
    if skip:return {"skipped":True,"snapshot_id":sid}
    z,stream,dialect=open_zip_text(zip_path,"PUB_NOMBRES_PJ.txt");observed=accepted=0
    def rows():
        nonlocal observed,accepted
        for r in canonical_reader(stream,dialect):
            observed+=1;rut=rut_valid(pick(r,"rut","rut_contribuyente"),pick(r,"dv","digito_verificador"))
            name=str(pick(r,"razon_social","nombre_razon_social","nombre") or "").strip()
            if not rut or not name:continue
            accepted+=1;tg=iso_date(pick(r,"fecha_tg_vig","fecha_termino_de_giro","fecha_termino_giro"))
            yield {"rut":rut,"entity_id":"ENT-RUT-"+rut,"legal_name":name,"legal_name_norm":upper_norm(name),"taxpayer_subtype_code":str(pick(r,"cod_subtipo","codigo_subtipo") or "").strip() or None,"activity_start_date":iso_date(pick(r,"fecha_inicio_vig","fecha_inicio_actividades_vigentes","fecha_inicio_actividades")),"termination_date":tg,"current_status":"TERMINATED_AS_PUBLISHED" if tg else "ACTIVE_AS_PUBLISHED","source_snapshot_id":sid}
    try:
        for b in batches(rows()):api({"action":"company_batch","rows":b})
    finally:stream.close();z.close()
    api({"action":"finalize","source_kind":"NAMES","snapshot_id":sid,"source_hash":sha,"record_count":observed,"accepted_count":accepted,"metadata":{"coverage":"ALL_VALID_LEGAL_ENTITY_TAXPAYERS","official":"SII"}})
    return {"snapshot_id":sid,"observed":observed,"accepted":accepted}
def load_activities(zip_path,sha,size,headers,eligible):
    sid,skip=snapshot("ACTIVITIES",ACT_URL,sha,size,headers)
    if skip:return {"skipped":True,"snapshot_id":sid}
    z,stream,dialect=open_zip_text(zip_path,"PUB_NOM_ACTECOS.txt");observed=accepted=0
    def rows():
        nonlocal observed,accepted
        for r in canonical_reader(stream,dialect):
            observed+=1;code=re.sub(r"\D","",str(pick(r,"codigo_actividad","codigo_actividad_economica","actividad_codigo","codigo") or ""))
            if code not in eligible:continue
            rut=rut_valid(pick(r,"rut","rut_contribuyente"),pick(r,"dv","digito_verificador"))
            if not rut:continue
            name=str(pick(r,"desc_actividad_economica","actividad_economica","glosa_actividad","descripcion_actividad","actividad") or "").strip()
            date=iso_date(pick(r,"fecha","fecha_actividad","fecha_inscripcion"));accepted+=1
            rid="SII-ACT-"+hashlib.sha1((rut+"|"+code+"|"+(date or "")+"|"+upper_norm(name)).encode()).hexdigest()[:28]
            yield {"activity_record_id":rid,"rut":rut,"entity_id":"ENT-RUT-"+rut,"activity_code":code,"activity_name":name or None,"activity_registration_date":date,"vat_affected":pick(r,"afecta_a_iva","afecta_iva") or None,"activity_category":pick(r,"categoria_tributaria","categoria") or None,"activity_status":pick(r,"vigencia","estado","estado_actividad") or "VIGENTE_AS_PUBLISHED","source_snapshot_id":sid}
    try:
        for b in batches(rows()):api({"action":"activity_batch","rows":b})
    finally:stream.close();z.close()
    fin=api({"action":"finalize","source_kind":"ACTIVITIES","snapshot_id":sid,"source_hash":sha,"record_count":observed,"accepted_count":accepted,"metadata":{"filtered_to_uaf_relevant_codes":True,"eligible_codes":len(eligible),"official":"SII"}})
    return {"snapshot_id":sid,"observed":observed,"accepted":accepted,"potential":fin.get("potential")}
def run():
    with tempfile.TemporaryDirectory() as td:
        td=Path(td);policy=td/"policy.csv";names=td/"names.zip";acts=td/"acts.zip"
        psha,_,_=download(POLICY_URL,policy);eligible,_=load_policy(policy)
        nsha,nsize,nh=download(NAMES_URL,names);n=load_names(names,nsha,nsize,nh)
        asha,asize,ah=download(ACT_URL,acts);a=load_activities(acts,asha,asize,ah,eligible)
        print(json.dumps({"ok":True,"policy_hash":psha,"eligible_codes":len(eligible),"names":n,"activities":a},ensure_ascii=False))
def self_test():
    assert rut_valid("76086428","5")=="76086428-5"
    assert rut_valid("76086428","0") is None
    assert iso_date("31/12/2025")=="2025-12-31"
    assert upper_norm("Gestión Inmobiliária") == "GESTION INMOBILIARIA"
    print("SII registry ingest self-test OK")
if __name__=="__main__":
    ap=argparse.ArgumentParser();ap.add_argument("--self-test",action="store_true");args=ap.parse_args()
    self_test() if args.self_test else run()
