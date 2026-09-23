# Tanda E · tarea 1 · resultado

## Estado

**PARCIAL / BLOQUEADO.** El recorrido comenzó bloqueado en autenticación, se
reanudó después de correcciones acotadas de DDL y fixture, y terminó por un
stall del runner antes de completar ventas/cobros, Nota/E3 y recibos. Las
secciones siguientes conservan la cronología y no deben leerse como una
afirmación de cobertura completa.

## Entorno y alcance

- Se usó exclusivamente el navegador real contra `http://127.0.0.1:43820/`.
- No se reiniciaron workflows ni se usó el preview normal.
- Se cargaron las credenciales sintéticas desde `.local/tanda-e-20260923/tarea-1/credentials.json` sin registrar valores.
- La página llegó a `/login`; no se expusieron credenciales, cookies ni encabezados.

## Paso 0 — login CAJA

- Usuario sintético: `tandae-caja` (valor no secreto).
- Esperado: autenticación exitosa para continuar con apertura de Caja y los nueve pasos.
- Actual: el formulario permaneció en `/login`; la interfaz reportó `Error de acceso` / `Usuario o contraseña incorrectos`.
- El log privado de la API confirma que `POST /api/auth/login` terminó en HTTP 500, no en una respuesta normal de credenciales inválidas:
  - `column reference "a.id" is ambiguous`
  - origen: transacción de autenticación en `auth.ts`.
- Evidencia visual redacted: `evidence/01-login-error-redacted.png`.

## Checklist

- [ ] Apertura Caja TEE con fondo 500.00
- [ ] Venta efectivo y saldo esperado 650.00
- [ ] Venta transferencia y referencia
- [ ] Nota / abono E3 ordinario de 50.00, deuda 100.00, saldo 700.00
- [ ] Recibo, reimpresión y control de acceso ADMIN/CAJA
- [ ] Remate aceptado y negativas de bajo costo
- [ ] E4 sin motivo rechazado y con motivo durable
- [ ] Insuficiencia CAJA y desbloqueo ADMIN
- [ ] Cierre/reconciliación con contado 0.00

Todos los puntos anteriores quedaron **bloqueados por el fallo de autenticación**; no se alteró el copy ni se modificaron reglas de negocio.

## Reanudación tras corrección estrecha en copy

- La autenticación CAJA volvió a funcionar y se verificó navegación autenticada a `/cobros`.
- El botón `Caja operativa` de CAJA permaneció visible/habilitado pero inerte; no abrió formulario ni sesión.
- ADMIN abrió TANDA E E2E TIENDA con fondo exacto `500.00`; la interfaz confirmó `Caja abierta correctamente`, `Sesión Abierta` y saldo servidor `500.00`.
- CAJA volvió a autenticarse y vio la sesión abierta.
- CAJA navegando al POS recibió HTTP 403: `No tienes permisos para ver este módulo (pos).` Evidencia: `evidence/03-caja-pos-403-redacted.png`.
- ADMIN sí accedió al POS. La búsqueda de `991000001` encontró el fixture correcto (`TANDA-E-POS`, 1.00 Mts., `$150.00`) y lo agregó al ticket.
- La validación de precio falló con HTTP 500; la UI mostró `No se pudo completar la operación. No se guardaron cambios; intenta nuevamente...`, dejó `Confirmar Venta` deshabilitado y no creó venta. Evidencia: `evidence/04-pos-price-validation-500-redacted.png`.
- El intento independiente de precio `90.00` dejó el ticket en `$90.00`, con el mismo error genérico y sin la denegación explícita esperada de bajo costo. Evidencia: `evidence/05-pos-undercost-generic-error-redacted.png`.

### Estado de cobertura posterior

Las ventas efectivo/transferencia, la nota y abono E3, recibo/reimpresión, remate, E4 con aritmética posterior a ventas, insuficiencia/desbloqueo y cierre no pudieron completarse porque el primer camino POS no puede confirmar un ticket. La sesión abierta quedó sin venta confirmada ni salida creada por esta ejecución.

