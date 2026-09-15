# Prompt A — auditoría financiera contra `replit.md`

Fecha de esta auditoría: 2026-09-15. Alcance: lectura estática de los
bloques financieros del Prompt A actualizado, con atención especial a los
bloques 1–3 y al punto 4.3 (corte de caja sin abonos).

## Dictamen y límites de evidencia

El código gana cuando contradice una afirmación del prompt o del documento.
En esta entrega no se cambió `replit.md` ni ningún archivo bajo
`artifacts/`, `lib/` o `scripts/`. Solo se deben crear los dos reportes
solicitados. No se ejecutaron la aplicación, workflows, pruebas, conectores,
consultas SQL ni escrituras financieras.

Las verificaciones de código que siguen son lecturas realizadas en esta
sesión. Las cifras, POST, saldos y resultados de 2026-09-15 que se citan desde
reportes anteriores son evidencia histórica leída, no una verificación nueva.
Se marca expresamente esa diferencia para no convertir una lectura histórica
en una aprobación actual.

### Resultado ejecutivo

| Área | Resultado | Corrección documental propuesta (no aplicada) |
|---|---|---|
| Dos definiciones de «Cobrado» | **Confirmado en código y documento; sigue sin reconciliarse.** La sección explícita ya existe en `replit.md:836-845`. | Conservar la sección, actualizar las referencias de código y no unificar. |
| Prompt C y fuente compartida | **Confirmado con una precisión de superficie:** la banda está en Caja en Tiempo Real, no en la página raíz de Dashboard. | Nombrar la superficie exacta y conservar `useSharedCuentasDestino`/`getDestinationAccounts`. |
| Predicado contabilizado | **Contradicción documental y conteo corregido:** hay seis copias manuales dentro de `admin-analytics.ts`, cinco en `getSalesSummary` y una en `getSessionMargin`. | Reemplazar referencias `archivo:línea` por archivo + función y documentar las seis ubicaciones; no unificar en esta entrega. |
| Feed pendiente | **Referencia desfasada.** | Citar el uso actual en `routes/notificaciones.ts`, dentro del feed de Caja. |
| Saldo a favor / autorización | **Regla automática vigente confirmada; la intervención dirigida es una excepción separada.** | Conservar esa distinción y no reintroducir el antiguo override del cajero. |
| Fechas efectivas | **Regla solo parcialmente cierta en el código.** El abono normal del cliente sí usa el builder y el endpoint estricto; pago dirigido genérico y proveedor tienen excepciones. | Documentar las excepciones; corregirlas en una entrega de código separada, no aquí. |
| Badge de estado | **Cinco superficies actuales confirmadas.** | Enumerar las cinco superficies y mantener saldo separado de la insignia. |
| Corte de caja | **Omisión confirmada por lectura estática:** el cálculo no incorpora `movimientos_credito`/ABONO. | Mantener como pendiente de alta prioridad antes del piloto; no ejecutar un cierre. |
| Autorización de las escrituras del 15 de septiembre | **No comprobada en fuente primaria.** | No afirmar que existe autorización textual; el reporte histórico del agente no la sustituye. |

## 1. «Cobrado»: dos mediciones que comparten nombre

### 1.1 Definición de ventas / Contado cobrado

`replit.md:60` define la identidad:

> Ventas = Contado cobrado + Ventas a crédito.

También dice que Contado cobrado es el nombre de la tarjeta anterior Cobrado
(Caja), sin cambiar su cálculo. El código respalda esa medición:

* `artifacts/api-server/src/lib/accounted-document.ts:10-12`,
  `collectedTicketPredicate()`, limita la medición a tickets vendidos con
  `cobrado=true`.
* `artifacts/api-server/src/lib/admin-analytics.ts:350-427`,
  `getSalesSummary()`, usa `${collectedTicketPredicate("f")}` para el campo
  `cobrado` en `:388`. No une el libro de `movimientos_credito` en esa suma.
* El endpoint `GET /admin/dashboard/realtime` (`routes/admin-analytics.ts:125-160`)
  entrega `getSalesSummary()` para las tarjetas; `getRealtimeStores()` usa la
  misma medición de ticket para el detalle por sitio (`admin-analytics.ts:620-630`).
