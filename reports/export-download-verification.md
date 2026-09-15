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

| Vista | Modo | Estado | Fuentes (KPI/chart/tabla/filas) | XLSX bytes / SHA-256 | PDF bytes / SHA-256 | PDF lectura + geometría | Pantalla=builder |
|---|---|---|---|---:|---|---|---|
| ventas | normal | **PASS** | ventas 9/3/18/35; admin/comparacion-tiendas 0/3/1/3 | 33360 / `3b4fe48827ac9ebd20c93e737e7a88ec931e3b385eb009c9edc9b4461dd6407d` | 41426 / `407b48fa90be93b34f3f8a63cb4083a07ea07828e6d326eb32c459b23ba54b6e` | 25 tablas, 25 encabezados, 12 totales, 348 valores; paneles 39/39; páginas vector 10/10, rectángulos 884, filas 155; palabras en celdas 1422, fuera 0, sin asignar 0; errores de fila 0, solapes de celdas 0; cobertura cuerpo 115/115 filas, 1359/1359 tokens, faltan 0 | true |
| que-comprar | normal | **PASS** | que-comprar 4/1/1/13; inventario 20/2/4/1279; mapas-calor 1/3/0/0; color 0/1/3/1244; compras 4/1/7/244 | 268651 / `3d7968280da420ad25ddd212260590040e7c1819cc72f92c711c619e8e4fb4bc` | 1283138 / `7071fcb1a04f0e8753e23e915e9eac76da80ba01a50598b6b2de151ae4feb858` | 23 tablas, 23 encabezados, 10 totales, 314 valores; paneles 36/36; páginas vector 709/709, rectángulos 49072, filas 17494; palabras en celdas 69135, fuera 0, sin asignar 0; errores de fila 0, solapes de celdas 0; cobertura cuerpo 16757/16757 filas, 108138/108138 tokens, faltan 0 | true |
| utilidad | normal | **PASS** | utilidad 11/1/13/31 | 23447 / `1146bad6e99466b80d61efbbe639ce132a45315b60a9938665f3708fe3ef1780` | 31269 / `149caed59784895ac7915314b4a4402cd82b27e5629403fb720e0740ce954872` | 14 tablas, 14 encabezados, 6 totales, 195 valores; paneles 21/21; páginas vector 6/6, rectángulos 558, filas 97; palabras en celdas 803, fuera 0, sin asignar 0; errores de fila 0, solapes de celdas 0; cobertura cuerpo 74/74 filas, 778/778 tokens, faltan 0 | true |
| clientes | normal | **PASS** | clientes 4/1/6/3; pagos-dirigidos 1/0/1/0 | 16355 / `ee35b8552404a8afca803b5206fe2a52d3dd4eea399747e5c2ac80747da865e2` | 21208 / `6569ceb251f1d277bf1ce12669ea2f571d0884f2268f097aae55f9a639882025` | 8 tablas, 8 encabezados, 7 totales, 38 valores; paneles 11/11; páginas vector 3/3, rectángulos 144, filas 30; palabras en celdas 189, fuera 0, sin asignar 0; errores de fila 0, solapes de celdas 0; cobertura cuerpo 19/19 filas, 121/121 tokens, faltan 0 | true |
| control-operativo | normal | **PASS** | control-operativo 7/0/6/26; diferencias-caja 7/2/2/0 | 18925 / `711bfdc02fbb37c75908f08869fb01107b1096e80e74346ca1aa8f2691e3c3d2` | 26058 / `6db04bfef6c470e9c4678456cb94a77e8bce1deba94c11085142f050174f825a` | 10 tablas, 10 encabezados, 4 totales, 48 valores; paneles 16/16; páginas vector 5/5, rectángulos 394, filas 64; palabras en celdas 693, fuera 0, sin asignar 0; errores de fila 0, solapes de celdas 0; cobertura cuerpo 46/46 filas, 683/683 tokens, faltan 0; Control bloques 7/7 sin JSON; con contenido 7/7 | true |
| ventas | comparar | **PASS** | ventas 8/3/18/0; ventas 8/3/18/0; ventas 9/3/18/33; ventas 8/3/18/0; ventas 8/3/18/0; ventas 9/3/18/14; ventas 8/3/18/0; admin/comparacion-tiendas 0/3/1/3 | 142198 / `c8175d1fa9abc7925692619ad87f114a09b084559692c4cdf122c62a3d54bbca` | 113171 / `282708af632b31967323b8cca79ef91513f93e311754597b67668b2d075e2638` | 151 tablas, 151 encabezados, 78 totales, 991 valores; paneles 237/237; páginas vector 41/41, rectángulos 3153, filas 563; palabras en celdas 5143, fuera 0, sin asignar 0; errores de fila 0, solapes de celdas 0; cobertura cuerpo 315/315 filas, 2539/2539 tokens, faltan 0 | true |
| que-comprar | comparar | **PASS** | que-comprar 2/0/1/0; inventario 16/2/4/0; mapas-calor 1/3/0/0; color 0/1/3/0; compras 3/1/7/0; que-comprar 2/0/1/0; inventario 20/2/4/1; mapas-calor 1/3/0/0; color 0/1/3/0; compras 3/1/7/0; que-comprar 4/1/1/13; inventario 20/2/4/21; mapas-calor 1/3/0/0; color 0/1/3/13; compras 4/1/7/90; que-comprar 2/0/1/0; inventario 20/2/4/11; mapas-calor 1/3/0/0; color 0/1/3/1; compras 4/1/7/154; que-comprar 2/0/1/0; inventario 16/2/4/0; mapas-calor 1/3/0/0; color 0/1/3/0; compras 3/1/7/0; que-comprar 2/0/1/0; inventario 20/2/4/11; mapas-calor 1/3/0/0; color 0/1/3/3; compras 3/1/7/0; que-comprar 2/0/1/0; inventario 16/2/4/0; mapas-calor 1/3/0/0; color 0/1/3/0; compras 3/1/7/0 | 280053 / `e243f08dd16e827b16cd3a4275008452db1f55a600935b2252bb881c9e36c543` | 789793 / `027ed5b8b20b1abc5f001d08d9ee1224c4a33c50c1920e2ce98e79498871472c` | 155 tablas, 155 encabezados, 61 totales, 780 valores; paneles 210/210; páginas vector 477/477, rectángulos 29734, filas 12602; palabras en celdas 33740, fuera 0, sin asignar 0; errores de fila 0, solapes de celdas 0; cobertura cuerpo 11944/11944 filas, 67018/67018 tokens, faltan 0 | true |
| utilidad | comparar | **PASS** | utilidad 11/1/13/2; utilidad 11/1/13/2; utilidad 11/1/13/27; utilidad 11/1/13/2; utilidad 11/1/13/2; utilidad 11/1/13/11; utilidad 11/1/13/2 | 95454 / `feb3fd70e752584017db65467202c516405f3cd9ef1310dfdfec4ee381aa1a6a` | 85558 / `7bf12e49b9cd4d914188d91f91f101da3d2af5074f5211a6e87bda3f7da95e21` | 98 tablas, 98 encabezados, 42 totales, 666 valores; paneles 141/141; páginas vector 28/28, rectángulos 2084, filas 381; palabras en celdas 3295, fuera 0, sin asignar 0; errores de fila 0, solapes de celdas 0; cobertura cuerpo 227/227 filas, 1806/1806 tokens, faltan 0 | true |
| clientes | comparar | **PASS** | clientes 4/1/6/0; pagos-dirigidos 1/0/1/0; clientes 4/1/6/0; pagos-dirigidos 1/0/1/0; clientes 4/1/6/3; pagos-dirigidos 1/0/1/0; clientes 4/1/6/0; pagos-dirigidos 1/0/1/0; clientes 4/1/6/0; pagos-dirigidos 1/0/1/0; clientes 4/1/6/3; pagos-dirigidos 1/0/1/0; clientes 4/1/6/0; pagos-dirigidos 1/0/1/0 | 56302 / `d2d33a43bc4e3546b7370d37b2f39f6f7cda5f0037a08320f3f9d023e974e14d` | 49729 / `c6ee11e8c21190c1cc8a229a086ae56fbc138b8ea7274f58f25ad2fe1cedd80c` | 56 tablas, 56 encabezados, 49 totales, 186 valores; paneles 71/71; páginas vector 14/14, rectángulos 914, filas 185; palabras en celdas 1170, fuera 0, sin asignar 0; errores de fila 0, solapes de celdas 0; cobertura cuerpo 108/108 filas, 519/519 tokens, faltan 0 | true |
| control-operativo | comparar | **PASS** | control-operativo 7/0/6/0; diferencias-caja 7/2/2/0; control-operativo 7/0/6/0; diferencias-caja 7/2/2/0; control-operativo 7/0/6/26; diferencias-caja 7/2/2/0; control-operativo 7/0/6/0; diferencias-caja 7/2/2/0; control-operativo 7/0/6/0; diferencias-caja 7/2/2/0; control-operativo 7/0/6/0; diferencias-caja 7/2/2/0; control-operativo 7/0/6/0; diferencias-caja 7/2/2/0 | 68960 / `bc9f10671daea7bba1bdd738d45e7cac0231dc1b2d1131d19a3512801457bc18` | 62579 / `28ba0449349e737ad9ffa70fa8b58d01d7ff777f1394bbdf24f4ca3d1569fb71` | 70 tablas, 70 encabezados, 28 totales, 300 valores; paneles 106/106; páginas vector 20/20, rectángulos 1416, filas 278; palabras en celdas 2056, fuera 0, sin asignar 0; errores de fila 0, solapes de celdas 0; cobertura cuerpo 166/166 filas, 1319/1319 tokens, faltan 0; Control bloques 49/49 sin JSON; con contenido 49/49 | true |

