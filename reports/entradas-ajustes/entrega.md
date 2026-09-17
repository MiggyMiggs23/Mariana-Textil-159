# Entradas — cuatro ajustes aprobados

## Implementación

1. **Documento de Entrada:** Producto contiene tela y color completos, sin repetir el SKU que permanece en su propia columna. Salida ya los separaba; la nota conserva su única aparición de SKU.
2. **Buscador aprobado:** tela, color y SKU separados, color sin truncar, unidad a la derecha y resumen completo del producto seleccionado. Catálogo real comprobado: 1,234 productos activos.
3. **Proveedor:** bloqueado al existir líneas. Cambiar proveedor requiere confirmar el vaciado; cancelar conserva todo. Quitar contenedor o cambiar sitio no cambia silenciosamente el proveedor de las líneas.
4. **Guardar:** abre revisión de proveedor/sitio, líneas, rollos, cantidades por unidad y productos con color completo. Cancelar conserva el borrador. Confirmar revalida y solo después guarda; las impresiones seleccionadas se abren tras el éxito.

La confirmación consulta disponibilidad vigente del contenedor. Error de consulta, incompatibilidad o indisponibilidad impiden el envío y conservan las líneas. Una búsqueda o captura pendiente no se omite silenciosamente; la confirmación queda protegida contra doble envío.

## Verificación final

- `pnpm run typecheck`: PASS completo, cero errores.
- Pruebas enfocadas: 17/17.
- Componente real del buscador: geometría de los 1,234 productos en escritorio y a 402 px.
- Recorridos aislados: bloqueo/cambio/cancelación de proveedor, contenedores compatibles e incompatibles, edición y eliminación de rollos, recaptura, productos pendientes, cuatro unidades, cancelación del resumen, fallo/reintento de guardado, payload y apertura de documentos tras el callback exitoso.
- La comprobación inicial detectó una consulta de disponibilidad desactualizada. Se corrigió y se revalidaron únicamente disponibilidad fresca, error de consulta y doble confirmación durante la consulta.
- PDF Chromium de Entrada: casos de 1, 10 y 11 líneas; paginación esperada de 1, 2 y 3 páginas contando series, nombre/color completos, SKU único, filas globales y margen seguro. Mínima separación de tinta: 5.2917 mm.
- Se actualizó una prueba obsoleta de enlaces para comprobar el componente de historial realmente montado; los enlaces productivos no se cambiaron.

## Evidencia y límites

El resultado de interfaz definitivo es `runtime-evidence-final.json` y su explicación `.md`; conserva la evidencia inicial y documenta la corrección. Los PDF y su informe están en `print-evidence/`. El fallo de contrato de enlaces guardado allí es histórico y fue sustituido por la ejecución final de 17 pruebas aprobadas.

Las pruebas montan componentes productivos con catálogo real y datos operativos interceptados. No se crearon usuarios, sesiones, entradas ni movimientos reales. No es una verificación autenticada ni una prueba con impresora física. La API y el motor de inventario no se modificaron.