## Cobertura independiente continuada

- En CAJA, con sesión abierta y fondo actual `500.00`, el caso sin motivo fue rechazado por validación nativa (`Please fill out this field`); no hubo fila durable. Evidencia: `evidence/06-e4-missing-reason-denied-redacted.png`.
- En CAJA, el intento válido de `25.00` con motivo `E2E gasto extraordinario` quedó bloqueado antes de POST porque la UI solicita `/api/sesiones-caja/46/corte` y recibe HTTP 403; el formulario era nativamente válido, pero no hubo fila ni decremento. El caso CAJA `500.00` también quedó bloqueado por la misma dependencia/permiso; evidencia: `evidence/07-e4-caja-excessive-blocked-redacted.png`. Esto es una barrera de autorización/flujo, no una aceptación silenciosa.
- En ADMIN, el formulario mostró saldo servidor exacto `500.00` y el desbloqueo extraordinario. Se creó la salida `500.00`, motivo y desbloqueo `E2E emergencia autorizada`, inicialmente `Pendiente`; después de confirmación explícita `Confirmar aceptar`, pasó a `Aceptada` con toast `Salida aceptar exitosamente.` y saldo servidor `0.00`. La operación durable no deja `-25.00` porque el abono CAJA de 25.00 nunca persistió; el ledger real actual es fondo 500.00 menos salida aceptada 500.00 = 0.00.
- En editor de catálogo ADMIN para TANDA-E-POS / AZUL E2E, costo `$100.00`, precio actual `$150.00`, candidato `$90.00`: la UI proyectó `-$10.00`, `-11.11%`, estado `Crítico` y rechazó el preview con toast exacto `No se puede guardar un precio de lista bajo costo.`; precio actual e historial permanecieron sin cambios. Evidencia: `evidence/08-catalog-undercost-denied-redacted.png`.
- En inventario ADMIN, se localizó roll `991000005`, ID 6247, DISPONIBLE, 1.00 Mts., costo `$100.00`. Se ingresó motivo `E2E remate autorizado` y se ejecutó `Marcar remate`; la UI cambió a `Retirar remate` y mantuvo nota `VENTA REMATE MARCADA`, sin intentar venderlo. Estado sigue DISPONIBLE; evidencia: `evidence/09-remate-marked-sale-deferred-redacted.png`. La nota ya estaba presente antes de la acción y el historial visible sólo tenía ALTA, por lo que se documenta la inconsistencia de estado como gap de evidencia, no como venta.

No se cerró la Caja. La venta remate quedó explícitamente diferida; tampoco se ejecutó cierre/reconciliación antes de completar las ventas y E3 pendientes.

## Reanudación posterior a fixes acotados

- El launcher se reinició una vez en la misma URL aislada. La sesión y el copy siguieron siendo TANDA E E2E TIENDA; no se reinició ningún workflow normal.
- El fix POS scalar-array quedó verificado en búsqueda y validación: `GET /api/pos/buscar` y `POST /api/pos/validar-precio` devolvieron 200 para roll `991000001`; Confirmar Venta llegó a habilitarse.
- El fallo restante está en creación de ticket, no en el scalar-array: `POST /api/tickets` devolvió HTTP 500 con error privado exacto `Falta evidencia de entrada/proveedor para la línea 369.` desde `supplier-trace.ts`. No se creó ticket para efectivo, transferencia, Nota de crédito ni remate. Evidencias: `evidence/10-pos-create-ticket-still-500-redacted.png`, `evidence/13-credit-note-create-ticket-500-redacted.png`, `evidence/15-marked-90-create-ticket-blocked-redacted.png`.
- El flujo CAJA POS 403 se mantuvo como restricción intencional de rol; no se cambiaron permisos.

### E4 fixed y ledger real

