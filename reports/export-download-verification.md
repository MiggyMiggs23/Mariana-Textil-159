# Verificación de descargas XLSX/PDF de Reportes (solo lectura)

Estado: **HTTP_READ_ONLY_EXPORTS_COMPLETED**.

## Alcance y limitación

Se montaron los routers reales en un arnés Express local sobre `127.0.0.1`.
No es una descarga contra la aplicación desplegada, no es un navegador y no crea una sesión real:
el arnés inyecta un contexto autorizado en memoria. La comprobación sí invoca los handlers HTTP
reales y recibe sus bytes. El contexto ADMIN se usó para cubrir las cinco pestañas y el comparativo;
la matriz de Control conserva el middleware de rol real y verifica ADMIN/non-ADMIN.

Todas las lecturas, incluidas las hechas por rutas y comparativos, usaron una única conexión
`READ ONLY REPEATABLE READ`. Se rechazaron sentencias de escritura. No se ejecutaron inicializadores,
usuarios, sesiones, fixtures ni escrituras de negocio. El reporte no contiene filas ni nombres privados.

## Fuentes de pantalla cubiertas

La composición se comparó contra las respuestas JSON de cada fuente que consume la pantalla:
`Ventas`, `Qué comprar` (`que-comprar`, `inventario`, `mapas-calor`, `color`, `compras`),
`Utilidad`, `Clientes` (`clientes`, `pagos-dirigidos`) y `Control operativo`
(`control-operativo` más `admin/diferencias`). Ventas global incluye también X04
(`admin/comparacion-tiendas`), tanto en Normal como en Comparar.

## Resultados

- Snapshot: `single READ ONLY REPEATABLE READ connection`
- Periodo real seleccionado: `2026-01-01/2026-12-31`
- Sitios elegibles para marcos de comparación: 7
- Casos verificados: 10
- Errores: 0