* En la interfaz de Caja en Tiempo Real, `tiempo-real.tsx:266-285`, la tarjeta
  se presenta como **Contado cobrado**, conserva el identificador de desglose
  `COBRADO` y muestra `totals.cobrado`.

Esta medición contesta cuánto de la venta del periodo se cerró como contado.
Un abono de una nota no es una venta nueva y no puede sumarse a esta
identidad.

### 1.2 Definición de cobranza de dinero recibido

`replit.md:521` define por separado:

> Cobrado = Contado + Abonos + Saldos a favor.

La fuente del código es otra:

* `artifacts/api-server/src/lib/admin-analytics.ts:130-221`,
  `destinationReadModel()`, une POS, crédito, aplicaciones de abono, saldo a
  favor y reversos.
* `getDestinationAccounts()` (`admin-analytics.ts:1301-1410`) separa
  `saleSources` de `collectionSources`; la cobranza usa `POS`, `ABONO`,
  `REVERSO_ABONO`, `ABONO_SALDO_FAVOR` y
  `REVERSO_ABONO_SALDO_FAVOR`.
* `artifacts/mariana-textil/src/hooks/use-shared-cuentas-destino.ts:3-22`
  es el lector compartido. Las superficies
  `pages/caja/tiempo-real.tsx:109-114` y
  `pages/caja/cuentas-destino.tsx:163-170` lo usan, en lugar de llamar al
  endpoint directamente.
* La banda de `tiempo-real.tsx:325-368` presenta “Qué dinero entró” /
  “Cobranza del periodo”, toma `cuentasData.encabezado.cobrado` y enlaza por
  fuentes: ventas del periodo (`POS`), abonos (`ABONO`) y saldo sin aplicar
  (`ABONO_SALDO_FAVOR`).

Esta medición contesta cuánto movimiento contable de cobranza cae dentro del
periodo. No prueba por sí sola una entrada física adicional de efectivo.

### 1.3 Estado documental

El Prompt C ya está escrito en `replit.md:958-964`: renombra la primera tarjeta,
mantiene la identidad de ventas, declara la fuente compartida de la banda,
mantiene los enlaces al detalle y advierte que la cobranza no prueba efectivo
físico. Eso quedó comprobado contra el código.

Además, `replit.md:836-845` ya contiene la sección titulada **«Cobrado: dos
definiciones sin reconciliar»**, con las dos frases, las funciones, la decisión
abierta y la asimetría por sitio. La sección es conforme al código leído. Las
correcciones restantes son de precisión de referencias y de ubicación de la
banda; no debe proponerse unificar las definiciones.

### 1.4 Asimetría Cruces / global

La lectura de `destinationReadModel()` confirma la causa estructural descrita
en la documentación:

* Las filas aplicadas de `ABONO` se unen al ticket de la nota y filtran el
  sitio de la nota (`:155-166`).
* El remanente `ABONO_SALDO_FAVOR` exige `$3::int IS NULL` y emite
  `NULL::int "ubicacionId"` (`:168-185`).
* El reverso de ese remanente repite `NULL::int "ubicacionId"` y la condición
  global (`:202-220`).

Por eso el saldo a favor sin aplicar y su reverso existen en la consulta global,
mientras una aplicación/recaptura queda atribuida al sitio de la nota. La
asimetría no se debe corregir ni presentarse como una conciliación.

Los importes históricos que siguen son **lectura de
`reports/prompt-c-readonly-2026-09-15-after.md`, no ejecución de esta sesión**:

* Cruces, 2026-09-15: `encabezado.cobrado.total` y `source5 net total`
  `$25,000.00`.
* Global, 2026-09-15: `encabezado.cobrado.total` y `source5 net total`
  `$0.00`.
* El mismo reporte explica que la lectura global contiene el reverso de saldo
  a favor sin ubicación, mientras Cruces conserva la recaptura atribuida a la
  nota.

Debe quedar como pendiente de alta prioridad antes del piloto: una tienda
puede mostrar cobranza que no aparece neta en global.

## 2. Referencias `archivo:línea` y copias del predicado

### 2.1 Las cuatro referencias documentales desfasadas

La tabla del documento `replit.md:537-542` todavía contiene las cuatro
referencias antiguas. La lectura actual muestra:

