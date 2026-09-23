# E11 — contrato frontend estable, construcción OFF

Autoridad: pedido acotado posterior a E5 `560246a8a26668773d2435ba1fbd0ffdc65a8893`,
replit.md, plan U E11, respuestas P9/P10 y autorización Tanda B 20260922.
P9 sustituye expresamente “todas las ventas/cobranza” para F. P10 determina F
por defecto y A sólo manual por ADMIN real. No se requiere otra decisión de negocio.

Esta entrega NO monta UI ni handlers, genera clientes, cambia permisos productivos,
ejecuta SQL, pruebas, workflows o commits. Fuente única: lib/api-spec/openapi.yaml.
Sus x-e11-gates son todos false. Son gates contractuales, no se afirma que exista
middleware E11. MAIN generará clientes; no importar tipos nuevos antes de generarlos.
No se tocó E3, sus paquetes/dists, ni evidencia E4/E12/E9/E5.

## Identidad y capacidades

Rol base CONTADOR permanece igual: perfil efectivo A/F es sidecar, no rol inventado.
GET identidad devuelve usuarioId, rolBase, perfil, perfilVersion, permisosVersion y
capacidades efectivas filtradas. ADMIN recibe perfil null. F nunca recibe capacidad
financiera general, A nunca capacidad de recepción/aplicación/aprobación/rechazo,
devolución/favor, mercancía, Fondo o administración. E5_PREPARAR requiere A explícito,
permiso específico y gates E11, E5 y preparación abiertos; no basta CONTADOR.

La futura identidad de caché y remount incluye usuarioId, rolBase, perfil,
perfilVersion y permisosVersion. También solicitudes pendientes/intenciones E5,
cursores y exportaciones. Al cambiar cualquiera: cancelar queries/mutaciones aún
no enviadas, borrar datos sensibles persistidos y cachés, desmontar formularios,
descartar intenciones/reintentos offline, recargar identidad y capacidades.
El mismo actor con mismo rol que baja de A a F NO conserva datos A ni propuestas.
Una respuesta tardía de la versión anterior se descarta. Revalidar al montar,
al foco/reconexión y antes de mutación; consulta de identidad periódica con
staleTime finito (máximo 30 segundos). La seguridad es inmediata en servidor,
no depende del intervalo ni de mensajes push.

## Entradas UI (destinos de implementación posterior, ninguna añadida ahora)

- Ruta existente montada `/usuarios`: ADMIN agrega selector A/F para CONTADOR,
  motivo requerido e historial paginado. No exponer en permisos como override libre.
- Ruta existente `/clientes` y detalle `/clientes/:id`: al ser contador redirigir
  a proyecciones E11; jamás montar primero hooks legacy. F a `/contabilidad/fiscal`;
  A a `/contabilidad/finanzas` y `/contabilidad/finanzas/clientes/:id`.
- Montar después `/contabilidad/fiscal` (ventas y clientes), y
  `/contabilidad/fiscal/facturas/:id` (documento interno saneado).
- Montar después `/contabilidad/conciliaciones` (periodos pendientes),
  `/contabilidad/conciliaciones/:id` (snapshot, ventas, aceptación/discrepancia).
- Montar después `/contabilidad/preparaciones` y `/contabilidad/preparaciones/:id`
  para A. La bandeja usa cobros E5 reales, no importe libre.
- Rutas E5 ya montadas detrás de E5_ENABLED `/cobros/pendientes` y
  `/cobros/pendientes/:id`: A entra exclusivamente a proyección/adaptador E11;
  F denegado. `/cobros/pendientes/:id/documentos/:documentoId` sigue sólo ADMIN.
  `/pagos-dirigidos` es redirect legacy, no implementar una bandeja paralela allí.
- `/notificaciones` y `/administracion/conciliacion`: ADMIN ve aviso NO_CUADRA
  con enlace al snapshot; no crear ruta de movimiento monetario/investigación nueva.

Todas las nuevas entradas requieren gate UI y capacidad servidor. OFF: sin links,
hooks, requests ni fallback legacy. Disponibilidad es la única lectura nueva
permitida OFF, devuelve cuatro false sin consultar usuarios/tablas E11.
No añadir PDF/XLSX/XML originales ni impresión completa para A/F. En esta entrega
las proyecciones son JSON; ninguna exportación nueva está autorizada.

## API y hooks

