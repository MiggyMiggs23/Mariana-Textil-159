---
name: Verificación de impresión
description: Evita falsos positivos al comprobar vistas PDF basadas en CSS de impresión.
---

Para exportaciones descargadas, comparar el archivo con otro generado por el mismo exportador no basta: contrastar sus fuentes con las de pantalla y verificar texto visible y geometría del PDF.

**Why:** Dos archivos idénticos pueden compartir una fuente omitida o columnas fuera de la página. Los bytes correctos no demuestran que los datos sean visibles.

**How to apply:** Descargar los bytes del handler real, abrir el XLSX/PDF con un lector independiente y comprobar últimas columnas, totales y límites físicos. Distinguir un arnés HTTP con contexto en memoria de una descarga con sesión real.

Las vistas imprimibles deben verificarse con el mismo estado corporal que activa el flujo real, emulando `media: print` y comprobando estilo computado, geometría y participación en el layout. En formatos físicos, medir todos los elementos críticos y validar el PDF natural completo, sin ocultar páginas mediante rangos.

**Why:** Comprobar solo el DOM o exportar sin el estado real de impresión produjo falsos positivos: contenido supuestamente visible con geometría 0×0, una hoja adicional, tamaños físicos incorrectos y un PDF vacío cuyo QR parecía fallar.

**How to apply:** Para probar el flujo, pulsar el botón real e interceptar únicamente la invocación nativa de impresión para exportar antes de su limpieza; verificar que el estado imprimible siga activo. La activación manual de clases es un diagnóstico de layout, no una prueba del botón ni de sus tiempos de espera. Exportar todas las páginas, sin rangos. Confirmar cantidad, tamaño físico y contenido según el fallo investigado; renderizar el PDF cuando se necesite verificar visibilidad y decodificar sus QR, no limitarse a verificar que exista un SVG. Antes de exportar formatos nombrados, comprobar el valor computado de `page`: una regla genérica posterior puede sobrescribir el formato específico aunque ambos contratos existan en el CSS.

Cuando un modo oculta globalmente con `visibility`, también debe colapsar los hermanos corporales ajenos a la raíz de la aplicación; la invisibilidad conserva su caja y puede crear un margen superior en el PDF. Los portales que contienen el documento imprimible deben restituirse de forma explícita y más específica.

Un PDF correcto al montar el componente aisladamente no descarta un defecto del flujo completo de impresión o reimpresión.

**Why:** La ruta, los portales, el estado del diálogo y el momento de invocar la impresión pueden diferir del montaje diagnóstico, aunque compartan componente y CSS.

**How to apply:** Identificar el flujo a partir de la evidencia del usuario; distinguir siempre pruebas del componente de pruebas del flujo real. Si no se reproduce la fragmentación, no atribuirla a un contenedor o al controlador sin evidencia; solicitar el PDF defectuoso y los ajustes de impresión antes de corregir.

Cuando se informa una entrada concreta, verificar sus campos imprimibles mediante lectura antes de construir la respuesta simulada. Reutilizar el identificador de la ruta no convierte datos inventados en los datos de esa entrada.

**Why:** Un montaje de la ruta correcta con texto, serie, cantidad o unidad diferentes no descarta un problema de ajuste del documento informado.

**How to apply:** Comparar los campos reales mínimos con la respuesta simulada, sin crear documentos ni autenticar usuarios de prueba en development. Informar por separado si se probó el flujo con datos simulados equivalentes o mediante una lectura autenticada real.

Un reporte de N etiquetas y N+1 páginas requiere contar el PDF completo y verificar qué serie y campos aparecen en cada página, especialmente la primera; no sustituir esa comprobación por mediciones de altura.

**Why:** Una página inicial adicional y una etiqueta partida no son equivalentes a una página final vacía, y un PDF de Chromium sin interfaz no reproduce necesariamente la ruta del diálogo con controlador físico.

**How to apply:** Ejecutar el conteo antes de modificar impresión y registrar navegador, sistema y parámetros de exportación. Si el baseline pasa, declararlo no reproducido, no como evidencia de un arreglo ni de un defecto del controlador.

Al aislar un portal de impresión, comprobar la especificidad de todas las excepciones que lo vuelven a mostrar; añadir otra regla más abajo no basta cuando ambas son `!important`.

**Why:** Un selector con `:not(#root)` aporta especificidad de ID. Una regla de aislamiento compuesta solo por clases y atributos puede perder frente a esa excepción y seguir imprimiendo portales inactivos.

**How to apply:** Verificar con más de un portal montado que los ajenos realmente quedan fuera del layout y del PDF; no conformarse con que exista el atributo que identifica al activo.

Para verificar márgenes físicos, medir toda la tinta del PDF rasterizado y comprobar por separado que el texto esperado está completo. Las cajas de palabras de `pdftotext -bbox` son diagnósticas, no contornos de tinta.

**Why:** Algunas fuentes incluyen ascendentes invisibles que hacen que la caja de una palabra invada el margen aunque sus glifos estén dentro del área segura. Además, `ImageMagick -trim` seguido de `%@` informa límites relativos a la imagen ya recortada, no a la hoja original.

**How to apply:** Medir `%@` sobre la página original sin recortarla; convertir píxeles a milímetros con el DPI de rasterización. Guardar las cajas de texto para diagnóstico y exigir texto completo, número de páginas correcto y bandas periféricas sin tinta. Medir geometría DOM con media `print`, no con estilos de pantalla.

En PDFs tabulares, no deducir bordes de celdas desde el inicio del texto de los encabezados. Usar geometría real del documento, incluir páginas de continuación y distinguir la cobertura visual de una muestra de una comprobación de todo el archivo.

**Why:** Una verificación de reportes aprobaba pese a encabezados no localizados y cruces de límites inferidos; los límites eran puntos medios entre textos, no bordes reales. Además, localizar solo el primer título dejaba sin medir las páginas de continuación. Los indicadores diagnósticos no justifican un PASS si no se resuelven o delimitan explícitamente.

**How to apply:** Extraer bordes y texto mediante un lector independiente; asociar cada tabla y continuación sin reutilizar coincidencias ambiguas. Comprobar que los bloques exigidos representan fuentes lógicas, no sitios, y que ningún intervalo vacío satisface por accidente una prueba de ausencia de JSON.

Retirar explícitamente una aprobación previa si un criterio posterior más completo detecta faltantes; conservar la evidencia histórica sin usarla para sostener el cierre actual.

**Why:** El propietario confirmó que detectar lo que la prueba anterior no veía y retirar el aprobado era el resultado correcto. También exigió distinguir ausencia real en la fuente de omisión en el PDF antes de corregir: un cero de una combinación sin ventas no es un dato perdido por el generador.

**How to apply:** Contrastar fuente, datos de exportación y PDF con lectura independiente; comunicar la causa antes de modificar y repetir después la matriz completa solicitada, sin rebajar criterios para recuperar un aprobado.

Para medir desplazamiento inicial, separar la caja de toda la tinta de la posición del contenido interior y comparar anclas equivalentes entre páginas del mismo diseño.

**Why:** Un borde o fondo fijo puede comenzar en la misma coordenada aunque el contenido interior se desplace. A la inversa, el primer texto puede empezar antes en una continuación de series que en una hoja de productos sin que exista espacio inicial sobrante.

**How to apply:** Conservar ambos indicadores y explicar las diferencias de plantilla; no declarar ausencia de desplazamiento únicamente porque coincida el borde, ni declarar un defecto comparando primeros textos de estructuras distintas.