- Con ledger real `0.00` después de la salida aceptada de `$500.00`, CAJA intentó `$25.00` con motivo `E2E gasto extraordinario`. La API lo rechazó correctamente con toast: `No se pudo registrar la salida` / `Saldo de Caja insuficiente. Solo ADMIN puede autorizar una salida extraordinaria con motivo explícito.` No creó fila; balance permaneció `0.00`. Evidencia: `evidence/11-e4-caja-insufficient-denied-fixed-redacted.png`.
- ADMIN ejecutó el desbloqueo real por insuficiencia: monto `$25.00` > saldo `$0.00`, motivo y desbloqueo `E2E emergencia autorizada`. La fila mostró `Desbloqueo extraordinario de Caja`, `Usuario #238 · saldo $0.00 · egreso $25.00`, inicialmente Pendiente; después de Confirmar aceptar quedó `Aceptada`, con balance `-$25.00` y actualización `ACEPTAR · 23 Sep 22:43`. Evidencia: `evidence/12-e4-admin-genuine-insufficiency-accepted-redacted.png`.

### Ventas y negativas después del fix

- Nota de crédito: se encontró roll `991000003`, se seleccionó cliente `TANDA E CLIENTE CREDITO`, plazo `30 días`, pero POST de creación produjo el mismo error supplier-trace HTTP 500; no hubo folio ni se intentó E3. No es válido reportar abono, recibo o reimpresión.
- Roll no marcado `991000004` a `$90.00`: la validación sí funciona y deniega con texto exacto `El precio de TANDA E TELA POS AZUL E2E serie 991000004 está por debajo del mínimo permitido.` Confirmar Venta quedó deshabilitado. Evidencia: `evidence/14-unmarked-90-denied-fixed-redacted.png`.
- Roll marcado `991000005` a `$90.00`: la validación de precio permitió el candidato, demostrando la excepción de remate; el intento de crear el ticket volvió a fallar con supplier-trace HTTP 500, sin venta. Evidencia: `evidence/15-marked-90-create-ticket-blocked-redacted.png`.

### Cierre/reconciliación final

- Se abrió el corte con ADMIN y se verificó el desglose E2 real: Fondo inicial `$500.00`, cobrado `$0.00`, tickets pendientes `0`, salidas físicas `$525.00` (IDs 1 y 2), efectivo esperado `-$25.00`.
- Se ingresó contado físico real `0.00`; al primer intento apareció HTTP 409 `REVISION_OBSOLETA: Conflicto concurrente; recarga y confirma de nuevo.` con request `6b1eebba-cd33-4613-961c-b09c3172bf30`. Evidencia: `evidence/16-close-revision-obsoleta-redacted.png`.
- Tras recargar y reabrir el corte, `Confirmar Cierre` quedó habilitado; la confirmación mostró `Caja cerrada correctamente`, contado `$0.00`, esperado `-$25.00`, diferencia `$25.00`, y el desglose E2. Se pulsó `Finalizar`.
- Historial verificó el resultado final: TANDA E E2E TIENDA · TANDA E ADMIN, `CERRADA · 0 cobrados`, Total `$0.00`, Esperado `-$25.00`, Diferencia `$25.00`, abierta 22:21 y cerrada 22:50. Después, Caja operativa sólo mostró `Apertura de Caja`/`Abrir Turno`, sin Realizar Corte ni salida activa; no se abrió un nuevo turno. Evidencia final: `evidence/17-final-closed-gate-redacted.png`.

La ejecución termina con la Caja correctamente cerrada y reconciliada con el ledger real, pero ventas/ticket, Nota/E3, recibo/reimpresión y venta remate quedan bloqueados por el error de evidencia proveedor/línea 369. No se alteraron fuente, permisos, reglas, workflows ni otras bases.

## Intento posterior con provenance reparada

