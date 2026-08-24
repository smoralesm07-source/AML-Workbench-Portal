FROM docker.io/cloudflare/sandbox:0.12.7-python

RUN python3 -m pip install --no-cache-dir "git+https://github.com/soxoj/maigret.git@a187f616de096d13a26cededc6bb622811070036"

WORKDIR /opt/atlas
COPY runtime/run_maigret.py /opt/atlas/run_maigret.py

EXPOSE 8080
