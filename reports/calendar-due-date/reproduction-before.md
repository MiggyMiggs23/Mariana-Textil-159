# Prompt O — reproducción antes de cualquier fix

Estado: **reproducido con datos reales y fuente de producción; no es una hipótesis**.

## Límite de ejecución

Se ejecutó:

```text
printf '{"type":"module"}\n' >/tmp/package.json
TZ=America/Mexico_City artifacts/api-server/node_modules/.bin/tsx /tmp/reproduce-prompt-o-client-note.ts
```

El script usó el pool real de `@workspace/db`, una única transacción
`REPEATABLE READ READ ONLY`, y terminó con `ROLLBACK`. No inició la API, no creó ni
autenticó/renovó una sesión y no escribió en la base. No imprimió PII ni credenciales.

Identidad observada: base `heliumdb`, esquema `public`, `transaction_read_only=on`,
aislamiento `repeatable read`.

## Nota real

La búsqueda READONLY de vencimientos no nulos con igualdad exacta
`tickets.fecha_vencimiento::text = movimientos_credito.fecha_vencimiento::text`
no encontró un candidato elegible con folio 1005 (`0`). Encontró una nota real
válida, folio 1000, ticket `106`, movimiento `51`. El conteo y los identificadores
numéricos no exponen PII.

La base devolvió, textualmente:

```text
tickets.fecha_vencimiento::text       = 2026-10-16
movimientos_credito.fecha_vencimiento::text = 2026-10-16
igualdad exacta                       = true
```

## Camino montado que reproduce el desfase

El camino objetivo es `GET /clientes/:clienteId/notas/:ticketId`.

1. `artifacts/api-server/src/routes/clientes.ts:138-143` ejecuta la función de
   producción `dateOnly`; la cadena intermedia es `2026-10-16`.
2. En `:1747-1766`, `GetClienteNotaCreditoResponse.parse(...)` aplica el schema
   generado. El campo real es:
   `GetClienteNotaCreditoResponse.shape.fechaVencimiento =
   zod.coerce.date().nullable()`.
3. La serialización real del campo es:
   `2026-10-16T00:00:00.000Z`, es decir:

   ```json
   {"fechaVencimiento":"2026-10-16T00:00:00.000Z"}
   ```

4. El componente real
   `artifacts/mariana-textil/src/components/cliente-nota-credito.tsx:93-95`
   recibe esa cadena y usa exactamente:

   ```text
   new Date(dString.includes('T') ? dString : `${dString}T12:00:00`)
   ```

   `date-fns.format(..., "dd/MM/yyyy")` bajo `America/Mexico_City` pinta
   `15/10/2026`.
5. La impresión sin cambios usa `projectTicketPrintDocument`, conserva la cadena
   `2026-10-16`, y la función real `formatDateOnlyMx` devuelve `16/10/2026`.

## Las cuatro representaciones exactas

| Paso | Representación observada |
| --- | --- |
| Base, SQL `::text` | `2026-10-16` |
| Endpoint target, JSON | `2026-10-16T00:00:00.000Z` |
| Componente montado, `America/Mexico_City` | `15/10/2026` |
| Impresión sin cambios | `16/10/2026` |

La `T` y la `Z` nacen en la coerción `zod.coerce.date()` del
`GetClienteNotaCreditoResponse`; `res.json` serializa el `Date` como medianoche
UTC. La pantalla y la impresión parten del mismo origen lógico: el endpoint lee
`movimientos_credito.fecha_vencimiento`, la consulta real demuestra que coincide
con `tickets.fecha_vencimiento`, y la proyección de impresión copia
`ticket.fechaVencimiento`.

## Límites verdaderos

No hubo sesión disponible. Las sondas HTTP sin sesión para detalle e impresión
devolvieron HTTP 401 (`{"error":"Debes iniciar sesión."}`). No se creó,
autenticó ni renovó sesión. Por ello no se presenta una observación HTTP
autenticada ni una aprobación de navegador; la evidencia anterior es la
reproducción aislada de los valores reales con el schema, funciones y fuente
montada de producción.