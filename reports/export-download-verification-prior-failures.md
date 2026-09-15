# Verificación de descargas XLSX/PDF de Reportes (solo lectura)

Estado: **HTTP_READ_ONLY_EXPORTS_COMPLETED_WITH_FAILURES**.

## Dictamen del pase ampliado

Se ejecutaron los diez casos: **6 aprobados y 4 fallidos**. No se acredita el cierre de legibilidad.

- Aprobados en Normal y Comparar: Utilidad y márgenes, Clientes y crédito y Control operativo.
- Fallidos en Normal y Comparar: Ventas y Qué comprar. El bloqueo está en la cobertura estricta del contenido PDF; no se detectaron fallos en las comprobaciones XLSX.
- En Ventas se detectó contenido esperado ausente en el cuerpo del panel ancho X04, asociado a «Metraje · bolsas». En Qué comprar queda por resolver la discrepancia de cobertura del cuerpo PDF; no se atribuye todavía a una causa específica.
- Control acredita sus siete fuentes lógicas en Normal y las 49 combinaciones fuente/sitio en Comparar, sin JSON crudo, palabras fuera de celda ni solapes detectados.
- Las dos aprobaciones históricas conservadas más abajo no acreditan el criterio ampliado: Ventas Normal y Qué comprar Normal quedan reabiertos.

La ejecución terminó y escribió este informe. Su salida de proceso fue 0, pero **eso no significa aprobación**: el dictamen y los cuatro estados FAILED de esta matriz son la evidencia de resultado.

No se modificó el generador productivo en este pase. Los recorridos reales de documentos y las sesiones por rol siguen reservados al usuario; las cuatro discrepancias PDF pendientes no se trasladan a esos recorridos.

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
- Errores: 4

