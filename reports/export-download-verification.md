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
- Casos verificados: 2
- Errores: 0

| Vista | Modo | Fuentes (KPI/chart/tabla/filas) | XLSX bytes / SHA-256 | PDF bytes / SHA-256 | PDF lectura independiente | Pantalla=builder |
|---|---|---|---:|---|---|---|
| ventas | normal | ventas 9/3/18/35; admin/comparacion-tiendas 0/3/1/3 | 33360 / `44f54299f06efd71d6c19fcbad6e0383ef41f2a2934ed6ae37851628ea981b0e` | 41502 / `1b69cc5feada70c721ea471d935d5ea18e781b4e652644a3ebbca67cd483717f` | 25 tablas, 25 encabezados, 12 totales, 348 valores | true |
| que-comprar | normal | que-comprar 4/1/1/13; inventario 20/2/4/1279; mapas-calor 1/3/0/0; color 0/1/3/1244; compras 4/1/7/244 | 268650 / `9a5d83c801e5bcd8a52c02806278fca956a0847daae0678a5ee3d1090650afb2` | 1279019 / `cda5ff9d1966026939da3614310cdae31b309cff2cb9656e44fd80081d779d6a` | 23 tablas, 23 encabezados, 10 totales, 314 valores | true |

Los hashes de contenido y bytes son evidencia de integridad, no sustituyen la lectura del documento.
Cada XLSX se abrió con ExcelJS y se verificaron hojas, encabezados, todos los KPI, filas, totales
significativos, gráficos, avisos, alertas, filtros legibles y celdas numéricas nativas.
Cada PDF descargado se abrió con fitz si estuvo instalado y además con `pdftotext` independiente;
se verificaron periodo en español, encabezados de tabla, totales significativos, caracteres
`Página Día Participación →`, ausencia de U+FFFD/sustituciones ASCII y ausencia de JSON interno.
fitz o pdftoppm confirmó renderización independiente; cuando se retuvieron artefactos se guardaron primera,
página que contiene X04 y última para inspección visual. No se compara contra otro PDF del mismo generador.

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
- `reports/exports/reportes-ventas-normal-global-page-1.png` (modo 0600; bytes/hash están en la tabla anterior).
- `reports/exports/reportes-ventas-normal-global-page-8.png` (modo 0600; bytes/hash están en la tabla anterior).
- `reports/exports/reportes-ventas-normal-global-page-10.png` (modo 0600; bytes/hash están en la tabla anterior).
- `reports/exports/reportes-que-comprar-normal.xlsx` (modo 0600; bytes/hash están en la tabla anterior).
- `reports/exports/reportes-que-comprar-normal.pdf` (modo 0600; bytes/hash están en la tabla anterior).
- `reports/exports/reportes-que-comprar-normal-page-1.png` (modo 0600; bytes/hash están en la tabla anterior).
- `reports/exports/reportes-que-comprar-normal-page-709.png` (modo 0600; bytes/hash están en la tabla anterior).

## Limitaciones y fallos históricos

Fitz/PyMuPDF: no disponible; no se instaló.
No se afirma descarga desde una aplicación desplegada ni autenticación de navegador.
La numeración/mapa de los nueve fallos originales no es recuperable en este contexto; se deja
deliberadamente para el agente propietario. La evidencia de este pase cubre el punto 8 de exports
y la comprobación de permisos Control sin inventar una correspondencia numérica.