Control Comparar: 49 bloques de sitio comprobados; 49 sin JSON crudo; coincidencias JSON: 0.
En cada caso se asociaron títulos en orden único y se extrajeron rectángulos vectoriales reales
de cada página del PDF; cada panel consume una fila de encabezado única con el conteo exacto
de columnas y todas sus etiquetas dentro de la celda correspondiente.
Las coordenadas no se reconstruyeron con anchos del renderer: se leyeron de los streams vectoriales
independientes y se rechazaron filas con huecos, celdas solapadas, texto fuera o palabras sin celda.
La comparación de texto contra rectángulos permite únicamente 5 pt de descenso tipográfico
documentado entre el bbox independiente y el rectángulo vectorial; no se relaja la geometría de celdas.
La cobertura del cuerpo exige todas las filas esperadas, forma de celdas y multiplicidad de tokens
de cada valor proyectado por panel, incluyendo columnas de identidad repetidas y filas envueltas.
Los hashes de contenido y bytes son evidencia de integridad, no sustituyen la lectura del documento.
Cada XLSX se abrió con ExcelJS y se verificaron hojas, encabezados, todos los KPI, filas, totales
significativos, gráficos, avisos, alertas, filtros legibles y celdas numéricas nativas.
Cada PDF descargado se abrió con fitz si estuvo instalado y además con `pdftotext` independiente;
se verificaron periodo en español, encabezados de tabla, totales significativos, caracteres
`Página Día Participación →`, ausencia de U+FFFD/sustituciones ASCII y ausencia de JSON interno.
fitz o pdftoppm confirmó renderización independiente; cuando se retuvieron artefactos se guardaron primera,
una página de panel ancho o X04 y última para inspección visual. No se compara contra otro PDF del mismo generador.