| Referencia que debe corregirse | Qué hay hoy en esa ubicación | Uso actual y ubicación leída |
|---|---|---|
| `artifacts/api-server/src/lib/pos.ts:2082-2088` — cuentas del corte | `pos.ts:2082` cierra la consulta de pagos y `:2084-2088` construye `formasPagoPorTicket`; no deriva cuentas del corte. | La derivación propia de cuentas del corte está en `buildCorteCaja()`, `pos.ts:2420-2425` (`cuentas`) y el efectivo esperado en `:2454-2456`. |
| `artifacts/api-server/src/lib/admin-analytics.ts:324-335` — predicado duplicado | `admin-analytics.ts:324-330` es `mexicoCityHour()` y `:332-347` inicia `where()`. | Las copias de `getSalesSummary()` están en `:381-382`, `:386-387`, `:390-391`, `:392-393` y `:396-397`. |
| `artifacts/api-server/src/lib/admin-analytics.ts:376-378` — margen | Esa ubicación es el CTE `lines` y cuenta líneas sin costo (`:376-378`). | La copia de margen está en `getSessionMargin()`, `admin-analytics.ts:441-442`. |
| `artifacts/api-server/src/routes/notificaciones.ts:194` — `pendingTicketPredicate()` | `notificaciones.ts:194-200` devuelve el conteo de notificaciones; no ejecuta la consulta del feed. | El uso real está en `GET /notificaciones/feed`, `notificaciones.ts:219-226`, en `cajaTicketsPromise`. |

La regla documental correcta debe citar archivo + nombre de función. Las líneas
de esta tabla se conservan únicamente como evidencia del estado que se leyó;
no son una propuesta de referencia durable.

### 2.2 Conteo exacto de copias manuales

La función canónica es `accountedDocumentPredicate()` en
`artifacts/api-server/src/lib/accounted-document.ts:6-8`. Además de esa
función, hay **seis** copias manuales del predicado contabilizado en
`admin-analytics.ts`:

| Nº | Función / contexto | Líneas actuales | Uso |
|---:|---|---:|---|
| 1 | `getSalesSummary()` — CTE `lines` | `381-382` | Incluye líneas de documentos contabilizados para margen. |
| 2 | `getSalesSummary()` — `ventas` | `386-387` | Suma ventas contabilizadas. |
| 3 | `getSalesSummary()` — `subtotal` | `390-391` | Suma subtotal contabilizado. |
| 4 | `getSalesSummary()` — `iva` | `392-393` | Suma IVA contabilizado. |
| 5 | `getSalesSummary()` — `tickets` | `396-397` | Cuenta documentos contabilizados. |
| 6 | `getSessionMargin()` | `441-442` | Calcula margen por sesión. |

No se unificaron. El número anterior de dos repeticiones es incorrecto y no
debe conservarse como conteo actual. La lectura de los usos analíticos no
encontró otra copia manual fuera de esas cinco apariciones en
`getSalesSummary()` y una en `getSessionMargin()`; `getRealtimeStores()` y el
resto de lectores usan los predicados canónicos.

`pendingTicketPredicate()` sí es canónico en
`accounted-document.ts:22-24`; el uso de Caja está dentro de
`notificaciones.ts` y el resto de usos analíticos deben citar sus funciones,
no las líneas obsoletas.

## 3. Saldo a favor, FIFO y autorización frente a intervención

### 3.1 Regla vigente confirmada

La búsqueda exacta de la frase antigua (“decisión explícita del cajero” /
“nunca automática”) no devolvió salida en `replit.md`. La documentación vigente
aparece en `replit.md:505` y `:854-862`, aunque esas secciones deben leerse
junto con los límites históricos.

El código confirma:

* `allocateCreditFifo()` en
  `artifacts/api-server/src/lib/credit-allocation.ts:142-195` ordena las
  deudas por `createdAt` e `id`, aplica hasta el saldo y deja el remanente.
* `projectCreditLedgerCore()` (`credit-allocation.ts:280-405`) conserva
  `preventImplicitFavor` solo como compatibilidad histórica. La regla explícita
  indica que cargos nuevos no deben escribirlo (`:286-288`); una fuente
  posterior puede aplicarse automáticamente y una marca histórica puede
  rechazar solo fuentes anteriores (`:306-312`).
