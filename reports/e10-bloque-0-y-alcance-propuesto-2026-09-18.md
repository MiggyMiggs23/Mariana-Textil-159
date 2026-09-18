# E10 — Bloque 0 y alcance propuesto

## Estado

**Revisión de código completada. Implementación y escrituras de E10 pendientes. Este documento NO es una autorización.**

Fuente: `attached_assets/Pasted--E10-Fondo-de-Mariana-movimientos-arqueo-e-historial-Co_1789751047884.txt`, contrastada con E10 de `reports/prompt-u-plan-de-implementacion.md`.

En esta revisión no ejecuté consultas SQL, migraciones, pruebas, login, reinicios ni cambios de aplicación. Sólo inspeccioné archivos y logs y escribí este informe. No se afirma haber comprobado el catálogo vivo ni conservación de datos en esta sesión.

## Bloque 0: patrones confirmados en el código

### 1. Arqueo actual de Caja

- `artifacts/api-server/src/lib/pos.ts:2600-2603`: muestra esperado, contado y diferencia `contado - esperado`.
- `:2614-2667`: cierre transaccional; bloquea la sesión con `FOR UPDATE`, exige ABIERTA, guarda contado y registra auditoría con la diferencia.
- `lib/db/src/schema/pos.ts:45-75`: el fondo inicial existente pertenece a la sesión de caja.

**Aplicación a E10:** reutilizar el criterio de conteo/diferencia y su presentación, no la sesión ni su saldo. Fondo tendrá arqueos propios e inmutables con saldo de referencia, contado, diferencia persistida, autor, fecha y referencia precisa a los movimientos incluidos. Un arqueo no inserta un ingreso, retiro ni ajuste.

### 2. Consistencia y concurrencia

- Caja bloquea la fila de sesión durante su cierre.
- `artifacts/api-server/src/routes/clientes.ts:2342-2377`: transacción, reclamación de operación, bloqueo por entidad, bloqueo del original y validación antes de insertar un inverso.
- El proyecto dispone de bloqueos transaccionales en `lib/db/src/lib/advisory-locks.ts`.

**Aplicación a E10:** bloqueo propio del Fondo, compartido por sus productores; no utilizar candados de crédito, inventario o caja. La suma y los movimientos que explican un saldo deben proceder de la misma instantánea. La captura de arqueo llevará versión/referencia del saldo mostrado; si cambió durante el conteo, se exigirá revisión del conteo, no una sustitución silenciosa del saldo esperado. El arqueo confirmado permanece igual ante movimientos posteriores.

No basta con ejecutar un SUM y luego insertar en consultas independientes. No se ha ejecutado una prueba concurrente en esta revisión.

### 3. Corrección e idempotencia

- `artifacts/api-server/src/routes/clientes.ts:2316-2391`: conserva el original, exige motivo, comprueba que no exista reverso y agrega el inverso enlazado dentro de una transacción.

**Aplicación a E10:** trasladar el patrón, no el motor ni las tablas de crédito/FIFO. Sin endpoints de edición o eliminación de movimientos. Protección en PostgreSQL contra modificación/borrado de los hechos nuevos. Inverso exacto, motivo propio, autor, fecha y enlace recíproco en las consultas; impedir dos inversos del mismo original.

Cada productor E10 tendrá identidad de reintento y contenido normalizado: mismo contenido devuelve el resultado existente; contenido distinto con la misma identidad se rechaza. La autorización ADMIN se comprueba también al repetir.

### 4. Exclusividad de ADMIN

- `artifacts/api-server/src/middlewares/auth.ts:119-127`: `requireRole` comprueba el rol real y rechaza los restantes con 403.
- `:59-117`: `requireSession` consulta la sesión **y renueva su vencimiento mediante UPDATE**. Por eso una consulta HTTP autenticada no debe tratarse como completamente libre de escrituras.

**Aplicación a E10:** exigir ADMIN en servidor para resumen, listados, detalles, movimientos, inversos, arqueos y cualquier exportación/archivo. Un permiso configurable no concederá acceso al Fondo a otro rol. Ocultar menú y enlaces es una segunda capa, no la autorización.

