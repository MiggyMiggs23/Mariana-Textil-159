# Correcciones de impresión — 26/09/2026

## Resultado

Activos en la aplicación del workspace: frontend `0ca090ce957ef72c37cebbdb0663948b61d90eeb90d76bbc5cc1f0b20ae023c5` y API `1c74777957fc1ad332228ea8407eac831cd14018debf94918c2a96647d6348b3`. Se comprobó el hash del HTML servido, el bundle de API y `/api/healthz` HTTP 200. No se republicó un despliegue externo.

### Etiquetas: nombre de tela y color

- Se intenta una línea al tamaño normal aprobado. Si no cabe, se permiten hasta dos líneas, separando únicamente entre palabras, con los escalones aprobados y mínimo de **14 px**.
- Se corrigió el falso bloqueo de portales ocultos: ancho cero no demuestra desbordamiento. La preparación espera recursos, mide el portal real fuera de pantalla y vuelve a comprobar antes de imprimir. Los desbordamientos reales siguen bloqueados y se informa el valor completo.
- El bundle anterior, cargado únicamente en el navegador de prueba con la misma API, fuentes y CSS, reprodujo el aviso de **GABARDINA METEPEC 1.50 - MARINO** con ancho cero. La versión corregida no produjo avisos.
- Se midieron **los 1234 nombres del catálogo vigente** en el componente de reporte de producción, en lotes de 25. **Nombres que no caben: ninguno en los 1234 comprobados.** Este diagnóstico usa los datos auténticos del catálogo; sus series y cantidades de prueba no se presentan como inventario real.
- Por separado, el botón real de la entrada de prueba MA-000002 imprimió **26 rollos reales de la copia aislada**: los 25 nombres más largos y el ejemplo solicitado. El ejemplo quedó en una línea visible a 18 px; **MEZCLILLA DIAMANTINA 10 OZ - INDIGO RAYADA** quedó en dos líneas a 18 px.
- Se verificaron las 26 páginas completas, extracción de nombres y decodificación de los **26 QR desde imágenes del PDF**. Los PDF individuales y sus imágenes no muestran recorte del nombre.

### Documento de entrada: piso original

- La columna **PISO** muestra el piso original documentado al recibir, no la ubicación actual del rollo.
- El PDF del botón real de MA-000001 conserva **Planta Alta / Planta Baja**, aunque después ambos rollos quedaron en Planta Baja. Se revisaron las dos páginas, incluida la lista de series.
- Las entradas nuevas conservan esa evidencia en su evento de creación. Para historia sin evidencia original suficiente se muestra **Sin evidencia**; no se reconstruye el piso original a partir de la ubicación actual. La ausencia explícita de piso documentada se distingue como **Sin piso**.

## PDF entregables

1. Ejemplo solicitado, una página:
   `reports/print-corrections-20260926/labels/GABARDINA-METEPEC-1.50-MARINO.pdf`
2. Nombre más largo, una página:
   `reports/print-corrections-20260926/labels/MEZCLILLA-DIAMANTINA-10-OZ-INDIGO-RAYADA.pdf`
3. Lote completo, 26 páginas:
   `reports/print-corrections-20260926/labels/etiquetas-top25-y-gabardina.pdf`
4. Entrada con pisos originales, dos páginas:
   `reports/print-corrections-20260926/labels/ENTRADA-MA000001-PISOS-ORIGINALES.pdf`

## Alcance y evidencia

Pruebas autenticadas en una **copia aislada**, con catálogo de lectura verificada y entradas creadas por flujos autorizados. Se pulsaron los botones de producción y se interceptó únicamente la llamada nativa de impresión para generar PDF con Chromium; sin dibujar documentos alternativos ni limitar rangos de páginas. No se probó una impresora física.

Los detalles, geometrías por nombre, hashes de PDF y verificaciones están en `labels/status.json`, `labels/native-result.json`, `labels/baseline-native-result.json`, `labels/pdf-qr-verification.json` y `labels/native-entrada-result.json`. La procedencia de los pisos y rollos está en `entrada/native-evidence.json` y `entrada/native-longnames-evidence.json`. Las ocho pruebas de contrato de etiquetas/preparación de impresión pasaron.

**Copia desechable destruida:** rama eliminada con respuesta 404 posterior, puertos 18427/18428 cerrados y directorio privado eliminado junto con credenciales, cookies, dump y logs crudos. Evidencia: `cleanup.json`. No se modificó la base de la aplicación ni otras ramas durante la limpieza.