- Se verificó que el copy fue reparado sólo en provenance: los cinco rollos dedicados tienen proveedor canónico 226 / entrada 468; no se aplicaron guardas de negocio ni cambios de permisos.
- La sesión #46 anterior quedó cerrada y su evidencia se preservó.
- ADMIN intentó abrir el nuevo turno solicitado con fondo `500.00` en TANDA E E2E TIENDA. La mutación fue rechazada por el gate vigente con HTTP 409/toast exacto: `Ya existe una sesión de caja para la fecha operativa de hoy, abierta o cerrada.` No se creó una nueva sesión ni se modificó el ledger. Evidencia: `evidence/18-new-turn-same-operational-date-denied-redacted.png`.
- Por este gate de una sesión por fecha operativa, no se iniciaron las ventas restantes ni cobros/E3/recibo/reimpresión en una caja que el plan exigía abrir; no se fabricaron tickets, folios ni movimientos. El cierre previo y sus números siguen siendo los de la sesión #46.

## Corrección de fixture posterior al recorrido

El bloqueo de `supplier-trace.ts` era atribuible al seed: los cinco rollos
sintéticos tenían costo físico y movimiento `ALTA`, pero carecían de
`recepcion_id` y proveedor autoritativo. Se corrigió únicamente
`tanda_e_e2e_copy`, sin cambiar código ni guardas:

- se creó el proveedor sintético activo `TANDA E E2E PROVEEDOR` (id 226);
- se creó la entrada TEE id 468, folio 1, con 5 rollos y costo total 500.00;
- sólo los rollos 6243–6247 fueron enlazados a esa entrada y proveedor.

La verificación exacta de la consulta usada por `supplier-trace` encontró los
cinco rollos con entrada y proveedor activo/concordante, y cero faltantes. Los
cinco conservan estado `DISPONIBLE`, cantidad `1.000` y costo unitario
`100.00`; no existía ninguna `ticket_linea` para ellos al hacer el enlace. La
marca de remate permanece únicamente en el rollo 6247.

El historial ya probado quedó intacto: sesión 46 sigue `CERRADA`, fondo 500.00,
contado 0.00, esperado -25.00 y diferencia 25.00; sus salidas ids 1 y 2 no
cambiaron. No hay sesión abierta para TEE, por lo que el siguiente recorrido
debe abrir un turno nuevo antes de reintentar ventas, Nota/E3 y recibo.

## Fixture para completar sólo los pendientes

La política válida de una sesión por sitio y fecha rechazó correctamente
reabrir TEE después de cerrar la sesión 46. En vez de alterar esa sesión, su
fecha o la guarda, se añadió exclusivamente al copy el sitio virgen TES (id
839), sin sesiones previas, con ADMIN id 240 y CAJA id 241. Sus credenciales
están bajo las claves privadas `admin2` y `caja2`.

TES tiene proveedor activo id 227, entrada canónica id 469 y cinco rollos
disponibles 6248–6252 / series `992000001`–`992000005`. Los cinco concilian
rollo → entrada → proveedor, tienen costo físico 100.00 y una recepción
canónica cada uno; el cache de existencia concilia 5.000 metros / 5 rollos.
Todavía no hay remates, tickets ni caja en este sitio.

Este fixture queda reservado exclusivamente para la cobertura pendiente de
ventas, Nota/abono E3, recibo/reimpresión y venta remate. Los casos E4,
negativas ya demostradas y cierre de sesión 46 permanecen como evidencia
terminada y no deben repetirse.

## Estado final real y matriz de resultados

MAIN canceló el runner después de más de 30 minutos sin evidencia nueva. Una
lectura final `READ ONLY` mostró que el segundo recorrido sí alcanzó a abrir la
sesión 47 en TES y crear el ticket 112 para el rollo 6248 por 150.00. El ticket
quedó `VENDIDO` pero **no cobrado**, sin sesión de cobro asociada; existe su
línea, consumo físico y movimiento de venta. Los otros cuatro rollos siguen
disponibles, sin remate. No se interpreta ese estado parcial como venta
efectivo completada.