Revisar además auditoría, notificaciones, búsquedas, lectores financieros, exportaciones y cachés compartidas. No difundir movimientos del Fondo por un canal general ni revelar su saldo mediante un total del que pueda deducirse por resta.

## Delimitación de la implementación propuesta

### Modelo nuevo

Tres tablas propuestas:

1. `fondo_mariana`: identidad única del Fondo y vínculo fijo con la ubicación real Mariana; sin saldo editable.
2. `fondo_movimientos`: ingresos directos, retiros e inversos; importe exacto a centavos, naturaleza, motivo, autor, fecha, enlace al original e identidad/contenido de reintento.
3. `fondo_arqueos`: saldo de referencia, efectivo contado, diferencia persistida, fechas/autor, referencia de movimientos y reintento.

Con restricciones, índices y protecciones de inmutabilidad propios de esas tablas. **Tres tablas no significa tres objetos SQL:** el SQL final deberá enumerar por separado tablas, claves, índices, funciones, triggers y cualquier secuencia. Este informe no sustituye ese inventario ni autoriza aplicarlo a la operativa.

No se encontró una implementación de Fondo en el repositorio. Esto no equivale a una inspección del catálogo vivo.

La identidad de Mariana debe quedar fijada en el servidor contra el catálogo existente. El orden de nombres de `src/lib/store-order.ts` no es una autoridad de ubicación. No se aceptará un sitio elegido por el cliente ni se creará otra ubicación; una identificación ambigua debe detener la preparación.

### Funcionalidad y límites contables

- Una pantalla Fondo dentro de Finanzas, exclusiva de ADMIN: saldo navegable, movimientos y sus detalles, captura e historial de arqueos.
- Saldo derivado exclusivamente de su libro, sin reutilizar el saldo de sesión de caja.
- Primer ingreso con motivo «saldo inicial»: reconocimiento de efectivo existente, con evidencia de conciliación para no duplicar dinero de caja o entregas. No se precarga ni se estima un importe real.
- Capital y otros ingresos directos se distinguirán de ese reconocimiento. Retiros con motivo; no presentar un retiro genérico como pago a proveedor.
- No insertar en ventas, pagos de clientes, crédito ni deuda de proveedores para representar un movimiento del Fondo.
- No conectar ni habilitar recepción de tiendas, remesas o fuente Fondo en pagos a proveedor: corresponden a E9/E12.
- Movimientos, arqueo e historial se aceptan y habilitan juntos.

### Efectivo de empresa

El lector encontrado en `src/lib/admin-analytics.ts:1223-1288` agrega información de sesiones de caja. No demuestra un total autoritativo de efectivo de empresa con Fondo.

No renombrar ese saldo de Caja como total de empresa ni corregir sus fórmulas en E10. El modelo nuevo debe distinguir reconocimiento de efectivo existente, entrada externa, salida e inverso, sin convertirlos en venta/cobranza ni confundir un traslado con dinero nuevo. Cualquier lectura compuesta que incluya Fondo será exclusivamente ADMIN y explicará sus componentes; no publicar una cifra global sin comprobar su definición y conciliación. E9 aportará después la integración indivisible de las remesas.

### Archivos previstos

Módulos nuevos de esquema, servicio, rutas, contratos, pantalla y pruebas de Fondo. Integración mínima en exports de DB, router, OpenAPI/cliente, navegación y documentación. No modificar crédito, FIFO, cierres de tienda ni inventario para implementar Fondo.

No ejecutar `db:push`, incorporar una migración automática al arranque, cambiar roles/permisos existentes ni reiniciar la API operativa como parte de esta preparación.

## Autorización que se propone: sólo fase aislada

Se solicita autorización expresa **antes de la primera escritura en una base**, con estas fronteras:

