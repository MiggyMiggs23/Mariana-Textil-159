# E11 — frontend funcional construido, OFF

## Alcance y autoridad

Implementación sobre el contrato frontend/storage E11 y las decisiones P9/P10
de `replit.md`: F sólo facturado; A asignado manualmente por ADMIN; conciliación
diaria opcional, semanal/mensual obligatoria, sin plazos inventados ni dinero.
E5 cerrado en `560246a8a26668773d2435ba1fbd0ffdc65a8893` no se redefine.

Los cinco gates de `src/lib/e11-feature-flags.ts` permanecen literalmente false.
No hay override de entorno/usuario. OFF no monta lectores, mutaciones, rutas
ni enlaces nuevos E11. No se cambian gates E5/E7/E9/E12 ni los 69 vetos ajenos.
Disponibilidad es la única lectura nueva permitida por contrato OFF; esta UI
ni siquiera la monta mientras los gates de construcción están cerrados.

## Fuentes y puntos de entrada

Todo código enumerado está bajo `artifacts/mariana-textil/src/`.

- `lib/e11-session.tsx`: disponibilidad/identidad tipadas, capacidad efectiva,
  frescura, separación de caché y revocación.
- `hooks/use-e11-write.ts`: intención normalizada, lock síncrono, almacenamiento
  por identidad/operación, revalidación, correspondencia y recuperación explícita.
- `pages/e11.tsx`: lectores dedicados, formularios y rutas saneadas.
- `App.tsx`: frontera previa al router legacy para CONTADOR y ocho rutas E11.
  `/clientes` y `/clientes/:id` redirigen antes de montar cualquier lector legacy.
  A usa su detalle financiero; F sólo lector fiscal. El resto del negocio legacy
  queda denegado para CONTADOR ON, incluidas URLs profundas/documentos.
- `pages/usuarios.tsx`: selector ADMIN A/F para CONTADOR activo, motivo, revisión,
  confirmación e historial paginado. No se agrega override de permisos.
- `components/layout/app-layout.tsx`: navegación administrativa condicionada.
  CONTADOR ON usa shell propio, sin lectores generales del layout.
- `pages/notificaciones.tsx`, `pages/conciliacion.tsx` y
  `components/notifications-bell.tsx`: acceso ADMIN a discrepancias/snapshots,
  incluyendo enlace del aviso persistido exacto. OFF no expone enlaces E11.
- `lib/e5-authorization.ts`, `components/e5-pendientes.tsx`,
  `hooks/use-e5-actions.ts`, `pages/e5-documento.tsx`: identidad E11 opcional en
  scope E5 y su revalidación; comportamiento anterior conservado OFF. CONTADOR ON
  no puede montar lectores/acciones E5 legacy. `/cobros/pendientes[/id]` y el
  redirect `/pagos-dirigidos` conducen exclusivamente al adaptador A autorizado.
  Documentos E5 siguen privados de ADMIN, sin alternativa para A/F.

## Hooks generados consumidos: 21 en el contrato final

No se copiaron clientes ni se escribieron fetchers E11 manuales.
Se usan hooks/funciones tipadas de MAIN desde `@workspace/api-client-react`.

1. `useGetE11Disponibilidad`
2. `useGetE11Identidad`
3. `useGetE11Perfil`
4. `useAssignE11Perfil`
5. `useListE11PerfilHistorial`
6. `useListE11FiscalClientes`
7. `useListE11FiscalVentas`
8. `useGetE11FiscalFactura`
9. `useListE11FinanzasClientes`
10. `useListE11FinanzasNotas`
11. `useGetE11FinanzasEstadoCuenta`
12. `useListE11Conciliaciones`
13. `useCreateE11Conciliacion`
14. `useGetE11Conciliacion`
15. `useListE11ConciliacionVentas`
16. `useDecideE11Conciliacion`
17. `useListE11Preparaciones`
18. `useGetE11Preparacion`
19. `usePrepareE11Aplicacion`
20. `useGetE11OperacionRecuperacion`
21. `useResolveE11Operacion`

Las funciones GET generadas complementan esos hooks para comprobaciones frescas
antes de mutar; nunca sustituyen lectores E11 por clientes legacy.

## Comportamiento implementado

### Identidad y privacidad

