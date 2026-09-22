# E9 — contrato frontend, construcción OFF

## Dictamen normativo

No se identifica una decisión material pendiente que obligue a detener esta
fase. No se equipara construir con habilitar.

Citas exactas:

- `reports/prompt-u-plan-de-implementacion.md`, E9: «La forma operativa de
  entregar sigue como pregunta 8: U no la decide.» Es el antecedente pendiente,
  no una nueva prohibición posterior a P8.
- Mismo apartado, verificación: «recepción ADMIN única».
- `reports/prompt-u-respuestas-2026-09-18.md:29`: «P8 (E9). Cada tienda entrega
  su efectivo completo al cierre. El envío lo documenta ADMIN o SUPERVISOR. Si
  lo recibido en Mariana no coincide con lo enviado, se abre una investigación.»
- `replit.md:1521`: «No autoriza ajustar automáticamente diferencias ni
  modificar un corte cerrado; E9 no queda habilitado.»
- Respuestas, apartado «P6, P8 y P14 — alcance y compatibilidad»: «No se
  identificó otro conflicto con las reglas vigentes».

La autorización actual permite construir E9 antes de E5, manteniendo OFF.
Receptor, evidencia y cierre son especificaciones técnicas posibles dentro de
esas reglas: ADMIN autoriza; quedan autor, fechas, importes y referencias
inmutables; cerrar una investigación solo documenta su conclusión. No significa
perdonar faltantes, ajustar saldos, transferir responsabilidad o fabricar dinero.
No se inventan roles ni permisos de Fondo para SUPERVISOR.

## Etapas y estado actual

Primera entrega: OpenAPI, clientes/Zod generados, este contrato y gate frontend
`E9_ENABLED=false`. Tras la reanudación explícita de MAIN, backend y SQL/reversión
están **preparados OFF**, sin aplicar SQL ni ejecutar pruebas. Endpoints siguientes
implementados detrás del gate; frontend en manos de MAIN. No activaciones ni E5.

El gate backend es `E9_ENABLED=false` en `src/lib/e9-feature.ts`: disponibilidad OFF devuelve
`enabled:false` sin consultar esquema E9/Fondo; demás rutas rechazan
`403 E9_DISABLED`. El gate frontend impide montar consultas, mutaciones, botones
y navegación nuevos. No depender de un 404 para representar OFF.

## Semántica y acceso

- ADMIN/SUPERVISOR documentan envío desde una tienda dentro de su alcance
  autorizado existente. Otros lectores requieren permiso existente de consulta
  de su tienda. No ampliar matrices ni permitir un `ubicacionId` arbitrario.
- Un envío por corte cerrado, ligado a su ID/version inmutable. Se entrega todo
  el efectivo físico contado de ese cierre, no ventas ni efectivo esperado ni
  una cantidad editable. No descontar unilateralmente fondo inicial ni reservar
  cambio. Cierre sin efectivo positivo: se informa no enviable, sin ingreso cero.
- Envío registra custodia/en tránsito por separado; no cambia caja histórica,
  cobros, ventas, clientes ni Fondo. No requiere E5 ni convierte cobros retenidos
  en abonos aplicados.
- ADMIN registra conteo físico en Mariana y autoriza recepción. SUPERVISOR no
  cuenta, autoriza ingresos, cierra investigaciones ni recibe datos del Fondo
  por este contrato. No exige turno abierto de caja Mariana: no es ingreso caja.
- Conteo puede ser cero. Diferencia = recibido − enviado, en centavos exactos;
  cualquier diferencia abre investigación automáticamente, sin ajuste. Cada
  conteo es evidencia nueva; no editar/destruir conteos anteriores.
- Autorización referencia el conteo vigente, exige importe recibido positivo
  y crea **exactamente un ingreso Fondo** por ese importe. Conteo cero conserva
  entrega pendiente/investigación y no admite autorización ni asiento cero.
  Una discrepancia positiva o negativa exige motivo explícito de autorización;
  la investigación continúa abierta, no se cierra al acreditar el dinero real.
