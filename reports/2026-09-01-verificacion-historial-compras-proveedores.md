# Verificación — Historial de compras a proveedores

Fecha: 2026-09-01  
Zona horaria: America/Mexico_City

## Resultado

Se añadió una pestaña global **Historial de compras** dentro de Proveedores. No se añadió ruta ni entrada lateral y no existe equivalente en Clientes. Cada fila representa la combinación entrada/producto: los rollos del mismo producto se suman por `cantidad_inicial`, por lo que una entrada de 750 rollos repartida entre dos productos produce dos filas.

La consulta usa `resolveReadScope`; para alcance PROPIA sustituye cualquier sitio solicitado por el asignado. El permiso es `proveedores.ver`, no el módulo financiero ni un módulo nuevo.

## Datos y volumen

La lectura real, sin mutaciones, devolvió 13 filas agrupadas y 3 sitios. La primera fila estaba ordenada por fecha descendente y conservó unidad `METRO`. El reporte de volumen está en `reports/2026-09-01-volumen-historial-compras-proveedores.md`: diseño para 5,000 filas/año, paginación de servidor de 50 filas y máximo de 100.

Se añadieron y aplicaron de forma aditiva:

- `rollos(recepcion_id, producto_id)`
- `entradas(fecha, id)`

El `db:push` general se abortó sin cambios porque propuso truncar `ubicaciones` para una restricción antigua ajena. Se aplicaron únicamente los dos índices con `CREATE INDEX IF NOT EXISTS`; no se aceptó la operación peligrosa.

## Ordenamiento y presentación

- Seis columnas ordenables: fecha, producto, proveedor, color, sitio y cantidad.
- Solo dos estados: ascendente y descendente.
- Predeterminado y primer clic en Fecha: más reciente primero.
- Desempate estable por entrada descendente y producto ascendente.
- Cambio por query de servidor sin recarga completa.
- Encabezado activo destacado; columnas inactivas muestran indicador de ordenabilidad.
- Encabezados sticky, alto máximo de 600 px y desplazamiento horizontal.
- Un único enlace por fila, en Producto, hacia el detalle de Entrada.
- Cantidad con `formatNumber(..., { kind: "quantity" })` y `formatUnit`.
- Sin fila de totales.

## Pruebas

- Frontend: 89/89 aprobadas, incluyendo el contrato nuevo de ubicación, enlace único, unidad, sticky y límite de altura.
- Backend específico: 3/3 aprobadas para las seis columnas, dos direcciones, orden predeterminado/estable y granularidad entrada-producto.
- `pnpm run typecheck`: aprobado.
- `pnpm run build`: aprobado.
- Consulta real de solo lectura: aprobada.
- API y web: reiniciadas y operativas; startup de esquema completo y sin errores.

## Escritorio y teléfono

Se capturó `/proveedores` a 1440×1000 y 390×844. La app respondió y el acceso se adapta correctamente; el preview no tenía sesión autenticada y redirigió al login con respuestas 401 esperadas. No se crearon usuarios, contraseñas ni sesiones artificiales para forzar acceso al contenido protegido.

La superficie protegida se verificó por typecheck, build y contrato estático de responsive: filtros apilables, tabla `overflow-auto`, encabezado sticky y límite vertical. Evidencia:

- `reports/evidence/historial-proveedores-desktop.jpg`
- `reports/evidence/historial-proveedores-mobile.jpg`

## Datos ficticios

No se añadieron datos ficticios al código ni al seed. No se mutaron filas de development para fabricar el escenario de 750 rollos.