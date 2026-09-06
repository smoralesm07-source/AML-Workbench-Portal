# Atlas 2026 · demos de la propuesta de rediseño

Cuatro páginas autocontenidas. Se abren directamente en el navegador (`open consola.html`), no
necesitan servidor, build ni credenciales, y no consultan Supabase ni ninguna fuente: los datos son una
muestra representativa con las magnitudes reales del ecosistema (9.782 inscritos, 429 con término de
giro y padrón vigente, 64 candidatas legibles de 1.027 brutas, pesos IPF-1.0 de
`docs/obligated-subjects-0560.md`).

Diagnóstico completo: `docs/atlas-ux-diagnosis-2026-09.md`.

| Archivo | Qué demuestra |
|---|---|
| `diagnostico.html` | El diagnóstico con sus mediciones y el plan por olas |
| `consola.html` | Demo 1 · shell, menú por pregunta, `⌘K`, rutas enlazables |
| `expediente.html` | Demo 2 · Entidad 360 por divulgación progresiva |
| `triage.html` | Demo 3 · cola operable con teclado y bitácora de decisiones |

## Qué probar en cada una

**`consola.html`**
- `⌘K` (o `Ctrl+K`, o `/`) abre el buscador: escribe `76124338`, `cambio`, `territorio` o `sanciones`.
  Flechas para moverse, `↵` para abrir.
- Haz clic en cualquier caso y mira la URL: `#/entidad/ENT-RUT-76124338`. El botón «atrás» del
  navegador funciona; recargar mantiene la sección.
- El botón de tema cambia **todas** las superficies, porque todo color sale de un token.
- «Turno» arranca con esqueletos de carga y los reemplaza por contenido.

**`expediente.html`**
- La conclusión va primero, en una frase. El puntaje llega con su credibilidad al lado.
- Pestaña «Cálculo»: la cascada IPF muestra el componente sin evidencia con trama, fuera del promedio.
- «Cómo se calculó el 78» abre el contrato completo: definición, fórmula, pesos, universo, ventana y
  limitaciones —incluida la del backtest.
- «Registrar decisión» ancla la bitácora al expediente.

**`triage.html`**
- Teclado completo: `j`/`k` mover, `r` revisada, `s` seleccionar, `d` descartar, `u` deshacer.
- `d` exige motivo: sin motivo no se guarda.
- La bitácora persiste en `localStorage`; «Reiniciar demo» la vacía.
- Caso 4 (Banco Regional del Sur) muestra la separación entre verosimilitud y accionabilidad:
  plausiblemente obligado y aun así no incorporable, declarado aparte del índice.

## Sistema de diseño

Un solo juego de tokens compartido por las cuatro páginas: fondo pizarra-verde, acento verde azulado
`#0d6a66` / `#3fbdb2`, y semánticos separados del acento (`--ok`, `--watch`, `--crit`, `--info`).
Tipografía Archivo para texto e interfaz, IBM Plex Mono para RUT, identificadores, etiquetas y
cualquier columna de dígitos. Tema claro y oscuro definidos token a token, con las tres variantes que
el navegador puede presentar: preferencia del sistema, `data-theme="light"` y `data-theme="dark"`.
