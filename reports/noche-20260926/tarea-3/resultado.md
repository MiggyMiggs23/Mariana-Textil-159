# Tarea 3 — navegador real sobre copia

**Resultado: parcial; operaciones monetarias principales aprobadas, devolución de rollo detenida.**

Se usó únicamente el ADMIN sintético de la copia. Se creó inventario y clientes propios mediante pantalla; no se pagaron documentos históricos por posición en una lista.

## Comprobado

- Venta y cobro en efectivo; venta y cobro por transferencia.
- Nota a crédito y autorización; abono ordinario; recibo E3 e impresión/reimpresión.
- Recepción dirigida E5, propuesta, rechazo ADMIN sin movimiento de saldos, repropuesta, preparación por contador A y autorización ADMIN parcial. El remanente permaneció retenido; no se habilitó devolución.
- Salida extraordinaria sin motivo rechazada por el formulario; insuficiencia rechazada; desbloqueo ADMIN; salida ordinaria con saldo.
- Marcar remate y vender el rollo en remate.
- Segunda nota, autorización y abono de liquidación. Lectura independiente: nota **12**, saldo **0.00**.
- Cierre real de sesión **1**: esperado **2548.00**, contado **2548.00**, diferencia **0.00**. Cálculo independiente: 1000 efectivo + 100 abono + 1450 liquidación − 1 salida autorizada por insuficiencia − 1 salida ordinaria. Transferencias y retención E5 excluidas del efectivo físico.

La primera tentativa de cierre no envió la operación: falló el login con HTTP 500. Se confirmó sesión todavía abierta y ningún paso de cierre ejecutado antes del intento de recuperación, que sí cerró y tuvo lectura independiente.

## Detenido / límites

No se ejecutó devolución comercial de rollo. No se cambió ningún gate ni se tomó decisión de negocio. El primer inspector de devolución empleó erróneamente `/notas/:id`; **esa captura no prueba ausencia funcional ni se cuenta como recorrido aprobado**. La nota liquidada se volvió a abrir mediante `/tickets/12`, y su saldo cero se comprobó contra la API. El caso de devolución con deuda no se completó antes de liquidar la cuenta; la deuda real previa sí está documentada en el recorrido E3/E5.

La captura inicial de entrada se detuvo por falta de piso requerido: no hubo entrada confirmada. Se creó después una entrada nativa independiente con piso y 20 rollos. No se repitieron las altas de proveedor/producto ni una operación monetaria incierta.

## Evidencia y entrega a rendimiento

- Cada carpeta de caso contiene resultado y PNG reales. `flow-close-recovery/close-result.json` conserva corte y lectura posterior.
- `final-browser-session-readbacks/result.json` y `../tarea-5/independent-final-readbacks/result.json` contienen las lecturas finales.
- Se crearon **seis tickets nativos pendientes**, IDs **2–7**, para rendimiento. `/tmp/noche-20260926/payment-input.json` contiene `before` (2,3,4) y `after` (5,6,7), todos con `nativeProvenance:true`. La lectura final confirmó que los seis seguían **sin cobrar**.
- Inventario/clientes/credenciales/journals de recuperación permanecen privados en `private.local/night-disposable/browser`; no hay secretos copiados a este informe.

No se modificó código de aplicación, no hubo commits y no se destruyó la copia: MAIN necesita continuar rendimiento y correcciones.