| Vista | Modo | Fuentes (KPI/chart/tabla/filas) | XLSX bytes / SHA-256 | PDF bytes / SHA-256 | Pantalla=builder |
|---|---|---|---:|---|---|
| ventas | normal | ventas 9/3/18/35; admin/comparacion-tiendas 0/3/1/3 | 31338 / `a0defbbcc0ccb3d1e90af36560f18f221c6ba9c0e7bf3aacb5cec642d9479471` | 21363 / `7646c4daf438dfb4a57bd0f281d06f24e03fdacf211802ccb76a65de8b72e475` | true |
| que-comprar | normal | que-comprar 4/1/1/13; inventario 20/2/4/1279; mapas-calor 1/3/0/0; color 0/1/3/1244; compras 4/1/7/244 | 263880 / `a974a28cad2812075781b1b4a1abde6841aeff266bf82b0f2ccb7610379c668a` | 2224719 / `e2c225ca19808dac7d25dcfc93724f214a61afbe5adf565af6926e355cd3e2a0` | true |
| utilidad | normal | utilidad 11/1/13/31 | 22099 / `9a49a755966383882124968bda8c8f86010630d284237a6baf4f8de05b81a385` | 13463 / `f05763df92bef828e385c984266023fb8c9083b2fe2c4ea172599ae4dfa66454` | true |
| clientes | normal | clientes 4/1/6/3; pagos-dirigidos 1/0/1/0 | 15207 / `d967aa292c95ce5153f1fad4844419d39bb94507c6276ad51db319d1b82cfa64` | 4035 / `2bc6bae5560bf7451d2e4ddceb23ca58474b909346781c521c217fd65e5dfa93` | true |
| control-operativo | normal | control-operativo 7/0/6/26; diferencias-caja 7/2/2/0 | 17768 / `e018f5d520bd35d783a17aa71d986fa34139ad006d362b92f912236b8678fd7d` | 10189 / `862fd109a81f66eb619e96e278a59369106b51fc5d9d1cb65a196d97becef821` | true |
| ventas | comparar | ventas 8/3/18/0; ventas 8/3/18/0; ventas 9/3/18/33; ventas 8/3/18/0; ventas 8/3/18/0; ventas 9/3/18/14; ventas 8/3/18/0; admin/comparacion-tiendas 0/3/1/3 | 132917 / `898f0e346a006ec458bca54f5579621e6398bc9d3028f1ae38f21983e8650cff` | 39981 / `69f33e439d043cd36b5f54e430280945c8a883da7ad5d87bb8b0593df83d00e1` | true |
| que-comprar | comparar | que-comprar 2/0/1/0; inventario 16/2/4/0; mapas-calor 1/3/0/0; color 0/1/3/0; compras 3/1/7/0; que-comprar 2/0/1/0; inventario 20/2/4/1; mapas-calor 1/3/0/0; color 0/1/3/0; compras 3/1/7/0; que-comprar 4/1/1/13; inventario 20/2/4/21; mapas-calor 1/3/0/0; color 0/1/3/13; compras 4/1/7/90; que-comprar 2/0/1/0; inventario 20/2/4/11; mapas-calor 1/3/0/0; color 0/1/3/1; compras 4/1/7/154; que-comprar 2/0/1/0; inventario 16/2/4/0; mapas-calor 1/3/0/0; color 0/1/3/0; compras 3/1/7/0; que-comprar 2/0/1/0; inventario 20/2/4/11; mapas-calor 1/3/0/0; color 0/1/3/3; compras 3/1/7/0; que-comprar 2/0/1/0; inventario 16/2/4/0; mapas-calor 1/3/0/0; color 0/1/3/0; compras 3/1/7/0 | 267896 / `22326a5b6cd78747883ecc67764497c4f9e38e2d2d11978c7f4dc299a50dceed` | 1462274 / `3b93787606440c7218bb9034644b1ce24dc0fb4e59223e829a08da4dc69810c6` | true |
| utilidad | comparar | utilidad 11/1/13/2; utilidad 11/1/13/2; utilidad 11/1/13/27; utilidad 11/1/13/2; utilidad 11/1/13/2; utilidad 11/1/13/11; utilidad 11/1/13/2 | 89571 / `d1d40c918865fbd433f0136b16bc97c5f11c5279f5d85ae10761faddb86afc9f` | 35673 / `595027fe744298885ba896b5c5e4c7791b13cda843e8368bc1afbf93fdb24418` | true |
| clientes | comparar | clientes 4/1/6/0; pagos-dirigidos 1/0/1/0; clientes 4/1/6/0; pagos-dirigidos 1/0/1/0; clientes 4/1/6/3; pagos-dirigidos 1/0/1/0; clientes 4/1/6/0; pagos-dirigidos 1/0/1/0; clientes 4/1/6/0; pagos-dirigidos 1/0/1/0; clientes 4/1/6/3; pagos-dirigidos 1/0/1/0; clientes 4/1/6/0; pagos-dirigidos 1/0/1/0 | 51346 / `12e3dd892ea9399a82fd8e54ac96c21272344fcea3cf06d55049de199268cd46` | 17335 / `90777ee89efc7fb71687af3d87e5e55022b6e87d27f78306d2ffa9835b3480dc` | true |
| control-operativo | comparar | control-operativo 7/0/6/0; diferencias-caja 7/2/2/0; control-operativo 7/0/6/0; diferencias-caja 7/2/2/0; control-operativo 7/0/6/26; diferencias-caja 7/2/2/0; control-operativo 7/0/6/0; diferencias-caja 7/2/2/0; control-operativo 7/0/6/0; diferencias-caja 7/2/2/0; control-operativo 7/0/6/0; diferencias-caja 7/2/2/0; control-operativo 7/0/6/0; diferencias-caja 7/2/2/0 | 64194 / `4d932802480ef12d729af74b310509524a49852c99dd827d1ef5e1d7bba71482` | 23445 / `eed12be035b690a55e56333bcc15672c81494b8450fb9f6c3db1a5b5f20293bb` | true |

Los hashes de contenido y bytes son evidencia de integridad, no sustituyen la lectura del documento.
Cada XLSX se abrió con ExcelJS y se verificaron hojas, encabezados, todos los KPI, filas, totales,
gráficas, avisos y alertas. Cada PDF se abrió con fitz si estuvo instalado; en este entorno se usaron
`pdftotext` y `pdftoppm` para extraer texto y renderizar la primera y última página.
Se comprobó que el texto incluyera las últimas columnas/valores y se compararon bytes/texto
contra el PDF esperado del mismo modelo compuesto.

## Matriz de autorización de Control

| Ruta | non-ADMIN | ADMIN |
|---|---:|---:|
| `/api/reportes/control-operativo/export.xlsx` | 403 | 200 |
| `/api/reportes/control-operativo/export.pdf` | 403 | 200 |
| `/api/reportes/vistas/control-operativo/export.xlsx` | 403 | 200 |
| `/api/reportes/vistas/control-operativo/export.pdf` | 403 | 200 |

## Artefactos locales

- `reports/exports/reportes-ventas-normal-global.xlsx` (modo 0600; bytes/hash están en la tabla anterior).
- `reports/exports/reportes-ventas-normal-global.pdf` (modo 0600; bytes/hash están en la tabla anterior).

## Limitaciones y fallos históricos

Fitz/PyMuPDF: no disponible; no se instaló.
No se afirma descarga desde una aplicación desplegada ni autenticación de navegador.
La numeración/mapa de los nueve fallos originales no es recuperable en este contexto; se deja
deliberadamente para el agente propietario. La evidencia de este pase cubre el punto 8 de exports
y la comprobación de permisos Control sin inventar una correspondencia numérica.
