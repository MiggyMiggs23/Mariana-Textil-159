# Ubicación por piso — Control de Inventario

## Resultado
- Agrupado: columna Ubicación después de Sitio, resumen de pisos por producto, piso único o conteo expandible por color.
- Desglose: sitio/piso, rollos y cantidad en la columna de su unidad. Vista Global identifica sitio y piso; pisos homónimos de sitios distintos no se fusionan.
- Detalle de Rollos: conserva las tarjetas existentes; cada serie muestra Piso. Ausencia registrada: Sin piso. Sin existencias no inventa ubicación.
- La ubicación es actual; no modifica la evidencia histórica del documento de Entrada.

## Verificación
- 8 pruebas frontend de ubicaciones/totales y 10 pruebas backend/contrato/estados pasaron; typechecks frontend y API pasaron.
- PostgreSQL local desechable: 32 comparaciones contra consulta anterior; totales originales conservados y desglose conciliado para cuatro unidades. Sin acceso a la base de la aplicación; servidor local detenido y eliminado.
- Capturas del componente real con fixtures HTTP explícitos, no inventario real. Se comprobaron expansión, totales y seis tarjetas; archivos en capturas/. No se inició sesión real ni se crearon movimientos.
- API activa SHA256: 7ce444a8dbda01aae9f6df484424159532f6d7c4b1ec9421bba438128693b446.
- HTML activo SHA256: 032b63fa24c9e2832cdd751ddf6dd198b0feddc0c28286ae2f65207dbcdab3c4, igual al servido por el proxy.
- Ambos workflows RUNNING, guardas válidas y /api/healthz HTTP 200. Arranque conserva inspection boot sin mantenimiento inicial. La captura anónima del preview mostró comprobación de sesión y respuestas 401 esperadas; no acredita un recorrido autenticado.
- Activación limitada al workspace, sin republicación externa. Builds congelados con deltas acotados; se preservaron las correcciones anteriores.