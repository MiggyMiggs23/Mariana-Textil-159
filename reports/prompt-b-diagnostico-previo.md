# Prompt B — diagnóstico antes de corregir los cuatro errores

Fecha: 2026-09-15 (Ciudad de México).

Bloques 1 y 2 ejecutados antes de tocar los cuatro errores. El comando original terminó con código 1 e inició API, frontend y scripts, pero sólo recogió los diagnósticos de API. El nuevo comando terminó con código 1 después de recoger los tres paquetes: **cuatro diagnósticos únicos, seis emisiones**, porque scripts importa código de API. El build real con los errores todavía presentes terminó con código 1 sin entrar en la compilación recursiva.

## Inventario completo antes de corregir

| Paquete propietario | Archivo | Línea:columna | Código | Mensaje |
|---|---|---|---|---|
| `@workspace/api-server` | `artifacts/api-server/src/lib/pos.ts` | 445:41 | TS2339 | Property 'toISOString' does not exist on type 'never'. |
| `@workspace/api-server` | `artifacts/api-server/src/routes/clientes.ts` | 1380:10 | TS1117 | An object literal cannot have multiple properties with the same name. |
| `@workspace/mariana-textil` | `artifacts/mariana-textil/src/pages/alertas.tsx` | 241:58 | TS2339 | Property 'pendiente' does not exist on type 'AdminAlertaCredito'. |
| `@workspace/mariana-textil` | `artifacts/mariana-textil/src/pages/alertas.tsx` | 260:54 | TS2339 | Property 'pendiente' does not exist on type 'AdminAlertaCredito'. |

`@workspace/scripts` también emite los dos diagnósticos de API. No se hallaron errores adicionales en las seis bibliotecas referenciadas.

## POS: rama muerta, no dato de DB mal tipado

- `deriveTicketCreditData` normaliza la fecha de la venta de crédito a texto calendario. Tanto su resultado como el fallback del ticket son `string | null`.
- Drizzle 0.45.2 usa `PgDateString` por defecto cuando se omite `mode`; sólo `{ mode: "date" }` selecciona `PgDate`. La sesión node-postgres de Drizzle utiliza un parser identidad para DATE/OID 1082. No se debe confundir con el parser de `pool.query` directo.
- Tras comprobar null, el tipo es string; el else de `typeof ... === "string"` es imposible. Eliminar únicamente esa bifurcación muerta mantiene el valor que se enviaba a `deriveEstadoNota`.
- **Cambio visible previsto:** ninguno. No cambiar schema, tipos de origen, contrato, calendario ni generación del vencimiento.

### Discrepancia de un día: relacionada con la presentación del mismo campo, no causada por esa rama

La impresión recibe texto calendario y utiliza `formatDateOnlyMx`, que conserva sus componentes. La tarjeta de crédito obtiene el otro endpoint (`GetClienteNotaCreditoResponse.parse`), cuyo esquema generado convierte el texto a Date; JSON serializa medianoche UTC y la tarjeta formatea ese instante en zona local.

Reproducción pura con `TZ=America/Mexico_City`: `2026-10-02` → JSON `2026-10-02T00:00:00.000Z` → tarjeta `01/10/2026`; impresión `02/10/2026`. No se consultó DB ni se modificó ese flujo. Queda pendiente para otra entrega.

## Excel: definición sobrescrita

La columna se llama «Saldo pendiente». La variable se deriva del saldo vigente proyectado del cargo en centavos, convertido a texto monetario mediante `centsToMoney`, o null si no aplica.

El objeto tenía primero `saldoPendiente` y después `saldoPendiente: saldoPendiente == null ? null : toExcelNumber(saldoPendiente)`. La última definición gana en JavaScript y entrega la celda numérica correcta. La primera, que habría entregado texto, está sobrescrita: **se elimina la primera y se conserva la última**.

No son cálculos económicos distintos, pero tampoco tienen el mismo tipo: para `123.45`, la primera sería texto `"123.45"` y la segunda número `123.45`; null permanece null. El objeto efectivo antes y después conserva exactamente la segunda.

**Cambio visible / contenido de Excel previsto:** ninguno. No se modificará el cálculo de saldo.

## Alertas: dos consumos del nombre equivocado

El contrato y el productor entregan `importe`, calculado desde `charge.pendienteCents / 100`: es el saldo vigente, no el importe original.

1. Línea 241: `saldoPendiente={credito.pendiente}` pasa undefined. El badge actual no utiliza esa propiedad para presentar estado. Cambiar a `credito.importe` alinea el contrato, **sin cambio visible del badge**.
2. Línea 260: `formatNumber(credito.pendiente, ...)` recibe undefined y devuelve el marcador «—». Cambiar a `credito.importe` **sí restaura el importe visible**. No cambia el cálculo, estado ni selección de alertas.

No se añadirán alias, campos nuevos, casts permisivos ni supresiones de errores.