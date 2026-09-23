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

Revisión de Parte 1: `eb07aa3947f16d8964d46f3b0b56d40f7f157d19`.

## Parte 2 — preparada, verificada y entregada; no liberada

Las decisiones nuevas sustituyen la exclusividad ADMIN anterior en `replit.md`
y `reports/prompt-u-respuestas-2026-09-18.md`: recaptura por permiso de matriz,
ADMIN por defecto, personalizable para otros actores permitidos por E1, sin
veto ADMIN fijo. CONTADOR, SISTEMAS y BODEGA continúan excluidos por E1. La
liberación propuesta abre efectivo ordinario, no dirigido/retenido, devolución,
atribución ni Fondo.

Paquete sellado: `reports/e3-apertura-preparada-20260922/`.
Outputs finales: `artifacts/api-server/dist-e3-apertura-20260922/` y
`artifacts/mariana-textil/dist-e3-apertura-20260922/`.

| Elemento | SHA-256 |
|---|---|
| API candidata | `44e27767ca02ee21b8ba0cdcea56331adcb949229df942a8b2387dc306dfcbd6` |
| Manifiesto | `c61e63cb4da2ac3227b2fd1450779b140498f3fae1d9722a243cf5097af21201` |
| Inventario runtime | `769372ea19bfb79009f26393ccf9192c3b8bd6cebcbc08aa85d9dedfef81cfc0` |
| Inventario integral del paquete | `159fee6dd3a1387dc945389c7c43341f8ffd7fea61de938512f031f9e8640388` |
| Fase B final para autorizar | `8eebf2fdae6bdce1393a9b359c3dfcbba06d9c20d3a0bcdbab523d4d80e3a742` |

La base de procedencia es `eb07aa3947f16d8964d46f3b0b56d40f7f157d19` **más**
`source-corrections.patch` y `activation.patch`, ambos fijados en el manifiesto.
No se presenta como una compilación de HEAD limpio. El snapshot físico permite
conservar el candidato mientras Tanda B modifica las fuentes vivas; el preflight
no depende de hashes de esas fuentes vivas.

Solo el snapshot abre E3 ordinario, matriz y la excepción de efectivo ordinario.
La fuente de desarrollo conserva OFF. Se corrigieron los consumidores E1/E2
para esa excepción acotada y la traducción local de `CreditEvidenceError` en
rutas E3, sin cambiar el manejador global ni abrir otros productores.

**Verificaciones:**

- Captura de expectativas con conexión efectiva del PID 3800, READ ONLY con
  ROLLBACK; dump solo esquema, sin copiar usuarios ni datos operativos.
- Reconstrucción fiel B0 y SQL 01 + SQL 03 exclusivamente en PostgreSQL nuevo.
  B1 catálogo `2cffb4df1f91f827e1a48e6049dfb0f65ebf386bafec17060acdc0f91b99dd16`;
  atributos `e360831b5e3d0ea63408d8c592d4bc88ea33eb0340d3e25896e2b6feb50cfe24`.
- Arranque real aceptado `r1b`: preflight, modo INSPECTION, healthz 200, workers
  absolutos y registro efectivo de arranque de PID 11847. Catálogo, hashes de
  filas y secuencias con `is_called` idénticos antes/después del arranque.
- Once casos funcionales HTTP aprobados: cobro efectivo, movimiento/operación/
  recibo relacionados, reintento idempotente, recaptura por permisos y exclusión
  E1, atomicidad completa, FK e inmutabilidad.
- Tres controles con defecto: cierre SQL del efectivo, permiso prematuro de
  recaptura y fallo de la última auditoría. La escritura fallida no dejó
  movimiento, operación, aplicaciones, recibo ni incremento del contador de
  folio. Se comprobó también sensibilidad a cambios de valores con igual conteo.
- API y frontend typecheck PASS. Inventarios runtime e integral PASS.
- Todos los procesos candidatos y clusters nuevos detenidos y destruidos.

**Fallos conservados:** R0 expuso la guarda de efectivo todavía cerrada en
fuente; el log de la primera confirmación acreditó esa causa antes de llegar
a SQL. No se atribuyó causalidad a un segundo 500 sin log ni se declaró allí
probado el mutante SQL. R1 falló al exigir inmediatamente la salida asíncrona
de inspección; se conservó y se añadió espera acotada, sin quitar aserciones.
R1b es la evidencia aceptada, incluyendo el control SQL con fuente habilitada.