* `autorizarNota()` en `artifacts/api-server/src/lib/pos.ts:1794-1961`
  acepta `aplicarSaldoAFavor` únicamente por compatibilidad (`:1801-1806`),
  ignora el importe enviado por el cliente, proyecta el ledger bloqueado,
  calcula `automaticFavorCents` (`:1891-1895`), registra la evidencia exacta y
  guarda el importe automático en auditoría (`:1912-1923`, `:1947-1958`).
* `AutorizacionNotaDialog` en `artifacts/mariana-textil/src/pages/cobros.tsx`
  muestra saldo disponible, aplicado automáticamente y remanente
  (`:1123-1144`), no ofrece un campo de override (`:1099-1101`) y autoriza
  enviando solo `{ id: ticketId }` (`:1158-1163`).

### 3.2 Intervención explícita: pago dirigido

El pago dirigido no contradice FIFO automático: es una excepción separada que
requiere documento objetivo y motivo.

* `cliente-pago-dialog.tsx:139-169` manda el flujo normal por
  `useCreateClientePago` con fecha y destino, y solo el modo `DIRIGIDO` manda
  `useCreateSolicitudPagoDirigido` con `documentoMovimientoId` y `motivo`.
* `solicitud-pago-dirigido-dialog.tsx:138-154` lo etiqueta “Pago Dirigido
  (Excepción FIFO)” y exige motivo de al menos diez caracteres
  (`:75-87`, `:121-126`).
* `notifications-bell.tsx:223-230` sí ofrece Aprobar/Rechazar directamente en
  la notificación para ADMIN; `routes/notificaciones.ts:219-226` conserva solo
  `PENDIENTE` como evento de Caja.

La propuesta del Bloque 5 (`reports/abonos-fifo-2026-09-15-propuesta-bloque-5.md`)
es histórica y sigue marcada “propuesta; no implementada”. No se debe describir
esa propuesta como una implementación nueva.

## 4. Fechas: calendario frente a instante

### 4.1 Lo que sí es estricto

`artifacts/api-server/src/lib/fecha-efectiva.ts:1-85` define el parser
`parseFechaEfectiva()`; solo admite RFC 3339 con hora y `Z` o desplazamiento
numérico, y rechaza `YYYY-MM-DD` o una fecha sin zona. `routes/clientes.ts`
lo llama antes de cualquier `zod.coerce.date()` en `:1937-1945` y
`:1993-2001`.

`artifacts/mariana-textil/src/lib/fecha-efectiva.ts:95-145` convierte el valor
de un `<input type="date">` en mediodía con el desplazamiento real de
`America/Mexico_City`. `cliente-pago-dialog.tsx:120-122` y `:139-168` usa
esa función tanto para vista previa como para el abono normal o dirigido de
cliente.

### 4.2 Excepciones reales que contradicen la cobertura documental

La frase de la sección `replit.md:836` (“el diálogo usa una función compartida
de Ciudad de México para abono normal, dirigido y vista previa”) está en
`replit.md:860`. Es cierta para `ClientePagoDialog`, pero no para todas las
superficies de pago:

| Flujo | Evidencia actual | Resultado |
|---|---|---|
| Solicitud dirigida genérica, cliente o proveedor | `solicitud-pago-dirigido-dialog.tsx:65-67` fabrica una fecha pelona con `new Date()` local; `:89-102` envía `fechaEfectiva: effectiveDate`. | **Contradicción:** no usa `buildMexicoCityEffectiveDate()`. |
| Endpoint de solicitud dirigida | `routes/pagos-dirigidos.ts:75-78` valida con `CreateSolicitudPagoDirigidoBody`, cuyo contrato generado usa `zod.coerce.date()` (`lib/api-zod/src/generated/api.ts:64-75`); después `:212-221` hace `new Date(data.fechaEfectiva)`. | **Contradicción:** no valida el valor HTTP crudo con `parseFechaEfectiva()`; una fecha pelona puede llegar a medianoche UTC. |
| Pago normal a proveedor | `proveedor-pago-dialog.tsx:65-67` obtiene el día con `new Date()` local y `:116-125` envía `${effectiveDate}T12:00:00`, sin desplazamiento. | **Contradicción:** hora presente, zona ausente. |
| Pago dirigido a proveedor desde el mismo diálogo | `proveedor-pago-dialog.tsx:102-110` envía `${effectiveDate}T12:00:00` al endpoint dirigido. | **Contradicción doble:** zona ausente en cliente y parser estricto ausente en endpoint. |
| Pago normal de cliente | `cliente-pago-dialog.tsx:120-168` usa el builder compartido; `routes/clientes.ts:1937-1997` valida antes de coerción. | **Conforme**, dentro de este flujo. |

