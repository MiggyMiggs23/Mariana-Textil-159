# A + C: integración propuesta antes de implementar

**Estado posterior:** el propietario aprobó este diseño y autorizó construir offline. Se produjo una implementación candidata inactiva y se pausó en un punto coherente al fallar la reconstrucción prioritaria del bundle. Tiene 40 pruebas focalizadas aprobadas y typecheck API sin errores, pero no está terminada ni verificada para apertura. Faltan revisión independiente, reconciliación SQL, negativos ampliados y validación global; ver `evidencia-a-c/estado-offline.md`. El texto siguiente conserva el diseño aprobado.

## Decisión y límites

El propietario eligió A + C: conservar evidencia desde el primer abono y decidir aparte cuándo abrir la captura. Acepta que devolver no sea inmediato; no acepta perder una futura devolución elegible por falta de evidencia.

Este documento presenta el diseño solicitado. **No autoriza ni ejecuta implementación, SQL, arranque o activación.** La apertura sigue bloqueada hasta construir y verificar la evidencia, y después requiere autorización separada.

Regla vigente: devolución del **importe íntegro nunca aplicado**. Abonos ya aplicados o parcialmente usados quedan fuera. No se altera FIFO, ni se convierte un sobrante parcial en un abono nuevo para hacerlo devolvible.

## Dos hechos distintos

1. **Origen de todo abono físico:** ya lo conserva el movimiento E1 inmutable, con identidad de operación, cliente, importe, actor, naturaleza, forma/cuenta, sitio y sesión. No propongo duplicar ese origen en otra tabla independiente.
2. **Constancia de su evaluación al recibirlo:** una finalización inmutable para cada abono físico, vinculada al origen E1. El ordinario registra la proyección canónica vigente (`projectCreditLedger`); el dirigido registra su aplicación íntegra existente después de persistirla (`directedApplication`, resultado FULL). No se atribuye al dirigido una proyección posterior que no ejecuta.

La prueba positiva `evidencia_no_aplicada_e2` conserva un significado estricto: solo se crea cuando el importe sigue íntegro y nunca se ha aplicado según el modelo canónico y su historia.

Así, un abono aplicado conserva origen y constancia, pero no recibe un certificado falso de “nunca aplicado”. Su exclusión de devolución procede de la regla acordada, no de haber olvidado registrar su recepción.

## Integración en la misma transacción

1. Conservar la reclamación/idempotencia de operación E1 y los bloqueos actuales de cliente y documento; no reordenar el flujo de reparto.
2. Insertar el abono físico mediante el productor E1 existente.
3. Ejecutar exactamente la proyección y las aplicaciones ordinarias o dirigidas actuales.
4. **Después del reparto**, el ordinario usa la proyección canónica y la comprobación histórica existentes. El dirigido conserva la validación previa de saldo y la aplicación íntegra actual al destino solicitado; después de escribirla registra FULL y su procedencia `directedApplication`. No añade otra proyección/FIFO ni cambia saldos o reparto. La mera ausencia de filas en `aplicaciones_credito` no basta para declarar UNUSED.
5. Guardar la constancia final, ligada a la misma operación y transacción. Contendrá referencia al origen, resultado, importes evaluados, versión del contrato/proyector y datos suficientes de la evaluación para auditarla.
6. Solo para el importe íntegro nunca aplicado, registrar además la prueba positiva vinculada a esa constancia.
7. Completar la auditoría y confirmar la transacción. Si falta la constancia o falla una prueba positiva obligatoria, abortar toda la operación; no confirmar el abono sin evidencia ni responder éxito.

Los errores revierten filas de abono, aplicaciones, constancia, prueba y auditoría de la transacción. Los huecos de secuencia propios de PostgreSQL no equivalen a movimientos financieros confirmados y no se intenta revertirlos.

## Por qué no basta conectar el hook

- El hook actual exige que la devolución esté habilitada. Se separará **registrar evidencia** de **entregar dinero**, conservando cerrado el permiso de devolución.
- Su validador actual rechaza abonos con aplicaciones. Invocarlo para todos rompería pagos legítimos.
- La proyección puede contener consumo implícito que no se demuestra consultando únicamente `aplicaciones_credito`. Una condición SQL “cero filas = nunca aplicado” sería incorrecta.
- No se generará prueba antes del reparto para sortear estas restricciones.

## Resultado por caso

