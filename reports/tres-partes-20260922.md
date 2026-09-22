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

## Parte 3 — Tanda B, construcción ordenada y apagada

### E4 — construida OFF; SQL preparado, no ejecutado

- Captura extraordinaria y proveedor explícitas, motivo y sesión abierta.
  SUPERVISOR/CAJA operan su tienda; proveedor solo Mariana. Extraordinarias
  usan caja física, sin Fondo en Coco/Cruces. Se preserva el flujo anterior OFF.
- ADMIN acepta/reclama; SUPERVISOR de la tienda responde con explicación y
  comprobante HTTPS opcional. Hay historial, control de versión, reintentos
  idempotentes y bloqueo síncrono de doble envío en captura y revisión.
- El egreso afecta inmediatamente el corte, independiente de su revisión.
  Revisar no cambia importes y se permite después del cierre.
- Permisos operativos ON desde `cobros_pagos`; OFF conserva `cortes`.
  No se concedieron permisos en la base. UI y servidor permanecen OFF.
- SQL y reversión en `reports/tanda-b-20260922/e4/`; no ejecutados.
  La reversión aborta si hay evidencia. P12 se documenta como dependencia
  concreta de E12; aceptar una salida no autoriza sobregiro.

**Verificación aceptada:** 34 pruebas backend y 34 defectos aislados
(32 originales más dos selectores de permisos); 21 pruebas sobre componentes
reales y 21 defectos aislados, con restauración GREEN. Las pruebas de interfaz
se completaron en grupos de 2, 13 y 6, conservando resultados ya válidos.
Typecheck API y frontend PASS.

Evidencia backend:
`e4/logs/backend-2026-09-22T17-43-24.422Z/manifest.json` y
`e4/logs/backend-2026-09-22T17-52-41.648Z/manifest.json`.
Evidencia de interfaz:
`e4/frontend-node-mutants-2026-09-22T18-19-01.845Z/manifest.json`,
`e4/frontend-node-mutants-2026-09-22T18-25-48.496Z/manifest.json` y
`e4/frontend-node-mutants-2026-09-22T18-32-33.050Z/manifest.json`.
Rutas relativas a `reports/tanda-b-20260922/`.

**Incidentes y límites:** el primer arnés de interfaz modificó temporalmente
fuentes vigiladas y las restauró; su evidencia queda rechazada. Se sustituyó
por copias físicas, guardias de red/escritura y entorno limpio. Tres intentos
Vitest fallaron antes de ejecutar casos y no cuentan como rojos. La alternativa
nativa detectó un timeout al reportar una aserción con un objeto DOM; se cambió
solo su representación a un booleano, sin ampliar timeout ni cambiar la
obligación, y el caso terminó correctamente. Un fixture del contenedor carecía
de los globals de navegador usados por Wouter; se completó antes de verificar
los seis casos pendientes. Todos los intentos se conservan.

La cobertura backend usa repositorios sintéticos y captura consultas del
adaptador real: no acredita ejecución PostgreSQL del SQL preparado ni una
prueba HTTP montada. La interfaz usa componentes reales con infraestructura
aislada, sin acceder a la API en marcha. PID 3800, gates OFF e inventario de
archivos protegidos fueron comprobados tras el incidente.

Commit E4: `95aa2bcc89fd5f7d6a5ea142ba6c9d403ac18000`.

### E12 — pago único caja/Fondo, construido OFF

Se conectaron los pagos FIFO y dirigidos a proveedor con reparto persistido,
aprobación sin cambiar los orígenes y retorno completo a cada origen.
La parte de caja requiere sesión abierta Mariana; Fondo puro no requiere turno.
Insuficiencia de caja admite desbloqueo ADMIN motivado e histórico; un retiro
del Fondo nunca admite sobregiro. P12 queda conectado también a E4.
Las correcciones contables y recuperaciones físicas son distintas; no se
modifica un corte cerrado. El desglose y los eventos con datos del Fondo
conservan acceso restringido. Los gates permanecen OFF.

La interfaz incluye controles editables, importes exactos en centavos,
confirmación contra disponibilidad fresca, ambas entradas de pago dirigido,
aprobación de propuesta persistida, detalle/estado de cuenta y retornos.
Conserva UUID en reintentos, bloquea doble envío y renueva la intención cuando
cambia su contenido. El retorno requerido por servidor a un usuario sin
metadatos conserva el formulario y pide un nuevo envío explícito.

SQL y reversión con preservación de evidencia quedan preparados, sin ejecutar,
en `reports/tanda-b-20260922/e12/`.