| Prueba solicitada | Resultado final | Evidencia/conclusión |
|---|---|---|
| Apertura de Caja con fondo 500.00 | **PASS** | Sesión 46 abrió correctamente en TEE; el segundo recorrido abrió sesión 47 en TES. |
| Venta efectivo y saldo 650.00 | **BLOCKED** | Ticket 112/rollo 6248 fue creado por 150.00, pero quedó sin cobro; no se alcanzó el saldo esperado. |
| Venta transferencia y efectivo sin cambio | **BLOCKED** | No hay ticket para el rollo 6249. |
| Nota a crédito, autorización y abono E3 50.00 | **BLOCKED** | El primer intento fue revertido por el defecto de fixture; no hay ejecución posterior completada para el rollo 6250. |
| Recibo, reimpresión y control ADMIN/CAJA | **BLOCKED** | Dependía del abono E3 no creado. |
| Precio de catálogo bajo costo rechazado | **PASS** | Rechazo explícito observado; el precio permaneció sin cambios. |
| Venta bajo costo sin marca rechazada | **PASS** | Validación explícita observada con el primer fixture. |
| Marcar remate con motivo | **PASS** | El rollo 6247 quedó marcado durante el primer recorrido. |
| Venta remate bajo costo | **BLOCKED** | El primer intento fue revertido por falta de procedencia; no se reintentó con el rollo 6252. |
| E4 sin motivo rechazada | **PASS** | La validación nativa impidió la creación. |
| E4 ordinaria 25.00 dentro de saldo | **BLOCKED** | No se obtuvo esta variante: el ledger ya estaba en 0.00 cuando CAJA pudo reintentar. |
| E4 CAJA insuficiente rechazada | **PASS** | Rechazo explícito sin fila durable. |
| E4 ADMIN con desbloqueo y motivo | **PASS** | Salida id 2 por 25.00 aceptada desde saldo 0.00. |
| Cierre/reconciliación | **PASS** | Sesión 46 cerró con esperado -25.00, contado 0.00 y diferencia 25.00; no se permitió reabrir el mismo sitio/día. |

Resultado global: **PARCIAL / BLOCKED**, no PASS. Los bloqueos iniciales de
autenticación, serialización de arrays y procedencia de proveedor fueron
diagnosticados o corregidos de forma acotada, pero el stall final impidió
completar y observar los flujos pendientes. Las capturas existentes se
conservan en `evidence/`; no se fabricó evidencia sustitutiva.

## Aprendizajes durables de preparación

- Un rollo sintético destinado a POS debe nacer con procedencia completa:
  proveedor activo, cabecera de entrada, `recepcion_id` y proveedor
  concordantes en el rollo, movimiento `RECEPCION` y cache de existencia
  conciliado. La consulta exacta que consume `supplier-trace` debe comprobarse
  antes de entregar el navegador; un `ALTA` aislado no sustituye esa cadena.
- La regla de una sesión de Caja por sitio y fecha es una política, no un
  obstáculo de fixture que deba relajarse. El plan de prueba debe terminar todos
  los flujos del turno antes del cierre. Si hace falta una continuación, se usa
  un sitio sintético nuevo sin sesiones previas; nunca se cambia fecha, estado,
  historia ni gate para reabrir.
- Un stall del runner no autoriza inferir resultados. Se conserva el último
  estado durable y cada expectativa no observada queda `BLOCKED`.

## Teardown y revisión de secretos

Después de la captura final read-only se detuvieron el objetivo HTTP y el
PostgreSQL aislado, se retiró el worktree congelado y se eliminó completamente
`.local/tanda-e-20260923/tarea-1`, incluida la copia, dump, logs privados,
secreto de sesión y credenciales. Los backups preexistentes ajenos a esta tarea
no se tocaron. Una revisión de los archivos de reporte encontró cero valores de
credencial conocidos antes del borrado y cero patrones de password, cookie,
Authorization, clave privada, hash bcrypt o URL con contraseña. No se
versionaron logs ni archivos de credenciales. Las capturas redactadas y este
resultado permanecen como única evidencia de tarea 1.