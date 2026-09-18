# E1 — propuesta acotada de verificación transaccional aislada

> **SUPERSEDIDA por la autorización posterior del propietario.** Se permite preparar un ensayo con escrituras en el **clon desechable existente**, no en una segunda base; scripts y alcance deben presentarse antes de ejecutar. La especificación vigente es `alcance-tecnico-ensayo-clon.md` y los archivos `scripts/src/e1-rehearsal*.mts`. El texto siguiente se conserva como antecedente, no como instrucciones vigentes.

**Estado: PROPUESTA NO EJECUTADA, PENDIENTE DE MANIFIESTO Y SCRIPT REVISABLES.**

Este documento no concede autorización. La API permanece pausada. No se han ejecutado consultas, pruebas, restauraciones ni transacciones para preparar esta propuesta. Sólo se revisaron archivos del código y de las evidencias anteriores.

**No presentar todavía una pregunta de autorización al propietario:** faltan el script cerrado, su identidad de destino y el inventario exacto de registros elegibles o fixtures empresariales. No se solicita permiso abierto para resolver esas carencias durante una ejecución.

## 1. Objetivo y límites

Verificar con PostgreSQL real los siete productores E1 y la entrada adicional de cancelación desde salidas, sin arrancar HTTP, importar el bootstrap, modificar producción ni ejecutar la batería existente de 122 pruebas API.

Los resultados offline comunicados —59 pruebas con dobles— y la conservación de la migración no prueban por sí solos:

- La compatibilidad ejecutable de Drizzle/SQL con las columnas, enums, FK, restricciones y triggers realmente restaurados.
- La serialización real de JSONB, dinero y fechas; ni la extracción de metadatos de solicitudes dirigidas.
- Las esperas y la visibilidad entre conexiones ante `ON CONFLICT`, el replay tras COMMIT o la ausencia de efectos laterales duplicados.
- La atomicidad conjunta de movimientos, aplicaciones, auditoría, inventario y notificaciones ante un fallo.
- La consulta de evidencia con identidad completa y microsegundos en PostgreSQL.

No se declarará E1 listo para operar hasta completar las comprobaciones autorizadas o hasta que el propietario acepte explícitamente el límite de verificación. Un PASS de esta prueba tampoco autorizaría reanudar la API.

## 2. Único destino propuesto y respaldo

Se propone **una sola base local adicional y desechable**, con nombre fijo previsto `e1_verificacion_aislada_20260917`, creada vacía y restaurada desde el archivo ya verificado:

- Archivo: `.local/backups/prompt-h-block2-20260917165108-3655/prompt-h-block2-20260917165108-3655.dump`.
- Tamaño documentado: 464990 bytes.
- SHA-256 esperado: `583ac96297ca40573aa96249e2b25de68812f98bd7b675214473932fe81f2925`.

No sobrescribir ni reconstruir el respaldo. No subir, reemplazar ni borrar nada en Drive. No restaurar, migrar, limpiar ni ejecutar pruebas en el clon retenido `restore_disposable_20260917165108-3655`; su directorio y sus archivos quedan intactos. Tampoco usar su clúster para alojar esta prueba, pues ello modificaría los archivos retenidos.

El nuevo destino debe residir en una instancia local separada, con directorio y socket propios fuera del directorio del clon retenido, sin TCP ni exposición pública. La elección de instancia, socket, directorio, administrador PostgreSQL existente y mecanismo de creación debe quedar cerrada en el script antes de solicitar autorización. No crear roles de base de datos para solventar dependencias de restauración: si faltan los propietarios/roles existentes necesarios, detenerse y reformular la propuesta. No crear usuarios ni sesiones de aplicación.

No hay autorización implícita para una segunda base, un segundo intento de restauración o una limpieza automática. Tras la prueba, conservar la nueva base y el informe hasta que el propietario decida su eliminación; esa eliminación queda fuera de esta propuesta.

### DDL E1, sin alterar su semántica

Referencia aprobada: `reports/e1-ensayo-2026-09-17/operativo-propuesto/01.sql`, SHA-256 documentado `680f8f4d339d20775dabeb540c43d4945391652f1eabd6e0162f3a1ca48ce57f`.

Aplicar una sola vez, exclusivamente al destino nuevo, el DDL E1 ya aprobado: mismas definiciones de tablas, columnas, tipos, índices, vista, funciones, restricciones y triggers; sin DDL de aplicación adicional.

