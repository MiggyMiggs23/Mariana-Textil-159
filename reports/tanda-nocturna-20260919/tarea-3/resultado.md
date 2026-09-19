# Tarea 3 — cierre parcial, sin cambios de producción

## Identidad y clasificación

Revisión de trabajo: `173b7cf1373c7fb568209453721dbf510c5b1d38`.
Baseline: `80eaa93d4300e86d9be54492e634f88f0c0abc90`.
No se creó commit: lo separa el agente principal.

La fuente autoritativa es `reports/e2-verificacion-2026-09-18/baseline-backend-failures.txt`, su `baseline-backend.log` y su manifiesto. Son **cinco casos en tres archivos**, no cinco archivos. No se utilizó la lista diferente de prompt B/S.

| Caso original | Clasificación y resultado |
|---|---|
| clientes-notas-credito: deriva los tres estados sin persistirlos | Frágil: esperaba la función textual `moneyState`; el router deriva el estado canónico y su proyección legacy. Reescrito: ejecuta el GET real registrado, con saldos pendiente/parcial/pagado y dependencias permitidas explícitas. Comprueba ambos estados, saldo, importe original e identidad de movimiento. |
| clientes-notas-credito: aplicaciones en ambas direcciones | Frágil: esperaba que SQL del detalle inverso permaneciera dentro del router; hoy delega al lector. Reescrito: ejecuta ambos GET reales, observa identidad cliente/ticket/pago, importe aplicado frente al total, fecha normalizada, parámetros de delegación al lector y liberación del snapshot. El lector de pago es una dependencia simulada explícita; no se afirma haber probado PostgreSQL ni el SQL interno del lector. |
| pos-caja-final: Ticket and Note are absolute, independently processed operations | **BLOQUEADO**: archivo completo protegido. No se editó ningún caso ni otro byte del archivo. Continúa rojo. |
| pos-caja-final: authorization uses the shared ledger projection and has no override | **BLOQUEADO** por la misma restricción de archivo completo. Continúa rojo. |
| clientes-pagos: cuentaDestino y preview | Expectativa desactualizada por evidencia E1 obligatoria. Corregida mediante comportamiento del DTO real y guarda pura real; detalles abajo. |

Los otros casos ya existentes dentro de los dos archivos editados no fueron reescritos. No se tocaron las 28 suites de tarea 5.

## Diagnóstico preciso del quinto caso

**El DTO no rechaza EFECTIVO como enum.** El fixture antiguo carecía de `naturaleza`, `operacionClave` y `sitioOrigenId`. La prueba exige exactamente esos tres issue paths; la misma operación EFECTIVO con evidencia completa y cuenta destino pasa el DTO. Sin cuenta destino sigue sin pasar. El preview conserva aceptación de fecha efectiva.

Separadamente, la evidencia completa pasa `readCreditEvidenceInput` y `assertCreditPhysicalContext` (CAJA_FISICA y sesión explícita). La guarda pura real `assertCreditCaptureEnabled`, sin importar el adaptador DB de credit-evidence, rechaza ingreso físico EFECTIVO/ABONO_ORDINARIO/ABONO con 403 y mensaje de captura deshabilitada. Transferencia con cuenta fiscal y sin sesión sirve de control positivo.

**El cierre físico de efectivo es correcto**, distinto de la validación de forma del DTO. La constante de ingreso permanece cerrada. No hay defecto de producción corregido ni propuesta de abrirla. No se prueba ni modifica devolución, corte E2 ni adaptadores DB.

## Baseline y atribución en la misma sesión de validación

Se extrajeron snapshots de solo fuentes mediante `git archive`, sin ejecutarlas como aplicación, instalar dependencias, construir bundles ni conectar DB.

`run-originals.mjs` ejecuta los tres archivos originales archivados mediante transpile de TypeScript y Node test, con lista cerrada de imports. Solo permite builtins de test/lectura y el DTO real con Zod; no resuelve imports de DB.

| Ejecución | Casos | Verde | Rojo | Exit |
|---|---:|---:|---:|---:|
| Originales sobre fuentes 80eaa93d | 19 | 14 | 5 | 1 |
| Originales sobre fuentes HEAD 173b7cf | 19 | 14 | 5 | 1 |
| Dos archivos permitidos reescritos | 6 | 6 | 0 | 0 |
| Los tres archivos, incluyendo protegido intacto | 19 | 17 | 2 | 1 |