La fase B está en `fase-b-FINAL-PARA-AUTORIZAR.txt` y comienza:
**«a partir del momento en que el propietario pegue el texto»**.
Incluye pines, respaldo/ventana exclusiva, SQL acotado y límites de reversión.
No se ejecutó ni se recibió esa autorización. El paquete CLOSED anterior y
E2 permanecen intactos, al igual que PID 3800, workflow, bundle, log y traza.

Revisión de Parte 2: `291757c183d092dd262bf26ab242ef282cd9ed2c`.
La fase B y el README se presentaron antes de iniciar construcción de Tanda B.

## Parte 3 — Tanda B construida y verificada OFF

Esta es la sección consolidada vigente. Sustituye los estados intermedios
«en curso» o «sin iniciar» que aparecieron durante la construcción. Esos
estados fueron históricos; no son pendientes actuales. Ninguna feature de
Tanda B fue activada y su SQL preparado no fue ejecutado.

### Índice único de resultados

| Feature | Estado | Resultado aceptado | Commit |
|---|---|---|---|
| E4 | Construida y verificada OFF | Backend 34/34 y 34 mutantes; UI 21/21 y 21 mutantes; typecheck API/UI PASS | `95aa2bcc89fd5f7d6a5ea142ba6c9d403ac18000` |
| E12 | Construida y verificada OFF | Backend 40/40 y 40 mutantes; UI 33 ciclos; 15 regresiones E4; typecheck API/UI PASS | `4c5a9d263949f79709c28a2cc9102db368d07b32` |
| E9 | Construida y verificada OFF | Backend 58 ciclos; UI 59 ciclos; todos GREEN → RED semántico → GREEN; typecheck API/UI PASS | `100bdca51c09fea70475de0f5f8f798a550c2960` |
| E5 | Construida y verificada OFF | Backend 49 ciclos; UI 111 ciclos; typecheck source-only API/UI sin diagnósticos | `560246a8a26668773d2435ba1fbd0ffdc65a8893` |
| E11 | Construida y verificada OFF | Backend 60/60; UI 153/153, 459 fases; typecheck aceptado | `3a36592` |
| E7 | Construida y verificada OFF | Backend 14/14; UI 23/23, 69 fases | implementación `762c219`; evidencia `5aadfec` |

### E4

Incluye captura extraordinaria y proveedor, revisión ADMIN/SUPERVISOR,
historial, versión e idempotencia. El egreso afecta el corte
independientemente de su revisión; revisar no cambia importes. SQL y reversión
están en `reports/tanda-b-20260922/e4/`, sin ejecutar. La reversión aborta si
hay evidencia y P12 queda como dependencia explícita de E12.

Evidencia aceptada: manifests backend
`e4/logs/backend-2026-09-22T17-43-24.422Z/manifest.json` y
`e4/logs/backend-2026-09-22T17-52-41.648Z/manifest.json`; manifests UI
`e4/frontend-node-mutants-2026-09-22T18-19-01.845Z/manifest.json`,
`e4/frontend-node-mutants-2026-09-22T18-25-48.496Z/manifest.json` y
`e4/frontend-node-mutants-2026-09-22T18-32-33.050Z/manifest.json`, relativos
a `reports/tanda-b-20260922/`.

### E12

Conecta pagos FIFO y dirigidos a proveedor con reparto persistido, aprobación
sin cambiar orígenes y retorno a cada origen. Caja requiere sesión Mariana
abierta; Fondo puro no requiere turno y nunca admite sobregiro. Correcciones
contables y recuperaciones físicas son distintas. Gates OFF.

SQL y reversión permanecen preparados en
`reports/tanda-b-20260922/e12/`. Evidencia backend:
`e12/logs/backend-2026-09-22T19-31-54.810Z`; consolidación UI:
`e12/frontend-consolidation-supplement.md` y
`e12/audit-frontend-consolidation.mjs`.

### E9

Incluye envío del efectivo contado de un corte cerrado, token canónico,
conteo, autorización de ingreso al Fondo, investigación y privacidad por
tienda. Un conteo cero no autoriza asiento cero. Gates OFF y SQL no ejecutado.

Evidencia:
`reports/e9/logs/backend-2026-09-22T21-27-12.909Z/manifest.json`,
`reports/e9/frontend-node-mutants-2026-09-22T21-27-16.625Z/manifest.json` y
`reports/e9/verificacion-main.md`. El checkpoint de fuentes previo fue
`4f9de12`; el commit de cierre no reescribe ese historial.