1. Preparar **una copia nueva, local y aislada** a partir de una lectura consistente de la base actual. No escribir en la fuente. No reutilizar ni modificar el clon conservado o el respaldo de Drive.
2. La restauración copia el esquema y los datos actuales, incluidos los actores existentes para sus relaciones y comparaciones, **exceptuando las filas de sesiones de autenticación**. No dar de alta usuarios nuevos, cambiar cuentas/contraseñas/roles, fabricar sesiones ni usar sesiones operativas copiadas.
3. Aplicar únicamente el esquema nuevo E10 en esa copia. Registrar el inventario concreto de objetos y el SQL ejecutado; cualquier ampliación fuera de las tres tablas y sus objetos auxiliares se vuelve a presentar antes de ejecutarla.
4. Escribir casos **ficticios de Fondo sólo en esa copia**, incluidos un primer ingreso de prueba, capital, retiro, inverso y arqueos con sobrante/faltante; además de la auditoría asociada. Esta es una excepción solicitada exclusivamente para fixtures aislados, **no permiso para reconocer o cargar el saldo inicial real de la empresa**. No importar importes históricos al libro nuevo.
5. Probar servicios/rutas/middleware con identidades ya existentes y contexto controlado únicamente en el proceso de pruebas, sin crear sesiones. Distinguir esto de una prueba de login y autorización en una sesión real, que no se considerará ejecutada.
6. Comprobar en la copia concurrencia, reintentos, fallo entre escrituras, saldo/historial al centavo, arqueos persistentes e inmutabilidad. Comparar antes/después ventas, Contado cobrado, cobranza, deuda e inventario. No usar fixtures que modifiquen esos dominios.
7. Ejecutar pruebas puras/de componentes y typecheck; introducir cada defecto en una copia de código aislada para comprobar que las pruebas nuevas fallan, sin sustituir módulos de los servicios activos.

**No incluye:** ninguna escritura, DDL, login de prueba, reinicio con inicializadores, saldo inicial, movimiento o habilitación de Fondo en la base operativa; publicar; crear usuarios/sesiones; E1–E9, E11/E12; Prompt P ni cierre de su Grupo 1.

Antes de aplicar algo a la operativa se presentarán **por separado** el SQL final, su inventario de objetos, conservación prevista, resultados realmente obtenidos y alcance de cualquier arranque. Se esperará otra autorización textual.

La respuesta del propietario se guardará textualmente en `reports/` antes de ejecutar esta fase. Si no autoriza importes ficticios/restauración aislada, no se ejecutará esa parte ni se afirmará que pasó.

## Límite de «suite completa»

El repositorio tiene múltiples scripts de pruebas, no un único comando cuya ejecución sea inocua. Algunas integraciones crean usuarios y sesiones, por ejemplo las de autorización POS, reportes, alertas y purga de productos.

**No se ejecutarán esas suites tal como están**, ni siquiera apuntándolas a una copia, bajo la restricción vigente. Se inventariarán los comandos y sus efectos. Los casos incompatibles deben poder ejecutarse sin altas/sesiones o quedar señalados como bloqueados; no se presentará una selección parcial como «suite completa aprobada».

No se ha ejecutado ninguna prueba ni typecheck de E10 en esta sesión.

## Observación del entorno, separada de E10

Los logs consultados muestran un intento de arranque de API a las **17:04 UTC** con inicializadores completados y posterior fallo `EADDRINUSE` en 8080; el frontend también informa puerto 20329 ocupado. No inicié ni reinicié esos procesos durante esta revisión y no atribuyo la causa del intento a un actor concreto.

Un workflow fallido por puerto ocupado no demuestra que no haya otro proceso sirviendo. No se intervinieron procesos ni se verificaron efectos de esos inicializadores en la base. Por tanto, **no afirmar que la base globalmente no tuvo escrituras** basándose en esta revisión de archivos.

## Documentación al terminar E10

Actualizar `replit.md` sólo con lo construido y verificado: Mariana/ADMIN exclusivos, primer ingreso como reconocimiento existente, arqueo sin ajuste, corrección por inversos, invariantes de ventas/cobranza/deuda y E9/E12 aún cerrados. No declarar E10 terminado a partir de este informe.