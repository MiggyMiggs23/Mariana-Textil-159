# Evidencia A+C — cierre de preparación offline

## Resultado PostgreSQL posterior — candidato rechazado

Con la autorización textual guardada en `autorizacion-propietario-validacion-postgresql.txt`, se intentó instalar la revisión exacta `f8818255bcb11784c422cc559c3273e1f2e25aa9` en **una única base nueva, local y desechable**, sin conexiones a la API ni clones E1/E10.

**FAIL de instalación en PostgreSQL 16.10:** `syntax error at end of input` al crear `e2_validate_abono_finalization`, en la expresión `CASE` dentro de `IF`. No se modificó el candidato. Reversión y casos de commit diferido, rollback inducido, reintentos y concurrencia quedaron **BLOQUEADOS**, no aprobados. El resultado offline anterior no acredita compilación PostgreSQL.

La base fue destruida; proceso, socket y directorio temporal ausentes. API/bundle y permisos siguen intactos. Informe: [postgresql-validacion/resultado.md](postgresql-validacion/resultado.md).

El pendiente 5 fue intentado bajo autorización y **no está acreditado**. Corregir el candidato y validar una revisión nueva es trabajo posterior, no ejecutado bajo esta autorización acotada a `f8818255`. La apertura sigue sin autorización.

## Antecedente: preparación offline completada

Estado: **pendientes offline 1–4 completados; candidato inactivo, no aplicado y sin autorización de apertura**.

Revisión exacta de fuentes comprobada: `f8818255bcb11784c422cc559c3273e1f2e25aa9`.
Baseline: `80eaa93d4300e86d9be54492e634f88f0c0abc90`.
Informe completo: [cierre-offline-20260919.md](cierre-offline-20260919.md).

## Completado

1. **Revisión independiente y correcciones.** Compatibilidad del inventario E1/A+C; reversión bloqueada antes de comprobar vacío; contraste de evidencia contra aplicaciones persistidas; protección de aplicaciones posteriores a finalización en la transacción de captura, incluso después de `SET CONSTRAINTS ... IMMEDIATE`; preflight de constraints, columnas y deferrabilidad; corrección de `pg_catalog.coalesce`; prueba positiva diferenciada por origen. Reconfirmación independiente final cerrada para los casos identificados.
2. **SQL preparado reconciliado y digests coordinados.** A+C es el único propietario de `evidencia_no_aplicada_e2`. Conserva ABONO y COBRO_RETENIDO como pruebas disjuntas; no elimina la preparación del segundo origen. La devolución mantiene cierre independiente. Contrato de activación V3 coordinado con cuatro artefactos y siete cuerpos de función; ninguna ejecución.
3. **Negativos ampliados.** Productores ordinario/dirigido montados en aislamiento, orden, clasificación, procedencia, prueba ausente y deriva de cada objeto de preflight. Se conservan códigos terminales, mensajes de aserción, hashes y restauraciones verdes. El mutante SQL del orden transaccional es expresamente léxico, no una prueba PostgreSQL.
4. **Typecheck raíz y comparación tras congelar fuentes.** Baseline y candidato en copias temporales separadas con enlaces internos propios: ambos exit 0, cero diagnósticos únicos o repetidos y cero fallos de procesos/parsers. Cuatro paquetes de artefactos/scripts y seis bibliotecas referenciadas completados.

## Contrato de evidencia

- Permisos de ingreso, evidencia y devolución siguen cerrados.
- Ordinario: clasifica las asignaciones del proyector canónico después de persistirlas.
- Dirigido: documenta su aplicación explícita íntegra ya escrita, exige `FULL` y usa `directedApplication`; no finge una proyección FIFO posterior ni cambia el FIFO existente.
- PostgreSQL preparado comprueba origen, importe y asignaciones persistidas; la prueba ABONO positiva exige `UNUSED`. El consumidor conserva aplicaciones, reversos e historia como defensas adicionales.
- Retenido: conserva prueba tipada del origen físico nuevo, en su misma transacción, con attester no conectado a ningún productor activo.
- Sin backfill. Evidencia inmutable. Reversión destructiva solo antes de capturar y con tablas vacías; después corresponde cerrar permisos y conservar evidencia.

## Verificación offline

| Comprobación | Resultado |
|---|---|
| Suite ampliada | 428/428 PASS, incluidos 421 casos de deriva de catálogo |
| Mutantes | 24/24 rechazados con exit 1, aserción y mensaje esperado |
| Restauraciones | 24/24 verdes, cada una 428/428 |
| Evidencia/devolución enfocadas | 29/29 PASS |
| Preflight/modos de arranque | 14/14 PASS |
| Dos verificadores estructurales SQL | PASS; solo inspección de texto |
| Typecheck raíz baseline y candidato | Ambos exit 0; sin diagnósticos nuevos ni anteriores |
| `git diff --check` | PASS |

Estos conteos corresponden a suites distintas y pueden solaparse; no se suman como cobertura única.
No se repitieron los antiguos manifiestos completos con navegador/HTTP.

## Límites conservados

No hubo acceso a ninguna base, SQL ejecutado, pruebas PostgreSQL, reinicio de API, cambio de workflow, build de aplicación ni sustitución del bundle.
Bundle en ejecución conservado: `3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98`.
El candidato de fuentes **no es** el bundle servido.

## Pendientes tras el intento PostgreSQL fallido

5. Corregir el defecto de instalación en una revisión posterior y acordar su validación aislada. La autorización de `f8818255` sí se ejerció, pero no acredita instalación/reversión, catálogo, restricciones diferidas/inmediatas, subtransacciones, rollback, privilegios, replay, locks/concurrencia ni aplicaciones futuras legítimas.
6. Decisión de apertura posterior, independiente incluso si esas pruebas pasan. **Captura y devolución continúan apagadas.**

No hay trabajo auxiliar en ejecución.