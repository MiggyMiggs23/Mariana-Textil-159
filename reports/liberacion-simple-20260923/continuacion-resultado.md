# Continuación completada: E3 servida y Tanda B instalada técnicamente

Fecha: 2026-09-23. Ejecución operativa realizada por MAIN; este cierre recoge
sus resultados y las evidencias guardadas, sin ejecutar pruebas nuevas.

## Resultado actual

- API y UI sirven `dist-simple-e3-tanda-b-20260923`. API efectiva: **PID12480**,
  con `API_STARTUP_MODE=NORMAL`, `API_INSPECTION_BOOT=1` y
  `NODE_ENV=development`; inicializadores pausados por INSPECTION.
- Workflows `artifacts/api-server: API Server` y
  `artifacts/mariana-textil: web` en ejecución, según comprobación de MAIN.
- `/api/healthz` devuelve **200**. La captura del preview combinado muestra
  el login; los 401 sin sesión son esperados. Esto **no acredita pruebas
  funcionales financieras autenticadas**.
- E3 ordinario conserva sus cuatro flags abiertos en conjunto API/matriz/UI.
  Los otros 34 flags revisados permanecen OFF, según
  `combined-source-review.json`.
- **Tanda B está instalada técnicamente, sin nuevas puertas operativas
  abiertas.** Dirigido, retenido, devolución, atribución, Fondo y remate
  siguen excluidos. E4, E12, E9, E5, E11 y E7 no se abrieron operativamente.
- Se conservaron los bundles anteriores, incluido E3. No se publicó en cloud.

## Autorización y cronología

La autorización literal se guardó antes de nuevas escrituras DB en
`reports/autorizacion-continuacion-simple-20260923.txt`; se conserva también
la autorización previa del procedimiento simple.

1. El operador delegado informó inicialmente que no podía arrancar servicios
   ni workflows por su alcance. Fue una limitación de delegación, no un
   fallo de infraestructura ni un nuevo intento de configuración fallido.
   MAIN asumió la ejecución; **ese bloqueo ya no es el estado actual**.
2. Se prepararon temporales TOML E3, renderizando el comando con
   `JSON.stringify`, y se validaron con el parser real `python3.tomllib`
   y `bash -n`. Se preservó el resto de configuración.
3. MAIN sirvió la UI E3 en el puerto 18097 y comparó HTML, favicon y assets
   byte a byte contra el directorio E3: PASS (`ui-e3-port-proof.json`).
   Ambas configuraciones E3 fueron aceptadas; se reiniciaron los workflows.
   E3 quedó en API PID10692, health 200 y captura con login visible.
   **No se repitieron los dos SQL E3 en la base efectiva:** ya tenían COMMIT.
4. `main.mjs rehearse tanda-b continuacion` terminó PASS: fixture, los dos
   SQL E3 y los cinco de Tanda B, ocho archivos COMPLETED/exit0 en PostgreSQL
   desechable. Candidato health200; `pgStopExit=0`,
   `disposableDestroyed=true`. Evidencia:
   `rehearse-tanda-b-continuacion/status.json`.
5. `main.mjs apply tanda-b continuacion` usó la API efectiva PID10692.
   Los cinco SQL se ejecutaron consecutivamente: todos COMPLETED/exit0 y
   COMMIT, sin fallo intermedio. Se preservaron los logs SQL y el estado en
   `apply-tanda-b-continuacion/`. No hubo rollback DDL.
   Los campos de health/cluster del modo apply no son comprobaciones de
   arranque: éste se verificó separadamente después.
6. MAIN cambió únicamente el nombre de dist en los temporales para el
   combinado; validó nuevamente parser TOML y `bash -n`. Sirvió la UI en
   18097 y comparó HTML, favicon y assets byte a byte: PASS
   (`ui-combined-port-proof.json`). Aplicó la configuración y reinició los
   workflows API/UI combinados, quedando API PID12480.
7. MAIN verificó health, puertas HTTP y captura de login combinado.
   Eliminó las instantáneas privadas de filas de ensayos/aplicaciones.
   No se incluyen copias de usuarios ni credenciales en esta entrega.

## Comandos exactos y validación de UI

Comando UI E3 validado y servido en el puerto de prueba:

```sh
cd /home/runner/workspace/artifacts/mariana-textil && exec pnpm exec vite preview --config vite.config.ts --outDir dist-e3-apertura-20260922 --host 0.0.0.0 --port "$PORT" --strictPort
```

Comandos actuales, extraídos de los TOML efectivos:

```sh
cd /home/runner/workspace && API_STARTUP_MODE=NORMAL API_INSPECTION_BOOT=1 NODE_ENV=development exec node artifacts/api-server/dist-simple-e3-tanda-b-20260923/index.mjs
```

```sh
cd /home/runner/workspace/artifacts/mariana-textil && exec pnpm exec vite preview --config vite.config.ts --outDir dist-simple-e3-tanda-b-20260923 --host 0.0.0.0 --port "$PORT" --strictPort
```

La prueba previa usó el comando UI literal extraído del temporal con
`PORT=18097`, `BASE_PATH=/` y acceso por `http://127.0.0.1:18097/`.
`--strictPort` evita aceptar silenciosamente otro puerto. Los archivos
`ui-e3-port-proof.json` y `ui-combined-port-proof.json` registran PASS,
`htmlExact=true` y las rutas de los tres assets comparados.
El servicio UI efectivo conserva PORT20329 y BASE_PATH=/; API, puerto8080.
No hubo un nuevo error de configuración que requiriera detener o probar
variantes. No se modificó la regla vigente en `replit.md`.

## Puertas comprobadas por HTTP

Evidencia: `combined-http.json`.

| Ruta | Estado | Resultado |
|---|---|---|
| `/api/healthz` | 200 | `status: ok` |
| `/api/e7/disponibilidad` | 200 | `enabled: false` |
| `/api/e7/atribucion` | 403 | `E7_DISABLED` |
| `/api/e5/cobros` | 403 | `E5_DISABLED` |
| `/api/e11/identidad` | 403 | `E11_DISABLED` |

La revisión de 34 flags OFF es evidencia de configuración del candidato;
no se presenta como 34 pruebas funcionales independientes desde pantalla.

## Qué falta probar desde pantalla

Con sesión y permisos correspondientes, el propietario debe verificar:

- Visibilidad y autorización según usuario/rol.
- Abono ordinario en efectivo, selección de destino/caja y actualización
  del saldo y reflejo contable.
- Emisión, impresión y reimpresión del recibo.
- Que los botones y operaciones excluidas permanezcan cerrados: dirigido,
  retenido, devolución, atribución, Fondo, remate y funcionalidades de Tanda B.

La carga del login y health200 no sustituyen estas pruebas. No se declara
la UI financiera completamente probada ni se realizaron operaciones
sintéticas sobre la base real para aparentar esa validación.