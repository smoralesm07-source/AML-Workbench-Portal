#!/usr/bin/env python3
"""Probe de disponibilidad del portal oficial RNPJSFL; no descarga ni interpreta el padrón."""
import json,os,re,time,urllib.request
EDGE="https://ldmtlwzqaqmegedktlxr.supabase.co/functions/v1/aml-osfl-registry-ingest";AUD="atlas-osfl-registry-ingest";PORTAL="https://www.registrocivil.cl/principal/nuestras-oficinas/portal-registro-nacional-de-personas-juridicas-sin-fines-de-lucro";UA="ATLAS-OSFL-RNPJSFL-Probe/0.94"
def token():
 base=os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL","");secret=os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN","")
 if not base or not secret:raise RuntimeError("GitHub OIDC unavailable")
 req=urllib.request.Request(base+("&" if "?" in base else "?")+"audience="+AUD,headers={"Authorization":"bearer "+secret,"Accept":"application/json"})
 with urllib.request.urlopen(req,timeout=30) as r:return json.load(r)["value"]
def edge(payload):
 req=urllib.request.Request(EDGE,data=json.dumps(payload).encode(),headers={"Authorization":"Bearer "+token(),"Content-Type":"application/json","User-Agent":UA},method="POST")
 with urllib.request.urlopen(req,timeout=60) as r:return json.load(r)
def main():
 status=None;blocked=True;detail="unknown"
 try:
  req=urllib.request.Request(PORTAL,headers={"User-Agent":UA,"Accept":"text/html,*/*"})
  with urllib.request.urlopen(req,timeout=60) as r:status=r.status;text=r.read(700000).decode("utf-8",errors="replace")
  direct=bool(re.search(r'''href=["'][^"']+\.(?:rar|zip|xlsx|xls)(?:\?[^"']*)?["']''',text,re.I));challenge=bool(re.search(r"captcha|challenge|cf-chl|verifique|javascript is required",text,re.I));blocked=challenge or not direct;detail="challenge_or_no_direct_file" if blocked else "direct_file_link_discovered"
 except Exception as e:detail=f"probe_error:{type(e).__name__}:{e}"
 result=edge({"action":"probe_status","portal":PORTAL,"http_status":status,"blocked":blocked,"detail":detail});print(json.dumps({"ok":True,"portal":PORTAL,"http_status":status,"blocked":blocked,"detail":detail,"edge":result},ensure_ascii=False))
if __name__=="__main__":main()