- Confirmación, enlace único e ingreso deberán ser atómicos. Una recepción
  autorizada no admite otro conteo/autorización ni una segunda remesa del corte.
  No ingresos anticipados, parciales ni duplicados por reintento/concurrencia.
- Un cierre documental de investigación por ADMIN exige conclusión y evidencia.
  Solo se admite tras recepción autorizada y mientras la investigación esté
  abierta; no se reescribe un cierre previo. Conteo cero mantiene pendiente.
  Conserva importe enviado, recibido y diferencia; no declara conciliado un
  faltante, borra pendientes monetarios ni genera ajustes/inversos. No se propone
  en esta fase ningún mecanismo de condonación, recuperación o pérdida.
- Periodos distintos son válidos: conservar fecha de corte/envío/conteo/
  autorización por separado. Los cortes cerrados no se recalculan.
- Consulta tienda muestra solo su remesa/conteos/investigación, nunca saldo,
  historial, movimiento, ID o enlaces Fondo. `fondo` existe solo en respuesta
  ADMIN. Ocultar UI no sustituye filtrado backend; tampoco inferir saldo de Fondo
  de ausencia de campo. Invalidar cachés de detalle al cambiar usuario/rol/sitio.

## Rutas, hooks y cuerpos

Base `/api`; importaciones desde `@workspace/api-client-react`.

| Método/ruta | operationId / hook | Uso |
|---|---|---|
| GET `/e9/disponibilidad?ubicacionId=` | `getE9Disponibilidad` / `useGetE9Disponibilidad` | Gate y capacidades, nunca saldo Fondo |
| GET `/e9/entregas?ubicacionId=&estado=&cursor=&limit=` | `listE9Entregas` / `useListE9Entregas` | Lista por alcance, paginación |
| GET `/e9/entregas/{id}` | `getE9Entrega` / `useGetE9Entrega` | Evidencia/corte exacto y detalle propio |
| POST `/e9/entregas` | `createE9Entrega` / `useCreateE9Entrega` | `{claveOperacion,corteId,versionCorte,evidencia}` |
| POST `/e9/entregas/{id}/conteos` | `createE9Conteo` / `useCreateE9Conteo` | ADMIN: `{claveOperacion,importeRecibido,evidencia}` |
| POST `/e9/entregas/{id}/autorizar` | `authorizeE9Recepcion` / `useAuthorizeE9Recepcion` | ADMIN: `{claveOperacion,conteoId,motivo?}` |
| POST `/e9/entregas/{id}/investigacion/cierre` | `closeE9Investigacion` / `useCloseE9Investigacion` | ADMIN: `{claveOperacion,conclusion,evidencia}` |

El selector de corte reutiliza la consulta existente de cortes dentro del
alcance autorizado. Backend revalida cerrado, tienda, versión, efectivo físico
positivo y unicidad: la UI no es autoridad del importe. `versionCorte` es token
opaco de evidencia congelada; no confiar en timestamps locales.

**Dependencia concreta del selector:** `GET /api/sesiones-caja/{id}/corte`
(`useObtenerCorteCaja`, esquema `CorteCaja`) ahora declara `versionCorte?:string`
en la raíz. `corteId === respuesta.sesion.id`; la pantalla es `/caja/cortes`.
La UI copia ese token exactamente; no lo deriva de fechas, montos ni IDs.
Solo E9 ON + CERRADA + snapshot E2 canónico válido lo emiten: hash SHA-256 del
snapshot completo, ID/sitio y fecha original de cierre, con serialización estable.
Incluye también `sesion.fechaOperativa` original: no inferir periodo del instante
de cierre/envío/recepción. Detalle E9 conserva `fechaOperativa` (campo adicional
opcional en OpenAPI por compatibilidad del contrato; backend siempre lo emite).
OFF retorna antes de toda lectura adicional. No se consulta esquema E9 ni se
modifica el periodo/corte. Históricos sin snapshot no reciben un token inventado:
no habilitar envío y mostrar falta de evidencia canónica. El POST revalida contra
la misma función canónica bajo bloqueo; este campo no reserva ni autoriza envío.