Base `/api`. Cada operationId siguiente genera hook `use` + inicial mayúscula
(por ejemplo useGetE11Identidad); no hooks manuales duplicados. `cursor/limit`
son paginación opaca, limit 1–100; fechas ISO y dinero decimal string, nunca float.

| Método y ruta | operationId | Cuerpo / query |
|---|---|---|
| GET /e11/disponibilidad | getE11Disponibilidad | ninguno |
| GET /e11/identidad | getE11Identidad | ninguno |
| GET /e11/usuarios/{usuarioId}/perfil | getE11Perfil | id entero |
| PUT /e11/usuarios/{usuarioId}/perfil | assignE11Perfil | E11PerfilInput: uuid, revisionEsperada, perfil A/F, motivo |
| GET /e11/usuarios/{usuarioId}/perfil/historial | listE11PerfilHistorial | cursor, limit |
| GET /e11/fiscal/clientes | listE11FiscalClientes | cursor, limit |
| GET /e11/fiscal/ventas | listE11FiscalVentas | desde, hastaExclusivo, clienteId opcional, cursor, limit |
| GET /e11/fiscal/facturas/{facturaId} | getE11FiscalFactura | id entero |
| GET /e11/finanzas/clientes | listE11FinanzasClientes | cursor, limit |
| GET /e11/finanzas/clientes/{clienteId}/notas | listE11FinanzasNotas | cursor, limit |
| GET /e11/finanzas/clientes/{clienteId}/estado-cuenta | getE11FinanzasEstadoCuenta | cursor, limit |
| GET /e11/conciliaciones | listE11Conciliaciones | desde, hastaExclusivo, cursor, limit |
| POST /e11/conciliaciones | createE11Conciliacion | E11SnapshotInput: uuid, perfilVersion, tipo, inicio, fuenteRevision, revisionAnteriorId nullable |
| GET /e11/conciliaciones/{id} | getE11Conciliacion | UUID |
| GET /e11/conciliaciones/{id}/ventas | listE11ConciliacionVentas | cursor, limit |
| POST /e11/conciliaciones/{id}/decisiones | decideE11Conciliacion | E11DecisionInput: uuid, perfilVersion, revisionEsperada, fuenteRevision, resultado, totalExterno, referenciaExterna, observacion |
| GET /e11/a/preparaciones | listE11Preparaciones | clienteId opcional, cursor, limit |
| GET /e11/a/preparaciones/{cobroId} | getE11Preparacion | UUID E5 |
| POST /e11/a/preparaciones/{cobroId} | prepareE11Aplicacion | E11PreparacionInput: uuid, perfilVersion, revisionEsperada, fuenteRevision, asignaciones |

Asignación E5: notaId, movimientoVentaId, importe por renglón; mismo cliente,
notas únicas con saldo, importe positivo, suma no mayor al retenido real.
No enviar actor, rol, timestamps ni capacidad desde UI. Los devuelve/deriva servidor.
Consultas financieras A incluyen notas facturadas y no facturadas; F no reutiliza
estos hooks ni “cuatro cifras” de crédito global. Factura aquí es documento interno
marcado facturado, no CFDI ni factura externa inventada.

## Errores, frescura y resultados

E11Error siempre code/message/requestId, nunca datos privados ni éxito cero.
400 VALIDACION; 401 NO_AUTENTICADO; 403 E11_DISABLED, PERFIL_DENEGADO,
PERMISO_DENEGADO, ADMIN_REQUERIDO, E5_DISABLED; 404 NO_ENCONTRADO;
409 UUID_REUTILIZADO, REVISION_OBSOLETA, PERFIL_CAMBIADO, FUENTE_CAMBIADA,
PERIODO_ABIERTO, ESTADO_INVALIDO, NOTA_SIN_SALDO; 422 IMPORTE_NO_COINCIDE,
USUARIO_NO_CONTADOR; 503 DEPENDENCIA_NO_DISPONIBLE.
403 no dispara lectura legacy. 409 conserva borrador visible sin reenviarlo:
refrescar identidad/fuente y pedir confirmación de nueva intención con nuevo UUID.
Timeout ambiguo reintenta exactamente el mismo UUID/cuerpo después de revalidar
identidad; nunca cambia importe o perfil bajo el mismo UUID.

