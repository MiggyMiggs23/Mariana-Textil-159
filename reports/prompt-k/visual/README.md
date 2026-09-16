# Propuesta Clientes — entrega visual estática

- `propuesta-clientes.html` es una exportación autónoma: el CSS está incluido y no carga fuentes, imágenes, datos ni dependencias externas.
- `propuesta-clientes-402x874.png` y `propuesta-clientes-1280x900.png` son las capturas requeridas, generadas localmente desde ese HTML que reproduce el marcado y las reglas efectivas de `PropuestaClientes.tsx` y `SummaryCard.tsx`.
- La propuesta conserva la composición de Proveedores: encabezado, cuadrícula responsive de cuatro `SummaryCard` y texto auxiliar.
- Todos los valores permanecen explícitamente desconectados. No se usan importes, conteos, cálculos ni métricas inventadas.