Evidencia: `{descripcion,referencias:string[]}`. Referencias documentales
existentes o identificadores legibles; no implementar carga de archivos ni
descargar URLs arbitrarias. Descripción obligatoria; referencias pueden vaciarse
si la propia descripción documenta el comprobante. El servidor congela autor y
fecha de cada evento, nunca acepta actor/rol/fecha de auditoría del cliente.

Dinero en strings decimales de dos posiciones, sin coma ni floats. UUID por
intención, estable durante reintentos. Mismo UUID/actor/contenido devuelve mismo
resultado; contenido distinto o conteo obsoleto: 409. No regenerar UUID ante
timeout. Tras un resultado incierto, reintentar intención o consultar detalle.

Estados recepción: `ENVIADA`, `CONTADA`, `AUTORIZADA`. Investigación separada:
`ABIERTA` / `CERRADA_DOCUMENTAL`; ausencia significa ninguna, no diferencia cero
inventada. Respuestas de escritura: detalle completo filtrado por actor.
Capacidades son calculadas por servidor; no se deducen solo del nombre de rol.

Errores `{error:{code,message}}`: `E9_DISABLED`/`E9_FORBIDDEN` 403;
`E9_NOT_FOUND` 404 sin revelar existencia fuera de alcance;
`E9_VALIDATION`/`E9_RECEIVED_ZERO` 400;
`E9_IDEMPOTENCY_CONFLICT`/`E9_CORTE_STALE`/`E9_CORTE_ALREADY_SENT`/
`E9_CONTEO_STALE`/`E9_ALREADY_AUTHORIZED`/`E9_STATE_CONFLICT` 409.
Errores de esquema/dependencia no se convierten en datos cero ni éxito.

## UI para MAIN

Lista por tienda/estado; detalle con cronología, corte exacto, enviado/recibido/
diferencia y estados independientes. Confirmación envío muestra total congelado
sin editor. Conteo ADMIN solicita importe real y evidencia. Confirmación ADMIN
advierte ingreso único por recibido y, con diferencia, investigación abierta.
Enlace Fondo solo ADMIN desde detalle autorizado; tienda no recibe ese enlace.
Investigación conserva discrepancia visible aun cerrada documentalmente.
No sumar remesas a cobranza/ventas ni tratar ingreso interno como dinero nuevo.

Backend preparado: adaptador transaccional real de E10, sidecars de custodia/
historia, lectores por alcance, bloqueo por UUID/corte/entrega, CAS y SQL/reversión
sin aplicar. El ingreso usa `OTRO_INGRESO` existente, sin cambiar catálogo E10.
Detalle Fondo ADMIN incorpora `origenE9?:{entregaId,corteId,corteHref}` únicamente
ON, para navegación exacta. Inverso Fondo independiente de recepción E9 rechazado;
investigación no es mecanismo de devolución ni corrección monetaria.
Enlace Fondo de entrega: `/fondo/movimientos/{movimientoId}`.
Pendiente MAIN: ejecutar evidencia offline y evaluar entrega. No prueba PG ni
liberación operativa implícita.

## Verificación de esta preparación

Codegen completado con `pnpm --dir lib/api-spec exec orval --config
./orval.config.ts` y `node lib/api-spec/fix-api-zod-barrel.mjs`. No se utilizó el
script agregado `codegen` que encadena `tsc --build`, para no escribir `dist`.
Typechecks `tsc --noEmit` de `lib/api-client-react` y `lib/api-zod` completados
con build-info exclusivamente en `/tmp`; `git diff --check` sin errores.
No se ejecutaron pruebas, aplicaciones, workflows, SQL ni DB.