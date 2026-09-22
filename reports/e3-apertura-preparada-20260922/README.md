# E3 ordinario con efectivo — preparado y ensayado, NO liberado

La preparación de Parte 2 no ejecuta fase B ni autoriza por sí misma un cambio
operativo. La fuente de desarrollo sigue OFF. La decisión vigente es permiso
de recaptura configurable, default ADMIN; E1 excluye CONTADOR, SISTEMAS y
BODEGA incluso con permiso. No se agregó veto ADMIN en código.

## Evidencia aceptada

`evidencia/arranque-candidato-r1b/candidate-start-results.json` y
`integration-cash.json`: ensayo PostgreSQL nuevo, esquema sin filas reales,
SQL01+SQL03, wrapper real INSPECTION, health200, workers en rutas absolutas,
registro efectivo de auditoría PID11847 y preservación de catálogo, hashes
deterministas de todas las filas y secuencias con is_called antes/después
del arranque. Las escrituras funcionales sintéticas se realizaron DESPUÉS
de esa comparación, exclusivamente en ese cluster; fue detenido y destruido.

Once casos funcionales incluyen HTTP preview/confirm efectivo, cadena FK de
operación/movimiento/recibo, replay, recaptura ADMIN por defecto y personalizable
para SUPERVISOR/CAJA/TERMINAL, exclusión E1, rollback al fallar última auditoría,
retry y rechazo por FK/inmutabilidad. Tres defectos aislados: SQL04 vuelve a
cerrar efectivo; concesión prematura rompe la expectativa default-deny; fallo
de auditoría impide confirmar y no deja filas financieras parciales. La
sensibilidad a cambios de valor manteniendo conteo se verificó por separado.
No se afirma que estos once casos cubran todos los cruces de FIFO/transferencia
ni que sean pruebas de operaciones realizadas contra la API operativa.

La política E2 de append conserva WARNING no bloqueante en wrapper, pero el
ensayo exige el registro efectivo válido. INSPECTION no ejecuta initializers,
backfills ni monitor; el esquema restaurado ya contiene funciones/triggers.

## Incidencias, conservadas sin convertirlas en verde

- R0 no era operativo cash: gate fuente E1 cerrado y finalización E2 cerrada.
  MAIN atribuyó únicamente la primera confirmación a CreditEvidenceError.
  Respondió500 por falta de mapeo E3; la segunda causa no quedó observada.
  SQL04 no quedó probado por R0. Véase `evidencia/r0-attribution.json`.
- Se añadió gate ordinario independiente OFF en fuente, habilitado solo en
  snapshot, y mapeo local E3 de CreditEvidenceError. Ningún gate dirigido,
  devolución, retenido, atribución, remate o Fondo se habilitó.
- R1 falló al leer la línea INSPECTION antes de estar disponible. La carrera
  de Pino es hipótesis, no causa retrospectivamente acreditada. R1b esperó
  acotadamente sin retirar ninguna aserción y pasó.
- R0/R1 y sus destrucciones permanecen en evidencia. El output API R0 está
  archivado; no es el output de liberación.

## Fuente exacta y reproducción

Base git `eb07aa3947f16d8964d46f3b0b56d40f7f157d19` **más correcciones sin
commit durante preparación**, no una base limpia: `source-corrections.patch`,
`source-manifest.json` y `activation.patch` describen la procedencia. La fuente
física final está en `source/`. Los cuatro cambios de activación son E3 API,
E3 UI, matriz y nuevo gate de efectivo exclusivamente ordinario.

Los node_modules de staging eran enlaces de build, no fuente inmutable:
se registra su resolución en `build-dependency-links.json` y se retiran al
sellar. No se entregan enlaces mutables dentro del paquete. pnpm-lock.yaml y
metadatos de paquetes están congelados. `tooling/` conserva los preparadores
y antecedentes usados. Para reproducir, usar un entorno aislado que reconstruya
las mismas rutas absolutas y dependencias del lock, nunca recompilar encima
del paquete entregado. Cambiar rutas puede cambiar el hash por sourcemaps y
workers. No se afirma una segunda compilación byte-idéntica no ejecutada.

`release-assets.sha256` verifica outputs finales y controles runtime únicamente;
no depende de fuentes vivas ni de Tanda B. `manifest.json` fija procedencia,
estado y evidencias; `package-integrity.sha256` cubre integralmente los archivos
físicos del paquete y outputs. El checksum externo de ese inventario evita
circularidad. La fase B fija manifest e inventario runtime; no se autoautoriza.

## Límites operativos

SQL02 NO es una reversión válida después del primer recibo ni restaura B0
exactamente: retiene permisos. Reversión de emergencia: detener escritores,
restaurar SQL04 y mantener lector compatible/evidencia. Restaurar un backup
completo solo sin perder transacciones posteriores, tras verificación y
conciliación explícitas. Retiro dirigido/retenido, devolución, atribución,
Fondo y remate siguen cerrados.

No se modificaron workflows ni el proceso operativo PID3800 por estos scripts.
La captura real fue READ ONLY de su conexión efectiva. E2 y paquete CLOSED
anterior solo se leyeron. MAIN verifica su preservación global y conserva el
informe único; este paquete no sustituye ese informe ni ejecuta Tanda B.