## Evidencia previa conservada

Las dos filas normales completadas antes de este pase se conservaron literalmente como línea base:
| ventas | normal | **FAILED** | — | — | — | export-content-or-geometry-criterion; diagnosticHash=d832fe0da42d20cd169494529950a59ab58dd93bdfdb39d08763040353f8dff9 | false |
| que-comprar | normal | **FAILED** | — | — | — | export-content-or-geometry-criterion; diagnosticHash=50a68cab3c4b9f084fc355f83ec1891a8d1fde2cee80748eec11ad6b0d8cfb08 | false |

## Causa raíz y evidencia sanitizada

La fuente X04 sí entregó `metrajeBolsas` para sus tres filas y su total; los cuatro valores
eran cero y el builder conservó las cuatro celdas. La lectura independiente del PDF anterior
solo encontró una de cuatro celdas, por lo que el déficit era una omisión de renderizado y no
una fila inexistente, una consulta vacía o un cálculo financiero faltante.

En Qué comprar, la fuente y el builder conservaron las observaciones largas, la URL completa
de evidencia y las fechas ISO completas. El PDF anterior cortaba colas de observaciones, partes
del query de evidencia y el sufijo de milisegundos/Z de fechas. La causa común era el segundo
reflujo de PDFKit al recibir líneas ya envueltas dentro de una caja de altura limitada. El
renderer ahora dibuja cada línea preenvuelta con `lineBreak: false`; la verificación de tokens
solo recompone fragmentos contiguos cuando concatenan exactamente un token esperado, sin aceptar
colas ausentes ni texto extra.

La regresión independiente de PDF comprueba las cuatro celdas X04, query completo, sufijo ISO,
observación larga, encabezados y límites bbox. El pase posterior conserva cobertura completa:
10/10 casos, 0 errores, 0 filas fuera de celda, 0 palabras sin asignar, 0 solapes, 0 déficits
de forma y 0 tokens faltantes; la matriz Control permanece 49/49 con contenido y sin JSON crudo.

## Matriz de autorización de Control

| Ruta | non-ADMIN | ADMIN |
|---|---:|---:|
| `/api/reportes/control-operativo/export.xlsx` | 403 | 200 |
| `/api/reportes/control-operativo/export.pdf` | 403 | 200 |
| `/api/reportes/vistas/control-operativo/export.xlsx` | 403 | 200 |
| `/api/reportes/vistas/control-operativo/export.pdf` | 403 | 200 |

## Artefactos locales

- No se retuvieron bytes; use `REPORT_EXPORT_WRITE_ARTIFACTS=1` para XLSX/PDF y páginas representativas 0600.
- Intento bbox fallido conservado por separado en `reports/export-download-verification-bbox-failed.md`; sus diagnósticos sensibles quedaron reemplazados por hash.

## Limitaciones y fallos históricos

Fitz/PyMuPDF: no disponible; no se instaló.
No se afirma descarga desde una aplicación desplegada ni autenticación de navegador.
La numeración/mapa de los nueve fallos originales no es recuperable en este contexto; se deja
deliberadamente para el agente propietario. La evidencia de este pase cubre el punto 8 de exports
y la comprobación de permisos Control sin inventar una correspondencia numérica.
