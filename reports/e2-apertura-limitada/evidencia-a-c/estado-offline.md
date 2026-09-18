# Evidencia A+C — checkpoint offline

Estado: **implementación candidata construida en fuente, inactiva y no aplicada**.

La recuperación prioritaria de la API se detuvo por el hash distinto del bundle reconstruido. Este trabajo no tocó `dist`, workflows, configuración, frontend servido ni ninguna base; no ejecutó DDL/DML, build, servidor o clon.

## Implementado

- Nuevo servicio `credit-abono-evidence.ts`, con permiso independiente `CREDIT_ABONO_REFUND_EVIDENCE_ENABLED=false`.
- Clasificación `UNUSED | PARTIAL | FULL` a partir de las asignaciones que entrega el proyector canónico; no implementa otro FIFO.
- Productor ordinario: finaliza después de proyectar y persistir las aplicaciones actuales.
- Productor dirigido: finaliza después de su aplicación dirigida; no se marca falsamente `UNUSED`.
- Transferencias y otros medios no cubiertos conservan su flujo y no exigen prueba de efectivo.
- El hook anterior que podía atestar indiscriminadamente un ABONO ahora rechaza explícitamente ese uso.
- El consumidor de devolución exige prueba positiva unida a una finalización `UNUSED` y conserva sus comprobaciones históricas.
- Arranque: ingreso y evidencia deben permanecer ambos cerrados o abrirse juntos; cuando evidencia se habilite, el preflight READ ONLY exige tablas, columnas, cinco triggers y cinco funciones exactas, incluidos cuerpos por SHA-256.
- SQL preparado:
  - finalización inmutable para cada nuevo ABONO físico cubierto;
  - prueba positiva solo para `UNUSED`;
  - validación de origen E1 y misma transacción;
  - constraint trigger diferido que impide confirmar un abono sin finalización o un `UNUSED` sin prueba;
  - ninguna reconstrucción/backfill;
  - reversión de esquema rechazada si ya existe evidencia. El rollback operativo futuro debe cerrar permisos y conservar las tablas.

El SQL E2 de devolución preparado con anterioridad queda pendiente de reconciliar: no debe aplicarse junto con este candidato porque también intentaba crear `evidencia_no_aplicada_e2`. La devolución continúa apagada.

## Verificación realizada

- Suite enfocada offline: **40/40 PASS**, incluyendo evidencia, devolución existente, modos y preflight.
- Typecheck del paquete API: **exit 0**, cero diagnósticos.
- Comprobaciones estructurales SQL offline: **PASS**.
- `git diff --check`: PASS.

No hubo prueba PostgreSQL. Por ello aún no se acreditan sintaxis/semántica real de triggers diferidos, atomicidad, locks o concurrencia. Tampoco se hizo en este checkpoint el typecheck raíz completo, comparación del manifiesto baseline ni revisión independiente final.

## Hashes del checkpoint

- Servicio: `d5d551050574c5a17fc4dfe224bd346da72c8c5e091e8a7448e406eb850e7948`.
- SQL instalación: `2a89d1a7a01ea61105fd3f2f9190c562a1bf0ef7523354373eea27553899badf`.
- SQL reversión previa a captura: `86d23ff75d2d871dad85cd48363d108ef32041801a8d02d89fefbe9158c7bae1`.
- Tests de servicio: `d4253003a770a034e384032e399a307fb26750acc20ef6c8611c88dc6d32bd34`.
- Tests estructurales SQL: `9a3422f461010e717d3ea357d218c71df8863552b1fde69ff7b9051ecfec6ebc`.

## Pendiente antes de considerar terminada la preparación

1. Revisión independiente completa de código/SQL y corrección de hallazgos.
2. Reconciliar el SQL futuro de devolución y el contrato/digest general de activación.
3. Mutantes/negativos adicionales: productor omitido, clasificación alterada, orden antes de FIFO, prueba faltante y preflight con cada objeto drifted.
4. Typecheck raíz y comparación de baseline tras congelar todas las fuentes.
5. Solo con autorización separada: pruebas PostgreSQL aisladas de instalación/reversión, commit diferido, rollback de fallos, replay y concurrencia.
6. La apertura continúa bloqueada y requerirá una decisión/autorización posterior aun cuando todo lo anterior pase.

No hay tareas hijas activas de este trabajo.