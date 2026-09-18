# E2 — revisión SQL de apertura limitada de abono físico

## Estado y alcance

Preparación **offline** únicamente. No se abrió conexión, no se consultó ni escribió la base, no se ejecutó DDL/DML, no se inició inicializador y no se reinició proceso alguno.

La única transición preparada reemplaza `public.e1_guard_cash_capture_closed()` para admitir exclusivamente la conjunción:

- `tipo = 'ABONO'`
- `naturaleza = 'INGRESO_FISICO'`
- `forma_pago = 'EFECTIVO'`

La función sigue rechazando con `E1C01` todo `DEVOLUCION_FISICA/EFECTIVO` y cualquier `INGRESO_FISICO/EFECTIVO` cuyo tipo sea distinto de `ABONO`. No se añadió bandera, variable de aplicación, permiso de worker ni mecanismo alternativo para abrirla.

`E1P01` y `E1A01` permanecen cerradas. Las validaciones permanentes de movimiento, reverso, sesión/sitio, cobro retenido, atribución e inmutabilidad no se reemplazan ni deshabilitan. No se prepara tabla de devolución, `GRANT`, `REVOKE`, cambio de rol ni `ALTER TABLE`.

## Referencia instalada leída de evidencia

Fuente offline: `../e1-guardas-operativa-2026-09-18/operational-run-1789747937364-3434.json`; estado reportado `PASS`, `finalReferenceComparison=PASS` y `finalPreservation=PASS`.

- SQL de instalación original de caja: SHA-256 `9e14649f95dbc889823a7c349a8e009ea1916699140914f03a453751f2d4c9b4`.
- Conjunto de tres funciones de guarda cerrada: SHA-256 reportado `59dd73520c3d11cc65b3f2fac25f46a4560ca45700c5c981c21e17dfe80988fd`.
- Conjunto de tres triggers temporales: SHA-256 reportado `982aa15dcce33633ccf42ae5a79f03858bd2ff0eee26724da8858f1216accb05`.
- Definición `pg_get_functiondef` de la guarda de caja: SHA-256 offline `f9ea1a43446d71608d666fc11b3464b53592aca92da92f2ceb9cb71d1802cc64`.
- `prosrc` cerrado exacto: SHA-256 offline `994ad4041bf1f8d96e0dbafcb81f07829d915f32598b4fd3721560c77461c6fd`.
- Dueño observado: `postgres`; ACL observada: `NULL` (privilegio EXECUTE por defecto de `PUBLIC`); `SECURITY INVOKER`; retorno `trigger`; lenguaje `plpgsql`; `search_path=pg_catalog, public`.
- Trigger de caja observado: `AFTER INSERT`, `FOR EACH ROW`, `tgenabled='O'`, `tgtype=5`, sobre `public.movimientos_credito`.
- Triggers E1P01/E1A01 observados: `AFTER INSERT`, `FOR EACH STATEMENT`, `tgenabled='O'`, `tgtype=4`.

No se presenta esa evidencia histórica como una lectura actual de la base.

## Archivos e inventario

| Archivo | SHA-256 | Inventario ejecutable |
|---|---|---|
| `sql/01-apply-limited-cash-abono.sql` | `8d8f11539712cbce8dd4d4b9647ccca453bfae902dc71b7ce3fdd93abde4015d` | 1 `BEGIN`, 1 lock, SELECT/preflight, 1 `CREATE OR REPLACE FUNCTION`, SELECT/postflight, 1 `COMMIT` |
| `sql/02-revert-closed.sql` | `f18b06411a48eed32f74d70d0901141302d557aecd1a0e9f93850b29e66e4a4c` | mismo límite; restaura el `prosrc` cerrado exacto |
| `sql/contracts.mjs` | `8ebbb631e6e9c6d7495ee492852c66627084365867aaaca978c853c47e235a48` | contrato compartido importable y manifiesto SQL |
| `sql/00-plan-digests.mjs` | `3092477540f5d766af77722fcfbe4be9794aba87d9942f043679c37bb94ff690` | cálculo offline, sin red ni cliente DB |
| `sql/offline-structural-tests.mjs` | `2bffa417e135838b025297533e6a4397d7531871347982c6f5c046e6c26dc2e6` | inventario y diez copias negativas en memoria |

El cuerpo limitado tiene SHA-256 `0f3c96e4e42edd1ba9319a9796bdb75fee647cd8cfe0974e99b6eb0987c57f7a`. El cuerpo del reverso coincide byte por byte con el `prosrc` cerrado (`994ad404…`).

Los dos SQL contienen solamente control transaccional, un `LOCK TABLE` de las tres tablas E1 y `auditoria`, consultas `SELECT` y un único reemplazo de la función objetivo. No contienen DML, `DROP`, `ALTER`, cambios de privilegios ni reemplazo de otra función.

## Interfaz de coordinación fail-closed

El operador autorizado debe proporcionar al arnés psql **ambas** variables; no existen valores predeterminados:

1. `expected_identity_sha256`
2. `expected_plan_sha256`

La identidad técnica prevista es SHA-256 UTF-8 de:

`current_database|database_oid|current_user|server_address_o_<local>|server_port_o_<local>|server_version_num`

