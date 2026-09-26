# Tarea 2 — documento histórico de preparación

**Estado actualizado:** la carga y las mediciones ya se ejecutaron.
El resultado terminal está en `resultado.md` y `summary.json`; este
documento conserva el plan previo, no describe el estado actual.

La copia Neon `noche_20260926`, rama `br-steep-field-axnpxgd0` del proyecto
`withered-block-09991755`, se restauró desde `pg_dump` consistente de la base
de aplicación, con `default_transaction_read_only=on` en la conexión origen.
Se verificaron 2,575 clientes distintos del cliente sistema (2,576 filas).
No se escribió ni aplicó DDL en el origen.

MAIN inició el servidor aislado. `private-ready.json` acredita identidad
efectiva, API congelada final, interfaz mensaje y login/me HTTP 200.
URL privada: `http://127.0.0.1:18228`. No se reconstruyó desde el árbol
mutable ni se incluyó RFC de proveedor.

Los archivos `/tmp/noche-20260926/test-env.json` y `credentials.json` son
privados y no forman parte del informe entregable. La copia y el servidor
se conservan hasta autorización de MAIN para destruirlos.

## Plan preparado, todavía no ejecutado

Permisos dispone primero de ventana exclusiva de escritura. El script
`annual-load.mjs` exige el argumento explícito
`--main-authorized-writer-window`; no debe ejecutarse antes del relevo.

Modelo sintético declarado: 365 días (27/09/2025–26/09/2026), tres tiendas
sintéticas, 50 tickets por tienda y día = 54,750 tickets y líneas; cuatro
productos medidos solamente en metros; reparto circular entre 2,575
clientes copiados. Uno de cada cuatro tickets es crédito; uno de cada
veinte queda pendiente. Efectivo/transferencia para los cobrados no crédito.
No es una estimación certificada de actividad real ni un ensayo de
integridad de productores: las filas históricas se insertan por SQL sólo
en la copia, bajo sus restricciones, sin deshabilitar triggers.

`browser-performance.mjs before|after operación muestra` prepara navegador
nuevo, sesión nativa y sitio seleccionado para cada muestra. Operaciones:
`list`, `search`, `account`, `payment`, `cut`, `credit`. Objetivos 2,000 ms,
salvo crédito 3,000 ms. El rango de crédito se pide explícitamente
personalizado para el año cargado. Tres muestras por operación y fase
permitirán informar cada resultado, mediana y máximo, sin ocultar fallos.

El cobro requiere tickets nuevos creados por productor nativo con
procedencia de entrada; su manifiesto privado se recibe de MAIN/worker
de flujos en `/tmp/noche-20260926/payment-input.json`, propiedades `before`
y `after`, cada una arreglo de `{id, folio, nativeProvenance:true}`.
El corte mide apertura y carga del diálogo de cierre, no confirma el
cierre irreversible. Se debe identificar esa distinción en los resultados.

Antes/después se comparará la misma carga y fuente. No se eliminarán
índices existentes para fabricar una mejora. Índices adicionales sólo se
considerarán después de tiempos reales y catálogo/planes de la copia.

## Preparación y límites comprobados

* `prepare-copy.mjs`, `api-bootstrap.mjs`, `launch-private.mjs`,
  `annual-load.mjs` y `browser-performance.mjs`: sintaxis Node verificada.
* Primer `pg_dump` falló por parámetros de conexión, antes de leer datos;
  se corrigió usando PGHOST/PGDATABASE explícitos y restauración final
  exitosa. No se dedujo éxito de un archivo de tamaño cero.
* A esta fecha aún no hay carga anual nueva, tiempos ni índices aplicados.
  No reutilizar las métricas históricas como mediciones de esta ejecución.