### E5

Incluye 14 rutas, contratos regenerados, recepción separada del crédito,
propuestas, autorización parcial, favor, rechazo, devolución íntegra nunca
aplicada y documentos inmutables. SQL y reversión permanecen preparados en
`reports/e5/01-preparado.sql` y `reports/e5/02-reversion-preparada.sql`.

Evidencia backend consolidada:
`reports/e5/backend-consolidation.json` y
`reports/e5/backend-consolidation.md`. Evidencia UI final:
`reports/e5/frontend-consolidation-2026-09-22T23-24-10.888Z.json`, con
111 IDs aceptados, cero pendientes y cero manifests en ejecución.

### E11

E11 quedó construida OFF con 21 operaciones y 21 hooks, perfiles efectivos
F/A sin sustituir el rol base CONTADOR, lectores saneados, aceptación fiscal
documental y recuperación ADMIN auditada. La fuente fiscal sigue siendo
`tickets.facturado`; no se afirma CFDI ni timbrado. SQL y reversión están
preparados, no aplicados.

Los resultados fueron auditados por
`reports/e11/audit-backend-consolidation.mjs` y
`reports/e11/audit-frontend-final.mjs`. El backend usa transacciones y SQL
sintéticos; no acredita PostgreSQL, driver ni HTTP real. La UI usa transporte
controlado; no acredita navegador E2E.

### E7

E7 incorpora preview/exportación sin sustituir el estado interactivo del
Grupo 4. El detalle operativo de cuenta mantiene su lector y declara que no
representa recepción/cobranza E7. Incluye PDF/XLSX reales sobre datos
sintéticos y descarte de descargas pendientes tras revocación o cambio de
sitio. No amplía acceso de Contador A/F ni cierra otros grupos o vetos.

Los auditores MAIN aceptaron backend 14/14 e interfaz 23/23 con 69 fases.
No acredita PostgreSQL ni navegador/HTTP autenticado.

### Historial de incidencias, ya cerrado

Los fallos e interrupciones se conservaron como FAIL y nunca se relabelaron:

- E4 rechazó el primer arnés UI porque tocó temporalmente fuentes vigiladas;
  tres intentos Vitest no ejecutaron casos. El arnés sustituto usó copias,
  guardias de red/escritura y restauración verificada.
- E12 tuvo una ejecución cortada por el límite externo tras 26 ciclos y siete
  regresiones; los resultados terminales válidos se conservaron y las ocho
  regresiones restantes se ejecutaron aparte.
- E5 conservó fallos por anclas, snapshots, loaders, JSDOM, reporte DOM y
  fixtures. Ningún error de infraestructura contó como control negativo.
- E11 conservó manifests interrumpidos. El auditor backend utilizó 207 archivos
  durables y no reconstruyó stdout temporal perdido.
- E7 conserva intentos FAIL y no se presenta como una sola corrida limpia.

Estos hechos son antecedentes de la evidencia aceptada de la tabla, no estados
actuales «en curso».

### Límites comunes de Parte 3

- Todos los gates de Tanda B permanecen OFF.
- No se aplicaron migraciones de liberación ni migraciones de usuarios a la
  base de la API. La preparación SQL y los fixtures actor se ejecutaron
  exclusivamente en bases PostgreSQL desechables.
- Las pruebas sintéticas no prueban por sí mismas concurrencia PostgreSQL.
- No se liberó E3 ni se ejecutó su fase B.
- No se reinició ni modificó el workflow como parte de este cierre documental.
- Los paquetes E3, bundles, workflow y source guards quedan fuera de este
  ajuste de informe.

## Adaptación de las 28 suites actor — cierre definitivo 25/28

Revisión de código y adaptación:
`722294124ec5b69f1d56c0b280f35ee04c4f844b`.
Los logs de pruebas se incluyen expresamente en el commit de cierre documental
porque la regla general del repositorio ignora archivos `.log`.

Las 28 rutas inventariadas ya tuvieron ejecución en PostgreSQL local
desechable, pero el resultado definitivo es
**INCOMPLETE_OR_FAIL: 25/28 califican**. No se declara PASS 28/28 y no queda
ningún runtime de esta adaptación pendiente o en curso.

### Prueba positiva y mutante del parser

