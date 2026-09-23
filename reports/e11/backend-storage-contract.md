# E11 — backend/storage contractual, OFF

Actualización de la segunda asignación: backend productivo construido OFF.
SQL y reversión pertenecen a otro agente; generados pertenecen a MAIN.
No se ejecutó DB/SQL/API/apps/tests. No activar E11, E5, E7 o gates previos.
Se preservan los 69 vetos ajenos,
operación por sitio, históricos 51–53 y grupos 2–4. Esta entrega no cierra E7.

## Gates y perfil real

`x-e11-gates` del OpenAPI fija E11_ENABLED, E11_UI_ENABLED,
E11_PROFILE_ASSIGNMENT_ENABLED, E11_RECONCILIATION_ENABLED y
E11_E5_PREPARATION_ENABLED a false. No son variables de entorno activables por
usuario. En implementación: OFF evalúa antes de cualquier sidecar/query,
GET disponibilidad devuelve flags false sin DB y demás /e11/* 403 E11_DISABLED.
No ampliar SELECT usuarios, auth/me o joins legacy con columnas aún inexistentes.
Si ON sin esquema requerido: 503 explícito, nunca fallback privilegiado.

Sidecar requerido `e11_perfiles`: usuarioId único, perfil A/F, versión monotónica,
actor y fecha de última asignación. Ninguna columna nueva en usuarios. Al encender,
CONTADOR sin sidecar se resuelve F versión 0; no se ejecuta migración ahora.
Al materializar F deberá existir evidencia de default, no un ADMIN inventado.
A sólo por PUT de ADMIN real autenticado y vigente, no SISTEMAS con override ni
permiso genérico de usuarios. El cuerpo exacto es E11PerfilInput:
uuid UUID, revisionEsperada entero >=0, perfil A/F, motivo no vacío. Identidad
del destinatario sale del path; actor del servidor; verificar destinatario activo
y CONTADOR. CAS de versión, historial y deduplicación atómicos.

`e11_perfil_eventos` append-only preserva anterior/posterior, motivo, actor,
fecha, UUID y revisión. GET historial exclusivamente ADMIN. A→F revoca al commit
capacidad e intenciones A. Desactivación/logout/cambio de rol invalida autorización.
Al salir de CONTADOR: revocar perfil efectivo, incrementar versión, registrar
posterior null, conservar historial. Volver a CONTADOR empieza F, nunca resucita A.
Edición legacy de rol deberá usar la misma transacción de revocación cuando ON.
ON: permisos efectivos = permisos actuales intersectados con techo del perfil
y vetos existentes; overrides incompatibles no abren acceso. No modificar las
otras 69 reglas ni otorgar poderes a roles no contadores.

## Lectores y privacidad

F usa lector dedicado con condición de facturado aplicada ANTES de joins,
conteos, filtros, paginación y totales. Fuente auténtica actual:
`tickets.facturado` y predicado/fecha canónicos de documento contabilizado.
No inventar tabla de CFDI, fecha de timbrado, UUID fiscal o folio externo.
facturaId=ventaId=ticket.id; folioFactura=folio interno;
fechaFacturacion=fecha canónica contable. El nombre contractual no certifica CFDI.
Cada documento se cuenta una vez, sin multiplicar por aplicaciones/pagos.
Cancelados se identifican como evidencia cuando existan en snapshot; no sumar
cancelados al total vigente. No sustituir FACTURADO por COBRADO ni fecha de pago.
Cambios de estado/facturado/importe invalidan fuenteRevision.

DTO F whitelist: cliente id/nombre; documento id/folio/fecha/estado/moneda/
total facturado. Sin cartera, saldo, límite, pagos, notas no facturadas,
proveedores, costos, margen, mercancía, direcciones, identificaciones o Fondo.
Ni resúmenes financieros generales ni “sólo cuatro cifras” abren ese acceso.
A: nombre/contacto limitado, límite, saldo canónico, notas y estado de cuenta
globales; proyección contable ABONO/REVERSO no concede lector de recibos/pagos
con cuenta, medio o documentos. Sin identificaciones/domicilios/costos/utilidad,
Fondo, productos/renglones o enlaces a payloads completos. Nada de spread de
entidades legacy seguido de ocultación UI. DTO additionalProperties:false más
serializador whitelist de servidor y consultas mínimas; ambos son necesarios.
Lecturas consistentes, montos de A iguales al global canónico ADMIN permitido,
sin tienda ficticia; no recalcular motores ni convertir esto en E7 completo.

## Inventario legacy: techo ON anti-bypass

Regla exhaustiva para CONTADOR ON: denegar por defecto todo endpoint de negocio
fuera de /e11/* salvo sesión/logout e identidad mínima; autorizar sólo capacidades
E11. La matriz siguiente identifica destinos conocidos, también aliases,
descargas, impresión y accesos directos. Otros roles conservan permisos/vetos.
No confiar en menú, rol de sesión viejo ni query facturado=true.

| Superficie existente | F ON | A ON |
|---|---|---|
| /auth/me, /auth/login, /auth/logout | sesión base sin ampliar SELECT; identidad E11 aparte | igual |
| /clientes, /clientes/{id}, /clientes/resumen, /clientes/cartera, /clientes/analitica, /clientes/comportamiento-pago y variantes por cliente | denegar; usar lector fiscal | denegar legacy; usar finanzas E11 |
| /clientes/{id}/estado-cuenta, /compras, /estadisticas, /analitica, /credito, /precios, /notas/{ticketId} | denegar | sólo equivalentes E11 limitados |
| /clientes/{id}/pagos y detalle /pagos/{pagoId}, vista-previa, reversar; ajustes, devoluciones-credito, recapturas-e3, recibos-e3 | denegar toda lectura/escritura | denegar; estado contable E11 no recibo |
| /clientes/*/documentos, documentos/{lado}; evidencia-credito y atribuciones-credito | denegar | denegar |
| /clientes/*.xlsx, *.pdf, estado-cuenta.xlsx/pdf, cartera.xlsx/pdf, notas/*/reimprimir | denegar | denegar |
| /tickets, /tickets/pendientes, /tickets/{id}, documento-impresion y acciones; /caja/tickets | denegar; documento fiscal E11 | denegar; nota E11 |
| /reportes/catalogos, /reportes/{seccion}, export.xlsx/pdf, /reportes/vistas/{vista}/export.* | denegar incluidos filtros fiscal y ventas | denegar; proyecciones E11 |
| /dashboard, /admin/dashboard/realtime y pendientes/desglose; /caja/tiendas/*/ventas y global | denegar | denegar |
| /sesiones-caja/*, /caja/*, cuentas destino, cobros, recibos | denegar | denegar |
| /proveedores/* incluido pagos/opciones/preview/detalle/reversar; compras; /fondo/*; E9/E12 | denegar | denegar |
| /pagos-dirigidos y aprobar/rechazar; /e5/* | denegar | denegar legacy E5; sólo adaptador E11 de preparación |
| /users, /users/{id}, /permisos/*, /ubicaciones, auditoría, inventario, POS, salidas, mercancía, administración y catálogos | denegar | denegar |
| /notificaciones | no bandeja general; no datos ajenos | no bandeja general; avisos de preparación en proyección |

ADMIN conserva /notificaciones y acceso de lectura a conciliación, pero no firma
como F ni usa assignment para suplantar actor. Guardas de perfil también cubren
servicios/exportadores/document resolvers y URLs firmadas; URLs/documentos viejos
no constituyen autorización. Revisar handlers no inventariados con default-deny.

## E5 auténtico, no segundo motor

Adaptador E11 consulta fuentes reales E5 y proyecta sólo cobroId/clienteId/revisión/
retenido/notas/propuestaId. POST delega transacción de propuesta E5 existente,
con actor A explícito, no rol CONTADOR genérico. Capacidad depende de E11 + E5 +
E5_CONTADOR_A_ENABLED + permiso específico + perfil vigente; todos gates siguen OFF.
Notas del mismo cliente, identidad exacta movimientoVentaId, saldo actual,
sumas positivas <= retenido real, sin nota duplicada/incobrable/ya pagada.
Revalidar bajo locks canónicos E5 en commit: perfil, versión, permisos, cobro,
fuenteRevision y saldos. Perfil change comparte orden de lock de actor antes de
fuente para que una preparación no sobreviva una revocación concurrente.
No recibe/aplica/autoriza/rechaza/devuelve ni genera favor. Conserva historia E5;
propuesta preparada antes de revocación queda evidencia, no capacidad vigente.
ADMIN resuelve con servicio/flujo real E5 sin que E11 lo reimplemente.

## Periodos, evidencia y conciliación

Zona IANA America/Mexico_City, intervalos locales [inicio, finExclusivo).
Día medianoche a medianoche; semana calendario lunes a lunes; mes primer día
a primer día siguiente (no 30 días ni intervalos UTC fijos). No permitir snapshot
de periodo abierto. Día opcional; semana y mes obligatorios por separado, aceptar
días no acepta semana/mes. Sin vencimientos, multas, bloqueo monetario o plazos
inventados. Lista muestra pendientes aun sin fila persistida, para periodos
cerrados solicitados; sin ventas total cero auténtico también conciliable.

`e11_conciliaciones`: snapshot inmutable UUID, periodo, revisión, anteriorId,
actor/versiones, fuenteRevision, instante, total/count y SHA256 de conjunto
ordenado canónico. `e11_conciliacion_ventas`: renglones whitelist congelados.
Congelar en transacción consistente todo el conjunto, no sólo página visible.
GET ventas del snapshot devuelve esos renglones. Decisión append-only separada,
uuid, actor, totalExterno, referenciaExterna, observación, resultado y aviso.
ACEPTADA exige igualdad exacta a centavos con totalFacturado; NO_CUADRA requiere
observación, permite igual total si discrepa composición, y crea aviso ADMIN
durable/outbox deduplicado con vínculo al snapshot en la misma transacción.
No se implementa nuevo workflow de investigación ni dinero.

Toda decisión verifica fuenteRevision vigente y revisiónEsperada. Si hay cambios,
409 FUENTE_CAMBIADA y estado REQUIERE_REVISION; jamás recalcular el snapshot
antiguo. Nueva revisión enlaza anteriorId, preservando cifras y decisión original.
Un snapshot sólo admite una decisión; rectificación crea nueva revisión vinculada.
La revisión vigente del periodo debe quedar ACEPTADA para cumplir obligación;
NO_CUADRA no la cumple. Fechas y actores siempre del servidor.

## UUID, errores y recuperación

Registro de idempotencia compartido E11 (namespace operación + actor + UUID)
almacena hash canónico del cuerpo/path y resultado. Misma clave/cuerpo devuelve
resultado original sin nueva fila/aviso/propuesta; diferente cuerpo/path 409
UUID_REUTILIZADO. Primero verificar sesión/perfil/permisos actuales incluso replay;
F nunca recupera resultado privado de un antiguo A. Mutaciones perfil usan CAS,
las otras incluyen perfilVersion; permisos se revalidan, no se confía en cliente.
La revisión obsoleta no consume dinero ni escribe evidencia parcial. Cursor atado
a actor/perfilVersion/filtros/fuente; si cambió fuente, 409 y reiniciar lectura.
No guardar archivos/base64: sólo referencias externas textuales y metadata
permitida. Errores/status completos en OpenAPI y frontend-contract.md.

DDL futuro debe imponer FK/unicidad/CAS, historial append-only, snapshot inmutable,
deduplicación y atomicidad de aviso. Reversión preparada debe rechazar eliminar
evidencia existente; desactivar no borra historia. El backend existe; el DDL no se
afirma aplicado ni verificado ahora. Evidencia futura requerirá pruebas positivas,
negativas y mutantes (incluidos overrides, cambio A→F mismo usuario, OFF sin tablas,
replay revocado, documentos legacy, carreras, calendarios y ausencia de dinero).

## Handoff estable de implementación para SQL y pruebas

Archivos nuevos: `src/lib/e11-feature.ts`, `e11.ts`, `e11-repository.ts` y
`src/routes/e11.ts` bajo artifacts/api-server. Diecinueve operaciones montadas
antes de routers generales. Cuatro gates de backend false; UI gate pertenece
al dueño frontend. Disponibilidad es atendida antes de auth/DB.

Integraciones: `middlewares/auth.ts` agrega identidad sidecar a req.auth sólo ON,
sin cambiar SELECT usuarios. `/auth/login` y auth middleware emiten headers
X-E11-Perfil, X-E11-Perfil-Version, X-E11-Permisos-Version/no-store sólo ON.
El JSON de auth permanece congelado; GET /e11/identidad es la fuente tipada
completa para frontend. `routes/index.ts` impone deny-by-default CONTADOR ON
antes de todos los legacy, incluso los que no usan middleware de permisos.
`lib/permisos.ts` filtra todos los permisos legacy de CONTADOR a false antes
de overrides. Capacidades E11 provienen exclusivamente del perfil asignado
y gates: A es el otorgamiento explícito E5_PREPARAR, no un override genérico
crear/cobrar; no se añade un módulo configurable ni un rol técnico nuevo.
`routes/users.ts` integra revocación en la misma transacción del cambio de rol
o actividad; reentrada/reactivación inicia F. `routes/notificaciones.ts` enlaza
el aviso real al snapshot sólo para ADMIN. Otros roles y 69 vetos no se amplían.

El adaptador A llama `e5Command(...,"PROPONER",...)`, dentro de la transacción
E11, con el repositorio E5 real. E5Actor lleva e11PerfilVersion; e5Capabilities
exige E11/E5 gates, CONTADOR y capacidad explícita. liveActor E5 vuelve a leer
perfil/version/capacidad. Contexto A no consulta sesiones de caja y ninguna
respuesta E5 completa sale al cliente A. Recepción/aplicación/Fondo siguen en
sus productores existentes, inaccesibles para A. No se edita evidencia E5.

### Esquema exacto consumido (nombres SQL; no DDL ejecutado)

| Tabla | Columnas requeridas / clave |
|---|---|
| e11_perfiles | usuario_id integer PK/FK usuarios, perfil text A/F/null (null revocado), version integer >=1, actor_id integer FK usuarios, updated_at timestamptz |
| e11_perfil_eventos | id uuid PK, usuario_id integer FK usuarios, actor_id integer FK usuarios, revision integer, uuid uuid, datos jsonb; UNIQUE(usuario_id,revision), UNIQUE(actor_id,uuid) |
| e11_operaciones | actor_id integer FK usuarios, operacion text PERFIL/SNAPSHOT/DECISION/PREPARACION, uuid uuid, solicitud_hash text SHA256, respuesta jsonb; PK(actor_id,operacion,uuid) |
| e11_conciliaciones | id uuid PK, tipo DIA/SEMANA/MES, inicio date, revision integer, anterior_id uuid nullable FK misma tabla, actor_id integer FK usuarios, perfil_version integer, datos jsonb; UNIQUE(tipo,inicio,revision) |
| e11_conciliacion_ventas | conciliacion_id uuid FK e11_conciliaciones, venta_id integer FK tickets, datos jsonb; PK(conciliacion_id,venta_id) |
| e11_decisiones | id uuid PK, conciliacion_id uuid UNIQUE FK e11_conciliaciones, actor_id integer FK usuarios, perfil_version integer, uuid uuid, datos jsonb, created_at timestamptz DEFAULT now(); UNIQUE(actor_id,uuid) |
| e11_avisos | id uuid PK, conciliacion_id uuid FK e11_conciliaciones, decision_id uuid UNIQUE FK e11_decisiones |

`datos` contiene exactamente evento/conciliación/venta/decisión contractual
whitelist, no entidades legacy completas. El resultado de replay es ese DTO.
La revisión del snapshot nunca se actualiza; estado/vigencia/última revisión
se derivan al leer de evidencia + decisiones + fuente actual. Revisión de perfil
sí se actualiza por CAS y evento. No se persiste un “total vigente” reescrito.
No triggers ni futuras columnas de usuarios son requeridos por el SELECT OFF.
Las FKs no deben permitir borrar usuarios/tickets con evidencia E11.

NO_CUADRA crea e11_avisos y una fila real en notificaciones_sistema en la misma
transacción: tipo E11_NO_CUADRA, entidad e11_conciliaciones, entidad_id snapshot
UUID, destinatario_usuario_id NULL. El lector existente reserva esos avisos
globales a ADMIN. avisoAdminId es UUID e11_avisos (no el serial de notificaciones).
Única decisión por snapshot y replay evitan notificaciones duplicadas.
No movimiento de crédito, pago, caja, proveedor ni Fondo en conciliación.

### Orden físico de escrituras para el dueño SQL

No hay tabla outbox ni worker independiente: `e11_avisos` es el registro UUID
de entrega, y se inserta la notificación local en la misma transacción PostgreSQL.
Es un fanout local atómico, no entrega de red eventual. No requiere status,
attempts, delivered_at ni job inventado. Si falla cualquiera, rollback de todo.

1. Asignar perfil: lock exclusivo seguridad → identidad ADMIN fresca → lock
   UUID/replay → lock usuario destinatario/perfil → CAS → UPSERT e11_perfiles →
   INSERT e11_perfil_eventos → INSERT e11_operaciones con respuesta → commit.
2. Cambio de rol/actividad legacy: lock exclusivo seguridad → guardas ADMIN
   recovery existentes → lock usuario/perfil → UPSERT e11_perfiles F o null →
   INSERT evento de revocación con UUID servidor → UPDATE usuarios y auditoría
   legacy → commit. No fila de replay E11 porque no es comando E11 con UUID cliente.
3. Snapshot: identidad F/version → lock UUID/replay → lock periodo → leer última
   revisión y fuente completa → INSERT e11_conciliaciones → INSERT cada venta
   congelada → INSERT e11_operaciones → commit.
4. Decidir: identidad F/version → lock UUID/replay → lock periodo → comprobar
   última revisión/fuente/sin decisión → INSERT e11_decisiones → para NO_CUADRA,
   INSERT e11_avisos y notificaciones_sistema → INSERT e11_operaciones → commit.
5. Preparar: identidad A/version/gates → lock UUID/replay E11 → comando PROPONER
   del repositorio E5 y sus locks/operación/auditoría existentes → INSERT
   e11_operaciones con DTO limitado → commit. No tabla paralela de propuestas E11.

Las validaciones de grafo snapshot→ventas y decisión→aviso→notificación deben ser
diferidas al cierre de transacción, no rechazar el INSERT inicial por falta de
los hijos que se insertan después. No habilitar E11 por existencia del esquema.
La tabla de replay distingue namespace operación/actor; path y cuerpo se
incluyen en solicitud_hash. Columnas no enumeradas arriba no son consultadas ni
escritas por este adaptador. No añadir columnas a usuarios.

### Concurrencia, frescura y límites técnicos verdaderos

Transacciones HTTP E11 SERIALIZABLE. Lock asesor transaccional compartido
hashtextextended('E11:security',0) antes de identidad; asignación y cambio de rol
usan exclusivo antes de filas. Usuarios/sesión/perfil se bloquean para leer.
Mutaciones reautorizan también en repositorio antes del replay. Perfil destino
CAS bajo lock; periodos usan lock hashtextextended('E11:period:'+tipo+inicio,0).
UUID utiliza hashtextextended('E11:'+actor+':'+operacion+':'+uuid,0).
Errores de serialización/deadlock/unique devuelven 409, nunca se reintenta con
intención nueva automáticamente. E5 mantiene sus locks canónicos existentes.

Tras commit, respuesta pasa por otra transacción de identidad fresca y lock
compartido: compara rol/perfil/version/capacidades, y envía payload sólo mientras
retiene la autorización. Si se revocó A después de COMMIT, resultado confirmado
no consultable sin DTO A aunque la preparación
ya se haya confirmado (replay autorizado conserva ese resultado). La siguiente
GET obtiene estado vigente. Cursores validan scope de identidad/filtros/fuente.

Lector fiscal único usa predicado/fecha canónicos de documento contabilizado
(incluye NOTA autorizada sin exigir pago), nunca el lector de cobranza/fondo.
Los renglones y total se obtienen de una misma consulta. F no recibe detalle
de producto ni de pago. Lectores financieros A llaman el proyector canónico
completo por cliente antes de paginar.

Limitaciones de rendimiento explícitas: paginación actual se hace sobre conjunto
autorizado materializado; listas A proyectan ledger completo por cliente y
periodos con evidencia verifican fuente por periodo. Rango de periodos máximo
3660 días por petición como límite técnico, no plazo de aceptación. No se afirma
validación de carga. El contrato monetario congelado impone su rango; respuesta
fuera de ese rango falla 503 explícito, nunca trunca montos.

Verificación realizada exclusivamente estática source-only TypeScript, noEmit,
sin project references, rootDir workspace, sin writes a dist. No diagnósticos
en fuentes backend nuevas/modificadas; comprobación global detenida por cuatro
TS2308 del barrel Zod generado (GetE11FinanzasEstadoCuentaParams,
ListE11ConciliacionVentasParams, ListE11FinanzasNotasParams,
ListE11PerfilHistorialParams). Son propiedad de MAIN; no se corrigieron generados.
No se afirma ejecución dinámica, integración SQL, pruebas, mutantes ni release.

## Seam interno de infraestructura (asignación posterior de MAIN)

No cambia OpenAPI, DDL, tablas, namespaces, orden de escrituras ni política.
Los gates de fuente siguen false. Ninguna ruta, variable de entorno, permiso,
rol o input cliente puede configurar este runtime.

- `lib/e11-runtime.ts` exporta E11RuntimeFlags con enabled, profiles,
  reconciliation, preparation, e5Enabled, e5ContadorA; defaults de producción
  provienen sólo de las constantes OFF existentes.
- E11RuntimeOptions acepta flags parciales, now():Date, uuid():string,
  transaction<T>(work:(tx:E5Sql)=>Promise<T>, options?:{isolationLevel:
  "serializable"}):Promise<T>, ledger(tx:E5Sql,clientId:number):
  Promise<CreditLedgerMovement[]>. No admite identity/authorize, servicio de
  propuesta falso, hooks para suprimir escrituras ni política reemplazable.
- `createE11Runtime(options).run(work)` delimita AsyncLocalStorage inmutable;
  no muta gates globales y aísla ejecuciones concurrentes. Infra de producción
  db/ledger se carga diferidamente; un fake completo no importa ni consulta DB.
- `createE11Service(options)` en e11-repository exporta métodos con las mismas
  firmas de sus funciones fuente: identity, assignProfile, userRoleChange,
  profileHistory, fiscalSales, fiscalClients, financeClients, financeNotes,
  financeStatement, periods, createSnapshot, snapshot, snapshotSales,
  decideSnapshot, preparations, preparation, prepare. También run y execute.
  Los exports fuente existentes conservan firmas y consumen el mismo runtime.
- `execute<T>({userId,sessionId,capability,exclusive?,mutationUuid?,work,parse,deliver})` usa
  `e11Execute` REAL; routes/e11.ts delega a ese mismo coordinador. work recibe
  tx y la identidad fresca obtenida de filas reales/fake; parse valida resultado;
  deliver recibe payload e identidad nuevamente autorizada, bajo el segundo
  lock. La primera transaction confirma o revierte todas las escrituras
  (incluido aviso), la segunda protege entrega. El fake de transaction debe
  implementar rollback al lanzar error, no sólo llamar callback.
- freshCommandActor/e11Identity permanecen reales, leen usuarios/sesión/perfil
  mediante tx y evalúan flags/versiones del mismo runtime. El clock controla
  vigencia de sesión (comparación parametrizada), periodos e instantes de
  evidencia; UUID controla eventos/snapshots/decisiones/propuestas.
- Preparación sigue usando e5Command, e5Repository, liveActor y e5Context reales,
  con ledger/tx inyectados únicamente como infraestructura. Las guardas A E5
  consumen el mismo runtime y no confunden CONTADOR base con capacidad A.
- `middlewares/e11-legacy.ts` exporta política pura
  e11LegacyAllowed(enabled,role,path) y
  createE11LegacyBoundary(enabled,authenticate). routes/index.ts monta la misma
  factory con E11_ENABLED y requireSession reales; no hace falta importar router
  ni DB para comprobar la política. Las excepciones de salud/login y el
  resto de superficies legacy permanecen iguales.

Verificación tras este seam: TypeScript backend source-only noEmit, sin
project references, rootDir workspace, cero diagnósticos. No tests ejecutados
ni servidor/DB/SQL/workflow. La reparación previa del generador/barrel por MAIN
ya permite typecheck; los cuatro TS2308 del registro histórico anterior no
persisten. No se afirma resultado de pruebas del nuevo seam.

## Corrección crítica: distinguir precommit, COMMIT incierto y entrega postcommit

`e11Execute` recibe mutationUuid para toda ruta POST/PUT (validado del cuerpo
original por routes/e11.ts). GET no se presenta como mutación confirmada.
parse del resultado sigue DENTRO de la primera transacción, antes de COMMIT.
Si esa transacción confirma y cualquier paso posterior falla (reautorización,
perfil/version/capacidad/sesión, lectura o entrega), el coordinador NO propaga
el error ordinario PERFIL_CAMBIADO/PERFIL_DENEGADO/NO_AUTENTICADO.

Envelope implementado por E11OutcomeError/e11ErrorBody:
- HTTP 409, code RESULTADO_CONFIRMADO_NO_CONSULTABLE: primera transacción
  confirmada, resultado inaccesible ahora. Campos code/message/requestId/uuid.
- HTTP 503, code RESULTADO_INCIERTO: callback de trabajo y parse concluyeron,
  pero transaction no confirmó el COMMIT (p.ej. pérdida de conexión). Mismos
  campos, uuid original. No afirmar rollback ni éxito definitivo.
- SQLSTATE clase 23/40 prueba rollback del COMMIT y conserva manejo precommit;
  fallos dentro del callback antes de completarlo tampoco se etiquetan como
  confirmados. Ningún error postcommit vuelve a esos códigos ordinarios.

No se incluye causa original, DTO protegido, perfil anterior ni otro dato
privado en esos envelopes. Si bytes ya fueron enviados, el handler no intenta
reescribir la respuesta; un fallo de red siempre exige conservar la intención.
Reintento reautoriza antes de replay. Revocado no obtiene DTO A ni escribe otro
efecto; recuperar permiso no permite cambiar perfilVersion/cuerpo bajo el mismo
UUID. ADMIN puede consultar evidencia desde sus superficies autorizadas.

Delta contractual requerido a MAIN (OpenAPI/generados no editados aquí):
agregar ambos valores a E11Error.code y propiedad uuid:string format uuid
(obligatoria para ambos outcomes, ausente en errores ordinarios); documentar
statuses 409/503. UI debe enclavar resultado/UUID sin datos A, no interpretar
estos errores como rechazo definitivo ni nueva intención.

Casos que debe cubrir testhelper, sin ejecución por este implementador:
1. Confirmar mutación, revocar antes de deliver: 409 outcome confirmado con
   UUID original, deliver no recibe DTO, evidencia/aviso/propuesta únicos.
2. Reintentar ese mismo UUID/cuerpo revocado: sin datos ni nuevos efectos.
3. Fallar notificación dentro del callback: rollback de decisión/aviso/replay.
4. Fallar confirmación de COMMIT tras callback completo: outcome incierto.
5. Fallar parse dentro de primera transacción: no efecto confirmado.
6. Lectura GET revocada conserva denegación ordinaria, nunca confirma escritura.

## Recuperación ADMIN mínima autorizada (contrato estable, sin SQL ejecutado)

Se añaden exactamente dos operaciones a las 19 anteriores:
- GET /e11/operaciones/{actorId}/{accion}/{uuidOriginal}
  operationId getE11OperacionRecuperacion.
- POST /e11/operaciones/{actorId}/{accion}/{uuidOriginal}/resolucion
  operationId resolveE11Operacion.
Ambas requieren sesión real vigente, ADMIN real y FISCAL_LEER; no basta perfil F,
permiso override ni capacidad financiera. E11_ENABLED permanece false. No agrega
capacidad al enum de identidad ni habilita preparación/conciliación/perfiles.

Terna exacta canónica: actorId original (no ADMIN resolutor), accion en
PERFIL/SNAPSHOT/DECISION/PREPARACION, uuidOriginal minúsculo.
POST: {uuid, revisionEsperada, identidadVersion, motivo}. uuid es del resolutor,
identidadVersion debe ser permisosVersion de ADMIN fresco; revisionEsperada es
revision del GET exacto. motivo trim 1..500. Sin campos extra ni query params.
Respuesta: {actorId,accion,uuidOriginal,estado,revision,resolucionId,resueltoEn}.
estado PENDIENTE/CONFIRMADA/CERRADA_SIN_EFECTO; revision SHA256 metadata canónica;
resolucionId y resueltoEn null antes de auditoría, UUID e ISO después. No payload,
IDs financieros, propuestas, montos, resultado hash privado ni identidad A.
Liberar marcador sólo tras estado terminal Y resolucionId no null. CONFIRMADA
sin resolución requiere POST para auditar; PENDIENTE, 404 y timeout nunca liberan.

Contrato físico para SQL owner (DDL pendiente, NO ejecutado aquí):
1. e11_operaciones agrega estado text NOT NULL DEFAULT 'CONFIRMADA',
   CHECK estado IN ('CONFIRMADA','CERRADA_SIN_EFECTO'). PK existente
   (actor_id,operacion,uuid) se conserva. Filas previas son CONFIRMADA sin
   reescribir solicitud_hash/respuesta; no alterar hashes históricos.
   CERRADA_SIN_EFECTO es tombstone append-only, nunca UPDATE/DELETE/TTL/reapertura.
   solicitud_hash conserva SHA256 (hash de solicitud resolutora), respuesta
   contiene sólo metadata saneada de cierre. Tombstone y auditoría mismo tx.
2. Nueva e11_resoluciones append-only:
   id uuid PK; actor_original_id integer FK usuarios; accion text con mismo enum
   de cuatro acciones; uuid_original uuid; admin_id integer FK usuarios;
   uuid_resolutor uuid; solicitud_hash text SHA256; revision_anterior text SHA256;
   identidad_version text SHA256; motivo text trim 1..500; estado text con
   CHECK IN ('CONFIRMADA','CERRADA_SIN_EFECTO'); respuesta jsonb; created_at timestamptz.
   Todos NOT NULL. UNIQUE(actor_original_id,accion,uuid_original);
   UNIQUE(admin_id,uuid_resolutor). FK compuesta
   (actor_original_id,accion,uuid_original) → e11_operaciones(actor_id,operacion,uuid),
   ON DELETE RESTRICT, igual para actores; sin cascadas ni borrado físico.
   Prohibir UPDATE/DELETE para auditoría y operación/tombstone en rol runtime.
   No agregar tablas E5, asientos, ledger, caja ni side effects financieros.

Orden real:
fresh ADMIN/session → lock E11:resolution:{adminId}:{uuidResolutor}
→ replay auditoría (hash exacto o UUID_REUTILIZADO)
→ lock E11:{actorId}:{accion}:{uuidOriginal}
→ lectura operación/auditoría → CAS
→ si ausente INSERT tombstone e11_operaciones
→ INSERT auditoría e11_resoluciones → COMMIT → reautorizar entrega.
Si operación existe, sólo inserta auditoría; jamás repite work original.
Retry resolutor mismo admin/UUID/path/cuerpo devuelve misma auditoría antes de CAS.
Otro UUID sobre terna ya resuelta da REVISION_OBSOLETA; GET recupera estado final.

TODOS los cuatro productores pasan por e11Replay, ahora normaliza UUID del lock
y lee estado ANTES de work. Tombstone causa OPERACION_CERRADA_SIN_EFECTO (409).
La misma PK de e11_operaciones es respaldo indispensable del lock: bajo
SERIALIZABLE un snapshot tomado antes de esperar podría no ver al ganador.
Si ambos vieron ausencia, sólo un INSERT de la misma PK puede confirmar; el
perdedor revierte TODO su trabajo, incluidas propuesta/aviso/replay. No basta
con lock entre tablas independientes ni un 404; jamás se hace ON CONFLICT DO
NOTHING tras work. Deadlock/serialización/unique conflict exige relectura CAS,
no liberación local del marcador. La llamada tardía no puede confirmar efectos.

POST resolver también usa coordinator/outcome con su UUID resolutor. Ante
timeout/outcome no crear recuperación recursiva: GET de la TERNA ORIGINAL
recupera la resolución auditada; si sigue pendiente, repetir POST exacto o
recargar CAS después de conflicto demostrado. Ningún error libera por sí mismo.

Seam: createE11Service expone recovery(tx,actor,target), resolve(tx,actor,target,input).
Schemas Zod locales E11RecoveryTarget/Input/Output reflejan OpenAPI; no se
modifican generados. MAIN debe regenerar y SQL/UI integrar antes de habilitar.
Pruebas nuevas pendientes del owner: ADMIN vs F/A, exact owner/action/UUID,
frescura identidad+CAS, UUID resolver conflict/replay, confirmación sin duplicar,
tombstone previo/tardío y carrera SERIALIZABLE, rollback auditoría, postcommit
revocado y recuperación posterior vía GET. Fixtures SQL fake deben devolver
estado y soportar e11_resoluciones; no regrabar hashes de evidencia histórica.