| Vista | Modo | Estado | Fuentes (KPI/chart/tabla/filas) | XLSX bytes / SHA-256 | PDF bytes / SHA-256 | PDF lectura + geometría | Pantalla=builder |
|---|---|---|---|---:|---|---|---|
| ventas | normal | **FAILED** | — | — | — | export-content-or-geometry-criterion; diagnosticHash=d832fe0da42d20cd169494529950a59ab58dd93bdfdb39d08763040353f8dff9 | false |
| que-comprar | normal | **FAILED** | — | — | — | export-content-or-geometry-criterion; diagnosticHash=50a68cab3c4b9f084fc355f83ec1891a8d1fde2cee80748eec11ad6b0d8cfb08 | false |
| utilidad | normal | **PASS** | utilidad 11/1/13/31 | 23448 / `fd2dfdc00a945409053fe4381ebe0202100976dd49379cabcf5061a58d7f1578` | 31268 / `924a624a32a2bf1bfdcfe32f45a03cf311e69e044b732ce8e8327dfc1b636345` | 14 tablas, 14 encabezados, 6 totales, 195 valores; paneles 21/21; páginas vector 6/6, rectángulos 558, filas 97; palabras en celdas 803, fuera 0, sin asignar 0; errores de fila 0, solapes de celdas 0; cobertura cuerpo 74/74 filas, 778/778 tokens, faltan 0 | true |
| clientes | normal | **PASS** | clientes 4/1/6/3; pagos-dirigidos 1/0/1/0 | 16356 / `9c2d02c45596727bcaab53c6a9ba629f10a00d9277faa189b90b6618545efae1` | 21209 / `35ee80e84afb30eb286f3b618b5b2b411b9d9cc6a06bd7ece7d0b1f22bab6c4a` | 8 tablas, 8 encabezados, 7 totales, 38 valores; paneles 11/11; páginas vector 3/3, rectángulos 144, filas 30; palabras en celdas 189, fuera 0, sin asignar 0; errores de fila 0, solapes de celdas 0; cobertura cuerpo 19/19 filas, 121/121 tokens, faltan 0 | true |
| control-operativo | normal | **PASS** | control-operativo 7/0/6/26; diferencias-caja 7/2/2/0 | 18926 / `5e6a593478d2e05a847c5f41baf453d3b63dd5dc5f6106ce4887870911b45a42` | 26001 / `213cb027b1a95fbd4923a2050e4a2f2920276685bc87d1506bf017a76998150a` | 10 tablas, 10 encabezados, 4 totales, 48 valores; paneles 16/16; páginas vector 5/5, rectángulos 394, filas 64; palabras en celdas 693, fuera 0, sin asignar 0; errores de fila 0, solapes de celdas 0; cobertura cuerpo 46/46 filas, 683/683 tokens, faltan 0; Control bloques 7/7 sin JSON; con contenido 7/7 | true |
| ventas | comparar | **FAILED** | — | — | — | export-content-or-geometry-criterion; diagnosticHash=1f2747277366a11974e7d6d11a7dde6d112fda303a0d15f7a8f3c9bde8cbe9fc | false |
| que-comprar | comparar | **FAILED** | — | — | — | export-content-or-geometry-criterion; diagnosticHash=c5a995f485ed8b10e7043986db57831dfc0e50d387ae4c854a72fa026a8ad95a | false |
| utilidad | comparar | **PASS** | utilidad 11/1/13/2; utilidad 11/1/13/2; utilidad 11/1/13/27; utilidad 11/1/13/2; utilidad 11/1/13/2; utilidad 11/1/13/11; utilidad 11/1/13/2 | 95454 / `767125c3bddb5edc7afa0b6097c2f5c9ac6f4da81dba29b2e81e8ebd25d70e0c` | 85558 / `63478908685e2d2c335e8a1d145120110a42c5eb1b3212fc4d902f9eadb29232` | 98 tablas, 98 encabezados, 42 totales, 666 valores; paneles 141/141; páginas vector 28/28, rectángulos 2084, filas 381; palabras en celdas 3295, fuera 0, sin asignar 0; errores de fila 0, solapes de celdas 0; cobertura cuerpo 227/227 filas, 1806/1806 tokens, faltan 0 | true |
| clientes | comparar | **PASS** | clientes 4/1/6/0; pagos-dirigidos 1/0/1/0; clientes 4/1/6/0; pagos-dirigidos 1/0/1/0; clientes 4/1/6/3; pagos-dirigidos 1/0/1/0; clientes 4/1/6/0; pagos-dirigidos 1/0/1/0; clientes 4/1/6/0; pagos-dirigidos 1/0/1/0; clientes 4/1/6/3; pagos-dirigidos 1/0/1/0; clientes 4/1/6/0; pagos-dirigidos 1/0/1/0 | 56301 / `7b5ad2fec8e40678ef6bd971897038488114ae4550de877914fcbbb2f92c42e6` | 49802 / `b87e146f758fd19ca58c2dac032147f781e0a58038119ed2f9188012ad07efd0` | 56 tablas, 56 encabezados, 49 totales, 186 valores; paneles 71/71; páginas vector 14/14, rectángulos 914, filas 185; palabras en celdas 1170, fuera 0, sin asignar 0; errores de fila 0, solapes de celdas 0; cobertura cuerpo 108/108 filas, 519/519 tokens, faltan 0 | true |
| control-operativo | comparar | **PASS** | control-operativo 7/0/6/0; diferencias-caja 7/2/2/0; control-operativo 7/0/6/0; diferencias-caja 7/2/2/0; control-operativo 7/0/6/26; diferencias-caja 7/2/2/0; control-operativo 7/0/6/0; diferencias-caja 7/2/2/0; control-operativo 7/0/6/0; diferencias-caja 7/2/2/0; control-operativo 7/0/6/0; diferencias-caja 7/2/2/0; control-operativo 7/0/6/0; diferencias-caja 7/2/2/0 | 68960 / `e9681e335b537df9f47c651e84a10718163736b52be5bc6af95f6e68d2d1ef0b` | 62552 / `75b0413d535742f3e8a886b5cb67cbe24fe94d7b49ac6ac6e081c27c344ffb52` | 70 tablas, 70 encabezados, 28 totales, 300 valores; paneles 106/106; páginas vector 20/20, rectángulos 1416, filas 278; palabras en celdas 2056, fuera 0, sin asignar 0; errores de fila 0, solapes de celdas 0; cobertura cuerpo 166/166 filas, 1319/1319 tokens, faltan 0; Control bloques 49/49 sin JSON; con contenido 49/49 | true |

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
| ventas | normal | ventas 9/3/18/35; admin/comparacion-tiendas 0/3/1/3 | 33360 / `44f54299f06efd71d6c19fcbad6e0383ef41f2a2934ed6ae37851628ea981b0e` | 41502 / `1b69cc5feada70c721ea471d935d5ea18e781b4e652644a3ebbca67cd483717f` | 25 tablas, 25 encabezados, 12 totales, 348 valores | true |
| que-comprar | normal | que-comprar 4/1/1/13; inventario 20/2/4/1279; mapas-calor 1/3/0/0; color 0/1/3/1244; compras 4/1/7/244 | 268650 / `9a5d83c801e5bcd8a52c02806278fca956a0847daae0678a5ee3d1090650afb2` | 1279019 / `cda5ff9d1966026939da3614310cdae31b309cff2cb9656e44fd80081d779d6a` | 23 tablas, 23 encabezados, 10 totales, 314 valores | true |

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