**Limitación técnica que debe resolverse antes de pedir autorización:** S07 del archivo original exige `heliumdb`, OID e inicio de instancia operativos. El archivo completo no puede ejecutarse sin cambios contra una base con otro nombre. El script debe mostrar una envoltura de destino aislado que sustituya únicamente esas comprobaciones de identidad por las del destino nuevo, conservando las comprobaciones de dependencias/colisiones y las sentencias de DDL S08–S26 sin modificaciones. Debe publicar el diff y hashes de esa envoltura, nunca editar el archivo aprobado ni debilitar sus comprobaciones. No se admite llamar «ejecución idéntica» a un archivo cuya guarda fue adaptada.

## 3. Guardas obligatorias antes de cualquier escritura de prueba

La restauración y la migración constituyen una fase separada de preparación; sus únicas escrituras permitidas son restaurar el respaldo y aplicar E1 a la nueva base. Una vez concluida esa fase, rige la lista cerrada de tablas de la sección 4.

Cada conexión de control, productor o lector debe comprobar nombre exacto de base, OID nuevo, dirección/socket local previsto, puerto si corresponde, versión, identidad de instancia y esquema `public`. Fijar estos valores en un manifiesto antes de abrir conexiones de prueba; revalidarlos al adquirir cada conexión.

Rechazos duros:

- Nombre `heliumdb`, nombre del clon retenido, cualquier otro nombre no aprobado, socket/dirección distintos o identidad de instancia distinta.
- URL heredada de producción, conexión sin destino explícito o importación que pueda abrir un pool antes de validar la identidad.
- Destino ya existente cuando se pretende crearlo, hash/tamaño de respaldo diferentes, restauración parcial, colisiones E1 o diferencia no explicada frente al respaldo.
- Cualquier escritura fuera de las tablas, operaciones y registros previamente declarados; acceso de red saliente, listeners HTTP o jobs de aplicación.

No modificar variables compartidas de entorno ni configuración de la aplicación. El destino se vinculará sólo al proceso aislado. El script debe interceptar o inyectar **todos** los accesos `db`/`pool`, incluido el cliente PostgreSQL directo de baja incobrable; no basta con inyectar el argumento `tx` de POS.

No confiar únicamente en buscar nombres en cadenas SQL: la instrumentación debe rechazar DML no autorizado y comparar huellas de tablas protegidas. También debe inventariar los triggers restaurados que puedan escribir indirectamente. No deshabilitar triggers, cambiar `session_replication_role`, elevar permisos para saltarse controles ni añadir funciones de prueba a la base.

## 4. Lista cerrada de escrituras de los productores

Nombres SQL contrastados con los esquemas actuales. `INSERT` incluye avance normal de la secuencia serial de esa tabla en el destino nuevo, aun si una transacción se revierte. No se permite `setval`, reinicio de secuencias ni cambios de definición durante las pruebas.

| Tabla `public` | Operaciones de aplicación contempladas | Causa exacta |
|---|---|---|
| `operaciones_credito_e1` | INSERT, incluido ON CONFLICT DO NOTHING | Claim de los siete productores. Nunca UPDATE/DELETE. |
| `movimientos_credito` | INSERT exclusivamente | Un movimiento nuevo por operación efectiva. Nunca UPDATE/DELETE. |
| `aplicaciones_credito` | INSERT exclusivamente | Autorización con favor, abono ordinario y dirigido. |
| `auditoria` | INSERT exclusivamente | Auditoría de los siete productores y solicitud/aprobación dirigida. |
| `autorizaciones_nota` | INSERT exclusivamente | `autorizarNota`. |
| `tickets` | UPDATE de los tickets seleccionados | Autorización y cancelación. No creación de tickets por estos productores. |
| `notificaciones_credito` | INSERT; UPDATE de `leida_at` | Autorización; supresión de aviso al cancelar. |
| `solicitudes_pago_dirigido` | INSERT; UPDATE de resolución | Solicitud CLIENTE y aplicación/aprobación. No rama PROVEEDOR. |
| `notificaciones_sistema` | INSERT, incluido ON CONFLICT DO NOTHING | Aviso de resolución dirigida. |
| `clientes` | UPDATE de `activo`, `updated_at` | Baja incobrable del cliente seleccionado. **No ejecutar la rama DELETE de baja sin deuda.** |
| `rollos` | UPDATE de estado/cantidad de rollos seleccionados | Venta ligada a autorización y reverso de inventario al cancelar. |
| `movimientos` | INSERT exclusivamente | VENTA/CANCELACION de inventario en esas dos rutas. |
| `existencias` | INSERT / ON CONFLICT DO UPDATE de cantidad y conteo | Recálculo de caché del par producto/sitio afectado. |
| `ticket_linea_consumos` | INSERT CONSUMO/REVERSA; ON CONFLICT DO NOTHING | Trazabilidad de proveedor de venta/cancelación. |
| `salidas` | UPDATE de cancelación; `autorizado_por_id` sólo cuando corresponda | Cancelación de salidas VENTA_CLIENTE ligadas al ticket; replay sin segunda actualización. |