La clave incluye usuarioId, rolBase, perfil, perfilVersion, permisosVersion y
capacidades. La identidad tiene staleTime 0, consulta periódica de 15 segundos,
revalidación al montar/foco/reconexión y antes/después de cada mutación.
No se habilitan vistas sobre identidad cacheada sin primera lectura de montaje.
Una identidad revocada no puede reaparecer por una respuesta vieja.

Cambio de identidad desmonta formularios/cursos de paginación, cancela queries,
retira cachés y mutaciones antiguas y elimina el payload sensible E11 del scope
anterior sólo preservando su UUID/acción/estado en cuarentena. Al entrar como CONTADOR también retira caché de negocio legacy e
intenciones E5 antiguas del actor. No se borran a ciegas intenciones monetarias
ADMIN E5: quedan ligadas al contexto previo y no se reenvían con otro perfil.
Las mutaciones E11 no quedan en cola automática offline ni tienen retry automático.
Respuestas tardías se descartan por vigencia de identidad y ciclo del formulario.

### Lecturas

F consulta únicamente DTOs fiscales; “factura” es documento interno marcado
facturado, no CFDI. No aparecen saldo, límite, pagos, mercancía, Fondo, proveedor
ni enlaces a tickets/documentos operativos.

A consulta clientes, límite/saldo canónico, contacto permitido, notas y
movimientos contables saneados. ABONO/REVERSO no abren recibos ni medios/cuentas.
No se inventa sitio para estas proyecciones globales. Los scopes E5 existentes
conservan su sitio real además de la nueva identidad.

Paginación opaca en listas/historial/notas/movimientos/ventas congeladas; los
errores de cursor permiten reiniciar desde la primera página. Cambiar filtros
remonta el lector. Carga/error/vacío se muestran sin sustituir importes por cero.

### Evidencia y conciliación

Intervalos de días CDMX `[inicio, finExclusivo)`, con calendario civil para
validar lunes a lunes y primer día a primer día. No se congela periodo abierto.
Se revisa total auténtico de todo el periodo y fuenteRevision antes de confirmar;
la transacción del servidor congela el conjunto entero, no la página visible.

Detalle muestra total/count/hash/actor/fecha/revisión y ventas congeladas.
Revisiones enlazadas conservan evidencia anterior. ACEPTADA exige igualdad exacta
a centavos; NO_CUADRA exige observación y permite discrepancia de composición
con total igual. La referencia externa es texto, sin archivos/originales.
La UI muestra el aviso ADMIN confirmado en la decisión. ADMIN sólo consulta,
no firma como F ni se agrega workflow monetario/de investigación.

### Preparación A

La bandeja utiliza cobros E5 auténticos del adaptador. Revalida cobro, cliente,
revisión, fuente, cargos exactos movimientoVentaId/notaId y saldo. Importes
positivos y suma no mayor al retenido real; notas/cargos únicos. UUID por
intención normalizada y confirmación explícita. Sólo registra propuesta:
no recibe, aplica, aprueba, rechaza, devuelve ni genera favor.

### Errores y recuperación

Lock adquirido antes del primer await. Se conservan UUID/cuerpo exactos ante
resultado ambiguo, en sessionStorage ligado a identidad/operación. El reintento
es explícito y exige identidad fresca. Nunca se reemplaza un importe bajo la
misma clave. Navegación/recarga recuperan lecturas del servidor y, dentro del mismo
scope autorizado, la intención incierta guardada.

Sólo un primer rechazo contractual definitivo antes de efecto permite retirar
la intención y revisar el borrador con UUID nuevo. Un 409/403/STALE durante replay
incierto no prueba ausencia de efecto y conserva el UUID original. Denegaciones
no disparan fallback legacy. Se verifican destinatario/actor/UUID o cobro/cliente/
periodo/documento/cifra congelada según el DTO antes de limpiar incertidumbre.
La autorización atómica, deduplicación y revocación inmediata son del servidor;
el polling UI no pretende sustituirlas.

## Verificación realizada y límites de esta entrega

- Lectura de contratos y P9/P10; revisión estática de paths, imports y gates.
- TypeScript source-only mediante Compiler API: noEmit, incremental/composite
  desactivados, sin project references y excluyendo tests/harness.
  Última comprobación: **0 diagnósticos**. Una comprobación anterior encontró
  cuatro TS2308 del barrel Zod generado; ese material no fue modificado aquí.
- `git diff --check` sin errores en la revisión realizada.
- No se ejecutaron tests, SQL, DB, API, aplicaciones, workflows, builds,
  instalaciones ni commits. No se tocó backend, OpenAPI, generados ni E3/dist.
