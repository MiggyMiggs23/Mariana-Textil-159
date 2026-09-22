# Diagnóstico de solo lectura del aborto B0

## Resultado

**Se reprodujo exactamente la referencia aprobada B0 y se encontraron diez diferencias frente a la base de la API. No se reparó nada ni se modificó la referencia.**

- Estructura: **1,519 de 1,519 renglones idénticos**.
- Atributos: **847 de 857 idénticos; 10 diferentes**.
- Diferencias de entorno —dueños/permisos—: **0**.
- Diferencias de fondo en el catálogo: **10 renglones de 3 objetos**: dos enums y un trigger. Se distingue abajo el orden lógico de las etiquetas de su posición numérica interna.
- Triggers desactivados entre las diferencias: **0**. El trigger discrepante está en `ALWAYS`, no desactivado.
- Índices inválidos o no listos entre las diferencias: **0**.
- No se encontraron objetos ausentes ni añadidos respecto de esta referencia.

La discrepancia explica el rechazo «Release attributes/privileges/enum mismatch». No prueba que la base real haya sufrido una modificación indebida: la reconstrucción no conserva todos los atributos originales. Tampoco autoriza aceptar una referencia nueva.

## Autorización y método

La primera escritura fue el texto literal del propietario en:
`reports/e2-paquete-liberacion-preparado-20260921/autorizacion-diagnostico-b0-solo-lectura.txt`.

