# Tanda E · tarea 1 · entorno E2E desechable

## Estado de preparación

- Fuente congelada: commit `38dff5e8e104be06991cd1bd1c49524fa40c4dd7`, worktree privado `.local/tanda-e-20260923/tarea-1/source-38dff5e8`.
- Fuente efectiva leída: base `heliumdb`, PostgreSQL `160010`.
- Captura: `pg_dump` custom, transaccionalmente consistente durante la captura; no se afirma quiescencia ni igualdad exacta posterior.
- Copia local: `tanda_e_e2e_copy` en `127.0.0.1:55439`. Testigo local distinto: `tanda_e_app_witness`.
- Antes de cualquier escritura, fuente y copia coincidieron en: 107 tablas públicas, 31 usuarios, 11 ubicaciones, 1234 productos, 740 rollos y 3 tickets.
- SHA-256 privado del dump: `bfe0241004a229c578027adfcd968706f39a3d90f3d93295b3268691691336aa`.
- Los 31 actores restaurados quedaron anonimizados, con credencial aleatoria desconocida y deshabilitados. Se eliminaron sesiones restauradas. Sólo quedan activos los dos actores sintéticos.
- La restauración reveló una ambigüedad real en el cuerpo de `e11_graph()`: declara una variable `a record` y reutiliza `a` como alias SQL de `e11_avisos`. Para no relajar globalmente `plpgsql.variable_conflict`, la copia usa el arreglo mínimo de renombrar esos dos alias internos a `aviso`; `proconfig` quedó nulo. No se modificó fuente ni base de aplicación. Evidencia y propuesta para tarea 2: `reports/tanda-e-20260923/tarea-2-e11-graph-alias.md`.
- Frontend y API fueron compilados desde la revisión congelada. No se ejecutó navegador.
- El launcher se validó de extremo a extremo: `/api/healthz` devolvió `{"status":"ok"}`, `/` devolvió HTTP 200 y la conexión servida confirmó `current_database()=tanda_e_e2e_copy`.
- La API se importa primero con `NODE_ENV=test` para ejecutar la guardia de URLs aisladas. Después, el runner activa el modo de inspección de arranque ya existente únicamente para omitir inicializadores de startup sobre el schema restaurado; las rutas/mutaciones de navegador no se vuelven read-only. Esto evitó el fallo PostgreSQL `55006` de un inicializador que intentaba crear un índice con eventos de trigger diferidos pendientes, sin editar fuente ni gates.

## Arranque y URL

MAIN debe mantener este comando en primer plano durante la única sesión del subagente de navegador:

```bash
bash reports/tanda-e-20260923/tarea-1/launch-isolated.sh
```

URL: `http://127.0.0.1:43820/`

El launcher falla cerrado si falta cualquier artefacto, si el puerto PostgreSQL está ocupado o si `current_database()` no es `tanda_e_e2e_copy`. API y UI sólo escuchan en loopback. La API recibe `TEST_DATABASE_URL=tanda_e_e2e_copy`, `APPLICATION_DATABASE_URL=tanda_e_app_witness`, `REQUIRE_ISOLATED_TEST_DATABASE=1`; nunca recibe la URL de `heliumdb`.

Credenciales, sin valores: `.local/tanda-e-20260923/tarea-1/credentials.json` (modo `0600`). Claves JSON originales: `admin` y `caja`. Para el recorrido restante usar exclusivamente `admin2` y `caja2`.

## Fixtures

- Sitio: `TANDA E E2E TIENDA` (`TEE`, id 837).
- Roles: `TANDA E ADMIN` (ADMIN, id 238) y `TANDA E CAJA` (CAJA, id 239).
- Cliente: `TANDA E CLIENTE CREDITO` (id 10, plazo 30, límite 5000).
- Producto: `TANDA-E-POS` / `TANDA E TELA POS` / `AZUL E2E` (id 2080), lista 150, costo físico 100.
- Proveedor sintético activo: `TANDA E E2E PROVEEDOR` (id 226).
- Entrada canónica: id 468, folio 1 en TEE, 5 rollos, costo total 500.00. Los cinco rollos enlazan por `recepcion_id` a esta entrada y el proveedor de rollo/entrada concilia.
- Rollos completos de 1 metro:
  - `991000001`: venta efectivo.
  - `991000002`: venta transferencia.
  - `991000003`: Nota a crédito para abono E3.
  - `991000004`: intento bajo costo sin marca, debe negarse.
  - `991000005`: marcar remate y vender bajo costo.

La cadena de trazabilidad fue completada después del primer recorrido, que
reveló el error de fixture `Falta evidencia de entrada/proveedor`. El cambio se
limitó a la copia desechable: se agregó un proveedor, una cabecera de entrada y
se enlazaron exclusivamente los cinco rollos sintéticos. No se tocaron tickets,
sesiones, salidas, movimientos históricos, otras bases ni código.

### Fixture aislado para el recorrido restante

La regla natural de una sesión por sitio/día impide reabrir TEE después del
cierre correcto de la sesión 46. No se alteró su fecha, estado ni historia. Se
agregó en la misma copia desechable un segundo sitio sin sesiones previas:

