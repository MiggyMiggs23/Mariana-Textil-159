# Rediseño aprobado integrado

## Entrega

- Se integró la última composición reconciliada en las dos páginas reales, no mediante importación de maquetas ni datos de ejemplo.
- En Caja, Cobrado en el periodo está después de las dos filas de ventas/operación y antes de Estado por Tienda. Es una cifra con desglose adjunto, sin encabezado de sección propio.
- Se conservaron consultas compartidas, filtros, enlaces, comparaciones, exportaciones, alertas condicionales, estados de costos pendientes, tablas y gráficas.
- Los tres destinos originales conservan también sus importes anteriores enlazados y variaciones enlazadas al detalle actual.
- La única cifra nueva autorizada, efectivo sin factura, se obtiene de la misma fila de la respuesta mediante centavos enteros. Una fila ausente no fabrica un cero.
- El título de la tabla de abonos permanece visible también sin movimientos.

## Verificación

- Typecheck del frontend: PASS.
- Pruebas específicas: 20 PASS. Incluyen identidad de la fuente de cobranza, filtros, comparación, exactitud monetaria y rechazo de una alteración de un centavo.
- Componentes reales montados en comprobación aislada: escritorio de 1280 px y teléfono de 402 px. Datos canónicos verificados, interceptados localmente; no se crearon sesiones ni actores.
- Comprobadas posición de Cobrado, agrupación 3+2, dimensiones, porcentajes sin solapamiento, estados vacíos, cajas cerradas, nombres canónicos y ausencia de desbordamiento de página.
- Evidencia de Caja: `installed-source-verification.json`.
- Evidencia final de Cuentas: `installed-source-cuentas-final-verification.json`.
- El ajuste posterior de mantener el título de abonos visible en vacío se confirmó con typecheck y las 20 pruebas; no se volvió a ejecutar la captura por ese cambio textual.
- Se reinició únicamente el frontend; Vite arrancó correctamente. La captura de entrada real mostró el login esperado, no una sesión autenticada.

## Límites conservados

Las comprobaciones aisladas no son una E2E autenticada. La base utilizada para el corte canónico carecía de operaciones, por lo que no se acredita un recorrido real cifra → detalle → folio ni una composición con ventas reales de siete dígitos o nombres largos vinculados a una venta. La prueba monetaria de siete dígitos sí es unitaria, no una venta real.

No se cambiaron backend, consultas financieras, datos, usuarios ni sesiones durante esta integración. Los pendientes anteriores de crédito, corte de caja y alcance por sitio no se incluyeron.