Los cinco nombres fallidos coinciden exactamente en ambos snapshots originales y con el baseline guardado. Son 19 casos de los tres archivos focales, **no** la suite completa de 126 del informe E2. `source-epoch-hashes.txt` distingue hashes baseline, HEAD y working tree: las fuentes consumidas actuales coinciden con HEAD; no se atribuyen sus diferencias anteriores frente a 80eaa93d a esta tarea.

## Mutantes reales, aislados y restaurados

Cada mutante se aplica únicamente al texto real en memoria antes de transpilarlo, en un **proceso Node separado**. No se editó ningún archivo de producción ni se sustituyó el cuerpo bajo prueba por una implementación ficticia. La ejecución siguiente carga la fuente intacta, sin selector de mutante.

| Mutante | Defecto semántico | Fallo observado | Restaurado |
|---|---|---|---|
| state | Una nota saldada devuelve estado legacy pendiente | `PENDIENTE` distinto de `PAGADA` | 6/6, exit 0 |
| payment | Invierte clienteId y pagoId al lector real delegado por el GET | 81/41 distinto de 41/81 | 6/6, exit 0 |
| evidence | Hace opcional sitioOrigenId en el DTO real | Falta el issue path exigido | 6/6, exit 0 |
| cash | Abre en memoria la constante de ingreso de efectivo | Falta la excepción esperada | 6/6, exit 0 |

Cada proceso mutante: 6 casos, 5 verdes, 1 fallo por aserción semántica, exit 1. No fueron fallos de loader, compilación o dependencia. Evidencia completa en `mutant-*.log/.exit` y `restored-*.log/.exit`.

## Ejecución reproducible y seguridad

Pruebas actuales:

```sh
node --require ./scripts/src/offline-test-guard.cjs --test \
  artifacts/api-server/src/clientes-notas-credito.contract.test.ts \
  artifacts/api-server/src/clientes-pagos.contract.test.ts
```

Mutantes: mismo comando, agregando antes de `--test`:

```sh
--import "data:text/javascript,globalThis[Symbol.for('tarea3.mutation')]='state'"
```

Repetir con `payment`, `evidence`, `cash`; ejecutar el comando sin `--import` inmediatamente después de cada uno.

Originales: extraer las rutas usadas de 80eaa93d o HEAD a un directorio temporal, y ejecutar:

```sh
node --require ./scripts/src/offline-test-guard.cjs \
  reports/tanda-nocturna-20260919/tarea-3/run-originals.mjs /tmp/directorio-extraido
```

Node v24.13.0: loader TS nativo para tests; TypeScript ya instalado para transpilar módulos completos en memoria. No es runtime build, no emite dist. El harness no importa producción por el resolvedor nativo: cada dependencia debe aparecer en su allowlist. DB y pool son adaptadores de fixture sin conexiones; sus métodos reciben pero no interpretan ni ejecutan SQL. Guarda offline existente precargada bloquea red/HTTP/DNS y elimina credenciales DB únicamente del proceso de prueba. No se cambiaron secretos, configuración de entorno persistente, dependencias, API ni workflows.

No se ejecutó typecheck raíz (lo coordina el agente principal al cierre conjunto). Las fuentes probadas se transpilaron sin diagnósticos de sintaxis.

## Archivos y hashes

Únicos archivos de código de esta tarea:

- `artifacts/api-server/src/clientes-notas-credito.contract.test.ts`
- `artifacts/api-server/src/clientes-pagos.contract.test.ts`
- `artifacts/api-server/src/tarea3-behavior-harness.mjs`
- `artifacts/api-server/src/tarea3-behavior-harness.d.mts`

Hashes exactos en `changed-files.sha256`. Evidencias y runner diagnóstico quedan exclusivamente en este directorio.

Archivo protegido intacto `pos-caja-final.contract.test.ts`: SHA256 `fb6280d489706f2e1a5b35c4e5e4f96bf90f96b3bbc5dcadb3c5f9fc5265ce2b` en baseline, HEAD y working tree.

**Resultado: tres casos corregidos y demostrados con mutantes; dos bloqueados e intactos. No se declara que los cinco hayan quedado verdes.**