Después de asignar: invalidar perfil/historial/identidad/capacidades y cachés del
usuario afectado. Después de snapshot/decisión: lista, detalle, ventas congeladas
y avisos ADMIN. Después de preparar: bandeja/detalle E11 y propuesta E5 que ADMIN
ve en su flujo existente. No marcar deuda pagada. Mostrar loading/error/empty
sin fabricar cifras. Navegación/reload/otra sesión deben recuperar estado servidor.

### Outcomes de mutación confirmada o incierta (delta coordinado con MAIN)

No todos los errores significan que no hubo escritura. Para POST/PUT, backend
devuelve code/message/requestId/uuid con:
- 409 RESULTADO_CONFIRMADO_NO_CONSULTABLE: COMMIT confirmado, pero autorización
  fresca o entrega impidió consultar resultado.
- 503 RESULTADO_INCIERTO: no se pudo determinar confirmación del COMMIT.

Ambos requieren conservar UUID y cuerpo de la intención, sin crear otro UUID,
sin reenviar automáticamente y sin volver a habilitar “confirmar” como si la
operación hubiera fallado definitivamente. Borrar datos A al revocarse y mostrar
sólo estado y UUID de seguimiento; no mantener DTO/propuesta confidencial.
La necesidad de conservar la intención NO autoriza persistir datos A en sesión F:
retener identificador y estado no sensible; el cuerpo privado debe permanecer
inaccesible/descartarse si no puede protegerse. Consultar evidencia mediante
actor autorizado o escalar a ADMIN; no reconstruir otra intención para resolverlo.

Si ya se recibió un outcome confirmado/incierto o hubo timeout ambiguo,
un 401/403/PERFIL_CAMBIADO posterior NO demuestra rollback del intento original
y no debe desbloquear creación de UUID nuevo. Replay sólo con cuerpo original
y autorización vigente; cualquier cambio de perfilVersion/cuerpo bajo UUID
original se rechaza. Los datos se recuperan por GET autorizado, nunca ocultando
la revocación. MAIN debe añadir los dos códigos y uuid al contrato/generados
antes de cerrar integración; este ajuste no implementa UI ni regenera clientes.

### Recuperación ADMIN implementada, delta autorizado de dos endpoints

Contrato estable: GET /e11/operaciones/{actorId}/{accion}/{uuidOriginal} y
POST /e11/operaciones/{actorId}/{accion}/{uuidOriginal}/resolucion.
actorId es SIEMPRE dueño original, no usuario actualmente autenticado.
Guardar como cuarentena sólo terna {actorId,accion,uuidOriginal} y outcome
no sensible. accion: PERFIL/SNAPSHOT/DECISION/PREPARACION. No guardar cliente,
notas, importes, cuerpos ni DTO A revocados. La terna basta para recuperar.

ADMIN real con FISCAL_LEER consulta GET (no permiso financiero): devuelve
{actorId,accion,uuidOriginal,estado,revision,resolucionId,resueltoEn}.
POST envía {uuid,revisionEsperada,identidadVersion,motivo}; UUID resolutor nuevo
para esa intención ADMIN, revisionEsperada del GET exacto, identidadVersion del
permisosVersion ADMIN fresco y motivo no vacío. Backend verifica original
existente o cierra sin efecto mediante tombstone irreversible; registra auditoría.
No envía payload original ni reintenta negocio. Resolución no es cobro/aplicación.

Liberar ÚNICAMENTE marcador de la terna exacta si respuesta saneada muestra
estado CONFIRMADA o CERRADA_SIN_EFECTO Y resolucionId no null. Mostrar resultado
verificado/cierre sin efecto; nunca “reintentar operación original”. Otro dueño,
otro UUID, otra acción, PENDIENTE, 404, error, timeout o estado local no bastan.
CONFIRMADA con resolucionId null aún requiere POST para auditar resolución.

Si POST resolutor pierde respuesta, preservar UUID/cuerpo resolutor sólo en
sesión ADMIN autorizada; GET de terna original permite recuperar auditoría sin
necesitar ese cuerpo. Retry POST exacto es idempotente. REVISION_OBSOLETA exige
GET nuevo, no liberar; si ya existe resolución terminal con id, liberar exacto.
No crear marcador recursivo por UUID resolutor: consultar terna original.
Si ADMIN pierde sesión, otro ADMIN puede consultar/resolver la misma terna,
sin cuerpo financiero original y sin efectos duplicados. Defaults OFF intactos.