# Tareas 6–7 — revisión de fuente, no recorrido de navegador

## Alcance y linaje

Fuente de verdad de versión activa: `replit.md` (encabezado 26/09), API `artifacts/api-server/dist-auditoria-colaborativa-final-20260925`, web `artifacts/mariana-textil/dist-auditoria-colaborativa-mensaje-20260925`. Contrasté `App.tsx`, fuentes HEAD y `reports/auditoria-colaborativa/staging/frontend-root-mensaje` (copia congelada usada para el web activo), y el contrato `GET /inventario/existencias/agrupadas` de `artifacts/api-server/src/routes/inventario.ts`/`lib/api-zod/src/generated/api.ts`. Los tres archivos modificados eran **idénticos byte a byte** entre HEAD y esa copia congelada antes de editar; por tanto, el defecto descrito pertenece también a la línea activa. El JS activo incluye referencias a PIEZA pero no el encabezado/total de piezas del inventario agrupado. No se modificó staging, dist, DB ni workflows.

Inventario de rutas de pantalla en el router (`App.tsx`, 76 rutas literales más fallback), agrupadas por flujo. Esto es **inventario estático, no una afirmación de recorrido funcional**; las rutas con compuertas E3/E5/E7/E10/E11 solo existen si está habilitada su bandera:

- Autenticación/tableros: `/login`, `/`, `/inventario/vista-global`.
- Configuración/administración: `/ubicaciones`, `/usuarios`, `/permisos`, `/administracion/conciliacion`, `/auditoria`, `/directorio/camionetas`, `/directorio/choferes`, `/equipos`.
- Entrada: `/entradas`, `/entradas/pendientes-costo`, `/entradas/:id/documento`, `/entradas/:id/etiquetas`.
- Salida/transporte: `/salidas`, `/salidas/nueva`, `/salidas/:id`, `/salidas/:id/documento/salida`, `/viajes`, `/viajes/nuevo`, `/viajes/:id`, `/viajes/:id/documento`, `/contenedores`, `/contenedores/nuevo`, `/contenedores/:id`.
- Existencia/catálogo: `/inventario`, `/inventario/auditorias`, `/inventario/stock-minimos`, `/inventario/rollos/:id`, `/inventario/rollos/:id/etiqueta`, `/inventario/ajustes`, `/movimientos`, `/etiquetas`, `/productos`, `/productos/:id`, `/precios`, `/precios/:id`.
- Venta/cobro: `/pos`, `/cobros`, `/caja/tiempo-real`, `/caja/tiendas/:ubicacionId/ventas`, `/caja/cortes`, `/caja/diferencias`, `/caja/cuentas-destino`, `/caja/cuentas-destino/:cuentaDestino`, `/caja/atribucion-e7` (E7), `/caja/comparativo`, `/pagos-dirigidos`, `/tickets/:id`, `/recibos-e3/:folio` (E3), `/cobros/pendientes`, `/cobros/pendientes/:id`, `/cobros/pendientes/:id/documentos/:documentoId` (E5).
- Clientes/proveedores/reportes: `/clientes`, `/clientes/:id`, `/clientes/:id/movimientos/:movimientoId`, `/proveedores`, `/proveedores/:id`, `/reportes`, `/reportes/:tab`, `/alertas`, `/notificaciones`.
- Condicionales: `/fondo`, `/fondo/movimientos`, `/fondo/movimientos/:id`, `/fondo/arqueos`, `/fondo/arqueos/:id` (E10), `/contabilidad/fiscal`, `/contabilidad/fiscal/facturas/:id`, `/contabilidad/finanzas`, `/contabilidad/finanzas/clientes/:id`, `/contabilidad/conciliaciones`, `/contabilidad/conciliaciones/:id`, `/contabilidad/preparaciones`, `/contabilidad/preparaciones/:id` (E11). Más fallback `NotFound`.

### Hallazgo confirmado y corrección enfocada

**Inventario > Agrupado por Producto, unidad PIEZA invisible en sumarios**. El API ya devuelve `totalPiezas` por tela y la lista de colores con `cantidadTotal`/`unidad`; la web activa/HEAD presenta columnas para metros, kilos y bolsas, pero no piezas. En consolidado el pie agrega tres unidades y omite piezas: 7 rollos PIEZA pueden contabilizarse como 7 rollos con cero cantidad visible hasta expandir color, contradiciendo `replit.md:386` (totales PIEZA separados) y la prohibición de mezclar unidades. Corregí solo UI y su helper de suma decimal: columna PIEZA condicional local y permanente en consolidado, pie PIEZA filtrado con suma exacta separada; `colSpan` de encabezado, carga y renglón expandido se ajusta a las columnas presentes. No se altera contrato ni cálculo API. Regresión de helper con METRO/KILO/BOLSA/PIEZA mezclados y filtro, tres tests verdes; `pnpm --filter @workspace/mariana-textil typecheck` y `git diff --check` verdes. **No hay prueba de navegador ni validación visual**; MAIN debe realizarla junto a las restantes.

Otras reglas inspeccionadas en fuente, sin certificación E2E: el router ofrece rutas de documentos por `:id` interno (excepto recibo E3 por folio, contrato existente), `movimientos` ya muestra resumen separado por cuatro unidades y `salida-detail` presenta totales separados; el contrato de `detail-link-tables.contract.test.ts` cubre enlaces estables de producto, rollo, entrada, salida, viaje y contenedor. No se concluye que **todas** las cifras del sistema tengan desglose y folio, ni que cada color tenga semántica correcta: una auditoría exhaustiva de 76 rutas y UI autenticada requiere recorrido navegador MAIN. No inventé destino donde falta contrato; no toqué permisos (otro responsable). Las decisiones sobre destinos ausentes/identidades ambiguas quedan pendientes del propietario conforme a `replit.md:66`. No hay capturas de esta tarea; no hubo commits ni liberación.

### Overlay exacto para MAIN

Base congelada de los **tres** archivos: `reports/auditoria-colaborativa/staging/frontend-root-mensaje/` seguido por la ruta indicada. Verificación SHA256 previa (en orden):

| Ruta bajo `artifacts/mariana-textil/src/` | staging previo | fuente corregida |
| --- | --- | --- |
| `pages/inventario.tsx` | `e3f585760c162f732c273b0a68a67f3badf27927e0b75a43842e97b533a29064` | `4db08031f8cb37e1568b83f039bf9215b08a83c7b7161c081dde4b7dc3e4fba2` |
| `lib/inventory-global-totals.ts` | `20061268c87ef9865e482b1f45a977ae8be0b4647334fcdc844eba46e012037e` | `ecd1f9848cc94271ad6c86a19b841b9d2043f5d52b9c632c9c342815ac9ca1c8` |
| `lib/inventory-global-totals.test.ts` | `525894187018eba9d1793f36a31ef8366c5efba0e5fdbea713144ba585e1a337` | `ecdb8a9bb4f768157179c66ba8da77c15c176955d7f47f6b6d971e4156e261c3` |

**Overlay = reemplazar exclusivamente esos tres archivos de staging con los tres archivos de fuente corregidos de las mismas rutas, tras comprobar hashes de base y antes de construir un candidato nuevo.** Para inspeccionar el diff exacto: `git diff -- artifacts/mariana-textil/src/pages/inventario.tsx artifacts/mariana-textil/src/lib/inventory-global-totals.ts artifacts/mariana-textil/src/lib/inventory-global-totals.test.ts`. Ningún otro archivo integra esta corrección. MAIN decide composición/liberación; la versión actualmente servida conserva el defecto.