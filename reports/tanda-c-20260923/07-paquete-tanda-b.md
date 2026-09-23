# Control MAIN posterior al ensayo

Tras el FAIL de reconstrucción, MAIN comprobó por lectura el PID 191 (inicio
2026-09-23 07:33:24), la ruta del bundle E2 y su SHA-256
`008dfd54d93f6a1606370d44cb2086673669c51278c92ebb6a5a63f4d503e7f5`.
`GET /api/healthz` respondió `{"status":"ok"}` mediante el proxy.
No hubo reinicio ni cambio de workflow. Este control de proceso/disco/salud
no sustituye el arranque comparativo en una base desechable fiel, que quedó
pendiente. Tampoco demuestra los bytes cargados en memoria por el proceso.

# 07 — Paquete Tanda B OFF: BLOCKED

**No listo para liberación. Sin autorización, sin sello de éxito, sin commit.**

Preparado desde `1031a630fd461c3df89767bad7a14cc777e56261` en
`reports/tanda-b-off-preparada-20260923`, con API/UI en sus directorios nuevos
`dist-tanda-b-off-20260923`. Todas las puertas E3/Tanda B OFF; sin activation.patch.
Fuente, builds, las 23 salidas y sus hashes están documentados en el README
del paquete, `source-manifest.json`, `manifest.json` y `release-assets.sha256`.
API SHA256: `970c806fa3759a9aa72b57648ff6813a81cef64d703e05e26f17407fa6a79190`.
UI index.html SHA256: `118cfee92b28955f81685aeb0bc6d5c4d99f7233e5e5c681403aad5feaa64af6`.

## Ejecutado y no ejecutado

| Control | Resultado / evidencia bajo el paquete |
|---|---|
| Builds aislados API/UI y auditoría estática | PASS; build-api.log, build-ui.log, evidencia/static-audit.json |
| Captura real READONLY contra PID191, sin actores/credenciales conservadas | MAIN PASS; evidencia/capture-cli.json y evidencia/live/read-only-capture.json |
| Preflight real CLI, token positivo y exit 0 | MAIN PASS; evidencia/preflight-cli.json |
| Rehearsal PostgreSQL16 nuevo, reconstrucción schema-only | MAIN FAIL atributos; evidencia/rehearsal-r1/catalog-fidelity.json |
| Cleanup del desechable | MAIN postgresStopExit=0, disposableDestroyed=true; terminal.json |
| Arranque candidato, preservación startup, pruebas funcionales | NO EJECUTADOS: bloqueo antes del boot |
| Control bundle E2 actual | NO ARRANCÓ sobre fixture infiel; no reinició API actual |
| Comprobación final runtime de lectura antes de entregar | PENDIENTE de MAIN |

## Diferencias exactas (comparación offline, sin nueva DB)

1585 filas de esquema idénticas; 902 atributos en cada catálogo.
Únicamente seis enumsortorder de `rol_usuario` difieren:
TERMINAL 1.5→2, CAJA 2→3, SUPERVISOR 3→4, BODEGA 4→5,
SISTEMAS 5→6, CONTADOR 6→7 (real→reconstruido).
ADMIN=1 y el orden relativo de etiquetas coinciden. Los 42 atributos de
triggers coinciden; no se detectaron diferencias de tgenabled u otros
atributos representados fuera de esas seis filas enum.

- schema hash igual: `89c445d53c3db7d8cb3a45bdab49f82acb12943d62084eced21ab3af5cf5a358`.
- attributes real: `597213c727c1b825a480720b0484badf26c17a02309fba8cd57d72af0e7a7665`.
- attributes fixture: `a8389a4be6f0765a58849a425e742fc941821fbdf9c6fab0fa9c1eeb428d5ec6`.

Se conserva r1 sin alteraciones, incluido el booleano declarativo
`rawEnumAndTriggerAttributesPreserved:true`, que no demuestra preservación y
queda contradicho para enums por los datos y el FAIL. El diagnóstico adicional
es `evidencia/comparacion-r1-offline.json`; no es control sintético atribuido
a base real. No se ha reparado ni normalizado catálogo, ni rebaselinado hashes.

## Cierre bloqueado y siguiente decisión

Manifiesto e inventarios preliminares archivados en `antecedentes/preliminar`;
manifiesto actual BLOCKED e inventario final coherente conservan trazabilidad.
Integridad documental no autoriza fase B. Fase B sigue **NOEJECUTABLE**.

Se requiere decisión explícita antes de cualquier mecanismo que reconstruya
fielmente los atributos del fixture. No hay permiso para reparar la base real
o suavizar expectativas. Quedan después pendientes arranque/preservación en
desechable fiel, controles negativos de gates/identidad/hash/catálogo,
sensibilidad de fila e integración HTTP con puertas cerradas.
Control E2 actual previsto (no ejecutado):
`008dfd54d93f6a1606370d44cb2086673669c51278c92ebb6a5a63f4d503e7f5`.
Su asociación de disco a PID191 no acredita bytes cargados en memoria.

Esta finalización solo compara y documenta archivos. Sin nueva conexión DB,
SQL, build, arranque, integración o commit. MAIN conserva la responsabilidad
de su comprobación final de runtime mediante lectura antes de entregar.