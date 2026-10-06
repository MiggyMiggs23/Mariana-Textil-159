# Escaneo corrido — 2026-10-06

## Activación

Solo frontend del workspace, `artifacts/mariana-textil/dist-scanner-burst-20261006`.
Once archivos copiados exactamente de `revision-2/web`, verificados por SHA-256 antes de arrancar.
TOML validado; un reinicio web. API anterior sin cambios ni reinicio.
HTML servido por el dominio de desarrollo y HTML del candidato coinciden:
`9b9fe8d03b7d4305b6db17ae9781316f431160645e89b6616ea606591b87ded5`.
No publicación externa. No modificaciones de la base real para pruebas.

## Cobertura

- Cinco pruebas montadas del componente real: DOM frente a estado viejo, FIFO con primer callback pendiente, tiempos mayores a límites anteriores, entradas manuales y error que no detiene la cola; discrepancia SKU genuina.
- Siete contratos del escáner y sus consumidores aprobados. Descubrimiento de consumidores excluye archivos de pruebas, no pantallas de producción.
- Typecheck y build congelados aprobados; solo cuatro archivos de producción difieren de la base de recibos. Cambios y hashes en `revision-2/changes.json`.
- Navegador autenticado contra API real y PostgreSQL desechable: Entrada nativa sintética con cinco rollos de 10 metros.
- Ticket NORMAL: cinco series distintas en orden, una vez cada una, 10 ms/caracter y primera búsqueda demorada 300 ms.
- Nota NORMAL: cinco series en orden, 65 ms/caracter.
- SKU incorrecto: advertencia exacta de etiqueta frente a rollo; la repetición no creó un sexto rollo.
- Auditoría: cinco registros, cero faltantes. Clasificación MAL ACOMODADO esperada por piso de prueba distinto del piso ausente de recepción. Auditorías canceladas; sin conciliación.
- Salida: cinco rollos en borrador, 50 solicitados / 0 enviados; borrador cancelado y cinco rollos disponibles en origen.
- Reconfirmación enfocada de revision-2: Ticket con aviso → selección de Nota limpia → primer escaneo de cinco rollos, sin limpieza manual, todos en orden. Conserva las comprobaciones previas no afectadas.

## Límites

No hubo acceso a pistola física. Son ráfagas automatizadas equivalentes a teclado, no certificación del dispositivo de tienda.
No se confirmaron ventas/notas. El harness de recibos reutilizado no instala `tarea4_rollo_remate`, lo que produjo HTTP 500 en validación de precio de la copia. No se modificó la lógica de precios ni se atribuye este fallo de preparación a producción. Las pruebas acreditan captura/cola y conservación de advertencia, no checkout ni ausencia general de errores en la app.
La captura pública posterior a la activación mostró comprobación de sesión sin autenticar; no se usa como evidencia de POS. Los recorridos autenticados corresponden al testing agent.
Capturas del navegador disponibles como observaciones, no archivos descargables certificados.

## Limpieza

`reports/receipt-terminal-runtime-20261001/run-JTxs5F/result.json` quedó CLEANED,
`cleanup.passed=true`, `apiExited=true`, a las 23:16:58 UTC.
Se destruyó el clúster desechable y sus credenciales; proxy HTTPS de revision-2 detenido.
No se reabrió la auditoría de permisos pausada.