1. Se identificó el único proceso Node de la API que ejecuta el bundle retenido y se consumió internamente su conexión efectiva. No se usó el conector Neon, otra base ni una URL inferida. No se guardaron ni imprimieron credenciales.
2. Se llamó al `readCatalog` original con **`release-catalog.sql` sin cambios**. Esa consulta hace `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, límites locales de tiempo, consulta de catálogos y `ROLLBACK`. Además, el cliente fuerza `default_transaction_read_only=on`. El resultado confirma `readOnly=on`.
3. Se exportó la revisión `31804125a1e752bde128d72e9fd44d23972ffff1` con `prepare-export.mjs`. Los paquetes internos se resolvieron dentro de esa revisión, no contra la fuente E3 actual.
4. Se ejecutó el reconstructor original `reconstruct-catalog-fixture.mjs`: metadatos `after.schema` archivados y enums declarados en esa revisión; sin filas de negocio.
5. Se creó un clúster PostgreSQL 16.10 vacío, solo accesible mediante socket en un directorio temporal privado, mediante los mismos parámetros `initdb` del ensayo previo. Se creó `heliumdb`, se cargó exclusivamente el fixture B0 y se ejecutó la misma consulta de catálogo. **No se instaló A+C/B1, no se ejecutaron migraciones contra la base real y no se arrancó ninguna API de prueba.**
6. Se comprobó que los dos hashes calculados de la reconstrucción coincidieran con los B0 ya aprobados, sin escribir en `release-expected.json`, archivos de hashes ni manifiestos. Después se comparó cada renglón por identidad del objeto y definición, comprobando también ausencias, adiciones y claves duplicadas.
7. Se detuvo el PostgreSQL desechable y se eliminaron tanto su directorio de datos como la exportación temporal. Evidencia terminal: `cleanup-and-preservation.json`.

Ambas lecturas informan: base `heliumdb`, OID `16384`, esquema `public`, rol `postgres`, versión `160010`, transacción de solo lectura y cero event triggers habilitados. La coincidencia de esos nombres no se usó para confundir las conexiones: la real provino del proceso de la API y la desechable de su socket privado.

## Cada diferencia

En los enums, el valor comparado es **`pg_enum.enumsortorder`**. No es un ID de usuario ni un permiso.

| # | Tipo | Objeto / etiqueta | Esperado reconstruido | Real | Clasificación | Explicación |
|---|---|---|---|---|---|---|
| 1 | enum | `forma_pago_proveedor.CHEQUE` | `4` | `3` | Fondo: orden efectivo distinto | El fixture crea `FACTURADO` antes de `CHEQUE`; la base real coloca `CHEQUE` antes de `FACTURADO`. |
| 2 | enum | `forma_pago_proveedor.FACTURADO` | `3` | `5` | Fondo: orden efectivo distinto | La declaración del candidato lo ubica tercero. El inicializador conservado usa `ALTER TYPE ... ADD VALUE IF NOT EXISTS 'FACTURADO'` sin BEFORE/AFTER, que lo añade al final de un enum existente. El catálogo real coincide con ese resultado. |
| 3 | enum | `forma_pago_proveedor.OTRO` | `5` | `4` | Fondo: orden efectivo distinto | Al crear desde cero con `FACTURADO` tercero, `OTRO` queda quinto. En la base real precede a `FACTURADO` y queda cuarto. |
| 4 | enum | `rol_usuario.BODEGA` | `5` | `4` | Fondo de catálogo: posición interna distinta, mismo orden lógico | El fixture asigna enteros consecutivos a todas las etiquetas; la base real conserva `TERMINAL=1.5`, por lo que `BODEGA` sigue en 4 sin que cambie su lugar relativo. |
| 5 | enum | `rol_usuario.CAJA` | `3` | `2` | Fondo de catálogo: posición interna distinta, mismo orden lógico | La creación completa asigna 3; la base real conserva 2, después de `TERMINAL=1.5`. |
| 6 | enum | `rol_usuario.CONTADOR` | `7` | `6` | Fondo de catálogo: posición interna distinta, mismo orden lógico | Es la última etiqueta en ambos catálogos; difiere la numeración al reconstruir todo de una vez. |
| 7 | enum | `rol_usuario.SISTEMAS` | `6` | `5` | Fondo de catálogo: posición interna distinta, mismo orden lógico | Conserva su lugar entre BODEGA y CONTADOR; cambia solo la posición numérica reconstruida. |
| 8 | enum | `rol_usuario.SUPERVISOR` | `4` | `3` | Fondo de catálogo: posición interna distinta, mismo orden lógico | Conserva su lugar entre CAJA y BODEGA; el fixture usa enteros consecutivos y la base real conserva la numeración con TERMINAL intercalado. |
| 9 | enum | `rol_usuario.TERMINAL` | `2` | `1.5` | Fondo de catálogo: posición interna distinta, mismo orden lógico | El valor 1.5 es compatible con una inserción incremental entre ADMIN=1 y CAJA=2. El fixture lo declara desde cero y recibe 2. No se encontró en esta revisión una sentencia histórica que permita atribuir fecha/autor exactos de esa inserción. |
| 10 | trigger | `public.ticket_linea_consumos.ticket_linea_consumos_append_only` | `O:31:f:f:f` | `A:31:f:f:f` | Fondo: modo de ejecución distinto | La reconstrucción vuelve a ejecutar `CREATE TRIGGER` a partir de `pg_get_triggerdef`, que no incluye el estado ALWAYS; por defecto queda ORIGIN (`O`). El real está ALWAYS (`A`), concordante con `ENABLE ALWAYS TRIGGER` en la migración archivada de trazabilidad de proveedor. Ambos están habilitados; no cambió la definición de la función ni la del trigger. |

Para el trigger, los cinco campos son `tgenabled:tgtype:tgdeferrable:tginitdeferred:tgisinternal`. Solo difiere el primero. `ALWAYS` ejecuta el trigger también bajo `session_replication_role=replica`; `ORIGIN` no. Por tanto, no son atributos equivalentes, y la base real tiene un modo de ejecución más amplio que la reconstrucción.

### Orden completo de los enums afectados

`rol_usuario`, **mismo orden lógico en ambos**:

`ADMIN → TERMINAL → CAJA → SUPERVISOR → BODEGA → SISTEMAS → CONTADOR`

- Esperado: `1, 2, 3, 4, 5, 6, 7`.
- Real: `1, 1.5, 2, 3, 4, 5, 6`.
- Las seis discrepancias no alteran comparación/orden relativo de etiquetas entre estos catálogos. Se clasifican como fondo de catálogo porque son atributos de enum, no dueños o permisos; no se presentan como seis cambios semánticos de roles.

`forma_pago_proveedor`, **orden lógico diferente**:

- Esperado: `EFECTIVO → TRANSFERENCIA → FACTURADO → CHEQUE → OTRO`.
- Real: `EFECTIVO → TRANSFERENCIA → CHEQUE → OTRO → FACTURADO`.
- Las mismas cinco etiquetas existen en ambos. La diferencia puede afectar ordenaciones o comparaciones por orden enum en PostgreSQL; esta inspección no evaluó su uso funcional en todas las consultas.

## Causa demostrada y límites de atribución

El esperado no se obtuvo de una copia completa de atributos de la base real: el reconstructor combina definiciones archivadas con enums de TypeScript. Al crear los enums de nuevo pierde posiciones numéricas de altas incrementales; además, puede usar un orden declarado diferente del resultado histórico de `ADD VALUE`. Al recrear triggers pierde el modo `ALWAYS` si solo tiene `pg_get_triggerdef`.

Fuentes que explican el mecanismo:

- `reconstruct-catalog-fixture.mjs`: enums desde `enumValues` y triggers desde `row.definition`, sin restaurar `tgenabled`.
- `lib/db/src/schema/enums.ts` en la revisión exportada: orden declarado de `rol_usuario`.
- `lib/db/src/schema/pagos-proveedor.ts` en la misma revisión: orden declarado de `forma_pago_proveedor`.
- `lib/db/src/lib/pagos-proveedor-schema.ts`: adición de FACTURADO al enum existente sin posición explícita.
- `lib/db/migrations/20260914_supplier_trace.sql`: habilitación ALWAYS del trigger de consumos.

La explicación mecánica y los valores están acreditados; no se reconstruyó una cronología de operaciones históricas ni se atribuyó quién ejecutó cada sentencia. No se concluye que las discrepancias sean cambios nuevos posteriores a la preparación. No se alteró ni relajó el preflight para aceptarlas.

## Tipos sin diferencias

| Tipo | Resultado |
|---|---|
| Funciones | Definiciones y atributos iguales, incluidos dueños, ACL y configuración. |
| Índices | Definiciones, validez, preparación y unicidad iguales. |
| Restricciones | Definiciones, validación y diferibilidad iguales. |
| Tablas | Definiciones de columnas, dueños, ACL, RLS y replica identity iguales. |
| Secuencias | Definiciones iguales. |
| Triggers | Definiciones iguales; una diferencia de modo, descrita arriba. |
| Enums | Mismas etiquetas; nueve diferencias de posición en dos enums, descritas arriba. |

## Integridad y evidencia

- Reconstrucción B0: estructura `37f6af5a2e06748a8499b995caeec072770090c36f2ad741d35c65953421bec8`; atributos `381cd3566d475a48e08ea2be82927718d69bd3332b83d38ead3b4a266594aff6`. Coinciden con los valores aprobados **sin modificarlos**.
- Real: misma estructura; atributos observados `c08c02eae60d61c611ff4ce3cb5854a4cb117a7a015ee8d50a0618eb4264626b`.
- `actual-catalog.json` y `reconstructed-catalog.json`: inventarios completos.
- `differences.json`: los diez pares de renglones esperados/reales.
- `comparison-summary.json`: conteos, identidades y hashes calculados.
- `live-read-evidence.json`: identificación de proceso y transacción, sin credenciales.
- `cleanup-and-preservation.json`: PostgreSQL detenido, base/exportación eliminadas y 181 archivos preexistentes conservados.
- `diagnose.mjs`: procedimiento usado; no forma parte del workflow ni modifica la aplicación.

No se cambiaron archivos existentes del paquete, hashes aprobados, manifiestos, bundles, workflow, permisos o datos operativos. El único archivo agregado dentro del paquete fue la autorización exigida; este diagnóstico está fuera de él. La API no se reinició. La consulta es una fotografía consistente en transacción de solo lectura, no una ventana de liberación sin escritores.