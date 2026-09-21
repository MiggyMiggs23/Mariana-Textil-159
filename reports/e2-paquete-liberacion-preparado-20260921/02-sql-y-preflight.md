# 2. SQL exacto, secuencia y preflight

**No se ejecutó ninguno de estos archivos.** Las copias en `sql/` son las
sentencias exactas candidatas, no instrucciones autorizadas para la base actual.
La identidad/conformidad actual de esa base se desconoce en esta preparación.

## Orden futuro, únicamente tras autorización

| Paso | Acción | Resultado requerido |
|---|---|---|
| 0 | Fijar manifiesto, autorización, ventana sin escritores y respaldo verificado/restaurable | Sin fuentes móviles ni operaciones concurrentes |
| 1 | Preflight **previo**, solo lectura, antes del DDL | Identidad y estado base B0 esperados; dependencias completas; CLOSED |
| 2 | `sql/01-install-evidence-prepared.sql` | Instalación transaccional exacta de A+C |
| 3 | `sql/03-preflight-schema-prepared.sql`, en sesión de solo lectura, y comprobación completa de catálogo | A+C conforme, guardas E1 intactas, sin backfill |
| 4 | Comparación B0→B1 limitada al delta aprobado y preflight nuevo de arranque | Sin cambios ajenos; manifiesto post-DDL aprobado |
| 5 | Arranque del bundle aprobado a través del wrapper aprobado | Logger desde ese intento; sin inicializadores |
| 6 | Verificación posterior y, separadamente, primer cierre real autorizado | Evidencia del runtime y del snapshot |

`02-revert-before-capture-only.sql` **no** es el paso 2 de la instalación:
es un camino excepcional de reversión, con condiciones indicadas más abajo.
No ejecutar instalación/reversión/reinstalación de ensayo en la base operativa.

### Detalles de ejecución que el operador futuro debe respetar

- El instalador `01` contiene su propio `BEGIN` y `COMMIT`. Se mantiene intacto;
  no envolverlo en otro BEGIN suponiendo que el preflight posterior quedará
  dentro de la misma transacción. La aprobación de los 51 casos se refiere a
  esos bytes, no a un instalador editado para esta ventana.
- Usar un cliente que aborte ante error SQL, sin archivo de inicio del usuario
  y sin incluir credenciales en argumentos/evidencia.
- `03` incluye metacomandos **psql** (`\gset`, `\if`, `\quit 3`): no enviarlo
  como una sola consulta a `pg` ni ignorar su estado de salida.
  Ejecutarlo en una sesión/transacción READ ONLY, terminar con ROLLBACK y
  conservar salida/estado terminal. Es lectura de catálogo, no reparación.
- `01` ya habrá confirmado cuando se ejecute `03`. Si el postflight falla,
  **no arrancar la API ni corregir el catálogo automáticamente**. La decisión
  será conservar cerrado o usar la reversión autorizada si sigue siendo segura.
- Establecer previamente límites de espera/bloqueos y política de abortar;
  sus valores y la pausa de escritores son decisiones operativas pendientes.
  No cortar escritores ni reiniciar servicios durante esta preparación.

## Delta exacto permitido

El `01` crea:

- `public.finalizaciones_abono_e2` y `public.evidencia_no_aplicada_e2`, con
  PK/FK/UNIQUE/CHECK y sus índices asociados declarados en el propio archivo.
- Dos columnas `e2_insert_xid xid8`, una en `public.movimientos_credito` y otra
  en `public.cobros_credito_pendientes_e1`, nullable, sin DEFAULT ni backfill.
- Ocho funciones A+C: estampado, rechazo de mutaciones, validadores de
  finalización/prueba, atestación de retenido, finalizador, completitud y
  guarda de aplicación posterior a la finalización.
- Ocho triggers A+C: dos de procedencia, dos de inmutabilidad, dos de validación,
  uno de completitud diferible y uno de orden de aplicación.

INSERT estampa el xid8 superior; UPDATE conserva la marca anterior.
Filas históricas quedan sin marca. No se inventa evidencia retrospectiva.

No modifica cuerpos/estados de guardas E1, no abre captura/devolución, no añade
un initializer, no renumera folios ni crea movimientos de negocio.
No confundir objetos explícitos con constraints/índices/triggers internos que
PostgreSQL crea a partir de las declaraciones; comparar el catálogo completo.

### Snapshot del cierre: ningún DDL adicional

El código escribe JSON en la auditoría existente, en el cierre normal.
No añadir una tabla de snapshots, columna cashSnapshot, UPDATE masivo de
auditoría ni INSERT de un cierre sintético. Si faltara alguna dependencia
existente de caja/auditoría, **STOP**: no ejecutar `ensureStartupSchemas`,
schema push ni un “arreglo de prerrequisitos” bajo esta autorización.

### SQL expresamente excluido

- `reports/e2-apertura-limitada/sql/01-apply-limited-cash-abono.sql`:
  cambia la guarda para permitir captura limitada; **no pertenece a CLOSED**.
- Su `02-revert-closed.sql` es la contraparte de aquella apertura, no el
  rollback de esta instalación A+C. No incorporarlo como sustituto.