La corrección propuesta es hacer que todos los flujos de fecha efectiva usen el
builder compartido y que cada endpoint valide el valor crudo antes de coerción.
No se aplicó porque este trabajo no modifica la aplicación.

### 4.3 No mezclar fecha calendario con instante

No toda fecha del dominio es una fecha efectiva. Los vencimientos de crédito
son fechas calendario: `credit-allocation.ts:387-399` los serializa como
`YYYY-MM-DD`, y `clientes-aging.ts:29-40` compara el día calendario para
derivar `CON_RETRASO`. `routes/notificaciones.ts:74-76` conserva el texto de
vencimiento sin desplazarlo. Esa representación no debe “corregirse” agregando
un offset como si fuera un instante de recepción.

Los filtros analíticos son el tercer caso: `mexico-date.ts:81-117`,
`parseMexicoDateQuery()`, recibe `YYYY-MM-DD` como fecha calendario y la
convierte a límites instantes de inicio/fin en `America/Mexico_City`; luego
`admin-analytics.ts:332-347` usa esos instantes para SQL. La UI de la nueva
banda calcula hoy explícitamente en México (`tiempo-real.tsx:103-114`), pero
la página Cuentas Destino todavía calcula su valor predeterminado con
`format(new Date(), "yyyy-MM-dd")` (`cuentas-destino.tsx:146-150`) y sus
presets con date-fns sobre el reloj local (`:172-206`). Debe documentarse esa
distinción, no presentarse como una sola regla de “todas las fechas”.

## 5. Las cinco superficies del badge de estado de nota

`ClienteNotaEstadoBadge` solo presenta el estado, icono y color
(`components/cliente-nota-estado-badge.tsx:19-50`); no calcula saldo. Las
cinco superficies actuales que lo renderizan son:

1. `components/cliente-nota-credito.tsx:81-92`, tarjeta “Estado de Nota” del
   detalle: el saldo pendiente está en la tarjeta vecina
   (`:95-110`).
2. `pages/cliente-detail.tsx:89-109`, columna Estado de cuenta: el saldo
   pendiente se muestra debajo como campo separado.
3. `pages/cobros.tsx:304-328`, lista de notas de cobro: el badge ocupa una
   celda y el importe/pendiente permanece fuera.
4. `pages/alertas.tsx:198-225`, tarjetas de créditos por vencer/vencidos: el
   pendiente es un campo monetario separado.
5. `pages/notificaciones.tsx:79-80`, `AlertList` de avisos de crédito:
   el pendiente y vencimiento aparecen junto al badge, no dentro de él.

La búsqueda actual devuelve estas cinco llamadas, además de imports y pruebas:

```text
components/cliente-nota-credito.tsx:91
pages/cliente-detail.tsx:101
pages/alertas.tsx:204
pages/notificaciones.tsx:80
pages/cobros.tsx:328
```

Esto coincide con `replit.md:850-852`: la insignia no contiene importes, el
saldo pendiente actual tiene campo propio y un dato ausente no se convierte en
cero. La cobertura visual de estados PAGADA y CON RETRASO que el documento
marca como no aprobada sigue siendo una limitación histórica; no se ejecutó
una prueba visual nueva aquí.

## 6. Corte de caja sin abonos (Bloque 4.3)

La lectura estática confirma el pendiente de `replit.md:966-970`:

* `listarSesionesCajaHistorial()` calcula
  `efectivoEsperadoCents = fondoInicial + efectivoCobrado - salidasEfectivo`
  en `pos.ts:2144-2156`. `efectivoCobrado` proviene de
  `ticket_pagos` (`:2120-2123`).
* `buildCorteCaja()` está en `pos.ts:2161-2560`; su cálculo equivalente es
  `esperado = fondoInicial + formas.EFECTIVO - salidasPorCuenta.CAJA_FISICA`
  (`:2428-2456`).