- No se afirma validación dinámica, visual, concurrencia real, integración DB,
  migración, activación ni release. Las verificaciones dinámicas y de regresión
  corresponden a MAIN; E11 continúa completamente OFF.

## Corrección crítica de recuperación (UI verifier)

`RESULTADO_CONFIRMADO_NO_CONSULTABLE` (409) y `RESULTADO_INCIERTO` (503)
preservan la intención original. También la preservan los rechazos 4xx de un
replay incierto. UUID_REUTILIZADO y códigos desconocidos nunca se consideran
prueba de ausencia de efecto. No hay limpieza genérica por status ni por
PERFIL_CAMBIADO/PERFIL_DENEGADO.

Rutas exactas de almacenamiento para MAIN/verifier:

- Payload autorizado: sessionStorage
  `e11-intencion:${encodeURIComponent(identityKey)}:${operation}`.
  Registro `{scope, operation, command, confirmed?: true}`. El cuerpo original
  se conserva para replay idéntico únicamente en el mismo contexto autorizado.
- Marcador mínimo duradero: localStorage `e11-recovery:${uuid}`.
  Exclusivamente `{uuid, action, state}`; action es
  `perfil|snapshot|decision|preparacion`, sin sufijo de IDs privados.
  Estados: `RESULTADO_INCIERTO`, `RESULTADO_CONFIRMADO_NO_CONSULTABLE`,
  `QUARANTINE`, `CONFIRMED`.
- Los dos registros deben escribirse antes del POST/PUT; fallo de persistencia
  no envía mutación. Los marcadores bloquean nuevas intenciones incluso tras
  recarga, cambio de perfil o sesión; sólo el cuerpo original incierto en su
  contexto vigente admite replay con igual UUID.
- Revocación convierte el registro en marcador QUARANTINE (o confirmado no
  consultable cuando ya existe confirmación), luego elimina el payload privado.
  No se persisten cliente/cobro/nota/importe/contacto/perfil en cuarentena.
- Confirmación correspondiente persiste `confirmed:true` y CONFIRMED antes de
  refrescar. Si refresh falla, no puede enviarse otra mutación; el marcador
  permanece. No se limpia por un error de lectura posterior al commit.
- Aviso visible `data-testid="e11-recovery-notice"`: UUID/acción/estado y
  escalamiento a ADMIN para consulta de evidencia con autorización vigente.
  Eventos `e11-recovery` y `storage` actualizan avisos/barreras.

Estado histórico anterior al delta final (sustituido por la sección siguiente):
no existía en los 19 endpoints una operación de resolución administrativa por
UUID sin cuerpo. Por tanto, la cuarentena no ofrece un botón de “descartar” ni
simula una resolución: requiere revisión autorizada del servidor por ADMIN.
La barrera local conservadora permanece hasta evidencia verificable; no se
inventa un endpoint ni se concede acceso A al actor revocado. Esto es un aviso
de recuperación seguro, no una afirmación de recuperación automática completa.
Los cinco gates siguen false. No se ejecutaron pruebas/apps/DB/workflows.

## Contrato final: recuperación ADMIN integrada (21 hooks)

La cuarentena permanente anterior queda sustituida por la recuperación contractual
GET/POST de MAIN, sin replicar negocio. `components/e11-recovery-admin.tsx`
consume `useGetE11OperacionRecuperacion` y `useResolveE11Operacion`.
Se monta desde el aviso de recuperación sólo con E11 habilitado e identidad
ADMIN real, perfil null y FISCAL_LEER. No depende de gates de perfiles,
conciliación o preparación, ni de barreras de otras intenciones de negocio.
OFF no monta ninguno de estos hooks.

Interfaces finales para MAIN/UI verifier (sustituyen formato previo):

- Cuarentena localStorage:
  `e11-recovery:${actorIdOriginal}:${ACCION}:${uuidOriginal}`
  con **sólo** `{actorId, accion, uuidOriginal, state}`.
  ACCION = PERFIL/SNAPSHOT/DECISION/PREPARACION. El actor es siempre el dueño
  original, obtenido del scope original al guardar/purgar, nunca el ADMIN actual.
  No se incluyen IDs financieros, importes, destinos, contacto o payload A.
