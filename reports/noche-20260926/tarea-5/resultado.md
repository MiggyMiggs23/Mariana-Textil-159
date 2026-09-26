# Tarea 5 — perfiles de contador

**Resultado: parcial, con fallos reproducibles del perfil A y conciliaciones detenidas por falta de entorno de periodos cerrados.**

Se crearon nativamente los usuarios sintéticos **F=241** y **A=242**; se asignó A mediante confirmación ADMIN y se leyó la asignación. No se reutilizaron usuarios reales copiados.

## Evidencia positiva

- A preparó una aplicación E5 mediante su pantalla específica. La preparación no movió dinero; ADMIN autorizó después de forma separada. Caso `../tarea-3/continuation-prepareA`.
- F abrió fiscal/conciliaciones y mostró rechazo de Fondo, proveedores, reportes y productos.
- Las lecturas API finales del mismo navegador autenticado F devolvieron **403** para Fondo, pagos del proveedor sintético 226, ticket 10 y cliente 2584. Identidad fiscal: **200, perfil F**.
- La proyección fiscal F consultada no contenía claves de contraseña/token/margen/costo/fondo/pagos a proveedor. El conjunto fiscal de ese intervalo era vacío: no se presenta esto como prueba de saneamiento de una factura no vacía.

## Defectos / bloqueos

- A presenta intermitencia persistente: `/api/e11/identidad` **503** (`DEPENDENCIA_NO_DISPONIBLE`) y accesos que deberían negarse consistentemente con 403 devolvieron **500**, incluso en un documento estático del mismo origen para detener lecturas SPA concurrentes. En la última lectura `/api/clientes/2584` sí devolvió 403.
- Hubo también fallos intermitentes de login HTTP 500 y esperas agotadas. No se confunden con autorización permitida ni con fuga demostrada de información.
- No se completaron conciliaciones día/semana/mes ni el aviso NO_CUADRA a ADMIN. MAIN no entregó una copia con reloj controlado y periodos cerrados que contuvieran una factura auténtica del ensayo. `continuation-fiscal/fiscal-result.json` conserva el bloqueo explícito **antes de escribir**. No se cambiaron fechas históricas, no se reinició reloj y no se concilió un periodo vacío para aparentar éxito.

## Fuentes

- `continuation-roles/roles-result.json`: altas/asignación y primer fallo.
- `accountant-boundaries/result.json`: pantallas y endpoints con IDs reales.
- `independent-final-readbacks/result.json`: última comprobación en sesión real, sin peticiones de fondo SPA.

Los errores preliminares de un experimento con `APIRequestContext` (401 por semántica distinta de cookie Secure en HTTP local) son problemas del harness, **no defectos de autorización**. Se sustituyó por `fetch` en documento imagen del mismo origen y se conservó la comprobación final del navegador.