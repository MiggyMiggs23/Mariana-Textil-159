# Tarea 1 — recorrido financiero nativo sobre versión liberada

**Estado terminal: recorrido monetario PASS; defecto de impresión del corte corregido por MAIN y retest nativo PASS.** Véase [retest final y PDF válido](retest-impresion.md). A continuación se conserva el diagnóstico original y sus evidencias históricas; no debe confundirse el PDF defectuoso original con el PDF final corregido.

## Aislamiento, autorización y alcance

- Autorización original: [texto del propietario](../autorizacion.txt).
- Sólo copia desechable `postreview_financial_20260926`, navegador `127.0.0.1:18328`; nunca `appDB` ni copias de campañas anteriores.
- API SHA256 `3aa7706416313c4bf5bbb0cfce03ee7f2151d0c36d6008579346b022d9c5a9ea`; UI SHA256 `af0541fd749f49ffe917aaae51ba6adc8c1f99f1dd5ad1de419a57a2a0c578b5`. Validación por cabeceras servidas en cada sesión. Reloj normal del sistema.
- 26 septiembre 2026, aproximadamente 09:34–09:51 UTC. Nuevo sitio `OWNER POSTREVIEW26` id835, cliente2583, producto2078, caja1, tres pisos, proveedor y 24 rollos creados mediante UI nativa. ADMIN234 fue el único actor en esta tarea; la concurrencia pertenece a tarea2.
- Toda mutación pasó por controles nativos. Lecturas independientes por HTTP y PostgreSQL en transacción `READ ONLY`, validando `current_database()`. No cambios de código aplicativo, gates, permisos, reloj, workflows ni commits. MAIN decide corrección/liberación y commit separado.
- 33 operaciones protegidas, todas ACK, ninguna incierta ni repetida. 1,088 respuestas HTTP observadas, cero 5xx y cero errores HTTP de negocio/sesión autenticada. Los 401 iniciales `/auth/me` son previos al login.

## Recorrido y comprobaciones

| Paso real | Resultado observado | Evidencia |
|---|---|---|
| Ticket contado folio1 | 10×100=$1,000; cobrado en efectivo, ticket y pago persistidos | [cobro](pay-cash-1790415418640/result.json) |
| Crédito folio2 | $1,000 autorizado; cliente con límite $50,000 y plazo7días | [autorización](authorize-credit-1790415431075/result.json) |
| Abono ordinario E3 | Efectivo$250, FIFO; deuda$750, favor$0 | [abono](abono-1790415444088/result.json) |
| Recibo/reimpresión E3 | Folio `E3-835-00000001`, dos copias; registro auditado y PDF con texto real | [original PDF](receipt-1790415481355/receipt-print.pdf), [reimpresión PDF](receipt-1790415481355/receipt-reprint.pdf) |
| Recepción retenida E5 | Efectivo$300; no disminuye deuda$750 ni aumenta favor | [recepción](retained-receive-1790415546785/result.json) |
| Propuesta dirigida | Propone$200; sigue retenido$300 y deuda$750; sin efecto financiero | [propuesta](retained-prepare-1790415681657/result.json) |
| ADMIN aplica retenido | Aplica$200, deuda$550, retenido$100; NO nuevo cobro | [resolución](retained-authorize-1790415704390/result.json) |
| Dirigido atómico adicional | Transferencia$100 a cuenta no fiscal; aplica$100, deuda$450; NO efectivo | [dirigido](directed-receive-1790415727706/result.json) |
| Remate | Marcado real de rollo3; vendido10×40=$400, por debajo del costo50; cobrado en efectivo | [venta](sale-remate-1790415791940/result.json), [cobro](pay-remate-1790415805394/result.json) |
| Salida extraordinaria caja | Gasto ordinario efectivo$25, persistido y descontado del corte | [salida de dinero](cash-exit-1790415489475/result.json) |
| Salida física adicional | Rollo4, origen835→destino836; EN_TRANSITO→RECIBIDA, sin repetir envío | [recepción](salida-transfer-1790415986203/result.json), [documento PDF](salida-transfer-1790415986203/salida-original.pdf) |
| Cierre no vacío | Esperado$1,925; contado$1,925; diferencia$0; sesión CERRADA | [cierre](close-1790416009671/result.json) |
| Lectura independiente | HTTP nuevo + PostgreSQL READ ONLY; tickets, libro, cobrosE5 y caja coinciden | [comprobación](independent-final-1790416104940/result.json) |

**Conciliación independiente**

