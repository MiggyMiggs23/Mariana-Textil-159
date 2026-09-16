# Visual Preview Evidence

This artifact validates the visual rendering of the requested changes for Prompt J layout restructuring without altering any main application components or triggering unapproved live changes.

## Execution Summary

- Generated mock data UI previews for `Propuesta Caja` and `Propuesta Cuentas`.
- **Caja**: 
  - Restructured to display 4 main cards, 4 operational cards, Store Status, followed by Comparative Table and Latest Documents in a 2/3 & 1/3 grid.
  - "Cobrado en el periodo" (95,000) added precisely under "Latest Documents" lacking decorative bounds as mandated, with the exact required subordinate linked elements ('Cobros directos', 'Abonos a notas (neto de reversos)', 'Saldo a favor (neto de reversos)').
- **Cuentas**:
  - Restructured top section combining "Vendido" (main) and "Por cobrar" (compact) in a single row above the matrix.
  - Rebuilt Cobranza sub-section placing "Cobrado" first, identically mimicking the required breakdown labels.
  - Formulated a 3-part cash card row for "Total en efectivo", "Efectivo facturado", and the calculated "Efectivo sin factura" adhering strictly to identical visual weight and size.
  - Integer-cent calculation strictly verified in components with mutation proof guard ensuring exact partial sums.
  - "Cobros de periodos anteriores" renamed properly with exact requested subtitle.

## Fictional / Sandbox Disclaimer
All data, screenshots, and visual components rendered in this execution are completely fictional, offline, isolated in a visual preview environment, and do not interface with live authentications, production databases, or workflows. This provides purely visual evidence before any code is approved for the main source tree.

## Verified Workspace/API Data Audit

The visual screenshots above remain sandbox fixtures. A separate read-only audit of
the canonical analytics functions against the verified current workspace/API database is recorded
in `real-data-canonical-snapshot.json`, with the exact hook-shaped route objects in
`real-data-canonical-http-responses.json`. The audit used one repeatable-read snapshot
for both Caja en Tiempo Real and Cuentas Destino (`2026-09-16`, Mexico City time).
The current running API pool was separately probed read-only in-process; its safe
connection fingerprint and `heliumdb/public` schema identity match the query pool.
The running API process points to the internal `helium` target, not an external-Neon
URL, so no external-Neon claim is made.
The database currently contains catalog rows but zero tickets, ticket lines, cash
sessions, and transaction dates, so it truthfully produces an all-zero state. The
catalog-only long product and client labels in that JSON are explicitly not presented
as transaction drill-down results.

## Screenshots Extracted
- `actual-caja-escritorio.png` / `actual-caja-movil.png`
- `propuesta-caja-escritorio.png` / `propuesta-caja-movil.png`
- `actual-cuentas-escritorio.png` / `actual-cuentas-movil.png`
- `propuesta-cuentas-escritorio.png` / `propuesta-cuentas-movil.png`