No permitir DELETE ni TRUNCATE de ninguna tabla en la fase de pruebas.

Fuentes del grafo revisado:

- `lib/pos.ts`: `autorizarNota` → `consumirRollosSalidaVenta` (`lib/salidas.ts`) → `venderRollo`/`insertMovimiento`/`refreshCache` (`lib/inventario.ts`) y `recordTicketLineConsumption` (`lib/supplier-trace.ts`).
- `lib/pos.ts`: `cancelarTicket` → `revertirMovimiento`/`refreshCache` y `reverseTicketLineConsumptions`; `routes/salidas.ts` añade la actualización condicionada de `autorizado_por_id`.
- `routes/clientes.ts`: pagos, reversos y ajustes; `routes/clientes-admin.ts`: exclusivamente la rama BAJA_INCOBRABLE.
- `routes/pagos-dirigidos.ts`: solicitud CLIENTE, `apply` y `notifyRequesterResolved`.
- `lib/credit-evidence.ts`: claim e INSERT E1 compartidos.
- Esquemas: `pos.ts`, `rollos.ts`, `salidas.ts`, `ticket-linea-consumos.ts`, `aplicaciones-credito.ts`, `solicitudes-pago-dirigido.ts`, `clientes.ts`, `audit.ts`.

Las filas ya existentes sólo podrán actualizarse si sus IDs y columnas están en el manifiesto de casos. No se concede permiso general sobre todas las filas de estas quince tablas. Los triggers indirectos y el manifiesto deben revisarse antes de considerar cerrada esta lista.

### Tablas expresamente fuera de la lista

Ningún cambio de usuarios, hashes, sesiones de autenticación, sesiones de caja, días de caja, ubicaciones, pisos, permisos o configuración; tampoco productos, proveedores, entradas, contenedores, pagos de proveedor, folios o registros de viajes. Sus lecturas necesarias podrán realizarse en la nueva base. No invocar login ni `requireSession`, que renueva sesiones.

`cobros_credito_pendientes_e1` y `atribuciones_credito_e1` deben permanecer vacías. No ejecutar su helper de inserción, ni siquiera para «demostrar» una atribución válida. No convertir históricos en fixtures.

## 5. Identidad, credenciales y tres históricos protegidos

Reutilizar sólo actores y filas de sesión ya existentes en el respaldo. Construir `req.auth` únicamente en memoria con datos de esas filas; no fabricar cookies, sesiones, permisos o roles. No modificar actores/sesiones para simular cierres o revocaciones: usar otro actor o una sesión ya existente apropiados; si no existen, registrar el caso como pendiente.

Para rutas que exijan credenciales ADMIN, sólo usar una vinculación secreta existente dentro del proceso. Nunca imprimir, persistir, pasar como argumento visible de comando ni incluir contraseña/hash/token en el reporte. Validar mediante el mecanismo real. Si no existe vinculación válida, detener el caso y no falsear su aprobación, omitir validación ni cambiar hashes.

Registrar antes del primer caso las identidades y huellas completas de los **tres movimientos financieros históricos** del respaldo, incluidos ID, fecha exacta, importe y contenido; después de E1 sus siete campos nuevos deben seguir NULL. Mantener estas filas sin cambios al terminar y después de cada caso.

No UPDATE, DELETE, atribución, recaptura ni uso como movimiento a reversar de esos tres históricos; no generar operaciones de prueba cuyo objetivo sea alterar su significado. Tampoco usar sus tickets/clientes relacionados si los efectos laterales pudieran modificar el historial protegido. La exclusión de IDs y dependencias se incorporará al manifiesto.

## 6. Prerrequisitos empresariales: autorización actualmente vacía

**SQL adicional autorizado para crear o preparar fixtures empresariales: NINGUNO.**