- Sitio `TANDA E E2E TIENDA 2` (`TES`, id 839).
- Actores: `admin2` → `tandae-admin2` (ADMIN, id 240) y `caja2` →
  `tandae-caja2` (CAJA, id 241). Conservan las políticas naturales de esos
  roles; no hay permisos excepcionales.
- Proveedor activo id 227 y entrada canónica id 469 / folio 1 / costo 500.00.
- Rollos disponibles, cada uno con recepción canónica y trazabilidad completa:
  - `992000001` (id 6248): venta efectivo.
  - `992000002` (id 6249): venta transferencia.
  - `992000003` (id 6250): Nota a crédito / abono E3.
  - `992000004` (id 6251): control bajo costo sin marca.
  - `992000005` (id 6252): marcar remate y vender bajo costo.

El siguiente navegador debe abrir un turno nuevo en TES y ejecutar solamente
los pendientes: ventas efectivo/transferencia, Nota y abono E3, recibo con
control ADMIN/CAJA y venta de remate. No debe repetir E4, cierre ni modificar la
sesión 46. El producto y cliente siguen siendo los fixtures globales ids 2080 y
10.

## Secuencia y comprobaciones obligatorias del único navegador

Guardar capturas, notas y cualquier traza redactada en `reports/tanda-e-20260923/tarea-1/evidence/`. No guardar contraseñas, cookies ni encabezados.

1. **CAJA, apertura:** iniciar sesión como `caja`; abrir Caja en `TEE` con fondo `500.00`. Comprobar sesión ABIERTA y efectivo esperado inicial `500.00`.
2. **Venta efectivo:** vender completo `991000001` a lista `150.00`; cobrar `EFECTIVO`. Comprobar ticket cobrado y esperado `650.00`.
3. **Venta transferencia no física:** vender completo `991000002` a `150.00`; cobrar `TRANSFERENCIA` con referencia no vacía. Comprobar ticket cobrado y que efectivo esperado permanece `650.00`.
4. **Nota y abono E3 ordinario:** crear Nota a crédito de `991000003`, cliente fixture, plazo 30 días, y autorizarla desde Caja. En el flujo **Abono E3 ordinario** cobrar `50.00` en efectivo. No usar E1 genérico ni E5. Comprobar folio E3, aplicación FIFO a la Nota, deuda posterior `100.00` y efectivo esperado `700.00`.
5. **Recibo y reimpresión:** salir de CAJA, entrar como ADMIN, abrir el mismo recibo por el resultado del abono o estado de cuenta/corte. Comprobar que la ruta ADMIN muestra folio, cliente, `50.00` y Nota aplicada. Solicitar impresión/reimpresión con un motivo explícito y cancelar el diálogo del navegador si aparece; comprobar que no se registra otro abono. Verificar que CAJA no obtiene acceso a la ruta de recibo.
6. **Remate y negativas:** como ADMIN, intentar venta de `991000004` a `90.00`; debe negarse porque está bajo costo y no marcado. En catálogo, intentar cambiar precio de lista del producto a `90.00`; debe negarse con “El precio de lista no puede ser menor al costo.” Marcar `991000005` como remate con motivo no vacío, venderlo a `90.00` y cobrar por TRANSFERENCIA; comprobar venta aceptada y señal histórica de remate.
7. **E4 sin/con motivo:** volver a Caja. Intentar salida `EXTRAORDINARIA` de `25.00` con motivo vacío; debe negarse y no crear fila. Crear la misma salida con motivo `E2E gasto extraordinario`; comprobar fila durable y efectivo esperado `675.00`.
8. **Insuficiencia y desbloqueo ADMIN:** como CAJA intentar extraordinaria `700.00`; debe negarse por Caja insuficiente, sin movimiento. Como ADMIN repetir con desbloqueo y motivo `E2E emergencia autorizada`; debe aceptarse sólo por ADMIN y conservar actor, motivo y saldo antes. Esta operación deja esperado `-25.00`.
9. **Cierre/reconciliación:** cerrar con contado `0.00`. Comprobar esperado `-25.00`, diferencia `25.00`, estado CERRADA, desglose E2 congelado y que no se permiten nuevos cobros/salidas ni un segundo cierre. El contado negativo está prohibido; no debe usarse para ocultar la excepción ADMIN.

## Evidencia preparada

- `source-identity.txt`: identidad/conteos de fuente y copia antes de escribir.
- `fixture-check.txt`: verificación posterior sin secretos.
- `fixture-manifest-redacted.json`: IDs y propósito de fixtures.
- `health-check.txt`: resultado de la validación real del launcher.
- Evidencia privada original: `.local/tanda-e-20260923/tarea-1/`.

## Teardown seguro

Ejecutar exactamente:

```bash
bash reports/tanda-e-20260923/tarea-1/teardown-isolated.sh
```

El comando sólo detiene PIDs cuyo `cmdline` coincide con este launcher, detiene el clúster local exacto, retira el worktree congelado y borra `.local/tanda-e-20260923/tarea-1`. No toca workflows, la aplicación ni `heliumdb`.