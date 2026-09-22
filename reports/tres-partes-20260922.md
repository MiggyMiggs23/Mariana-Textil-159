# Tres partes — informe único

## Parte 1 — verificada, sin cambios ni reinicio

La autorización íntegra se guardó, antes de cualquier otra escritura, en
`reports/e2-liberacion-20260922/autorizacion-tres-partes-20260922.txt`.
También se guardó íntegro el mismo mensaje, que incluye la autorización de
bases desechables de Tanda B, en `reports/autorizacion-tanda-b-20260922.txt`.
Ambas copias se compararon byte por byte con el adjunto original.

El workflow real ya contenía exactamente:

```
cd /home/runner/workspace && exec bash reports/e2-paquete-liberacion-preparado-20260921/api-start-audit.sh
```

No fue necesario modificarlo ni reiniciar. Verificación:

- Workflow `artifacts/api-server: API Server`: running, puerto 8080.
- PID `3800`; `TracerPid=0`.
- Bundle `artifacts/api-server/dist-e2-20260927/index.mjs`:
  `008dfd54d93f6a1606370d44cb2086673669c51278c92ebb6a5a63f4d503e7f5`.
- Entorno del proceso: `API_INSPECTION_BOOT=1`.
- Petición autorizada a `/api/healthz`: HTTP 200, `{"status":"ok"}`.
- Traza E2 antes y después:
  `a367379f2de3eab58bffe328cf91ec5d3f5c7bb6178dd55b28547e6993ff52ea`.
- `reports/arranques-api.log` contiene el arranque de PID `3800` a
  `2026-09-22T15:31:16.789Z`, con hash completo correcto, modo inspección,
  preflight `passed` y exit 0.

No se aplicó SQL ni se escribió en la base de la API.

## Parte 2 — en preparación

## Parte 3 — pendiente de la entrega del paquete E3