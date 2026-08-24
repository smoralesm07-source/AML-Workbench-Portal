from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os, webbrowser, socket, threading, time
ROOT=Path(__file__).resolve().parent
os.chdir(ROOT)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

def free_port(start=8765):
    for p in range(start,start+50):
        with socket.socket() as s:
            try:
                s.bind(('127.0.0.1',p)); return p
            except OSError: pass
    raise RuntimeError('No hay puerto local disponible')
port=free_port()
url=f'http://127.0.0.1:{port}/index.html'
httpd=ThreadingHTTPServer(('127.0.0.1',port),Quiet)
print('AML Analytical Workbench v0.10.0 LOCAL')
print('Datos permanecen en este equipo. No se publican en Internet.')
print('Abriendo:',url)
print('Para cerrar, vuelva a esta ventana y presione Ctrl+C.')
threading.Timer(0.6,lambda:webbrowser.open(url)).start()
try: httpd.serve_forever()
except KeyboardInterrupt: pass
finally: httpd.server_close()
