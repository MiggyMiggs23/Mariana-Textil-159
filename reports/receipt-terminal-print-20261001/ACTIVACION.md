# Activación preparada — MAIN únicamente

**Cierre actualizado: activado por MAIN; véase `ESTADO.md`.** El protocolo siguiente se conserva como descripción del procedimiento preparado y ejecutado. La preparación del worker no accedió a appDB; después MAIN obtuvo PASS digital acotado, aplicó guarda + siete defaults en transacción y activó los bytes exactos con workflows validados. No hubo publicación externa ni inicializadores generales.

**Bloqueo descubierto y corregido en ensayo E5:** el trigger nativo `e5_insert_authority` todavía exigía ADMIN para `e5_impresiones`. El compuesto **revision-3** conserva exactamente los binarios revision-2 y añade `lib/db/src/lib/receipt-print-authority.sql`. MAIN instaló esta migración en el arnés conservado: `run-vd201X/receipt-print-guard-1790900480221.json` acredita filas financieras/auditoría y demás funciones sin cambios. La regresión MAIN cerró con PASS digital en `remainder-rjBxgw`, complementada por los E3 anteriores y la revisión visual parcial descrita en ESTADO. El script de activación indicado abajo instaló **guarda + defaults en una sola transacción**; no bastaba el UPSERT de defaults. No desactivar triggers ni ampliar ninguna guarda financiera: el parche añade exclusivamente una rama documental con permiso efectivo, sitio asignado, recepción CAJA original e intención IMPRIMIR coherente. La fuente financiera anterior (incluida extensión E11) permanece byte por byte. El hash histórico de E11 se conserva como procedencia; una reversión E11 antigua deberá detenerse por drift en lugar de borrar silenciosamente la nueva regla.

## Orden después de PASS

Desde la raíz, usando el PID **del Node API activo**, no el arnés:

1. `node reports/receipt-terminal-print-20261001/activate-permission-defaults.cjs preflight <API_PID>`
2. Revisar `permission-preflight.json`: identidad helium, cambios exactos por rol, filas personalizadas conservadas, hashes de las tres tablas completas y plan de la función (`REPLACE_PRINT_BRANCH_ONLY` o `UNCHANGED`). Acepta exclusivamente la definición anterior probada `8e5b05bc6101b1d1ddd311bc34e7e47d16247fd655b7d48dc6bfba222900b90c` o la nueva `fe3f1b3b070c48c0deac7c1f0d7c8281c7262b1cf131fa8c44f287f8fdedcbab`. El snapshot íntegro queda en `permission-preflight-private.json` (0600; no adjuntarlo a informes públicos).
3. `node reports/receipt-terminal-print-20261001/activate-permission-defaults.cjs apply <API_PID> --main-authorized-after-pass`
4. `node reports/receipt-terminal-print-20261001/stage-release.mjs --main-authorized-after-pass`
5. Revisar `permission-applied.json`, `release-staging.json`, y ejecutar las dos guardas `sha256sum -c reports/receipt-terminal-print-20261001/release-api.sha256` / `release-web.sha256`.
6. MAIN copiará `api.proposed.toml` / `web.proposed.toml` a archivos temporales hermanos de los artefactos reales y utilizará **verifyAndReplaceArtifactToml** de la skill artifacts, con rutas absolutas. Sólo después realizará el cambio/reinicio coordinado y verificará health, identidad servida y recorridos autorizados. No compilar desde HEAD.

El callback de la skill **valida y reemplaza**, no ofrece dry-run: la validación de esquema definitiva se deja a MAIN en el paso 6 para no alterar servicios durante esta preparación. Las propuestas mantienen los campos, puertos, rutas, IDs y configuración de producción existentes; sólo cambian los comandos development a bundles congelados y sus guardas. No se solicita publicación externa.

## Alcance y guardas

