# Datos de entrega opcionales — 2026-10-08

Activado únicamente frontend del workspace, dist-optional-delivery-20261008.
Once archivos byte-exactos del candidato probado; TOML validado, un reinicio web, hashes de arranque aprobados.
HTML servido y candidato: 1c5446871a3d4b992310a65fa0f26dc0d6153b742a4bfc554f6fef1f423931e2.
Sin publicación externa, cambios API ni datos de prueba en la base real.

## Cambios
- POS: retirados condición de botón, validación de envío y asteriscos. Campos, envío y normalización conservados.
- OpenAPI: corregidas ambas descripciones; codegen y typecheck de librerías ejecutados. Diff generado limitado a esas dos descripciones en schemas cliente, Zod y ticketInput.
- Revisión: ninguna obligación equivalente en Salidas/Venta a cliente. Viajes ya usa OR destinatario/cliente/folio, y fallback de destino; no requirió cambios.
- Usuario confirmó conservar la prohibición de crédito a Venta a Público. No se expusieron campos en otros contextos.

## Pruebas y límites
Dos contratos regresivos aprobados. Typecheck/build congelados aprobados, delta de producción limitado a POS respecto del escaneo activo.
El testing agent creó stock real sintético mediante Entrada con proveedor/costo; creó la Nota vacía en POS, pero quedó bloqueado en impresión. Fue detenido: no hay PASS global de ese agente.
MAIN recuperó el documento persistido con HTTP 200: Nota 1000, destinatario/dirección null, estado VENDIDO y autorización PENDIENTE.
MAIN completó mediante API real otra Entrada con proveedor, Nota 1001 con destinatario/dirección y Ticket sin esos datos; creación HTTP 201 y lectura persistida comprobadas.
Esto comprueba creación/confirmación POS, NO autorización de crédito ni cobro en Caja. El caso lleno es API, no UI: mantener la regla de crédito impide confirmar la combinación pública donde se muestran esos campos.
Se invocó Imprimir Nota con window.print sustituido antes de navegar para evitar bloqueo nativo. Para capturar se restauró la clase print-credito y media print: sin CSS inventado ni datos simulados de impresión.
Capturas 29/30 inspeccionadas: sin destinatario/dirección se omite el renglón y se reacomoda el encabezado; llenos aparecen ambos. No impresión física.
Viajes: búsqueda por folio 1000 y cliente encuentra Nota sin destinatario; creación de viaje con esa Nota HTTP 201, captura 31.

## Evidencia
main-confirmations.json, verified-empty.json, trip-without-recipient.json, finish-check.log.
screenshots/29-empty-note-print-verified.png, 30-filled-note-print-verified.png, 31-trip-without-recipient.png son entregables inspeccionados.
Las capturas 26/27 no son prueba de impresión: precedían la restauración de clase; no entregarlas.

## Limpieza
run-gm6ayx/result.json: CLEANED, cleanup.passed=true, apiExited=true.
Clúster y credenciales desechables eliminados; proceso terminó exit 0.