| Recepción | Qué se conserva | Prueba positiva / devolución |
|---|---|---|
| Efectivo ordinario íntegro, nunca aplicado | Origen E1 + constancia final | Prueba positiva obligatoria; devolución futura sujeta a las demás validaciones |
| Efectivo ordinario totalmente aplicado | Origen E1 + constancia de uso | Sin prueba positiva; pago legítimo aceptado |
| Efectivo ordinario parcialmente aplicado | Origen E1 + constancia de uso parcial | Sin prueba positiva; no separar el sobrante como otro recibo |
| Efectivo dirigido | Origen E1 + aplicación dirigida + constancia | No se fuerza “nunca aplicado”; permanece aplicado y no devolvible bajo esta regla |
| Transferencia y otros medios actualmente válidos | Flujo actual | No se rechazan ni se les exige esta prueba de efectivo |

Si una prueba positiva fue válida al recibir el abono y posteriormente este se utiliza, la prueba original no se borra ni se modifica. Al pedir devolución se revisan nuevamente la historia completa, aplicaciones, reversos, saldo íntegro, sitio, sesión y permisos. Recuperar saldo después de una aplicación no vuelve a convertir el abono en “nunca aplicado”.

## Integridad de base propuesta

- Una finalización por origen, con referencia exacta al movimiento/operación E1; inmutable y registrada en la transacción original.
- Prueba positiva única y vinculada a una finalización compatible, con cliente/importe/origen coherentes.
- Comprobación diferida al confirmar: todo nuevo abono físico cubierto debe tener su finalización; si el resultado declarado es íntegro nunca aplicado, debe tener también su prueba positiva.
- PostgreSQL verifica relaciones, coherencia, inmutabilidad y correspondencia exacta con aplicaciones persistidas. Vincula la procedencia al productor leído del movimiento: ordinario `projectCreditLedger`, dirigido `directedApplication` y necesariamente FULL/importe íntegro. **El constraint no recalcula FIFO:** la clasificación ordinaria procede del proyector existente; la constancia dirigida describe la aplicación íntegra existente ya escrita. Su integración/exactitud se verifican con pruebas del código real.
- Triggers específicos para las columnas de cada tabla. No reutilizar a ciegas una guarda que accede a `NEW.tipo` u otros campos ausentes, ni retirar protección para evitar ese error.
- Preflight de arranque ampliado a los objetos exactos requeridos. Esquema incompleto o incoherente implica rechazo, no creación automática.
- No backfill ni atestación de recibos anteriores durante replay. El reintento de una operación completa reutiliza su resultado/evidencia; no crea un segundo abono.

Estos objetos y relaciones deben concretarse en un futuro SQL exacto revisable. El SQL E2 hoy preparado no satisface todavía todo este contrato.

## Verificación exigida antes de plantear apertura

1. Misma asignación FIFO y mismos saldos con y sin registro de evidencia: ordinario, dirigido, cargos/ajustes y fechas efectivas válidas.
2. Matriz anterior, incluido consumo implícito sin una fila que lo represente en aplicaciones.
3. Fallos inducidos en constancia, prueba, auditoría y comprobación final: ninguna operación financiera parcial confirmada.
4. Productor que omite el finalizador o la prueba obligatoria: rechazo al confirmar.
5. Doble envío, UUID repetido, payload incompatible y carreras contra nuevas aplicaciones y devolución: sin duplicados ni doble disposición.
6. Abono inicialmente íntegro usado después y luego restaurado: devolución rechazada por uso histórico.
7. Transferencias sin cambios; no introducir restricciones nuevas a fechas válidas ni modificar el orden `(created_at,id)`.
8. Permisos de ingreso/devolución independientes; devolución cerrada mientras se registra evidencia. Retenidos y atribución permanecen cerrados.
9. Pruebas PostgreSQL autorizadas por separado: las pruebas offline no prueban atomicidad, triggers diferidos o concurrencia real.

## Orden de autorizaciones

1. Revisar este diseño, antes de implementarlo.
2. Autorizar la preparación de código y SQL, manteniendo capturas y devolución inactivas.
3. Revisar SQL exacto, reversión, código y resultados; autorizar aparte cualquier prueba con base.
4. Solo después de evidencia construida y verificada, decidir y autorizar aparte la apertura.

No se exige devolución inmediata como condición nueva: se respeta la aceptación expresa del propietario. Tampoco se interpreta esa aceptación como permiso para abrir antes de verificar la evidencia.

## Referencias de diseño

- `artifacts/api-server/src/routes/clientes.ts`: productor ordinario, proyección y persistencia de aplicaciones.
- `artifacts/api-server/src/routes/pagos-dirigidos.ts`: productor dirigido y aplicación transaccional.
- `artifacts/api-server/src/lib/credit-refund.ts`: hook, prueba positiva, revisión histórica y disposición.
- `artifacts/api-server/src/lib/credit-aging-read-model.ts` y `credit-allocation.ts`: cálculo vigente; no sustituirlo.
- `lib/db/src/schema/pos.ts`: origen E1 y aplicaciones.
- `reports/e2/sql/credit-refunds-prepared.sql`: contrato preparado que deberá revisarse, no ejecutarse.