* Ninguna de esas rutas consulta `movimientos_credito` ni suma `ABONO`.

Consecuencia: un abono genuinamente recibido en el cajón puede no aparecer en
el efectivo esperado del corte. Es un gap de conciliación, no evidencia de que
el cajón haya recibido un importe concreto. No se ejecutó `buildCorteCaja`,
ningún cierre ni ningún cuadre.

El importe histórico de $25,000 del 15 de septiembre no debe atribuirse sin
más al cajón: el reporte histórico de Bloque 4 describe reversos y
recapturas, no ingreso físico adicional. Esa limitación está correctamente
advertida en `replit.md:970` y debe mantenerse.

## 7. Autorización de escrituras financieras

La regla del Prompt A exige una cita textual primaria del propietario antes de
considerar autorizadas las cuatro escrituras. El archivo existente
`reports/prompt-a-auditoria.md`, sección «Dictamen», concluye
**“Autorización textual del propietario: NO COMPROBADA”** y explica que solo
encontró la condición de detenerse y reportes redactados posteriormente por el
agente.

El reporte histórico `reports/abonos-bloque4-2026-09-15-resultado.md` sí
describe IDs 47–50, instantes, saldos `$5,750.00`/`$7,022.00`, originales
45/46 intactos y cero neto del día 15, pero eso es evidencia histórica de
ejecución, no autorización textual primaria. No debe escribirse que la
autorización quedó comprobada hasta localizar la fuente primaria.

## 8. Bloque 4 histórico y verificaciones parciales

Los siguientes datos se conservan como reportados en archivos previos, sin
reacreditarlos en esta sesión:

* `reports/abonos-bloque4-2026-09-15-resultado.md:34-39` reporta reversos
  47/48 y recapturas 49/50 con instantes exactos.
* `:59-70` reporta deudas de `$5,750.00` y `$7,022.00`, favor `$0.00` y
  aplicaciones persistidas.
* `:96-121` reporta que 43–46 quedaron intactos, conserva el veto histórico y
  deja el día 14 en `$25,000.00` y el día 15 en `$0.00` neto para esas cuatro
  operaciones.
* `replit.md:825` y `:976` declaran cuatro diagnósticos de typecheck
  preexistentes, dos de API y dos de Alertas, no corregidos. No se ejecutó
  typecheck en esta auditoría.
* `replit.md:825` y `:976` también mantienen la cobertura visual real no
  aprobada; no se debe leer la existencia del componente o de una prueba de
  render como E2E autenticada.

## 9. Matriz final de afirmaciones y correcciones

| Afirmación auditada | Evidencia actual | Resultado | Corrección propuesta |
|---|---|---|---|
| Contado cobrado conserva identidad de ventas | `accounted-document.ts:10-12`; `getSalesSummary():350-427`; tarjeta `tiempo-real.tsx:266-285` | Conforme | Añadir referencia explícita a la segunda definición y a la sección nueva. |
| Cobranza usa fuente compartida de Cuentas Destino | hook compartido; `destinationReadModel():130-221`; banda `tiempo-real.tsx:325-368` | Conforme; superficie precisa es Caja en Tiempo Real | Nombrar esa superficie; no calcular en navegador. |
| Cobrado tiene dos definiciones | `replit.md:60`, `:521`; funciones distintas | Hecho confirmado, decisión abierta | Añadir “Cobrado: dos definiciones sin reconciliar”; no unificar. |
| Cruces/global son siempre iguales | SQL `admin-analytics.ts:168-220` y snapshot histórico | **Falso** | Mantener asimetría como pendiente de alta prioridad; no corregir aquí. |
| Referencias de líneas 538–542 siguen vigentes | lecturas de `pos.ts:2082`, `admin-analytics.ts:324`, `:376`, `notificaciones.ts:194` | **Falso** | Sustituir por nombres de función y ubicaciones actuales. |
| Hay dos duplicaciones manuales | `getSalesSummary():381-397` y `getSessionMargin():441-442` | **Falso: seis copias** | Documentar 5 + 1; no unificar en esta entrega. |
| Saldo a favor requiere selección manual del cajero | `autorizarNota():1801-1806`, `:1891-1958`; UI `cobros.tsx:1099-1163` | **Falso para notas nuevas** | Mantener automático; separar pago dirigido como excepción. |
| Todas las fechas efectivas son explícitas | parser estricto de cliente normal frente a `pagos-dirigidos.ts:220` y proveedor | **Parcial / falso globalmente** | Unificar builder y validación cruda en entrega posterior. |
| Fechas de vencimiento son instantes | `credit-allocation.ts:387-399`; `clientes-aging.ts:29-40` | **Falso: son calendario** | Documentar tipos de fecha por dominio. |
| Badge contiene importe original o saldo | componente badge y cinco llamadas | **Falso** | Mantener badge de estado y saldo actual en campo propio. |
| Corte ve todo efectivo recibido | `buildCorteCaja():2428-2456` solo tickets/salidas | **Falso** | Incorporar el gap al plan pre-piloto; no ejecutar cierres aquí. |
| Existe autorización textual de las cuatro escrituras | `reports/prompt-a-auditoria.md`, sección «Dictamen» | **No comprobado** | No afirmar autorización hasta obtener fuente primaria. |

