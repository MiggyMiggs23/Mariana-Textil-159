# Comparación de permisos efectivos contra respaldo E10

## Dictamen

**PASS: no cambió ningún valor efectivo de permisos.** No se activa el criterio
de detención solicitado por el propietario.

Las únicas diferencias de filas detectadas son:

- `permisos_rol`: `updated_at` cambió en 70 de 192 filas;
- `permisos_ubicacion`: `updated_at` cambió en las 54 filas.

No hubo altas, bajas, cambios de banderas, cambios de claves estables ni cambios
en `updated_por`. `permisos_usuario` continúa vacío. Tampoco cambiaron rol,
ubicación asignada, estado activo o alcance de consulta de ninguno de los 31
usuarios que alimentan la resolución.

Esto confirma el efecto conocido observado en esta ejecución: los
inicializadores renovaron fechas y consumieron secuencias, pero no cambiaron la
matriz efectiva de permisos.

## Identidad y referencia

La lectura actual confirmó:

- base `heliumdb`, OID `16384`;
- esquema `public`, rol `postgres`;
- PostgreSQL `16.10`;
- observación final `2026-09-18 21:44:38.392451+00`.

La referencia es el respaldo operativo E10 capturado el
`2026-09-18T18:48:23.953Z`:

`.local/backups/e10-operativo-20260918124823-63437/e10-operativo-20260918124823-63437.dump`

Su SHA-256 esperado y vuelto a calcular coincide:

`4f126fdc916a548bf8bdc3af7310a2acd3a3808fbf5dcd0c4c7afb0d85f51d0e`

Tiene 497065 bytes y formato custom. Es la referencia aceptada porque fue
capturada antes de E10 mediante snapshot REPEATABLE READ/READ ONLY, restaurada y
comparada con PASS. La comprobación posterior al COMMIT E10 confirmó que las 66
tablas originales conservaron contenido y secuencias; E10 no autorizó cambios de
permisos. Esta cadena está documentada en
`reports/e10-operativo-2026-09-18/backup-restore-metadata.json` y
`resultado-operativo.md`.

## Comparación de filas

| Conjunto | Respaldo | Actual | Altas | Bajas | Valores efectivos distintos | ID / `updated_por` distintos | `updated_at` distinto |
|---|---:|---:|---:|---:|---:|---:|---:|
| `permisos_rol` | 192 | 192 | 0 | 0 | 0 | 0 | 70 |
| `permisos_ubicacion` | 54 | 54 | 0 | 0 | 0 | 0 | 54 |
| `permisos_usuario` | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| entradas de usuario: rol/sitio/activo/alcance | 31 | 31 | 0 | 0 | 0 | n/a | n/a |

Las huellas canónicas, calculadas sin `updated_at`, coinciden:

| Conjunto | SHA-256 respaldo = actual |
|---|---|
| rol: rol, módulo y cuatro banderas | `36d31d9c309875e285cd348372d54485fe5731e24e386909a1ba11bb4b80548a` |
| sitio: ubicación, rol, módulo y cuatro banderas | `82d5886431fddcf8bacc6f61b333e9ea7aa3c10d77c3df02f346652b2de7b502` |
| overrides de usuario | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| entradas de usuario para resolución | `f5a7e24f7dcdeb5f4f2f359a73bb6e8c6cee50e2d546a70194772873b96bc11a` |

## Comparación de la resolución efectiva

Se reprodujo literalmente la precedencia de
`artifacts/api-server/src/lib/permisos.ts`:

1. ADMIN: acceso total sin consultar las tablas;
2. override no nulo de `permisos_usuario`, por cada acción;
3. fila de rol explícitamente personalizada cuando `updated_por` no es nulo;
4. fila heredada del sitio asignado;
5. fila heredada del rol;
6. ausencia: denegar.

Se incluyeron los 32 módulos declarados por la aplicación, los 31 usuarios y las
cuatro acciones `ver`, `crear`, `editar` y `autorizar`. También se incorporaron
rol, ubicación, activo y alcance de consulta para detectar cambios de
asignación/semántica.

- celdas usuario/módulo comparadas: 992 en respaldo y 992 actuales, cada una
  con cuatro acciones (3,968 valores booleanos por lado);
- celdas distintas: **0**;
- SHA-256 de ambas matrices:
  `a305a672a33a6846244dd48389a2d82bf02795fbb8d78b1d547ffbed79e0cc8e`.

## Procedimiento reproducible y límites

1. Se verificó el hash del dump.
2. `pg_restore 16.10 --data-only --table=<tabla> --file=<archivo temporal>`
   extrajo únicamente los COPY de `permisos_rol`, `permisos_ubicacion`,
   `permisos_usuario` y `usuarios` a `/tmp`. No se restauró ni arrancó una base.
3. Una sola consulta SELECT obtuvo las mismas columnas de las tablas actuales;
   antes se confirmó la identidad mediante otra consulta SELECT.
4. Un comparador offline normalizó booleanos/NULL, ordenó por las claves de
   negocio, comparó altas/bajas, banderas e ID/autor y construyó la matriz con la
   precedencia anterior.
5. Los detalles numéricos y hashes están también en `resultado.json`; no se
   guardaron nombres, credenciales, contraseñas ni valores personales.

La consulta se ejecutó por el canal de lectura de la base de desarrollo de la
aplicación. Aunque la sesión permite transacciones de escritura, se enviaron
exclusivamente sentencias SELECT; no se ejecutaron DDL, DML, locks explícitos ni
funciones de mantenimiento.

El resultado acredita las tablas y entradas que participan en los permisos
efectivos de la versión de código revisada. No acredita que toda la base sea
idéntica al respaldo: ya están documentados cambios de timestamps/secuencias y
la instalación E10 posterior al respaldo. Tampoco repara esos cambios, recupera
el bundle ni autoriza arrancar API, frontend o clones.