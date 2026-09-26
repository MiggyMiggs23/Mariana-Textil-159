# Tarea1 terminal — retest nativo del corte corregido: PASS

**26 septiembre 2026, 09:58 UTC.** Sólo se reabrió e imprimió el corte existente de caja1, cerrado con esperado/contado **$1,925.00** y diferencia **$0.00**. No se repitió el recorrido financiero, no se creó dinero, no se volvió a cerrar caja y no se hicieron escrituras financieras.

Versión observada por cabeceras servidas:
- APIv9: `3aa7706416313c4bf5bbb0cfce03ee7f2151d0c36d6008579346b022d9c5a9ea`.
- UI con corrección MAIN: `a296de5707e38b9996293f48f968fca1e480810931b5769286bebe9b75f83f6f`.
- Misma copia `postreview_financial_20260926`, origen18328, reloj de sistema.

## Prueba y evidencia final

Ruta nativa: loginADMIN → Cobros → sitioOWNER POSTREVIEW26 → Historial de cortes → Ver corte → esperar carga de capacidad/corte canónico → **Imprimir Corte**. Captura PDF inmediatamente durante el flag de impresión activado por el botón nativo; sin inyectar estilos/clases ni reemplazar `window.print`.

- [Resultado y lecturas del corte](cut-print-retest-1790416705549/result.json).
- [PDF final, válido y descargable](cut-print-retest-1790416705549/corte-native-print-repeat.pdf): **3 páginas carta, 180,517bytes**.
- [Texto extraído](cut-print-retest-1790416705549/corte-extracted.txt): título **Detalle de corte**, total **$1,925.00**, último renglón de salida física **−$25.00**, motivo/fecha/registrador completos. No quedó “Consultando…” en el PDF final.
- [Primera página rasterizada](cut-print-retest-1790416705549/corte-pdf-first-page.png).
- [Última página rasterizada](cut-print-retest-1790416705549/corte-pdf-last-page.png), revisada visualmente: fórmula, total, tabla de trazabilidad y último renglón íntegros, sin recorte.
- [Geometría de texto PDF](cut-print-retest-1790416705549/corte-bbox.html). Todas las palabras dentro de612×792pt: página1 x18–584.243/y14.790–748.530; página2 x18–593.990/y10.791–788.986; página3 x30.750–584.244/y6.291–664.388. Último importe−$25: x536.836–569.242/y555.757–565.953, completamente dentro de la última página.
- El portal se observa `display:block`, no `display:none`; se conserva cuerpo `print-corte` durante la captura. El título ya no está desplazado fuera de la hoja.

Las dos capturas preliminares de esta misma UI también recuperaron contenido, pero se tomaron mientras cargaba el panel auxiliar de envío; se conservan como trazabilidad. El PDF enlazado arriba es el final, esperando ambas cargas. No se utiliza como PASS el primer intento que tenía métricas de fuente levemente negativas en saltos de página.

## Cierre de tarea

**Defecto de corte vacío cerrado por corrección de MAIN y retest nativo PASS.** El recorrido financiero previo mantiene sus pruebas; este retest no afirma haber repetido otros flujos sobre la UI corregida. Se mantiene la limitación ya documentada para la captura PDF E5 posterior al ciclo `window.print`, sin convertirla en supuesto defecto de producto ni afirmar impresión física.

Tarea1 terminal, lista para **commit independiente por MAIN**. No se inició tarea2: se espera GO de MAIN después de su commit. No se alteró código aplicativo ni se reiniciaron servicios.