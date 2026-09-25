# Snapshot: safe E7 frontend source versus working HEAD

Read-only comparison made during preparation on 2026-09-25 while other agents were editing HEAD. `M` means different contents; `H` means present only in HEAD. These are **observations, not permissions to ship**. The safe source is `.local/e7-text-baseline`; the active frontend `dist-clientes-lista-20260925` was built from that isolated tree with the approved customer list edits. Subsequent concurrent changes may alter this list; recompare before approval.

## `artifacts/mariana-textil/src/`

| Status | Relative file |
|---|---|
| H | `components/client-directory.test.tsx` |
| M | `components/client-directory.tsx` |
| H | `components/commercial-return-dialog.tsx` |
| H | `components/commercial-return.render.test.ts` |
| H | `components/credit-site-scope.tsx` |
| M | `components/e7-readers.tsx` |
| M | `components/notification-audio-controller.contract.test.ts` |
| H | `components/notification-audio-controller.mounted.test.tsx` |
| H | `components/test-system-reset.test.tsx` |
| M | `lib/clientes-api.contract.test.ts` |
| M | `lib/clientes-api.ts` |
| H | `lib/commercial-return.ts` |
| H | `pages/auditorias-inventario-site.test.tsx` |
| M | `pages/auditorias-inventario.test.tsx` |
| M | `pages/caja/cuentas-destino.tsx` |
| M | `pages/caja/tiempo-real.tsx` |
| M | `pages/cliente-detail.tsx` |
| M | `pages/cliente-movimiento-detail.tsx` |
| M | `pages/clientes.tsx` |
| M | `pages/proveedores.tsx` |
| M | `pages/reportes.tsx` |
| M | `pages/ticket-detail.tsx` |

`artifacts/mariana-textil/public/sounds/README.md` is H (non-source documentation). At snapshot time the other frontend source files matched the safe baseline; no differences were observed under the source directories of `lib/metered-pricing`, `lib/number-format` or `lib/scanned-code`.

## Generated clients / schemas (not safe to copy wholesale from HEAD)

- `lib/api-client-react/src/generated/api.ts`, `api.schemas.ts`: M.
- `lib/api-zod/src/generated/api.ts`, `lib/api-zod/src/index.ts`, and `generated/types/index.ts`: M.
- `lib/api-zod/src/generated/types/`: M for `adminCuentaDestinoMovimientoFuente.ts`, `adminCuentasDestinoEncabezadoCobrado.ts`, `clientePagoDetalle.ts`, `clientePagoDetalleTipo.ts`, `listAdminCuentaDestinoMovimientosFuenteItem.ts`.
- H for `clientePagoDetalleDevolucionComercial.ts`, `createCommercialReturn201.ts`, `createCommercialReturnBody.ts`, `createCommercialReturnBodyRevision.ts`, `listClientesListado200.ts`, `listClientesListado200ItemsItem.ts`, `listClientesListadoActive.ts`, `listClientesListadoDirection.ts`, `listClientesListadoParams.ts`, `listClientesListadoPeriod.ts`, `listClientesListadoSort.ts`, `listProveedoresDirectorioParams.ts`, `listProveedoresDirectorioPeriod.ts`, `previewCommercialReturn200.ts`, `previewCommercialReturnBody.ts`, `proveedoresDirectorioResult.ts`, `proveedoresDirectorioResultItemsItem.ts`, `proveedoresDirectorioResultPeriod.ts`, `testResetInput.ts`, `testResetInputConfirmation.ts`, `testResetResult.ts`, `testResetStatus.ts`.

The generated files intermingle already-active, new directory, test-reset, and unreleased commercial-return contracts. Approve only exact isolated additions against retained sources. The build script independently checks parent hashes, baseline hashes and the authorized file/byte hashes; this observation list never supplies an allowlist.