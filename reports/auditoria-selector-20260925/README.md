# Selector de sitio de auditorías

El cambio manual de sitio deselecciona el detalle y filtra el historial.
No cierra, cancela ni modifica una auditoría. La selección automática inicial
no se repite después de una elección manual; un auditoriaId antiguo en la URL
tampoco vuelve a imponerse. El detalle sincroniza el sitio solo una vez al
seleccionar una auditoría, cuando llega la respuesta de ese mismo ID.

El escaneo conserva su destino `detail.data.id`; los pisos siguen consultando
`detail.data.ubicacionId`. Cambiar la selección limpia únicamente el texto
local pendiente de escanear y la selección local de piso.

## Verificación

- Código anterior en copia aislada: 2 fallos de aserción y 1 prueba aprobada.
- Código corregido: 5 pruebas aprobadas entre la suite nueva y la existente.
- `verification.txt` y los logs conservan comandos, salidas y hashes originales.
- Typecheck frontend PASS; build Vite PASS.
- Navegador con componente y selector Radix reales: cambio Centro → Norte,
  historial filtrado, sin detalle seleccionado, botón Iniciar habilitado;
  regreso explícito a la auditoría de Centro y escáner disponible.
- Todas las respuestas de la captura son sintéticas e interceptadas;
  ninguna operación de escritura ni cuenta real. No prueba operaciones DB.

## Activación

Solo frontend. Base de fuentes servida 512c6ff010c136a843b66cd971cfaff1fd7bee0a,
conservando los dos cambios E7 anteriores y agregando el archivo de auditorías
corregido. El archivo de auditorías original era idéntico entre esa base y
HEAD antes de este arreglo. Construcción desde `.local/e7-text-baseline`,
salida `artifacts/mariana-textil/dist-audit-site-20260925`.

Workflow web actualizado y reiniciado. API, esquema, permisos y candidato
comercial no liberado sin cambios. Captura: `resultado.png`.