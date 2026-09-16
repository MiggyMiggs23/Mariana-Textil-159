# Prompt F — lectura previa a construir

Se inspeccionó el código antes de modificarlo. El estado encontrado fue:

1. Existía `GET /clientes/:id/pagos/:pagoId`, utilizado por `useGetClientePagoDetalle` y el diálogo Ver Reparto de `cliente-nota-credito.tsx`.
2. La selección del movimiento contenía exactamente `m.id=$1 AND m.cliente_id=$2 AND m.tipo='ABONO'`. El manejador devolvía 404 cuando no encontraba fila: no admitía REVERSO ni AJUSTE.
3. La respuesta incluía identidad del cliente y movimiento, `fecha` desde `created_at`, monto absoluto del abono, forma de pago, cuenta destino, referencia, usuario registrador, indicador de reversión, ID del reverso y motivo.
4. El reparto existente no era exclusivamente una lista de la proyección: consultaba las aplicaciones guardadas y obtenía saldos/estado actuales mediante `loadCustomerCreditProjection`. No exponía los saldos antes y después de cada aplicación proyectada.
5. `projectCreditLedger` ya ofrecía asignaciones con origen, destino, importe aplicado y saldos antes/después, además de trazas optativas. No era necesario escribir otro algoritmo FIFO.
6. Faltaban la presentación de REVERSO/AJUSTE, importe firmado, nombre del cliente, fecha efectiva claramente rotulada, instante de captura comprobado, notas, vínculo bidireccional original/reverso, evidencia y regreso al renglón del estado de cuenta.
7. La tabla genérica conservaba el enlace automático a `/tickets/:id` para la columna Folio. Se eligió una extensión optativa por renglón, conservando ese comportamiento como predeterminado.

La diferencia entre aplicaciones guardadas y proyección se comunicó antes de continuar. La implementación distingue ambas; no convierte la evidencia histórica en la autoridad del saldo.

## Datos actuales

Se ejecutó una lectura en una sola transacción `REPEATABLE READ READ ONLY` mediante la conexión de desarrollo de Replit. Resultado:

```text
database: heliumdb
schema: public
version: PostgreSQL 16.10
movimientos_credito agrupados por tipo: ninguna fila
cliente con id 7: 1
movimientos con id entre 43 y 50: 0
```

Esta identidad coincide con la identidad de la API que se había comprobado en la evidencia de Prompt J. No es una afirmación sobre una publicación desplegada.

Los casos mencionados en el documento no están presentes en la base actual. La evidencia histórica local encontrada se documenta por separado en `real-data-availability.md`; no fue restaurada ni mezclada con datos actuales.

## Activación posterior sin mantenimiento automático

La API inicialmente servía un bundle anterior y su arranque normal ejecutaba inicializadores y mantenimiento con escrituras. Posteriormente el entorno se reinició automáticamente y detuvo los servicios. Para restablecerlos sin ejecutar esas escrituras se añadió un arranque de inspección optativo de desarrollo, revisado antes de utilizarlo.

Se activó `API_INSPECTION_BOOT=1` únicamente en desarrollo. El arranque omite inicializadores, backfill de compras y monitor de mínimos; solo comprueba `SELECT 1` antes de servir. Ambos workflows arrancaron correctamente y `/api/healthz` devolvió `{"status":"ok"}`. El código nuevo de la API sí quedó cargado. El arranque normal de producción no cambió y rechaza esta opción.

**No es un servidor globalmente de solo lectura:** conserva las operaciones autorizadas del sistema. Iniciar sesión y usar una sesión autenticada pueden escribir o renovar su caducidad; no se hicieron esas acciones. El mantenimiento automático indicado estuvo pausado mientras se habilitó la opción de desarrollo.

**Estado posterior, 2026-09-16:** el propietario autorizó el arranque normal y aclaró que sus escrituras de inicialización no estaban incluidas en la restricción de Prompt F. Se retiró la opción de inspección y se recuperaron ambos servicios y su mantenimiento normal. Véase la regla vigente en `replit.md`.

La presentación aislada no debe describirse como una E2E autenticada.