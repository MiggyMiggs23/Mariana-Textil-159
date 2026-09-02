# Verificación de utilidad y explicaciones estadísticas

**Fecha local:** 2026-09-01  
**Alcance:** nomenclatura monetaria, tarjeta de utilidad acumulada por cliente, explicaciones de gráficas y tablas estadísticas, exportaciones y verificación aislada.

## Resultado ejecutivo

- Los importes de ganancia revisados se presentan como **Utilidad**; los porcentajes conservan **Margen**.
- El bloque de nomenclatura no cambió fórmulas. En Caja, cortes, Clientes y Reportes la utilidad revisada conserva la resta de venta menos costo congelado.
- `MARGEN_BAJO` permanece como identificador interno. No es un importe ni un rótulo monetario mostrado al usuario.
- La tarjeta de utilidad acumulada por cliente inicia oculta en cada montaje, muestra `••••••` y usa un control táctil y accesible de 44 px para mostrar u ocultar.
- El servidor omite la utilidad acumulada para SUPERVISOR. La reciben ADMIN y usuarios no SUPERVISOR con el permiso efectivo `clientes_finanzas.ver`; el ojo no sustituye esta autorización.
- Cada gráfica y tabla estadística auditada presenta debajo una sola oración basada en la consulta real.

## Verificación contable y diferencias de alcance

La utilidad monetaria revisada usa venta menos costo congelado. Caja, cortes, Clientes y los reportes de ventas agregan líneas vendidas dentro de sus filtros. Proveedores aplica la misma resta, pero solo a ventas asociadas con rollos recibidos del proveedor consultado. Esta diferencia es de población y alcance, no de fórmula; por eso dos cifras de utilidad pueden cubrir conjuntos distintos sin contradecir la aritmética.

La utilidad acumulada del cliente recorre todo su historial, no el periodo visible en la analítica. Suma únicamente líneas con costo congelado conocido y devuelve por separado `lineasExcluidasSinCosto`. No reutiliza el campo histórico `margen`, porque ese campo queda pendiente cuando existe al menos una línea sin costo.

La medición de solo lectura realizada en development encontró **9 líneas vendidas a clientes**, **0 sin costo congelado** y **0.00% excluidas**. En ese corte la tarjeta es completa; el contador visible conserva la advertencia para futuros datos incompletos.

## Discrepancias detectadas al leer consultas

1. **Pérdida estimada:** el bloque no dispone de un precio de venta observado, por lo que su importe monetario permanece en cero. La explicación lo declara en vez de inferir una pérdida monetaria desde el título.
2. **Compras por mes de un cliente:** la consulta suma `ticket.total`, por lo que la oración especifica **total con IVA**.
3. **Comparativo de Caja:** las ventas y la utilidad de sus gráficas son importes sin IVA; la explicación lo declara.
4. **Unidades de gráficas genéricas:** el renderizador forzaba conteo para toda serie. Ahora respeta la unidad declarada por el backend, sin cambiar datos.
5. **Destinos financieros de Caja:** PostgreSQL no podía unir directamente los enums distintos de pago de ticket y cuenta. La consulta convierte ambas fuentes a texto antes del `UNION`; importes y reglas de clasificación no cambian.
6. **Precisión de exportación:** una prueba esperaba tres decimales para cantidades, aunque la presentación vigente usa dos. Se alineó únicamente la expectativa del contrato.
7. **Limpieza de integración:** Caja intentaba borrar pagos y movimientos protegidos como append-only. La prueba ahora conserva esos registros y usa la eliminación de la rama Neon como frontera de limpieza.

## Cobertura de explicaciones

El mapa central cubre los 40 identificadores literales de gráficas y tablas emitidos por Reportes. También se auditaron las superficies estadísticas externas: inventario del Dashboard, comparativo de Caja, detalle y analítica global de Clientes, y detalle de Proveedores. Las oraciones declaran periodo, alcance, IVA, unidad y exclusiones cuando la consulta correspondiente los hace relevantes.

Las tablas puramente operativas —por ejemplo historiales de movimientos o listas de documentos— no se trataron como tablas estadísticas. Las tablas de cartera, rankings, evolución, producto, tela y color sí incluyen explicación.

## Pruebas

### Sin mutar development

- Frontend, contratos completos: **89/89**.
- Explicaciones de reportes: **2/2**.
- Campos sensibles de utilidad: aprobado.
- Reportes, Caja, Clientes y exportaciones unitarias/contractuales: aprobadas después de alinear la expectativa de dos decimales.

### Mutantes en Neon desechable

Se creó una rama Neon desechable y bases vacías independientes por suite. Cada base recibió el esquema y seed vigentes; antes de probar se verificó `current_database()` y se inicializó la API. `TEST_DATABASE_URL` fue distinta de `DATABASE_URL` y las guardas `NODE_ENV=test` y `REQUIRE_ISOLATED_TEST_DATABASE=1` permanecieron activas.

- Reportes de integración: **4/4**.
- Caja / analítica administrativa: **1/1**.
- Clientes: **10/10** — ledger **1/1** y API **9/9**.
- POS/Caja: **35/35**.

No se crearon usuarios, ADMIN ni sesiones en development. Los usuarios y sesiones de prueba existieron únicamente dentro de las bases desechables. No se ejecutó limpieza de usuarios, sesiones, pagos ni auditoría sobre development.

La captura móvil final está en `reports/2026-09-01-verificacion-movil.jpg`. Sin crear una sesión de development, la vista muestra correctamente el login responsivo; las respuestas 401 observadas corresponden a consultas protegidas sin autenticación.

## Conclusión

La nomenclatura distingue dinero de porcentaje, la tarjeta protege la cifra frente a miradas casuales y frente a roles no autorizados, y las explicaciones describen las consultas reales. Las fórmulas del bloque de nomenclatura se conservaron. Las discrepancias encontradas quedaron corregidas cuando eran de presentación o tipado, y documentadas cuando reflejan el alcance real del dato.