La revisión de archivos permite identificar las tablas de los productores, pero no prueba que el respaldo tenga notas, clientes con deuda vencida, solicitudes, rollos trazables o sesiones elegibles suficientes para los siete casos sin tocar los tres históricos. No se realizaron consultas para descubrirlos.

El script pendiente debe primero poder inventariar en READ ONLY la nueva base y proponer IDs elegibles. Antes de solicitar permiso de ejecución debe existir un manifiesto cerrado que explique cómo se satisfacen, separadamente:

1. Nota de crédito pendiente, cliente activo, límite suficiente y sesión de caja existente abierta para VENTA_CREDITO.
2. Nota autorizada cancelable, con salida ligada no entregada y, para cubrir efectos de inventario, rollo y consumo trazables.
3. Cliente activo apto para ajuste manual.
4. Cliente activo con saldo vencido para BAJA_INCOBRABLE, sin reutilizar históricos protegidos.
5. Cliente/cargo aptos para abono ordinario y su aplicación.
6. Cargo apto para solicitud y aprobación dirigida.
7. Abono **nuevo de esta prueba**, no uno histórico, apto para reverso.

No asumir que el mismo cliente o la misma nota sirven para todos: la baja desactiva al cliente, la cancelación elimina la obligación y los abonos cambian la disponibilidad.

Si se necesitan fixtures, la propuesta debe ampliarse **antes** de preguntar al propietario, enumerando cada INSERT/UPDATE, tabla, columnas, cantidad máxima de filas, dependencias y su motivo. Una lista genérica «crear datos de prueba» no sirve. No crear tales fixtures con bootstrap, seed, venta completa u otro helper que agregue escrituras no revisadas. Si no se puede cerrar ese SQL exacto, mantener esta propuesta pendiente.

## 7. Presupuesto de casos, sin ampliación dinámica

Propuesta de límite para la fase de productores, independiente de cualquier fixture futuro que requeriría su propio presupuesto explícito:

- **Siete intenciones financieras efectivas como máximo**, una por productor: VENTA_CREDITO, CANCELACION_VENTA_CREDITO, AJUSTE_MANUAL, BAJA_INCOBRABLE, ABONO_ORDINARIO, ABONO_DIRIGIDO y REVERSO_ABONO. Máximo siete filas nuevas confirmadas en `operaciones_credito_e1` y siete en `movimientos_credito`.
- ABONO_DIRIGIDO usa una solicitud CLIENTE pendiente y su aprobación con la misma metadata/UUID. Esto supone dos transacciones de negocio, pero una sola intención y un solo movimiento. Probar también la rama de aplicación inmediata ADMIN exigiría explicitar una segunda intención o sustituir este caso; no se agrega automáticamente.
- Una repetición idéntica tras COMMIT por cada intención: siete replays, cero nuevos movimientos/aplicaciones/auditorías/notificaciones.
- Un conflicto de contenido por cada UUID: siete rechazos, cero escrituras confirmadas.
- Dos llamadas simultáneas, en dos conexiones, para **el mismo** ABONO_ORDINARIO: constituyen su único caso efectivo, no dos operaciones. Un ganador, un replay y una sola serie de efectos.
- Un intento con actor distinto sobre un UUID ya confirmado y un intento de sitio no autorizado con actor existente: dos rechazos, sin modificar usuarios/permisos.
- Dos transacciones deliberadamente fallidas, una de ABONO_ORDINARIO y otra de cancelación, con fallo de arnés después del último efecto lateral y antes de COMMIT. Máximo una ejecución de cada una; ROLLBACK completo, sin filas E1 adicionales confirmadas. No modificar código de producción ni crear triggers para inyectar ese fallo.
- La cancelación efectiva se invoca por la entrada ligada de salidas. Su UUID incluye `requestedSalidaId`; no reutilizarlo por la ruta directa con contenido distinto como si debiera ser un replay válido. La ruta directa puede verificarse en el caso de rollback sin añadir otra cancelación confirmada.
- Tres rechazos de captura cerrada: efectivo físico, cobro pendiente y POST de atribución histórica; sin activar flags ni insertar en tablas cerradas.
- Lecturas acotadas de evidencia: ADMIN, actor propio y actor fuera de alcance disponibles, con/sin preparación histórica; comparación exacta de cinco campos y fecha SQL de microsegundos. No crear atribuciones para estas comprobaciones.

