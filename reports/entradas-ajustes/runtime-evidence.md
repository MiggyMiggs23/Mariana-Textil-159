# Entradas ajustes · pasada UI montada aislada

- Estado: **FAIL** (1 falla(s) registrada(s)).
- Catálogo canónico REAL1234: 1234 productos; SHA-256: a34a2013ac78b42eb77b628105c43bc66a01f33cdcd22c5c4335f3f96b2089ab.
- Fuentes montadas: producción Entradas y ProductCombobox.
- API/auth: stubs locales Playwright; POST de creación interceptado, sin POST real; `window.open` solo registrado.
- Limitación: no es E2E autenticado; no verifica login, sesión, middleware, base de datos ni API real.

## Cobertura
- Proveedor inicial seleccionable y bloqueo posterior a la primera línea.
- Cambio explícito cancelado conserva proveedor y líneas; confirmación limpia líneas, resumen y estado editor.
- Contenedor compatible/incompatible; el incompatible conserva proveedor y líneas.
- Captura y edición/eliminación/recaptura de rollos.
- METRO/KILO/BOLSA/PIEZA en revisión con totales por unidad, proveedor, sitio, líneas y rollos.
- Guardar abre revisión sin mutación/impresión; cancelar conserva borrador.
- Error conserva borrador y reintento exitoso muta una vez y registra documento/etiquetas después del callback.
- Captura pendiente bloquea guardar.
- ProductCombobox real con catálogo completo y geometría en 402px/escritorio.

## Fallas reales
- `fresh-container-revalidation`: fresh unavailable container must prevent mutation

1 !== 0
 Selector/endpoint: button[data-testid="btn-confirm-entrada-review"] / POST /api/inventario/entradas.

Ver detalle y payloads observados en `runtime-evidence.json`.