- Lee DATABASE_URL únicamente del entorno `/proc` del mismo proceso API driver-phones verificado por bytes; rechaza TEST_DATABASE_URL, NODE_ENV=test, Neon y cualquier base distinta de heliumdb. No imprime URI ni credenciales.
- Preflight en transacción READ ONLY; apply exige la misma identidad/proceso, versión de script y snapshot de todas las filas de permisos. Cualquier drift detiene antes del UPSERT; repetir preflight para revisión, no eludir la guarda.
- La transacción bloquea las tres tablas de permisos y reemplaza sólo la función `e5_insert_authority()` con el SQL exacto probado; su único DML es el UPSERT de `recibos_abonos` para defaults no personalizados. ADMIN/TERMINAL ver=true, demás roles ver=false, otras acciones=false. No toca filas ya iguales ni `updated_por`, usuarios, ubicaciones u otros módulos. Compara valores e identidad MVCC de cada fila ajena antes de COMMIT. Exige ausencia de event triggers DDL y verifica todas las demás funciones, owner/ACL/configuración de la guarda y todos los triggers sin cambios. Defaults y función se confirman o revierten juntos.
- Fallos de guardas o triggers requieren diagnóstico. No ejecutar seed, ensureStartupSchemas ni SQL de reparación general. La API propuesta conserva `API_INSPECTION_BOOT=1` explícito.
- Staging verifica hashes antes de copiar y después. Destinos nuevos: `artifacts/api-server/dist-receipt-terminal-print-20261001` y `artifacts/mariana-textil/dist-receipt-terminal-print-20261001`. Copia exacta de revision-2, sin rebuild; resolución de paquetes externos por node_modules instalado. Nunca sobrescribe destinos existentes.
- Bundle API candidato: `f29032a0b172fb6a53d86be1cd80da3b27faf91ceb5a500d262b20e2b79aff0a`. Manifest candidato: `889ac50564e5cff92129df60d467e864748105079d07dfb742b0c3ce7b262a09`.
- Conservación: fuente/bundles sidebar-order y driver-phones, así como pruebas congeladas anteriores, no se sustituyen. Ante fallo de activación, MAIN puede conservar/restaurar los comandos previos; no borrar personalizaciones ni revertir indiscriminadamente filas de permisos.

## Recorrido para el usuario

1. En **Terminal**, buscar “Consultar / imprimir recibos de abonos” por cliente o folio. También existe **Recibos de abonos** para perfiles con permiso efectivo.
2. Abrir un recibo E3 o E5 recibido en Caja. TERMINAL sólo ve el sitio asignado, aunque el selector de consulta indique TODAS.
3. Solicitar impresión/reimpresión; en E5 indicar motivo. Se audita la solicitud. Se conservan dos copias A5 horizontal, Cliente y Tienda; cancelar el diálogo no vuelve a cobrar ni aplica dinero.
4. Si no hay asignación, permiso o evidencia suficiente, corregir acceso/evidencia con el responsable; no reconstruir saldos históricos ni forzar emisión.
5. La matriz muestra **Recibos de abonos · Ver = consultar / imprimir (sin operaciones financieras)**. ADMIN/TERMINAL son defaults; las personalizaciones explícitas prevalecen. Autorizar/aplicar dinero permanece ADMIN.

## Evidencia y pendientes

| Verificación | Resultado |
|---|---|
| Backend documental | 4/4 aprobado |
| Defaults | 1/1 aprobado |
| UI montada de descubrimiento | 4/4 aprobado |
| Typecheck libs/API/UI y builds | aprobados |
| Ensayo aislado `isolatedrun-vd201X` | PENDIENTE de consolidación MAIN |
| Navegador receipt-terminal-browser | PENDIENTE |
| Preflight y cambios appDB | NO EJECUTADOS |
| Copia a destinos estables/configuración/arranque | NO EJECUTADOS |
| Impresora física del propietario | PENDIENTE; no sustituida por PDF/navegador |

MAIN debe registrar resultados y conteos reales, hash del PASS usado, filas efectivamente insertadas/actualizadas/preservadas, guardas del proceso servido y límites pendientes; no convertir esta preparación en evidencia de liberación.

## Persistencia en futuras instalaciones

La inspección de `artifacts/api-server/src/index.ts` y `lib/db/src/prepare-test-database.mjs` confirma que **el arranque normal no crea ni reemplaza las funciones E5**. No hay un inicializador oculto que reintroduzca la guarda ADMIN-only en el siguiente arranque. E5/E11 se instalan mediante una cadena financiera explícita, autorizada y separada; no debe añadirse esta migración al arranque para eludir esa frontera.

`lib/db/src/lib/receipt-print-authority.mjs` es ahora el paso terminal canónico, idempotente y fijado por SHA de cualquier nueva instalación financiera E5/E11 de esta función. El bootstrap actual de la funcionalidad (`reports/receipt-terminal-runtime-20261001/fixture.mjs`) lo invoca después de la cadena histórica, sin editar los SQL/pruebas congelados anteriores. Una instalación desde cero debe finalizar esa cadena con `installReceiptPrintAuthority(client)`; una base sin E5 falla explícitamente, no aparenta instalar el permiso. El llamador conserva la responsabilidad de identidad y transacción. No se cambió el bundle API ni se requiere reconstrucción/reinicio para el parche SQL.