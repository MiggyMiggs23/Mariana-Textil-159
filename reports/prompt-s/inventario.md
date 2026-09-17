# Prompt S — inventario previo a la sustitución

Inventario de la versión anterior a los cambios de esta entrega. Las líneas de este documento corresponden a esa versión, no a las líneas después de sustituir. El inventario se presentó al propietario antes de iniciar las sustituciones.

## Resultado

**6 copias completas manuales**, todas en `artifacts/api-server/src/lib/admin-analytics.ts`: cinco en `getSalesSummary` y una en `getSessionMargin`. No son ocho, no son siete dentro del resumen y no hay una octava en el desglose por ubicación.

El mismo archivo tenía **16 llamadas** a `accountedDocumentPredicate`, contadas independientemente de su importación; no diez. Ubicaciones previas: 143, 154, 620, 646, 649, 916, 1129, 1323, 1929, 1932, 1933, 1936, 1957, 1967, 1992 y 2001.

`replit.md` ya registraba seis al comenzar esta sesión. El conteo anterior de dos no representa el estado inicial de esta entrega ni debe reinstalarse.

La búsqueda de copias cubrió código de `artifacts/`, `lib/` y `scripts/`, distinguiendo aplicación, pruebas y verificadores. Dependencias, compilados y archivos generados no son nuevas fuentes mantenidas; las citas en documentos, adjuntos e informes/dumps históricos tampoco son consumidores ejecutables. No se encontraron otras copias completas mantenidas fuera del archivo citado.

## Condición canónica y equivalencia

`artifacts/api-server/src/lib/accounted-document.ts:6–8` exige:

1. `estado = 'VENDIDO'`.
2. TICKET cobrado, **o** NOTA autorizada.

El argumento `alias` es una cadena, con valor por omisión `t`; acepta los alias `f` y `t` usados por las copias sin extensión. No se cambia la definición, el tipo del argumento ni el resto de los predicados canónicos.

Las seis copias tienen esa condición completa. No son cadenas idénticas byte a byte: expresan el booleano como `alias.cobrado`, mientras el helper usa `alias.cobrado=true`; ambas expresiones tienen el mismo valor SQL, incluido NULL. La sustitución abarca también el `estado='VENDIDO'` adyacente, no solo la rama OR. Ninguna variante que omita parte de la condición se considera idéntica.

| Archivo | Líneas anteriores | Alias | Uso | Clasificación |
|---|---:|---|---|---|
| `artifacts/api-server/src/lib/admin-analytics.ts` | 381–383 | `f` | CTE `lines` de `getSalesSummary` | Completa, equivalente |
| Mismo | 387–388 | `f` | Suma de ventas | Completa, equivalente |
| Mismo | 391–392 | `f` | Suma de subtotal | Completa, equivalente |
| Mismo | 393–394 | `f` | Suma de IVA | Completa, equivalente |
| Mismo | 397–398 | `f` | Conteo de tickets/documentos | Completa, equivalente |
| Mismo | 441–443 | `t` | `getSessionMargin` | Completa, equivalente |

## Variantes que no se sustituyen

Estas condiciones no son automáticamente defectos: algunas responden preguntas operativas o restringen deliberadamente un conjunto a crédito. Sustituirlas por contabilización completa puede cambiar resultados y no está autorizado. Su evaluación, cuando proceda, queda abierta y separada de la unificación.

En las filas abreviadas, `lib/` y `routes/` son relativos a `artifacts/api-server/src/`.

| Archivo y líneas anteriores | Alias o expresión | Diferencia exacta / contexto conservado |
|---|---|---|
| `lib/admin-analytics.ts:167,180,201,215` | `sale_ticket` | Solo exige ticket `VENDIDO` al relacionar aplicaciones de abonos/reversos; no exige en esa condición tipo y autorización/cobro. Pertenece a `destinationReadModel`, expresamente intocable. |
| `lib/admin-analytics.ts:369` | `f` | `estado='VENDIDO' AND cobrado`; no discrimina TICKET/NOTA. CTE de pagos de caja, además excluye la forma CREDITO. |
| `lib/admin-analytics.ts:463,1204` | `t` | Filtro por `VENDIDO`, sin las dos ramas de documento procesado. |
| `lib/admin-analytics.ts:920` | `t` | Rama `$4='CREDITO'` con NOTA autorizada, sin rama TICKET; se usa bajo un filtro exterior contabilizado. |
| `lib/admin-analytics.ts:1239–1242` | `t` | Agregados de sesión por `VENDIDO`; el conteo de 1242 añade `cobrado`, sin discriminar tipo. |
| `lib/admin-analytics.ts:1739,1816` | `t` | Estado `VENDIDO` en consultas de efectivo; los filtros por forma/conciliación no equivalen a contabilización completa. |
| `lib/admin-analytics.ts:1962–1963` | `ft` | NOTA autorizada junto con movimiento `VENTA_CREDITO`, sin rama TICKET. |
| `lib/admin-analytics.ts:1973–1975` | `ct` | `VENDIDO` y pago EFECTIVO; no exige las dos ramas canónicas. |
| `lib/admin-alertas.ts:89` | `t` | `cobrado=true OR autorizacion_estado='AUTORIZADA'`; esa expresión no comprueba tipo documental ni `VENDIDO`. |
| `lib/reportes-inventory.ts:144` | `t` | `VENDIDO`, para un informe operativo de inventario; no predicado financiero completo. |
| `routes/clientes.ts:1189` | Sin alias | `VENDIDO` en la fecha de primera compra; no discrimina procesamiento en esa condición. |
| `lib/pos.ts:2008,2048,2110,2114,2116,2243,2276,2299,2315,2356` | `ticketsTable` en Drizzle/SQL, o `t` según consulta | Condiciones de estado, cobro y forma de pago para caja/POS. No son copias completas; conservar sus combinaciones y no sustituir filtros operativos. |
| `lib/salidas.ts:282,600`; `routes/salidas.ts:237` | Objeto del ticket, sin alias SQL | Condicional JavaScript por tipo: TICKET cobrado frente a autorización de nota; algunas rutas añaden estado `VENDIDO`. Son decisiones de entrega, no copias literales SQL. |
| `lib/accounted-document.ts:11,15,19,23` | Parámetro `alias` | Predicados hermanos de contado, crédito, impago y pendiente; son deliberadamente diferentes y permanecen canónicos. |

Los contadores por tipo en `admin-analytics.ts:479–480`, los enums de estado y las transiciones de rollos `VENDIDO` no son copias del predicado de documento. No se cuentan como defectos financieros por coincidencia de una palabra.

Las pruebas que mencionan fragmentos de la condición, entre ellas `realtime-breakdown.contract.test.ts`, `pos-caja-final.contract.test.ts`, `lib/clientes-aging.test.ts` y `lib/admin-analytics.contract.ts`, son aserciones, no consultas financieras adicionales. Si una aserción exigía la copia sustituida, su actualización debe comprobar el uso canónico sin debilitar la regla.

## Límites

- No se autoriza tocar `destinationReadModel`, FIFO, proyección de crédito ni atribución de sitio.
- El Prompt P permanece detenido, con Grupo 1 sin cerrar y grupos 2–4 sin continuar.
- El inventario no acredita paridad de resultados: esa evidencia debe obtenerse ejecutando antes/después sobre los mismos datos y documentarse por separado.