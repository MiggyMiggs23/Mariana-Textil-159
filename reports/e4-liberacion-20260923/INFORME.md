# E4 — liberación del 23 de septiembre de 2026

## Resultado

**E4 abierto en API y pantalla. E12 continúa cerrado**, incluidos Fondo y mezclas.
Autorización literal: `autorizacion.txt`.

Se sirve `dist-e4-20260923` en ambos workflows; se conservan los bundles previos.
API arrancada con mantenimiento pausado, PID observado 33784; salud HTTP 200
`{"status":"ok"}` antes de reiniciar la UI. Ambos workflows están RUNNING.
No se necesitó SQL nuevo ni se repitió SQL en la base de la aplicación.
No se ejecutó purga ni se crearon operaciones de prueba en esa base.

## Comportamiento liberado

- Extraordinarias en Mariana, Coco y Cruces, por SUPERVISOR/CAJA de su tienda,
  con permiso real de captura, sesión abierta, monto positivo y motivo obligatorio.
- Saldo calculado por el lector canónico de caja, independiente de E12, bajo
  candado de sesión. Dos retiros concurrentes no pueden gastar el mismo saldo.
- Insuficiencia bloqueada. ADMIN puede desbloquear **solo una extraordinaria**
  con motivo obligatorio; se conserva actor, fecha, saldo anterior, importe y
  motivo en la salida y auditoría. Las revisiones conservan esa evidencia.
- ADMIN acepta o reclama. SUPERVISOR de la tienda responde al reclamo con
  explicación. Revisar no vuelve a descontar dinero.
- Proveedor exclusivamente Mariana, activo, caja física y límites duros de
  efectivo y deuda, sin desbloqueo ADMIN. Pago al proveedor y salida física
  quedan en la misma transacción; el fallo de auditoría revierte ambos.
- La captura proveedora anterior sin E12 solo registraba una salida de caja:
  se corrigió para usar el registro canónico de pago y reducir deuda realmente.
- El endpoint rechaza campos desconocidos de E12/Fondo/mezclas, en lugar de
  ignorarlos y convertir silenciosamente la petición en otra operación.
- UI con saldo fresco antes de confirmar, bloqueo de doble envío, UUID
  conservado en reintentos e historial visible. Una sola superficie de captura.

Se preservaron E3 ordinario, remate, precio mínimo, borrado individual y E11
limitado. No se abrieron dirigido, retenido, devolución, atribución ni Fondo.
No se ampliaron permisos ni alcances entre tiendas.

## Pruebas y límites

**PostgreSQL desechable: PASS.** Se preparó esquema/seed canónico aislado,
se aplicó allí el SQL E4 ya existente y se ejecutaron las funciones reales
`crearSalidaDineroCaja` y `registrarPago` en transacciones PostgreSQL.

Incluye CAJA y SUPERVISOR en cada una de las tres tiendas, alcance denegado
entre tiendas, insuficiencia, ADMIN con motivo e historial persistido,
reintento después de cambiar saldo, retiros concurrentes, revisión sin nuevo
descuento, deuda de proveedor, rechazo del desbloqueo de proveedor y rollback
atómico por fallo deliberado de auditoría.

Terminó con `E4_DISPOSABLE_PG_PASS` y
`E4_DISPOSABLE_CLUSTER_DESTROYED_PASS`. Se comprobó eliminación del clúster.
Evidencia: `disposable-pg-stdout.txt` y `disposable-pg-cleanup.txt`.
Runner específico: `lib/db/src/run-e4-isolated-tests.mjs`; no se alteró
el manifiesto histórico de 28 suites.

Además:
- Pruebas enfocadas E4/E12/E11: 85 PASS; última suite E4: 37/37.
- Typecheck API, UI y workspace: PASS.
- Compilaciones API/UI y conservación de gates: PASS; `build-final.md`.
- Pruebas DOM de componentes reales y mutantes negativos: 21 casos aprobados
  en la corrida completa anterior a consolidar el padre. Consolidación:
  casos enfocados aprobados. La última corrida completó también esos 21 casos,
  pero su estado global fue `FAIL_SOURCE_CHANGED` porque otro trabajador
  agregó el runner PG durante la fotografía global del árbol; **no se informa
  esa corrida global como PASS**. No cambió la fuente UI medida.
- Los detalles e intentos de preparación están en `ui.md` y
  `backend-support.md`. Los directorios de evidencia DOM citados en `ui.md`
  se conservaron íntegros, con sus rutas originales, dentro de
  `ui-evidence.tar.gz`; se retiraron únicamente sus copias de trabajo.
- Arranque y salud: `runtime-api.log`, `runtime-ui.log`.
- Captura visual de la pantalla de acceso correcta. No se declara un recorrido
  autenticado completo en navegador: la prueba financiera fue en PostgreSQL
  aislado y la interacción fue comprobada mediante DOM.

## Qué probar desde la pantalla

Usar únicamente los datos de prueba de este período; estos ejercicios sí
registran salidas y, en el caso del proveedor, pagos reales dentro de la app.

1. **Acceso y tres tiendas.** Con CAJA y SUPERVISOR asignados a cada tienda,
   entrar a **Caja Operativa → Salidas de dinero**, con sesión abierta.
   Registrar una extraordinaria pequeña y un motivo identificable.
   Comprobar que aparece una sola vez y reduce el efectivo esperado.
2. **Motivo obligatorio.** Intentar registrar sin motivo: debe impedirlo.
3. **Saldo insuficiente.** Con CAJA/SUPERVISOR, intentar un importe superior
   al efectivo esperado: debe bloquearse sin crear la salida.
4. **Excepción ADMIN.** Intentar una extraordinaria insuficiente sin motivo
   de desbloqueo: debe bloquearse. Completar el motivo y registrar; recargar y
   comprobar que el desbloqueo y su evidencia siguen visibles en el historial.
5. **Aceptar y reclamar.** Usar dos extraordinarias distintas: ADMIN acepta
   una y reclama la otra con explicación. SUPERVISOR de esa tienda responde
   al reclamo; ADMIN puede revisarla después. Ninguna revisión debe volver
   a descontar el importe. Una aceptada no se usa para ensayar el reclamo.
6. **Proveedor duro.** Solo Mariana debe ofrecer esta captura. Con proveedor
   activo y deuda, probar un pago pequeño y revisar salida/deuda. Intentar
   superar el efectivo o la deuda: debe bloquearse incluso para ADMIN,
   sin opción de desbloqueo.
7. **Cierres y límites.** No deben aparecer Fondo ni mezcla. Un usuario no
   ADMIN no opera otra tienda; una sesión cerrada no acepta nuevas salidas.

La aceptación desde pantalla es adicional a las pruebas aisladas realizadas,
no un reemplazo de ellas.