MAIN ejecutó las dos unitarias puras del parser con entorno vacío y sin
DB/SQL. La fuente viva produjo 2/2 PASS; el output durable está en
`reports/actor-suites/parser-green.log`
(`04b8144bcd79d5f665497cca1c46804a4182617fe52023a8e08b95feb9ed9530`).

Para la prueba roja se copió el parser fuera de la fuente viva y se
deshabilitaron en esa copia los dos guards bajo prueba: rechazo de nombre
inventado y rechazo del terminal único de archivo. Las dos unitarias fallaron
con `ERR_ASSERTION: Missing expected exception`, acreditando que ambas
protecciones son sensibles al defecto. Evidencia durable:

- copia mutante `reports/actor-suites/parser-mutant.mjs.txt`
  (`d99e554922f09df774b8d0ed663b11b4b646268fe69e44ec87d150a49bc3cc41`);
- output rojo `reports/actor-suites/parser-mutant-red.log`
  (`4c950bbc260857b04cf531175d3fe947cdf03f2ce7c6159054873fcd3c08da67`).

La prueba mutante no editó runner/harness vivos ni procedencia y no ejecutó
casos actor, helpers de negocio, SQL o DB.

La comprobación de compilación source-only `noEmit` terminó con exit 0.
En conjunto, el control del parser queda documentado como 2 rojos sensibles
en copia mutante y 2 verdes posteriores sobre la fuente viva.

### Auditoría final y cobertura

MAIN reejecutó el auditor read-only sobre diez runs V2 proporcionados
explícitamente. El resultado durable es
`reports/actor-suites/final-audit.json`:

- estado `INCOMPLETE_OR_FAIL`;
- 25 rutas calificadas;
- un solo error:
  `Missing route evidence: artifacts/api-server/src/lib/permisos.test.ts, artifacts/api-server/src/pagos-dirigidos.integration.test.ts, artifacts/api-server/src/security-api.test.ts`;
- los terminales de los diez runs acreditan `clusterDestroyed:true`;
- no hay conflicto real de target, runner, helpers o schema entre las 25 rutas
  calificadas.

Grupo 1 conserva 10 PASS durables en
`2026-09-23T05-59-00.642Z-d61d54bf`. Los prefijos y runs posteriores aportan
los otros 15 casos calificables. `pos-location` se acepta por reparse de su log
durable con hash de fuente coincidente y addendum, sin editar su manifest
histórico ni reconstruir identidad.

### Tres bloqueos exactos

1. **`permisos`** — último run
   `2026-09-23T06-21-02.689Z-562fac1c`: 29 tests, 28 PASS y 1 FAIL.
   El caso restante es BODEGA/contenedores: conflicto de política entre el seed
   que concede `V` y `pending-costs`, que revoca el acceso.
2. **`pagos-dirigidos`** — 1 test, 1 FAIL. El fallo observado es HTTP 400 por
   ausencia de evidencia E1, antes del 409 de saldo esperado. La revisión del
   contrato demuestra además que completar honestamente el flujo físico
   posterior requiere un gate que permanece OFF. No se habilitó ese gate ni
   se cambió la naturaleza del dinero para obtener un verde artificial.
3. **`security-api`** — último run
   `2026-09-23T06-26-47.484Z-db9e5d21`: 49 tests, 48 PASS y 1 FAIL.
   S26, línea 2626, prueba `numFmt(carteraC.actual)`: actual `undefined`,
   esperado `"$"#,##0.00`. Se confirmó como defecto productivo, no como
   defecto de fixture. Su corrección queda fuera del alcance de esta adaptación.

Los runs terminados por deadlock o parser permanecen FAIL/UNSAFE con sus logs,
preflight, procedencia y cleanup originales. El auditor puede aceptar PASS
anteriores y un último UNSAFE recuperable bajo hashes reales, pero no modifica
evidencia histórica ni reconstruye identidades.

Al cierre, MAIN comprobó salud HTTP 200 en los mismos workflows, sin
reiniciarlos. Esta comprobación no ejecutó llamadas actor, SQL ni escrituras DB.
No se corrige aquí el formato productivo de security ni se abren gates.

Por tanto, el estado de este documento es: **Partes 1 y 2 conservadas; features
E4/E12/E9/E5/E11/E7 cerradas OFF; Adaptación actor cerrada
INCOMPLETE_OR_FAIL con 25/28 rutas calificadas y tres bloqueos explícitos**.