**Verificación aceptada:** 40 pruebas backend y 40 mutantes aislados PASS
(`e12/logs/backend-2026-09-22T19-31-54.810Z`); 33 ciclos de interfaz
GREEN/RED semántico/GREEN restaurado y 15 regresiones E4 GREEN.
Typecheck API y frontend PASS. El backend usa transacciones/repositorios
sintéticos: no es prueba de concurrencia PostgreSQL ni ejecución del DDL.

La consolidación de interfaz y su auditoría están en
`e12/frontend-consolidation-supplement.md` y
`e12/audit-frontend-consolidation.mjs`. Se verificaron resultados individuales,
marcadores de aserción y hashes; no se convirtió un fallo de infraestructura
en un rojo ni se relabeló un manifiesto interrumpido como PASS.

**Incidentes:** se corrigieron omisiones de la primera entrega UI antes de
probarla; seis opciones inválidas de Testing Library se detectaron en typecheck.
El mock de mutaciones omitía notificar a React después de finalizar: se
reparó según el contrato instalado, sin cambiar la obligación de retry.
Una ejecución superó el límite externo de cinco minutos después de completar
26 ciclos E12 y siete regresiones E4. Se verificaron sus resultados terminales,
se ejecutaron las ocho regresiones restantes y se compararon posteriormente
todos sus hashes de fuente. El manifiesto original sigue sin estado final;
la comparación posterior no acredita ausencia de escrituras transitorias.

Commit E12: `4c5a9d263949f79709c28a2cc9102db368d07b32`.

### E9 — construida y verificada OFF

P8 sí resuelve las preguntas de modalidad, envío y diferencias. El plan exige
recepción ADMIN única; no se consideró el antiguo pendiente de socios como
bloqueo de construcción. Contrato y evidencia de preparación en `reports/e9/`.

Se prepararon servidor, UI, contratos generados, SQL y reversión. Incluyen
envío completo desde efectivo contado del corte cerrado y token canónico
servidor, conteo, autorización de un ingreso al Fondo, investigación documental
y privacidad por tienda. Un conteo cero no autoriza un asiento cero. La lista
se integra en Cortes; el envío, en el detalle del corte cerrado.

Tras la reanudación autorizada, MAIN ejecutó **58 casos backend y 59 de
interfaz**, todos con ciclo GREEN → RED semántico → GREEN restaurado.
Ambas ejecuciones terminaron con exit 0; API y frontend typecheck PASS.
No se ejecutó SQL. Los gates continúan OFF.

Evidencia: `e9/logs/backend-2026-09-22T21-27-12.909Z/manifest.json` y
`e9/frontend-node-mutants-2026-09-22T21-27-16.625Z/manifest.json`.
El backend es sintético: no acredita concurrencia PostgreSQL ni ejecución
del DDL. La interfaz monta componentes reales con infraestructura aislada.
El detalle y los límites están en `e9/verificacion-main.md`.

Commit de cierre E9:
`100bdca51c09fea70475de0f5f8f798a550c2960`.
Las fuentes preparadas estaban en el checkpoint automático previo `4f9de12`;
no se reescribió ese historial. El commit de cierre conserva la evidencia
de verificación correspondiente.

### E5 — construida y verificada OFF

Se prepararon las 14 rutas, contratos regenerados, recepción separada del
crédito, propuestas, autorización parcial, favor explícito, rechazo,
devolución íntegra nunca aplicada y documentos inmutables. La interfaz se
integra en Caja, ficha de cliente y las tres rutas de pendientes. Durante la
revisión se corrigieron permisos, recuperación de intenciones y correspondencia
de respuestas antes de mostrar éxito. Las puertas permanecen `false`.

SQL y reversión están en `e5/01-preparado.sql` y
`e5/02-reversion-preparada.sql`; **no ejecutados**. Incluyen extensiones E1
acotadas, procedencia de inserción sin `xmin`, guardas de conservación e
inmutabilidad y cierre DML E5. La revisión corrigió el rechazo de lotes de
múltiples recepciones y la incompatibilidad con consumo FIFO futuro del favor.
Esto es revisión de fuentes, no prueba PostgreSQL.

**Backend:** MAIN ejecutó 49 ciclos distintos GREEN → RED de aserción
específica → GREEN restaurado. `e5/backend-consolidation.json` y
`e5/backend-consolidation.md` conservan la procedencia por snapshot y sus
comparaciones; los manifiestos interrumpidos/fallidos no se renombraron PASS.
La auditoría estática consolidada no ejecuta pruebas nuevas. Son pruebas
sintéticas y capturas SQL: no acreditan PostgreSQL ni routing HTTP integrado.

