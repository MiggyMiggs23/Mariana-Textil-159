# E3 backend preparado — 21 septiembre 2026

## Identificación y estado

Base exacta: `55ac9c70181a01e6b42c56a8beb334417f6512f0`.
Cambios de esta entrega sin commit propio: manifest de fuentes
`backend-source.sha256`. La revisión final integrada corresponde al agente
principal; no se atribuye un commit a un árbol todavía sin confirmar.

**PREPARADO, OFF. NO LIBERADO.** `E3_ENABLED=false` y
`E3_DIRECTED_ENABLED=false`, sin selector por env ni payload. Los cierres
existentes de efectivo E1, evidencia E2 A+C, devoluciones y pendientes no se
activan. El router E3 está antes de los middlewares amplios `/clientes`, para
que OFF devuelva 423 antes de autenticar/consultar base. No se ejecutó la
aplicación ni se consultó ninguna base.

## Terminado en fuente

- Contratos OpenAPI y clientes/Zod generados iniciales: ocho operaciones (cuatro de
  preview/confirmación, tres lectores de recibo y solicitud de impresión).
  Codegen fijado explícitamente a Zod 3, que es la versión instalada;
  colisión de Params resuelta en el postprocesador existente.
- Caja ordinaria: naturaleza derivada `INGRESO_FISICO`, importe entero exacto,
  medio/cuenta consistente, sitio y sesión operativa abierta, fecha servidor.
  No acepta pregunta/campo naturaleza, fecha histórica, ticket dirigido ni motivo.
- Cliente/recaptura: permiso de matriz `clientes_recapturas.crear`, defecto
  denegado para roles noADMIN, sin veto fijo nuevo en la ruta E3. La regla
  heredada E1 sí restringe roles: conflicto bloqueado descrito abajo; no se
  afirma que otorgar la matriz habilite cualquier rol. Motivo y fecha histórica
  con zona obligatorios, naturaleza `CORRECCION_CONTABLE`, ABONO legítimo del
  mismo ledger, ninguna sesión de caja ni ingreso de dinero.
- `caja_abonos.crear` es permiso separado: no amplía `clientes_finanzas`.
  Registro de módulos y seed E3 están además bajo cierres fuente OFF; no
  cambian catálogo activo de 32 módulos ni defaults por reiniciar. Los 34
  módulos son solamente el catálogo preparado tras autorización.
- Preview obligatorio guardado por UUID/actor, vigencia diez minutos; hash
  del ledger completo, intención y reparto. Confirmación bajo transacción,
  candado UUID y namespace compartido CUSTOMER_CREDIT; revisa cliente,
  actor/sitio y sesión bloqueada contra cierre. Rechaza saldos/reparto cambiados.
- Reutiliza `projectCreditLedger`, carga transaccional existente, claims E1,
  productor `insertCreditMovementE1`, aplicaciones y finalización E2. No crea
  segundo algoritmo financiero. FIFO, tres notas y anticipo/excedente funcionan
  en pruebas de dominio con almacén transaccional offline.
- UUID de intención identifica una recepción única; reintentos devuelven
  snapshot/folio original y no crean movimiento. Misma clave con intención
  distinta rechaza. Reintento tiene acceso actual, sin exigir reabrir una caja
  que cerró después del primer registro.
- Snapshot inmutable propio `E3-<sitioId>-<consecutivo>` al confirmar, cliente/importes/reparto/
  remanente/deuda/favor/fechas/actor/origen. Recaptura se distingue de dinero
  nuevo. Lectura ADMIN por folio, cliente, movimiento y sesión operativa del
  corte; nunca reconstruye con saldo actual. Evidencia ausente/inconsistente
  rechaza con explicación.
- Impresión/reimpresión registra solicitud y motivo en auditoría, no afirma
  impresión física y no inserta ABONO. El snapshot soporta el A5 de dos copias
  en otro equipo; renderer y navegación son responsabilidad frontend.
- P6: política exacta noADMIN aplicada también al validador de solicitud
  dirigida de cliente existente; sobrante, faltante y nota ya pagada rechazan.
  No se implementa/activa recepción retenida E5/E7.
- Esquema Drizzle preparado, SQL de instalación/reversión y retirada muy
  acotada de guarda para ingreso efectivo ABONO_ORDINARIO. SQL separado para
  reinstalar guarda; comprobaciones de hash del cuerpo previo impiden reparar
  silenciosamente una versión inesperada. Devoluciones y dirigido quedan
  cerrados, permanentes E1 y evidencia A+C no se retiran.

