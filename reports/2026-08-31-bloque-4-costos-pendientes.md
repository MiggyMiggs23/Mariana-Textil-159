# Diagnóstico — Costos pendientes

Fecha: 2026-08-31

## Navegación

El único botón de acceso a `/entradas/pendientes-costo` se oculta por debajo
del breakpoint `sm`. En una pantalla angosta el usuario no dispone de ese
acceso, aunque la ruta sí está registrada correctamente.

## Error al guardar

La captura de costos completa el total y registra el cargo de proveedor con
un `ON CONFLICT` dirigido a `entrada_id` para filas de tipo `COMPRA`. Ese SQL
depende del índice único parcial `pagos_proveedor_entrada_compra_idx`.

El índice está declarado para instalaciones nuevas, pero la rutina repetible
que actualiza instalaciones existentes al arrancar no lo crea. En una base
anterior a esa declaración, PostgreSQL rechaza el `ON CONFLICT` porque no
encuentra una restricción única coincidente y la API termina en error 500.

## Alcance de la corrección

No cambia la regla contable. Se hará repetible la creación del índice parcial
y se mantendrá un solo movimiento `COMPRA` por Entrada. El acceso a la
pantalla dejará de ocultarse en anchos pequeños.

## Hallazgos de la verificación E2E

La primera pasada móvil encontró además que la lista devolvía 500 porque
seleccionaba las iniciales del sitio sin incluirlas en el `GROUP BY`. También
se comprobó que actualizar la COMPRA en el conflicto era incompatible con el
trigger append-only del ledger.

La corrección final:

- agrupa explícitamente las iniciales del sitio;
- conserva la COMPRA existente cuando proveedor e importe coinciden;
- falla con un conflicto de dominio si la COMPRA existente no coincide;
- detecta cargos duplicados antes de instalar el índice y exige conciliación
  manual en vez de alterar movimientos financieros;
- mantiene el cargo diferido hasta capturar el costo real, según la decisión
  contable confirmada.

La comprobación HTTP autenticada sobre una rama Neon desechable terminó con
respuesta 200 y esquema válido para la lista de costos pendientes.