No contiene contraseña, URL de conexión ni datos operativos. La obtención de esos campos requiere una fase de identidad de solo lectura separadamente autorizada; estos archivos no la ejecutan.

El **digest de plan** es SHA-256 UTF-8 de:

`E2_APERTURA_LIMITADA_PLAN_V2|<identity_sha256>|<mode>|<functions_report_hash>|<triggers_report_hash>|<audit_prosrc_fingerprint>`

Modos exactos:

- aplicar: `CLOSED`
- revertir: `LIMITED`

`00-plan-digests.mjs` recibe el hash de identidad y el modo, importa las constantes de `contracts.mjs` y entrega el digest que el coordinador/boot worker debe pasar. No recibe credenciales. Un modo, identidad o digest ausente/diferente termina la sesión antes del reemplazo.

Este valor identifica el plan coordinado; **no es un hash del catálogo actual ni prueba que el preflight pasó**. Los dos hashes incluidos proceden del reporte E1 citado. No se fabricó ni se autoaprobó un supuesto hash de catálogo LIMITED: ese estado todavía no fue capturado en una DB. Si en una fase futura se autoriza una captura real de catálogo, su hash y evidencia deberán entrar por un canal independiente, antes de cambiar este contrato.

`contracts.mjs` es ejecutable para inventario JSON e importable sin efectos de red. Expone versión de plan, digests del reporte, metadatos fijos, los once contratos de trigger y el manifiesto apply/revert con sus variables obligatorias. Su forma JSON final contiene `planVersion`, `reportDigests`, `functionMetadata`, `triggers`, `audit` y `sqlManifest`.

El tercer fingerprint es el SHA-256 del `prosrc` histórico exacto de `public.proteger_auditoria_append_only`: `9e7e5b8de15d7079105c3d29416142e6f2825c8cd1828f85f8b67a1e4e842099`. No modifica los dos digests E1 históricos. El contrato `audit` incluye trigger, metadatos, fuente exacta y fingerprint; cambiarlo invalida el digest PLAN V2.

## Cortes y comprobaciones

### Antes del corte

Dentro de la transacción y después del lock:

1. compara la identidad con la prevista;
2. exige el modo de entrada exacto (`CLOSED` al aplicar, `LIMITED` al revertir);
3. compara cuerpo y metadatos de la función;
4. exige dueño, ACL, seguridad, lenguaje, retorno y `search_path` observados;
5. exige que `PUBLIC` conserve su EXECUTE por defecto, sin ampliarlo;
6. compara las once guardas no internas exactas de las cuatro tablas por catálogo estructurado, no por `pg_get_triggerdef`: las diez E1 más `auditoria_append_only`, con OID enlazado de esquema/tabla/función, nombre, `tgtype`, `tgenabled`, `tgargs`, `tgattr`, constraint, parent y ausencia de `tgqual`;
7. fija también esquema, dueño `postgres`, lenguaje `plpgsql` y `SECURITY INVOKER` de cada función enlazada por esos triggers;
8. compara los cuerpos E1P01 y E1A01;
9. compara fuente exacta, fingerprint y metadatos de `proteger_auditoria_append_only`;
10. rechaza filas faltantes, adicionales o drift desconocido.

No se compara texto de trigger, por lo que una diferencia inocua de calificación `ON public.tabla` frente a `ON tabla` no produce falsos rechazos por `search_path`.

El permiso por defecto de `PUBLIC` se comprueba con `aclexplode(COALESCE(proacl, acldefault('f', proowner)))`, grantee OID `0`, `EXECUTE` y sin grant option. No se intenta resolver `PUBLIC` como rol de `pg_authid`; se conserva `proacl IS NULL` y no hay `GRANT`.

### Corte

Se ejecuta un solo `CREATE OR REPLACE FUNCTION`. PostgreSQL conserva OID, dueño y ACL de la función existente. No se toca trigger alguno.

### Después del corte

Antes de `COMMIT`, se vuelve a comparar el cuerpo objetivo y sus metadatos críticos. Cualquier error o comparación falsa cierra la conexión con la transacción sin confirmar. El lock de tabla se mantiene hasta el commit.

El reverso no elimina ni recalcula filas, abonos, aplicaciones, sesiones o cortes; únicamente repone la definición cerrada exacta.

## Prueba offline y límites

`node reports/e2-apertura-limitada/sql/offline-structural-tests.mjs` reportó:

- inventario esperado en aplicar y revertir;
- cero DML y cero DDL de objetos/permisos fuera del único reemplazo;
- diez mutaciones aisladas detectadas: tipo permitido, devolución, `SECURITY`, ACL, identidad obligatoria, lectura real de `tgenabled`, `tgqual`, esquema de función, pseudo-grantee `PUBLIC` y fingerprint append-only;
- cero conexiones PostgreSQL.

Esta revisión estructural no demuestra semántica PostgreSQL real, permisos efectivos, adquisición de locks ni comportamiento concurrente. El lock preparado bloquea escrituras y cambios de trigger sobre las cuatro tablas durante la transacción, pero no se afirma seguridad concurrente operativa hasta una ejecución y prueba real expresamente autorizadas. Tampoco se afirma apertura de devoluciones, cobros retenidos o atribuciones históricas.