- Efectivo: contado$1,000 + remate$400 + abonoE3$250 + recepciónE5$300 − salida$25 = **$1,925**.
- La aplicación de retenido$200 no vuelve a ingresar dinero; la transferencia$100 no aumenta efectivo.
- Deuda: cargo$1,000 − abono$250 − aplicaciónE5$200 − dirigido$100 = **$450**; disponible **$49,550**, favor **$0**.
- PostgreSQL: dos pagos de ticket suman$1,400; libro canónico contiene cargo$1,000 y abonos−250/−200/−100. Las aplicaciones E5 son `OPERACION_CREDITO_SIN_DINERO`, sin medio ni sesión física, evitando duplicación.
- Dos recepcionesE5 suman$400 recibido/$300 aplicado/$100 retenido. El remanente retenido no se convirtió a favor ni se devolvió.
- Gates existentes E3/E5 estaban habilitados; no se modificaron.

## Defecto para MAIN — impresión de corte completamente vacía

**Reproducción:** entrar ADMIN → Cobros → sitio OWNER POSTREVIEW26 → Historial de cortes → Ver corte → Imprimir Corte. El diálogo contiene el corte$1,925, pero la salida impresa/PDF está vacía.

- [Pantalla correcta](documents-print-check-1790416269942/screen-cut-after-native-print-viewport.png).
- [PDF vacío reproducido](documents-print-check-1790416269942/corte-native-print-repeat.pdf): una página, 1,034bytes, `pdftotext` produce sólo un salto de página. La primera reproducción independiente también fue vacía.
- [Prueba CSS observada](documents-print-check-1790416269942/result.json), campo `printCss`: `printMedia:true`, `bodyClass:"print-corte"`, `directBodyChild:true`, `display:"none"`, `visibility:"visible"`. No se inyectaron estilos/clases ni se reemplazó `window.print`.
- Causa localizada: `artifacts/mariana-textil/src/index.css:274` oculta todo hijo directo del body salvo root. Excepción`:293` sólo rescata elementos **que contienen** `.corte-print`, no el diálogo que **es** `.corte-print`. Radix monta ese diálogo directamente bajo body. Por eso queda `display:none !important` aun siendo visible.
- MAIN debe corregir la excepción para el propio nodo portal y verificar posicionamiento/paginación; no basta afirmar que el botón dispara impresión. Repetir native print + extracción/raster no vacío antes de liberar.
- Sin pérdida monetaria detectada: el cierre sigue persistido y conciliado. **No se ha corregido ni liberado este defecto en esta tarea.**

## Límites de evidencia y fallos del arnés, no del producto

- 152 capturas PNG viewport/full, además de texto, respuestas y hashes por etapa. [Corte escritorio](independent-final-1790416104940/nonempty-closed-cut-viewport.png), [corte móvil](independent-final-1790416104940/mobile-cut-viewport.png), [recibo móvil](independent-final-1790416104940/mobile-receipt-viewport.png).
- Cuatro documentos E5 (recibos y constancias) se abrieron en UI y tuvieron solicitudes de impresión auditadas: [capturas/resultados](documents-print-check-1790416182339/result.json). **Sus PDF generados después del click son inválidos/vacíos y no se presentan como documentos útiles:** E5 elimina `e5-print` inmediatamente después de `window.print`; el PDF CDP posterior ya no corresponde a ese momento. Es una limitación del método de captura, no evidencia suficiente de un defecto E5. No se afirma impresión física ni éxito de exportación E5. Los snapshots de pantalla sí contienen los documentos auténticos.
- El `status:PASS` de cada arnés sólo indica que sus aserciones programadas terminaron; la validación posterior descubrió el corte vacío. Este informe prevalece sobre una interpretación de PASS como ausencia absoluta de defectos.
- Se conservaron seis intentos iniciales bloqueados: etiquetas select que incluían opciones, sitio reseteado al navegar, búsqueda de serie no presente en documento agrupado, URL QR inventariada con formato equivocado y columna SQL colocada en tabla equivocada. Todos se corrigieron únicamente en arnés; se reanudó desde ACK sin repetir mutaciones. No hubo 5xx ni evidencia de defecto aplicativo por esos casos.
- No se probó en esta tarea una negativa de límite crediticio, impresión física, devolución de retenido ni permisos combinados: no se extrapolan resultados a esos escenarios.
- Scripts: `reports/owner-night-20260926/task1/{runtime,native,retained,salida,readback,documents}.mjs`. Configuración sin secretos aquí; credenciales y journal viven sólo bajo `/tmp/postrelease-review-20260926/`.

## Handoff

Tarea1 terminada; el defecto de impresión documentado quedó corregido por MAIN y pasó el [retest](retest-impresion.md). Se conserva el límite de captura E5 explícito. **MAIN debe hacer su commit independiente de tarea1 antes de iniciar tarea2.** No se inició concurrencia ni se destruyó la copia; quedan 20 rollos no usados por este recorrido. La copia y credenciales siguen siendo responsabilidad de infraestructura para su destrucción final.