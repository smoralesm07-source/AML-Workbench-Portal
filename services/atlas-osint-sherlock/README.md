# ATLAS OSINT · Sherlock service

Microservicio aislado para la búsqueda de presencia digital por `username` desde **Entidades** de ATLAS AML.

## Contrato

- `GET /health`: estado del servicio, sin datos de usuario.
- `POST /v1/username`: requiere `Authorization: Bearer <Supabase access token>`.
- Respuesta: `ATLAS_OSINT_USERNAME_V1`.
- La semántica de identidad es siempre `USERNAME_COINCIDENCE_ONLY`.

El servicio no promueve identidad, no acepta URL objetivo, proxy, lista de sitios, comandos ni argumentos libres. Sherlock sólo consulta su catálogo gobernado; los sitios NSFW se excluyen.

## Variables de entorno

```text
SUPABASE_URL=https://<proyecto>.supabase.co
ATLAS_ALLOWED_ORIGINS=https://<origen-atlas>
ATLAS_OSINT_RATE_LIMIT_PER_HOUR=30
ATLAS_OSINT_MAX_CONCURRENCY=3
ATLAS_OSINT_SITE_TIMEOUT_SECONDS=8
```

`ATLAS_ALLOWED_ORIGINS` acepta varios orígenes separados por coma. No hay API key del cliente: el servicio valida el JWT de la sesión Supabase mediante JWKS.

## Ejecución local

```bash
docker build -t atlas-osint-sherlock .
docker run --rm -p 8080:8080 \
  -e SUPABASE_URL=https://<proyecto>.supabase.co \
  -e ATLAS_ALLOWED_ORIGINS=http://localhost:8000 \
  atlas-osint-sherlock
```

Luego configure `assets/atlas-osint-config.js`:

```js
window.__ATLAS_OSINT_CONFIG__={
  enabled:true,
  apiBase:'https://osint.example.org'
};
```

Si el servicio vive en otro origen, ese origen también debe agregarse explícitamente a `connect-src` en la CSP de `index.html`. No use `*`.

## Privacidad y auditoría

El servicio registra únicamente:

- hash SHA-256 del usuario autenticado;
- hash SHA-256 del username consultado;
- hash SHA-256 del `entity_id` cuando se envía;
- recuentos técnicos y duración.

No registra el username ni el Entity ID en texto plano. Los resultados tampoco se persisten en el navegador: la extensión 0520 usa caché sólo en memoria y la descarta al cerrar la pestaña.

## Interpretación

Una URL devuelta por Sherlock acredita únicamente que el motor observó un perfil público compatible con el mismo username en ese sitio y momento. No acredita que la cuenta pertenezca a la persona o entidad investigada. La corroboración y eventual promoción de un vínculo deben ocurrir en una capa separada, gobernada y auditable.
