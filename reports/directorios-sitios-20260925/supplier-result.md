# Proveedores — resultado final aprobado, sin RFC nuevo

## Exclusión explícita del RFC de proveedores

Por decisión actual del propietario se retiró **únicamente** el nuevo RFC de proveedores. Se quitaron:

- `lib/db/src/schema/proveedores.ts`: la propiedad `rfc: text("rfc")`. El esquema Drizzle vuelve a las columnas anteriores.
- `lib/db/migrations/20260925_supplier_rfc.sql`: script candidato eliminado **sin haber sido aplicado**. No hay DDL requerido para proveedores.
- `lib/api-spec/openapi.yaml`: propiedad/required RFC solamente de `Proveedor` y `ProveedorMetricas`, y propiedad opcional RFC solamente de `ProveedorInput` y `ProveedorUpdate`. Los RFC de **clientes** y el endpoint `/proveedores/directorio` permanecen.
- `artifacts/api-server/src/routes/proveedores.ts`: exclusivamente `rfc: row.rfc` en presentación, `rfc` en inserción, campo `rfc` en tipo de updates y asignación RFC en PATCH. No se alteraron otros campos ni el GET operativo.
- `artifacts/mariana-textil/src/pages/proveedores.tsx`: búsqueda/placeholder ya solo incluyen nombre, contacto y teléfono; retirado RFC del estado, envío, reseteo y campo del formulario de alta.
- `artifacts/mariana-textil/src/pages/proveedor-detail.tsx`: retirado RFC del estado/envío y de visualización/edición/impresión; se conserva el resto de datos y actualización del caché al editar.
- `artifacts/mariana-textil/src/proveedores-historial.contract.test.ts`: reemplazada prueba del RFC rechazado por una prueba pura de ausencia de RFC proveedor y búsqueda aprobada.
- Codegen actualizó `lib/api-client-react/src/generated/api.schemas.ts`, `lib/api-client-react/src/generated/api.ts`, `lib/api-zod/src/generated/api.ts`, `lib/api-zod/src/generated/types/proveedor.ts`, `proveedorMetricas.ts`, `proveedorInput.ts`, `proveedorUpdate.ts` para reflejar **sin RFC proveedor**. Otros generados de directorio se mantienen; archivos de clientes no fueron modificados por esta tarea.

## Función conservada para ensamblaje seguro

- `artifacts/api-server/src/routes/proveedores.ts`: GET aditivo `/proveedores/directorio?period=1m|3m|1y|all` antes de `/:id`, sin modificar GET `/proveedores` operativo ni sus consumidores. Exige sesión y **ambos** `proveedores.ver` y `proveedores_finanzas.ver` antes de SQL. `resolveReadScope(req.auth!)` limita los conteos a `e.ubicacion_id` autorizado; error de alcance 403 y periodo inválido 400. Cada entrada cuenta una compra independientemente de sus líneas, con fecha `entradas.fecha` y periodos móviles `America/Mexico_City`. La respuesta presenta `proveedorId`, `purchaseCount`, `period`, sin importes; ausencia de proveedor en agregación equivale a cero en UI.
- `lib/api-spec/openapi.yaml` y archivos generados del directorio: contrato aditivo que documenta ambos permisos y el alcance. Tipos nuevos conservados: `lib/api-zod/src/generated/types/listProveedoresDirectorioParams.ts`, `listProveedoresDirectorioPeriod.ts`, `proveedoresDirectorioResult.ts`, `proveedoresDirectorioResultItemsItem.ts`, `proveedoresDirectorioResultPeriod.ts`, más sus barrels.
- `artifacts/mariana-textil/src/pages/proveedores.tsx`: historial **existente** reutilizado bajo «Últimas compras»; conserva cards, columnas, filtros, alta, purga y análisis aprobado. Selector Nombre A–Z / Mayor demanda, periodo mes/3 meses/año/todo el tiempo y conteo visible disponibles solo con permiso financiero. Para usuarios de catálogo, conserva búsqueda por subcadena de nombre/contacto/teléfono y columnas/orden no financieros, sin pedir ni mostrar conteos. Encabezados de datos ordenan de verdad; error de conteos visible sin ocultar demás información. Se conservan simplificaciones aprobadas 1,2,6,7,8 implementadas por otros trabajos, sin revertir archivos completos.
- `artifacts/mariana-textil/src/lib/supplier-directory-sort.ts`: comparador puro del directorio; fecha de última compra NULL va al final en orden ascendente y descendente, sin mutación del arreglo original.
- `artifacts/mariana-textil/src/proveedores-historial.contract.test.ts`: pruebas puras de preservación del historial y simplificaciones, permisos/sitio, búsqueda sin RFC y orden NULL-last.

**Builder:** ensamblar desde mapas activos retenidos, **no HEAD**. En router de proveedor portar solo imports de `ListProveedoresDirectorioQueryParams`/`Response` y GET `/proveedores/directorio` con **ambos middlewares** de permiso y predicado territorial; **no portar** ninguno de los cuatro hunks RFC antiguos. No incluir `20260925_supplier_rfc.sql` ni un esquema Drizzle con RFC. Usar contrato/codegen final sin RFC proveedor y mantener intactos los RFC de cliente. No se requiere DDL para este trabajo.

## Verificaciones y límites

- `pnpm --filter @workspace/api-spec run codegen` incluyendo `typecheck:libs`: aprobó.
- `pnpm --filter @workspace/api-server run typecheck` y `pnpm --filter @workspace/mariana-textil run typecheck`: aprobaron.
- `node scripts/src/frontend-test-runner.mjs src/proveedores-historial.contract.test.ts`: **7/7** pruebas puras aprobaron (permisos y alcance por inspección de ruta, comparador real fechas NULL en ambos sentidos). `git diff --check` de fuentes propias aprobó.
- No hubo conexión a base viva, ejecución de SQL, activación, reinicio ni workflows. No se probaron respuestas autenticadas; el main maneja ensamblaje y liberación.