**Interfaz:** 111 ciclos terminales GREEN → RED de aserción específica →
GREEN restaurado, consolidados entre ejecuciones. Los últimos 84 terminaron
con exit 0. Auditoría final:
`e5/frontend-consolidation-2026-09-22T23-24-10.888Z.json`;
111 IDs aceptados, cero pendientes, cero manifiestos en ejecución.
La auditoría conserva hashes, declaraciones, helpers y la procedencia
documentada cuando el entorno eliminó snapshots temporales.

Los fallos conservados incluyen anclas ambiguas, dependencias de snapshot,
loaders de imágenes y APIs JSDOM faltantes, un timeout de reporte al adjuntar
DOM/React a una aserción y fixtures desactualizados respecto del adaptador.
Se corrigieron sin contar errores de infraestructura como controles negativos.
Typecheck completo source-only de API y frontend: cero diagnósticos.
La primera invocación API conservaba un rootDir limitado al artefacto y produjo
nueve TS6059 por imports relativos entre proyectos; se corrigió sólo la
invocación noEmit, usando raíz workspace, sin editar tsconfig ni generar dist.
Ambos logs permanecen en `e5/typecheck-*-main.log`.

No se acredita PDF físico ni validación visual de la aplicación activa:
la captura de preview falló al estar los workflows detenidos. No se reiniciaron
para obtenerla; las pruebas montadas se ejecutaron sin utilizar la API.

Durante esta continuación el entorno volvió a informar ambos workflows
detenidos y retiró snapshots temporales. Se continúa OFF conforme a la
autorización; MAIN no emitió otro reinicio. El inventario de archivos protegidos
volvió a coincidir, excluyendo únicamente el log de arranque ya documentado.

### Pausa por cambio de entorno

Al preparar la validación E9, el entorno informó ambos workflows
`not started`. La comprobación de `/proc/3800/status` confirmó
`API_PID_3800_NOT_PRESENT`. No se conoce la causa de la detención.
MAIN y el agente backend no ejecutaron órdenes para detener, iniciar o
reiniciar la API durante esta tanda; no se intentó recuperarla sin autorización.
El agente backend recibió la pausa y confirmó que dejó de modificar fuentes.

Después de detectar el cambio se ejecutó:

`sha256sum --check --quiet reports/tanda-b-20260922/protegidos-inicial.sha256`

Resultado: **PROTECTED_INVENTORY_PASS**. El paquete E3 entregado y los archivos
protegidos conservan sus hashes. Esto acredita integridad de archivos, no
disponibilidad de procesos ni ausencia de efectos históricos de otros actores.
El resultado operativo correcto de Parte 1 era válido cuando se comprobó;
no se presenta como estado operativo actual.

Al producirse esa pausa, la revisión completa validada más reciente era E12
y E9 estaba sin validar. La comprobación posterior de E9 figura arriba.
La fase B de E3 sigue sin ejecutarse; no se autoriza ninguna liberación.

### Trabajo restante

- Construir OFF E11 y E7, en ese orden y cada una en su commit.
- Adaptar las suites creadoras de usuarios a PostgreSQL desechable.
  El inventario por puntos reales de creación encontró **28**, no 25.
  No se descartaron arbitrariamente tres ni se adaptó todavía ninguna.
- Completar este mismo informe y la verificación final después de reanudar.

Este informe es una **entrega de estado con trabajo pendiente**, no una
declaración de cierre de las tres partes.

### Reanudación autorizada y comprobación posterior

El propietario autorizó continuar OFF y reanudar exclusivamente el workflow
API sin cambiar comando, bundle ni modo. Su texto literal quedó guardado
como primera escritura en
`e2-liberacion-20260922/autorizacion-reanudacion-workflow-api.txt`.

La API ya estaba ejecutándose al verificar; MAIN no ordenó un segundo arranque.
Se comprobaron PID **110**, `TracerPid=0`, hash E2 completo coincidente,
modo INSPECTION efectivo, healthz **200** y registro de arranque.
La revisión directa del bundle confirma el camino de arranque no escritor;
no existe una comparación de datos antes/después de esa reanudación.
Evidencia y límites en
`e2-liberacion-20260922/verificacion-reanudacion-workflow-api.md`.

La pausa anterior queda resuelta para continuar la construcción OFF.
No se ejecutó fase B, SQL ni apertura de puertas.

El inventario protegido se volvió a comparar: no hubo diferencias inesperadas.
La única diferencia fue la línea autorizada del arranque PID 110 en
`arranques-api.log`; al excluir exclusivamente esa última línea, el hash del
prefijo coincide exactamente con el inventario original.