- Intención resolutora sessionStorage:
  `e11-resolver:${encodeURIComponent(adminIdentityKey)}:${actorIdOriginal}:${ACCION}:${uuidOriginal}`
  con `{scope, target:{actorId,accion,uuidOriginal}, body:{uuid,revisionEsperada,identidadVersion,motivo}}`.
  UUID nuevo por intención resolutora, cuerpo persistido antes del POST,
  retry exacto y lock síncrono. Fallo de almacenamiento no envía.
  Al cambiar identidad/salir se elimina este cuerpo ADMIN, no la terna original.
- Marcadores UI: `e11-recovery-notice` y `e11-recovery-admin`.
  Eventos `e11-recovery`, `storage` y `e11-resolved`.
- GET consulta exclusivamente la terna original. POST envía revisión de ese GET,
  permisosVersion ADMIN fresco y motivo confirmado (1–500). No usa `useE11Write`,
  no crea cuarentena recursiva por UUID resolutor y no reenvía payload financiero.
- Antes de consultar/resolver/aceptar respuesta se verifica identidad vigente.
  La metadata debe corresponder exactamente a actor original, acción y UUID.
  Sólo CONFIRMADA/CERRADA_SIN_EFECTO con resolucionId válido y fecha resolutoria
  permite limpiar **esa** terna y sus payloads originales coincidentes.
  CONFIRMADA sin resolución auditada requiere POST; PENDIENTE, 404, timeout,
  respuesta ajena o error conservan bloqueo.
- Si POST pierde respuesta, incluida REVISION_OBSOLETA en replay, GET nuevo de
  la terna es autoridad. Conserva cuerpo/UUID resolutor mientras no haya prueba
  terminal. Otro ADMIN puede consultar/resolver la misma terna sin conocer el
  cuerpo financiero. El aviso muestra resultado verificado/resolucionId y
  advierte no reenviar operación original.
- Una resolución elimina sólo su marcador. Otros marcadores permanecen y no
  bloquean el resolver ADMIN. Formularios de negocio que conservaban referencia
  al UUID resuelto quedan detenidos; no reenvían esa intención por desaparición
  del marcador.

Los marcadores antiguos sin actor original verificable no se atribuyen al ADMIN
actual ni se liberan automáticamente. Se informa error de metadata en vez de
inventar un namespace autorizado.

Validación estática del delta: ninguna modificación a backend/spec/generados/tests.
La comprobación source-only noEmit detectó un TS2308 externo en
`lib/api-zod/src/index.ts:837` por export duplicado `ResolveE11OperacionBody`;
no se corrigió material de MAIN. Sin diagnósticos en fuentes frontend productivas.
No se ejecutaron pruebas, apps, DB, SQL ni workflows; gates continúan false.

## Corrección de aislamiento DOM tras revocación (hallazgo MAIN)

MAIN demostró fallo GREEN de E11-RECOVERY-ADMIN-SESSION-LOSS en
`reports/e11/frontend-node-mutants-2026-09-23T01-16-46.935Z`: el storage se
purgaba y la cuarentena persistía, pero el motivo privado seguía en el DOM.
El provider asignaba la misma key a dos hermanos (aviso y árbol de negocio).
Las keys duplicadas no garantizan reconciliación correcta: al cambiar scope,
un hermano anterior puede quedar sin desmontar aunque el nuevo resolver ya
no esté autorizado. La purga de storage no borra por sí sola el estado/DOM.

Corrección mínima productiva: keys `recovery:${key}` y `business:${key}`.
Son únicas entre hermanos y ambas cambian con la identidad completa; React
puede retirar ambos árboles anteriores, ejecutar sus cleanups y montar el
scope nuevo sin reutilizar formularios/estado privado. Sin cambios a contratos,
storage, gates, autorización, mutaciones o fixtures.

Alcance de regresión para MAIN: todos los consumidores de E11SessionProvider,
no sólo recuperación ADMIN. Revalidar pérdida/restauración de FISCAL_LEER,
cambio usuario/rol/perfil/versiones/capacidades, remount de aviso y formularios
de negocio, descarte de respuestas tardías, purga de cuerpos/cachés y
conservación de la terna mínima. Incluir salida a ramas de error/identidad
inválida y desmontaje del provider. Verificar ausencia de motivo privado en DOM
y de warnings por keys duplicadas, además del storage.
Los 149 terminales previos corresponden al snapshot anterior: no se declara
su vigencia después de esta corrección sin assessment/revalidación de MAIN.
No se ejecutaron tests, aplicaciones, DB ni workflows para esta corrección.