## Transferencias: compatibilidad con E1

La sesión requerida por Caja es **operativa** y queda en el snapshot E3.
Para EFECTIVO, E1 conserva CAJA_FISICA y su sesión física. Para TRANSFERENCIA,
E1 conserva cuenta bancaria y `sesionCajaId=null`; el recibo enlaza por separado
la sesión operativa. No se suma transferencia a efectivo esperado. No se
relajó la regla permanente E1 ni se modificó el lector de efectivo E2.

## Evidencia ejecutada, exclusivamente offline

`node scripts/src/e3-offline-mutations.mjs`: **14/14 verdes, catorce mutantes
independientes en copia temporal fallaron por aserción del caso nombrado,
14/14 verdes restaurados**. Cada caso nuevo tiene su rojo real, no una etiqueta.
El ejecutor elimina credenciales heredadas, solo enlaza dependencias externas
Express/Zod, copia módulos locales y precarga la guarda que bloquea red/DB.
No sustituye módulos vigilados del workspace.

| Caso | Defecto introducido que realmente falló |
|---|---|
| E3-01 | Pérdida del remanente de cobro FIFO/anticipo |
| E3-02 | Aceptar un preview con ledger cambiado |
| E3-03 | Marcar reintento como cobro nuevo |
| E3-04 | Reclasificar recaptura como dinero físico |
| E3-05 | Imputar transferencia a sesión de efectivo E1 |
| E3-06 | Aceptar dirigido noADMIN por debajo del saldo |
| E3-07 | Inventar cero al faltar saldo histórico del recibo |
| E3-08 | Eludir cierre de router montado antes de auth/repositorio |
| E3-09 | Aceptar preview calculado/expirado sin emisión guardada |
| E3-10 | Permitir que otro actor/intención invalide el preview ajeno |
| E3-11 | Permitir al cajero consultar contexto de otro sitio |
| E3-12 | Sustituir nombre congelado del receptor por ID interno |
| E3-13 | Sustituir consecutivo por sitio por UUID |
| E3-14 | Permitir que preview/confirmación legacy evadan permiso de recaptura E3 |

Logs `backend-tests/green-before.log`, `red-01.log` a `red-14.log`,
`green-restored.log`, `mutations.json`.
Además **52/52** regresiones existentes de FIFO, naturaleza/captura E1,
evidencia A+C y efectivo de Caja pasaron con la misma guarda offline.
Codegen + `typecheck:libs` y `tsc --noEmit --incremental false` de API: **exit 0**.
No se emitió bundle API. Los archivos protegidos pasaron comparación SHA-256
contra el inventario previo del agente principal.

## Detenido y límites explícitos

- **BLOQUEADO — decisión del responsable sobre matriz de recaptura versus E1.**
  La petición permite configurar `clientes_recapturas.crear` para otros roles,
  pero `e3Repository.lockAndLoad` invoca `assertCreditEvidenceAccess`, que
  delega en `credit-evidence-contract.ts::assertCreditActorAccess`. Esta regla
  E1 heredada admite solamente ADMIN/SUPERVISOR/CAJA/TERMINAL activos y exige
  sitio asignado para noADMIN. Por tanto, aunque se otorgue el permiso nuevo,
  CONTADOR/SISTEMAS/BODEGA siguen rechazados con 403 por E1 en preview y
  confirmación, incluidos reintentos. La matriz configurable no constituye
  autorización efectiva para todos los roles. No se eliminó ni eludió E1:
  resolver la incompatibilidad requiere decisión explícita del responsable,
  fuera de esta entrega OFF. Evidencia existente: prueba
  `E1 current actor/site access rejects role, inactive actor and moved site even on replay`
  en `credit-evidence-contract.test.ts` rechaza expresamente CONTADOR y
  SISTEMAS; pasó en `backend-tests/existing-regressions.log`. BODEGA está
  excluido por la misma lista de código, no por un caso explícito de esa prueba.
- **SQL NO ejecutado, ninguna conexión DB.** No se probó PostgreSQL real:
  triggers, FK, bloqueos entre conexiones, serialización contra cierre real,
  matriz de permisos persistida, error de finalización A+C y rollback
  PostgreSQL requieren ensayo aislado posterior y autorización apropiada.
  El almacén de pruebas serializa transacciones en memoria; no se presenta
  como prueba de concurrencia PostgreSQL ni de esquema instalado.