El manifiesto debe fijar también cuántas filas auxiliares puede producir cada nota/rollo/aplicación seleccionados; **ese presupuesto aún está pendiente**, porque depende de los IDs y sus trazas. No ejecutar si falta. Un reintento adicional, otra combinación de productor, otra nota o fixture no quedan cubiertos.

## 8. Mecanismos y comandos: separación de lectura y escritura

No se incluyen comandos ejecutables completos mientras socket, rol, script y manifiesto no estén cerrados.

| Mecanismo previsto | Clasificación y alcance |
|---|---|
| `sha256sum`, inspección de archivos y `pg_restore --list` del dump | Sólo lectura del archivo. Sin secretos en salida. |
| Consultas de identidad/catálogos/huellas con `BEGIN ... READ ONLY` | Sólo nueva base. No consultas necesarias a producción ni al clon retenido. |
| Creación de la base local fija y `pg_restore --exit-on-error --single-transaction` | Escrituras de restauración sólo en la base nueva; nunca `--clean` contra una base existente ni restauración global de roles. |
| Envoltura revisada del SQL aprobado, con límites y watchdog | DDL E1 sólo en la base nueva; una ejecución. |
| Proceso Node de funciones/handlers con adaptadores reales pg/Drizzle inyectados | DML limitado a sección 4 y al manifiesto; no servidor, middleware de login, startup, migración automática o backfill. |
| Dos conexiones pg para el único caso concurrente | BEGIN/COMMIT/ROLLBACK exclusivamente en la base nueva. |
| Reporte de resultados, conteos, hashes y errores sanitizados | Sin datos personales, credenciales, URLs secretas ni filas crudas del respaldo. |

COMMIT se propone únicamente para la restauración, E1 y los casos previstos del destino nuevo que necesitan probar persistencia y replay real. Un resultado ambiguo de COMMIT exige lectura de comprobación, nunca repetir ciegamente. Establecer tiempos máximos, cierre garantizado de conexiones y cero reintentos automáticos. Los valores exactos de esos límites deben aparecer en el script revisado.

## 9. Criterios de aceptación y parada

PASS exige:

1. Identidad y hashes correctos; ningún acceso/escritura al origen o al clon retenido; respaldo local y Drive intactos.
2. DDL de prueba equivalente al aprobado, sin cambios de triggers existentes ni activaciones.
3. Siete productores completados dentro del presupuesto o resultados parciales identificados como tales, nunca PASS global si falta alguno.
4. Claim, movimiento y efectos auxiliares atómicos; replay y concurrencia sin duplicados; conflictos rechazados; rollback sin residuos excepto avance legítimo de secuencias locales permitido.
5. Metadata dirigida leída de JSONB correctamente; fecha/dinero canónicos estables; credenciales ausentes de contenido canónico y reportes.
6. Evidencia con alcance correcto, cinco campos exactos y microsegundos; tres históricos intactos, E1 histórico NULL, ninguna atribución.
7. Huellas sin cambios en usuarios, sesiones, configuración y todas las tablas excluidas; lista exacta de filas cambiadas dentro de las quince tablas permitidas y del presupuesto.
8. Flags efectivo/pendientes/atribución en false. Ningún alcance E2–E12, ninguna alteración de FIFO, deuda o límites de crédito.

Cualquier violación, dependencia no prevista, credencial inválida, ausencia de sesión/registro elegible, escritura indirecta no inventariada o límite excedido obliga a detener y reportar. No ampliar permisos ni fabricar evidencia para conseguir PASS.

## 10. Pendientes antes de solicitar autorización textual

- Script y manifiesto de identidad aislada; mecanismo de instancia separada sin tocar el clúster retenido ni crear roles.
- Envoltura de S07 y prueba estática del DDL sin diferencias semánticas.
- Inyección total de conexiones y bloqueo verificable de escrituras fuera de lista, incluidas las de triggers.
- Selección de registros existentes y exclusión de los tres históricos/dependencias.
- Lista SQL exacta de fixtures, si fueran indispensables; hoy es vacía, no autorizada.
- Presupuesto cerrado de filas auxiliares, secuencias afectadas, casos y tiempos; hashes de scripts y condiciones de parada.
- Vinculación secreta existente válida para los casos que la requieran, sin exponerla.

Sólo después de cerrar esos puntos se podrá pedir al propietario autorización para **esa versión exacta**. Este documento no autoriza ejecutar nada ni sustituye esa aprobación.