# Trazabilidad A + B — Bloque 0

Fecha: 2026-09-15. Las lecturas y los fragmentos siguientes se comunicaron en el chat **antes de comenzar las ediciones**. El usuario autorizó A+B y precisar la regla documental, no pantallas ni rutas nuevas de C.

## Identidad del historial

Productor en `artifacts/api-server/src/lib/inventario.ts`:

```ts
documentoTipo: "ENTRADA",
documentoId: String(entrada!.id),
```

Productor en `artifacts/api-server/src/lib/pos.ts`:

```ts
documentoId: String(ticket!.id),
```

Resolver existente en `artifacts/api-server/src/lib/kardex-document.ts`, `resolveDocument`:

```ts
const ticketId = Number(reference.id);
const folio = ticketMap.get(ticketId);
if (folio == null) return { label: null, route: null };
return {
  label: `${reference.tipo === "NOTA" ? "Nota" : "Ticket"} ${folio}`,
  route: `/tickets/${ticketId}`,
};
```

**Conclusión limitada:** los productores revisados guardan IDs; el historial de rollo solo exponía la referencia persistida, sin ruta resuelta. No se consultaron registros históricos de DB para declarar que todos usan esa semántica.

**Ajuste comunicado:** A1 requiere enriquecimiento de contrato/productor además del enlace. Se reutiliza el resolver, sin inferir desde folios. Un hallazgo posterior en la carga de mapas detectó un fallback legado de Entrada por ID **o** folio; se comunicó antes de darlo por válido y se solicitó retirarlo de la resolución afectada, utilizando la relación estable rollo → entrada.

## Líneas del ticket

Respuesta de `artifacts/api-server/src/lib/pos.ts`:

```ts
id: linea.id,
ticketId: linea.ticketId,
rolloId: linea.rolloId,
serieRollo: linea.serie ?? null,
```

OpenAPI:

```yaml
rolloId: { type: ["number", "null"] }
serieRollo: { type: ["string", "null"] }
```

A3 es frontend: enlazar solo con `rolloId`, no ampliar ni duplicar ese campo.

## ResponsiveTable

En `artifacts/mariana-textil/src/components/client-responsive-table.tsx`:

```tsx
headers[index] === "Folio" && row.ticketId != null
```

```tsx
<Link href={`/tickets/${row.ticketId}`}>
  {cell}
</Link>
```

```ts
const supportsAccountMovementHighlight =
  headers.includes("Pago") && headers.includes("Saldo");
```

El resaltado compara `row.id` con el `movimientoId` del query; no resuelve documentos ni genera rutas por nombre de columna aproximado. No se cambia globalmente este componente.

## Otras diferencias con el inventario recibido

- Movimientos ya tenía algunos enlaces por `ticketId`; faltaba consumir la ruta resuelta en otras referencias. No se duplican los existentes.
- `AdminAlertaCredito` carecía de `ticketId`: B1 sí requiere contrato y productores.
- Los destinos individuales de crédito, ajuste, corte, evento o discrepancia no se crean. Los enlaces a rollo/producto/ticket ya existentes no equivalen a construir esos detalles.
- No se convierte la falta de enlace en permiso nuevo: los destinos conservan sus controles de acceso.