- E2 fue abortado en B0; esta entrega no lo repara ni presupone liberación.
  E3 efectivo queda además detenido por los cierres E1/E2 conservados.
- SQL `03` es propuesta de apertura solo del productor ordinario, no
  autorización. Se necesita B0 nuevo aprobado, respaldo/restauración y
  verificaciones de E2/SQL antes de cualquier ejecución. Reversión de esquema
  rechaza si ya hay recibos; jamás borra evidencia para volver atrás.
- Dirigido retenido, aplicación posterior/constancia y lectores E5/E7 siguen
  pendientes/cerrados. La política P6 no equivale a recibir esos cobros.
- No se probó impresión física, navegador de liberación ni flujo Caja activo.
  No se reinició API, cambió bundle retenido/candidato ni se tocó el paquete E2.
- Revisión de permisos UI, selección de cliente/sesión, todas las
  invalidaciones y enlaces ADMIN de abono/estado/corte debe completarse en
  integración frontend. Contrato común actualizado: cuenta destino enum
  obligatorio, folio de asignación número nullable, timestamps wire ISO.

## Correcciones de integración posteriores (mismo alcance OFF)

- Catálogo mínimo `GET /caja/abonos-e3/contexto`, con `caja_abonos.crear`,
  no `clientes`/`ubicaciones`/`clientes_finanzas`; devuelve clientes por búsqueda
  de dos caracteres (máximo 50, solo id/nombre/teléfono), tiendas activas y
  sesiones abiertas. NoADMIN se limita al sitio asignado; ADMIN puede elegir.
  La puerta 423 precede auth y consulta también en esta novena operación.
- UUID de preview ligado a actor + intención, no solamente al token. Bajo el
  mismo candado de operación se rechaza otro actor o importe/sitio/cliente
  cambiado; el UPSERT SQL repite la condición y no sobrescribe propietarios.
- Tras el anuncio del integrador se sustituyó folio UUID por **contador por
  sitio y namespace propio `recibo_folio_e3`**, patrón rollback-safe de
  Entradas/Salidas. Primero `E3-2-00000001`, por ejemplo; no consume secuencia
  de tickets ni entradas. Asignación dentro de la misma transacción y solo
  después de descartar replay. Instalación/reversión siguen sin ejecutar.
- Snapshot congela sitioNombre/actorNombre y clienteTelefono/clienteRfc además
  de clienteNombre; receptor/sitio nunca se imprimen como sustitutos de IDs.
  Contactos ausentes quedan explícitamente null, no datos inventados.
- Se leyó la especificación A5 original anexada (11–50,66–98): esta
  corrección atiende nombres, identificación y folio por sitio. Marcado de
  reimpresión/fecha y geometría física siguen siendo verificación frontend.
- **Codegen final ejecutado tras instrucción posterior del integrador**:
  OpenAPI incorpora contexto y nombres congelados, tipos/hooks/Zod regenerados.
  `backend-tests/codegen-final.log` acredita generación y `typecheck:libs`
  exit 0; `backend-tests/typecheck-final.log` corresponde a API
  `tsc --noEmit --incremental false`, también exit 0. No se generó bundle API,
  no se tocaron UI, base ni workflows. El contrato queda estable.

### Cierre del acceso legacy a recapturas tras activar E3

Revisión confirmó que POST `/clientes/:id/pagos` y su vista-previa solo exigían
`clientes_finanzas.crear`, no el nuevo permiso de recaptura. Se añadió
`legacyPaymentCaptureGuard()` antes de ambos handlers/permisos financieros:
con E3 OFF continúa exactamente la ruta previa; con E3 ON devuelve 409
`E3_DEDICATED_CAPTURE_REQUIRED` y orienta a Caja o recaptura del cliente.
Se cierran ambos endpoints legacy completos al liberar E3 porque su preview
puede omitir naturaleza; confiar en ese campo permitiría mantener el acceso
alternativo. No cambia lectores/reversos, no interpreta el pago ni concede
permisos. E3-14 monta el middleware real en ambos caminos, prueba OFF/ON,
con y sin naturaleza, y falla por aserción al retirar el cierre en el mutante.
Codegen final ya completo; este ajuste de seguridad no modifica OpenAPI.