## 10. Extractos textuales de comandos y salidas

Estos extractos son de búsquedas/lecturas de esta sesión; no son pruebas de
ejecución financiera:

```text
$ rg -n 'pos.ts:2082-2088|admin-analytics.ts:324-335|admin-analytics.ts:376-378|notificaciones.ts:194' replit.md
replit.md:538:- artifacts/api-server/src/lib/pos.ts:2082-2088 ...
replit.md:539:- artifacts/api-server/src/lib/admin-analytics.ts:324-335 ...
replit.md:540:- artifacts/api-server/src/lib/admin-analytics.ts:376-378 ...
replit.md:542:... artifacts/api-server/src/routes/notificaciones.ts:194 ...
```

```text
$ rg -n 'ClienteNotaEstadoBadge' ... | (llamadas, excluyendo imports/tests)
components/cliente-nota-credito.tsx:91
pages/cliente-detail.tsx:101
pages/alertas.tsx:204
pages/notificaciones.tsx:80
pages/cobros.tsx:328
```

```text
$ rg -n 'parseFechaEfectiva|new Date\(data.fechaEfectiva\)|new Date\(fechaRaw\)' ...
routes/pagos-dirigidos.ts
220: const effectiveDate = data.fechaEfectiva ? new Date(data.fechaEfectiva) : new Date();
routes/clientes.ts
1941: fechaEfectiva = parseFechaEfectiva(req.body?.fechaEfectiva);
1997: fechaEfectiva = parseFechaEfectiva(req.body?.fechaEfectiva);
routes/proveedores.ts
674: const parsed = new Date(fechaRaw as string);
```

La búsqueda de la frase antigua exacta sobre “decisión explícita del cajero” y
“nunca automática” tuvo salida vacía. La coincidencia documental que sí queda
es la frase vigente “sustituye expresamente la aplicación manual anterior”,
que no significa que siga vigente el comportamiento manual.

### Extracto histórico no reejecutado

El reporte previo `reports/prompt-c-readonly-2026-09-15-after.md:1-7`
conserva este comando y su alcance:

```text
Comando exacto:
pnpm --filter @workspace/api-server exec tsx ../../.local/operations/prompt-c-readonly.ts --after
Escrituras, migraciones, login, secretos, sesión de usuario y ejecutores operativos: 0.
```

Y sus salidas históricas relevantes:

```text
Cruces — 2026-09-15:
source5 net total ...: $25000.00

Global — 2026-09-15:
source5 net total ...: $0.00
```

No se ejecutó ese comando en esta auditoría; se cita únicamente para conservar
proveniencia y evitar presentar sus cifras como una comprobación nueva.

## Conclusión

El código confirma la separación entre Contado cobrado, cobranza del periodo,
FIFO automático, pago dirigido como intervención, badge de estado y saldo
separado. El documento ya contiene varias reglas correctas, pero todavía
conviven referencias de línea falsas, un conteo de duplicaciones incorrecto y
no existe la sección explícita que declare las dos definiciones de Cobrado sin
reconciliar. La regla de fechas también necesita una salvedad: los flujos de
cliente normal son estrictos, mientras pago dirigido genérico y proveedor aún
aceptan o producen representaciones sin desplazamiento.

Las correcciones propuestas son documentales o entregas posteriores; ninguna
se aplicó en este trabajo.