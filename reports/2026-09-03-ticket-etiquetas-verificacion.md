# Verificación de ticket y etiquetas

## Contratos automatizados

- El ticket de 80 mm no contiene un componente QR y usa un logo centrado de 25 mm.
- Los productos se imprimen como bloques verticales; la modalidad metreada omite Rollos y cada cantidad conserva la unidad del producto.
- CLIENTE, CAJA y ADMINISTRACIÓN se renderizan como páginas independientes en una sola operación de impresión.
- Las tiras TABULAR se renderizan fuera del ciclo de copias y, por tanto, no se triplican.
- La acción superior de Etiquetas permanece visible, muestra el total seleccionado, se deshabilita en cero e imprime todos los identificadores seleccionados. La acción individual se conserva.
- `AutoFitText` compara la geometría renderizada del texto con el ancho interior disponible, vuelve a medir al cargar fuentes y antes de imprimir, y marca explícitamente cualquier desbordamiento al tamaño mínimo.
- `?fitReport=1` renderiza una etiqueta por producto devuelto por el catálogo, informa el conteo por escalón y enumera cualquier campo que no cabe.

## Integridad del catálogo

La base de desarrollo consultada en modo de solo lectura contiene actualmente 566 productos activos, no los 419 indicados por el ticket. No se eliminó, inventó ni filtró información para forzar ese número. El reporte renderizado usa el catálogo completo que entregue la API en el entorno donde se ejecute; sus conteos visuales deben capturarse allí antes de aceptación.

## Comprobaciones externas pendientes

Este entorno no permite afirmar mediciones ni comportamiento de hardware. Quedan pendientes en una impresora térmica real:

1. Medir con regla que el logo impreso tenga 25 mm de ancho y permanezca centrado.
2. Confirmar el corte automático entre las tres copias.
3. Imprimir una selección de 15 etiquetas de productos distintos.
4. Fotografiar las tres copias y las etiquetas de los nombres más largo y más corto.