# Comparación de enums validada; paquete pendiente de aclaración

La autorización del propietario se guardó íntegra antes de cualquier otra
escritura de esta continuación en
`autorizacion-propietario-tanda-b-b0-b1.txt`.

## Cambio independiente

Commit `817830d`: comparador reutilizable para preflights de catálogo,
pruebas puras y runner PostgreSQL exclusivo para MAIN.

Compara cada etiqueta según su posición relativa dentro de su tipo y esquema.
Las capturas crudas no se modifican; los atributos ajenos a enums, incluidos
triggers, siguen siendo significativos. Valores ambiguos o duplicados fallan.
No cambia esquemas, enums ni triggers de la base de la API.

Validación MAIN:

- `node --test scripts/src/release-catalog-comparison.test.mjs`: **5/5 PASS**,
  exit 0. Renumeración pasa; permutación, adición, eliminación y renombrado
  fallan la igualdad. Identidad de enum y atributos de trigger no se omiten.
- `scripts/src/release-catalog-postgres-main-only.mjs`: **PASS**, exit 0,
  con PostgreSQL 16.10 en clúster local desechable, socket privado y sin TCP.
  El fixture creó un enum incremental y uno equivalente con numeración
  distinta: igualdad aceptada. Reordenamiento, adición y eliminación:
  igualdad rechazada. El runner terminó su bloque de parada y eliminación.
- Evidencia: `07-enum-unit.log` y `07-enum-postgres.log`. No se usaron
  actores, conexiones ni filas de la aplicación.

Este commit prepara el comparador que deberá consumir el **nuevo** preflight.
No se modificaron los paquetes históricos sellados ni se recalcularon sus
hashes. La integración con B0/B1 del nuevo paquete sigue pendiente de resolver
el conflicto de alcance siguiente; no se declara un nuevo preflight completo
ni paquete terminado.

## Conflicto no cubierto por renumeración

El inventario estático exacto, con hashes de los SQL y referencias, está en
`07-inventario-conflicto-b0-b1.txt`.

E5 sustituye cuatro objetos E1 existentes: dos funciones, un CHECK y el
trigger `zz_e1_pending_receipts_closed`. El trigger conserva AFTER INSERT
STATEMENT, pero añade una transition relation. Por ello un B1 que solo una
las filas B0 con nuevas filas no representa el SQL completo.

No se recortó E5, no se alteró la autorización y no se construyó un B1 falso.
Se necesita aclarar si los cambios explícitos de esos cuatro objetos en el SQL
E5 se incluyen en la preparación/ensayo, conservando todos los demás objetos
B0 intactos. Esto **no** solicitaría ni autorizaría aplicación en la base real.

## Estado operativo

Por lectura de procesos, el runtime ahora es PID 204; el PID 191 anterior ya
no existe. El hash en disco del bundle E2 sigue siendo
`008dfd54d93f6a1606370d44cb2086673669c51278c92ebb6a5a63f4d503e7f5`.
No se infiere identidad de conexión ni modo de arranque a partir de ese hash.
Una futura captura READ ONLY deberá fijar la identidad efectiva vigente.

En esta continuación no se consultó ni escribió la base de la API, no se
reinició la API, no se cambió su workflow ni bundle. Ninguna puerta abierta.
No hay manifiesto nuevo aprobado ni fase B ejecutada.