- Fixture, casos, suplementos, controles negativos y SQL antiguo fallido
  usados en la base desechable.
- DDL E1 completo, migraciones generales, seeds, backfills y purgas.

## Qué debe comprobar el preflight previo

No basta un `SELECT 1`. La implementación final versionada aún está pendiente:

1. Identidad inequívoca de destino: conexión efectiva, base/OID, esquema,
   rol, versión PostgreSQL y configuración relevante, sin revelar credenciales.
   No aceptar un nombre de base como único identificador.
2. Autorización/manifiesto y hashes exactos; estado B0 actual obtenido con
   lecturas coherentes. Comprobar el respaldo y la restauración realmente
   disponibles, no solo que existe un nombre de archivo.
3. Dependencias de los FK y consultas: movimientos, clientes, aplicaciones,
   cobros retenidos, caja, auditoría y contrato E1 completo; tipos, constraints,
   índices, triggers, funciones, privilegios y ausencia de interferencias.
4. Guardas E1C01/E1P01/E1A01 CLOSED con cuerpos, firma, tabla, atributos y estado
   habilitado exactos. No deshabilitar triggers ni cambiar replication role.
5. Objetos A+C de este delta ausentes. Si ya existen parcial o totalmente,
   detenerse: `01` no es un reconciliador idempotente; no usar IF NOT EXISTS,
   DROP previo ni “reparar para que coincida”.
6. Modo/flags CLOSED del bundle candidato y ausencia de inicializadores,
   backfills o monitor escritores en el modo que se vaya a usar.
7. Dependencias de snapshot en auditoría/caja, sin exigir ni fabricar snapshots
   históricos. Capturar referencias de cierres previos para demostrar preservación.

La ventana debe conservar la línea base entre preflight, respaldo y aplicación.
Los detalles de pausa y quién puede escribir deben aprobarse; READ ONLY por sí
solo no detiene a otros procesos.

## Qué verifica `03` y qué NO

El archivo exacto comprueba las dos columnas xid8 y los dos triggers de
procedencia, firma/atributos de su función y SHA-256 del cuerpo:
`5746c222b6f13659a6d37447152f3735864491f6c1430a925d5010fda517c05a`.
También compara columnas/defaults/tipos/nulabilidad y constraints de las dos
tablas, y la validez de sus índices PK/UNIQUE.

**No es por sí solo el preflight completo de liberación:** no demuestra
identidad de base, ausencia de escritores, todos los cuerpos de las otras
funciones, todos los triggers, permisos completos, flags del bundle ni snapshot.
El inventario/hashes ampliados de `limited-startup-preflight.ts` constituye
una referencia de implementación, no una ejecución probada contra la base API.

## Preflight posterior al DDL y previo al exec

Además de `03`, comprobar todos los objetos A+C contra el manifiesto de la
revisión: cuerpos y firmas de las ocho funciones, ocho triggers con tabla,
tipo/habilitación/deferrabilidad, relaciones y propiedades de tablas/índices.
Las tres guardas E1 y el resto del catálogo deben conservarse.

Comparar datos preexistentes **por sus columnas preexistentes** contra B0:
añadir una columna NULL cambia la representación completa de una fila aunque
no cambien sus valores anteriores. Exigir nuevas tablas de evidencia vacías,
marcas históricas NULL, ausencia de DML de negocio y conservación de secuencias
y auditoría antes de permitir operación. Registrar separadamente cualquier
efecto de arranque/login y el cierre futuro; no atribuirlo al DDL.

B1 se deriva de B0 y del delta aprobado, no de aceptar automáticamente cualquier
catálogo observado después. El preflight retenido tiene identidad/digest y
conteos congelados; no sirve tras este DDL. No “actualizar el hash esperado”
para ocultar diferencias: preparar, revisar y autorizar el preflight nuevo.

## Reversión exacta, límites y recuperación

`sql/02-revert-before-capture-only.sql` toma ACCESS EXCLUSIVE sobre las cinco
tablas indicadas en el archivo; exige la guarda CLOSED exacta y ambas tablas
de evidencia vacías. Retira los objetos A+C propios y las dos columnas, sin
CASCADE y sin modificar guardas E1.

**No verifica por sí mismo la identidad del destino ni restaura una guarda
abierta.** Requiere el mismo control externo de identidad/autorización y una
ventana sin escritores. Si su condición no se cumple, aborta; no vaciar
evidencia ni modificar su guarda para forzarlo.

La autorización de desinstalación debe quedar restringida a la ventana previa
a reanudar operación, con B0/B1 conservados y sin nuevas marcas/evidencia.
Tras aceptar actividad que genere procedencia, cierre/snapshot o evidencia,
no aplicar un rollback automático aunque ambas tablas A+C sigan vacías.

Un snapshot de cierre no se revierte eliminando A+C: está en auditoría. No
editar/borrar la auditoría, reabrir la sesión ni restaurar un respaldo sobre
operaciones posteriores para “deshacer la prueba”.
El plan de continuidad posterior requiere un bundle **E2 CLOSED compatible**
con los snapshots conservados. Volver al bundle retenido no garantiza esa
compatibilidad; identificar y aprobar el candidato de recuperación antes de GO.