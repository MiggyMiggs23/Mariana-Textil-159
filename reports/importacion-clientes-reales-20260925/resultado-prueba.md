# Prueba completa previa a la carga real

**Estado:** prueba aprobada; todavía no se escribió en la base de la aplicación.
La autorización literal está en `autorizacion-propietario.txt`.

Se restauró un esquema completo leído en modo solo lectura de la base efectiva
(108 tablas, funciones y triggers incluidos) en PostgreSQL local desechable,
sin copiar filas de negocio. Se cargaron las 2,575 filas reales del archivo
en esa base desechable y se comparó cada campo, sin recortar nombres.

| Resultado | Cantidad |
|---|---:|
| Clientes cargados en la prueba | 2,575 |
| Con RFC | 2,277 |
| Sin RFC | 298 |
| Con dirección particular | 2,007 |
| Sin dirección | 568 |
| Con teléfono | 1,924 |
| Sin teléfono | 651 |
| RFC genérico XAXX010101000 | 7 |
| Excluidos | 0 |

Todos tienen límite de crédito 150000.00, días de crédito 0 y saldo inicial 0;
correo, contacto y dirección de entrega vacíos (NULL). Los nombres se conservaron
literalmente; el mayor tiene 97 caracteres. Nombre, RFC, dirección y teléfono
son columnas PostgreSQL `text`, sin límite de longitud corto. No se encontraron
límites de longitud adicionales en el formulario o ruta de clientes revisados.
El nombre normalizado de clientes activos es único; no hay nombres duplicados
en este archivo ni coincidencias con clientes existentes.

**No existe una restricción de RFC único:** los siete RFC genéricos se insertan
sin cambiar el esquema, sin deduplicar clientes y sin inventar RFC.

## Correcciones del archivo exacto recibido

Se comparó cada celda original sin hacer trim antes de la comparación.
En este archivo existen **cinco**, no siete, RFC con espacios o guiones:

| Fila Excel | Original | Corregido |
|---|---|---|
| 439 | CAC160222-RC6 | CAC160222RC6 |
| 1120 | IAR 161104PI0 | IAR161104PI0 |
| 1302 | COSA 591101FL4 | COSA591101FL4 |
| 1535 | LOS101130 S83 | LOS101130S83 |
| 2167 | JILR850422 IUA | JILR850422IUA |

También existen dos RFC de 14 caracteres que **no** contienen espacios/guiones:
fila 1632 `PERMM690523QB5` y fila 1772 `GOMM5502223663`.
Se conservan exactamente como vienen; no se presume cómo corregirlos ni se
afirma que sean RFC fiscalmente válidos. El campo admite sus valores íntegros.

## Integridad y repetición

- Todas las filas previamente existentes y las otras 107 tablas permanecieron
  idénticas según conteos y huellas SHA-256.
- Una segunda carga fue rechazada sin insertar ni modificar filas.
- Un error forzado después de insertar y validar constraints revirtió todas
  las filas: no quedó carga parcial. Como es normal en PostgreSQL, los valores
  de una secuencia consumidos en la prueba revertida no se recuperan.
- El script de aplicación es solo lectura por defecto. No se ejecutó su modo
  de escritura.
- Escritura exige `--apply --report-delivered`, autorización literal,
  prueba desechable aprobada y hashes coincidentes. Una reclamación local
  exclusiva impide repetir automáticamente incluso tras una interrupción.
- No se crea una tabla nueva, no se altera ningún esquema y no se escribe
  bitácora en otra tabla. Solo se agregan clientes y avanza su secuencia de ID.

Evidencia: `preflight.json`, `disposable-proof.json`, `disposable-test.log`,
`read-only-check.log`. El archivo fuente está intacto; su SHA-256 es
`847e6e3305e66508bf7c5eefce1b73d107364e4ccd3d78852961a86f72fbed50`.

## Comandos

Prueba completa: `node reports/importacion-clientes-reales-20260925/disposable-test.mjs`.
Comprobación sin escritura: `node reports/importacion-clientes-reales-20260925/run-import.mjs`.

**Solo después de que MAIN comunique estos resultados al propietario y delegue
expresamente aplicar:** `node reports/importacion-clientes-reales-20260925/run-import.mjs --apply --report-delivered`.
No repetir automáticamente ante una respuesta incierta: revisar primero
`apply-once.claim.json`, `application-result.json` y el estado real de la base.