# Validación PostgreSQL A+C — instalación fallida

**Resultado: FAIL. El candidato no pudo instalarse. No se autoriza apertura.**

## Autorización y revisión

- Autorización textual: [autorizacion-propietario-validacion-postgresql.txt](../autorizacion-propietario-validacion-postgresql.txt), guardada antes de preparar y escribir en PostgreSQL.
- Commit de la autorización: `025054680207e3e17491f96dcab3972e8016418f`.
- Candidato exacto: `f8818255bcb11784c422cc559c3273e1f2e25aa9`.
- SQL de instalación, SHA-256: `dd99574f022b4d325a73238bf0d1e348e015003d2dad3ebc9de00ede8b094cbd`.
- PostgreSQL **16.10**, ejecución `run-1789790527925`.

Los archivos exportados fueron comparados byte por byte con Git. No se corrigió ni sustituyó el candidato durante la prueba.

## Aislamiento

Se creó **una sola base**, `e2_ac_synthetic`, desde `template0` de un clúster nuevo creado con `initdb`.
No se usó un dump, la base de la API, los clones E1/E10, sus conexiones ni sus datos.

Antes del DDL de fixtures se verificaron nombre de base, usuario, directorio de datos, puerto y socket privados. `listen_addresses` estaba vacío e `inet_server_addr()` era NULL: no se abrió un listener TCP.
Los procesos recibieron un entorno saneado y conexiones con parámetros explícitos, sin usar secretos ni URL de la aplicación.

La fixture era una dependencia sintética parcial para el contrato A+C, no una réplica del esquema operativo completo. Las dependencias y las guardas E1 cerradas se instalaron correctamente.

## Fallo observado

Al ejecutar el SQL intacto con `psql -X -v ON_ERROR_STOP=1`:

```text
01-install-evidence-prepared.sql:150: ERROR: syntax error at end of input
LINE 39: CASE source_producer WHEN 'ABONO_DIRIGIDO' THEN 'dir...
```

El error ocurrió al crear `e2_validate_abono_finalization`, antes del `COMMIT` de la instalación.
`psql` terminó con **exit 3**; el harness registró **FAIL / exit 1**.

La revisión independiente confirmó que es un fallo del SQL exacto, no un error de conexión o de fixture. La causa probable es la expresión `CASE` sin agrupar dentro de la condición PL/pgSQL `IF`. **No se ensayó ninguna corrección**, ni se afirma que sea el único defecto.

## Cobertura realmente ejecutada

| Fase | Resultado |
|---|---|
| Identidad y hashes del candidato | PASS |
| Creación de base privada e identidad de conexión | PASS |
| Dependencias sintéticas y guardas E1 cerradas | PASS |
| Instalación exacta de evidencia A+C | **FAIL** |
| Reversión, reinstalación y preflight real de catálogo | **BLOQUEADOS** |
| Commit diferido y rollback ante fallos inducidos | **BLOQUEADOS** |
| Reintentos, replay y concurrencia | **BLOQUEADOS** |
| SAVEPOINT, inmutabilidad y otros casos preparados | **BLOQUEADOS** |
| Destrucción de la base y del clúster de prueba | **VERIFICADA** |

No se consultó el catálogo después del fallo para medir objetos residuales. Se observó `BEGIN` sin alcanzar `COMMIT`; la semántica de rollback al cerrar la conexión no se presenta como una aserción de atomicidad ejecutada.

El conjunto de casos dependía de que se instalara el candidato. No se aplicó una variante corregida ni se contó ningún caso bloqueado como aprobado.

## Destrucción e integridad

- `DROP DATABASE e2_ac_synthetic WITH (FORCE)`: exit **0**.
- Parada del clúster: exit **0**.
- `pg_ctl status`: exit **3**, sin servidor.
- PID desechable **10580**, socket y directorio `/tmp/e2-ac-pg16-mC82Uy`: ausentes.
- `terminal.json`: `cleanupError: null`, `rootRemoved: true`.
- La coordinación hizo una comprobación adicional del PID y directorio ausentes.

La API conservó el PID **176**, con el mismo inicio observado. No se reinició.
Bundle servido intacto:
`3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98`.
Preflight del runtime intacto:
`9a87b47b52d3776b10d760bdab6b9f5e71158f75ef71921ec8adbb3e0585de9f`.

**Captura y devolución permanecen apagadas.** No hubo cambios de workflows, flags, frontend, build ni bundle.

## Evidencia y siguiente condición

En `run-1789790527925/`: `manifest.json`, `commands.log`, `postgres.log` y `terminal.json`. El manifiesto incluye hashes del candidato, autorización, fixture y harness.
Véanse también `resultado-postgresql.txt`, `revision-resultado.md` y las observaciones de runtime.

Queda por corregir el defecto y validar una revisión posterior, con su alcance acordado. No se efectuó esa corrección ni se amplió automáticamente la autorización. Una futura validación satisfactoria tampoco autorizaría abrir captura o devolución.