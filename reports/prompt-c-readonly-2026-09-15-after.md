# Prompt C — evidencia financiera READONLY

- Estado: **PASS** para la lectura ejecutada.
- Comando exacto: `pnpm --filter @workspace/api-server exec tsx ../../.local/operations/prompt-c-readonly.ts --after`.
- Escrituras, migraciones, login, secretos, sesión de usuario y ejecutores operativos: **0**.
- Evidencia JSON completa: `reports/prompt-c-readonly-2026-09-15-after.json`.
- Las cifras son el snapshot «AFTER» posterior a los cambios de frontend y se comparan contra el JSON «BEFORE» inmutable.

## Identidad de ventas

En cada alcance se afirmó **Ventas = Contado + Ventas a crédito** usando los resultados reales de `getSalesSummary`, `getRealtimeStores` y `getDestinationAccounts`. Los abonos no se sumaron a Ventas.

### Cruces

- Filtro aplicado: `2026-09-15` a `2026-09-15` (America/Mexico_City).
- Ubicación: id 2 (Cruces).
- Tarjetas baseline: Ventas **$37772.00** (2), Contado cobrado **$0.00** (0), Ventas a crédito **$37772.00** (2), Utilidad **$6880.00**.
- Detalle canónico: 2 movimientos, **$25000.00**, pageSize=2, 1 página(s).
- source5 net total (POS, ABONO, REVERSO_ABONO, ABONO_SALDO_FAVOR, REVERSO_ABONO_SALDO_FAVOR): **$25000.00**; CREDITO fue excluido.

### Global

- Filtro aplicado: `2026-09-15` a `2026-09-15` (America/Mexico_City).
- Ubicación: global.
- Tarjetas baseline: Ventas **$37772.00** (2), Contado cobrado **$0.00** (0), Ventas a crédito **$37772.00** (2), Utilidad **$6880.00**.
- Detalle canónico: 4 movimientos, **$0.00**, pageSize=2, 2 página(s).
- source5 net total (POS, ABONO, REVERSO_ABONO, ABONO_SALDO_FAVOR, REVERSO_ABONO_SALDO_FAVOR): **$0.00**; CREDITO fue excluido.

## Corte de caja — hallazgo documentado, no ejecutado

La lectura del código deja el camino exacto en `artifacts/api-server/src/lib/pos.ts`: `listarSesionesCajaHistorial` comienza en la línea 2101 y calcula `efectivoEsperadoCents` en las líneas 2144–2145; `buildCorteCaja` comienza en la línea 2161. Ambos derivan pagos desde `ticket_pagos`; el efectivo esperado es fondo inicial + pagos EFECTIVO de tickets − salidas de efectivo. No se llamó `buildCorteCaja`, `cuadrarCaja` ni ningún ejecutor porque pueden participar en un flujo operativo mutador. `movimientos_credito`/ABONO no entra en ese cálculo.

El dato histórico del 15/09 se describe con cautela: los $25,000 observados corresponden a las recapturas 49–50 y a los reversos 47–48; fueron operaciones de recaptura/reclasificación de fechas, no nuevo ingreso físico. Este reporte no afirma que el cajón haya recibido $25,000 nuevos ni un sobrante real a partir de una consulta aislada. La omisión del camino de corte queda como gap de alta prioridad antes del piloto y no se corrige aquí.

## Preservación histórica

Se consultaron en la misma transacción READ ONLY las filas 43–50 completas mediante huella MD5 y el conteo/huella del veto `preventImplicitFavor`; el snapshot antes y después de los read models coincide. No se guardaron nombres de clientes, nombres de usuarios, contactos ni filas de detalle con PII.

## Assertions y gaps abiertos

Las assertions ejecutaron las funciones reales y quedaron registradas así:

PASS: todas las assertions ejecutadas en este informe pasaron; fallos registrados: 0.

No se observó una discrepancia de conteo/importe entre el agregado de Cuentas Destino y el detalle canónico en estos alcances.

## AFTER comparison against immutable BEFORE JSON

- Baseline JSON: `reports/prompt-c-readonly-2026-09-15.json` (SHA-256 `1d4cf49d0abed12e80887512112da73c4cea5dbd7936c36ee8f9b8de957a6a58`).
- Only numeric destination leaves and card/source-group values are compared; timing metadata is excluded.
- A changed value is evidence only; this validator does not fix data.

### Cruces — every numeric destination leaf

| Numeric leaf | BEFORE | AFTER | Changed |
|---|---:|---:|:---:|
| `cobrosAnteriores[0].importe` | 25000.00 | 25000.00 | no |
| `encabezado.cobrado.abonos` | 25000.00 | 25000.00 | no |
| `encabezado.cobrado.contado` | 0.00 | 0.00 | no |
| `encabezado.cobrado.saldosFavor` | 0.00 | 0.00 | no |
| `encabezado.cobrado.total` | 25000.00 | 25000.00 | no |
| `encabezado.porCobrar.periodo` | 37772.00 | 37772.00 | no |
| `encabezado.vendido.contado` | 0.00 | 0.00 | no |
| `encabezado.vendido.credito` | 37772.00 | 37772.00 | no |
| `encabezado.vendido.total` | 37772.00 | 37772.00 | no |
| `facturacion.facturadoEfectivo` | 0.00 | 0.00 | no |
| `facturacion.facturadoTotal` | 0.00 | 0.00 | no |
| `facturacion.facturadoTransferencia` | 0.00 | 0.00 | no |
| `facturacion.noFacturadoEfectivo` | 0.00 | 0.00 | no |
| `facturacion.noFacturadoTotal` | 37772.00 | 37772.00 | no |
| `facturacion.noFacturadoTransferencia` | 0.00 | 0.00 | no |
| `incongruencias.conteo` | 0 | 0 | no |
| `incongruencias.importe` | 0.00 | 0.00 | no |
| `ivaCobrado` | 0.00 | 0.00 | no |
| `ivaFacturado.base` | 0.00 | 0.00 | no |
| `ivaFacturado.iva` | 0.00 | 0.00 | no |
| `matriz.filas[0].efectivo.importe` | 0.00 | 0.00 | no |
| `matriz.filas[0].otras.importe` | 0.00 | 0.00 | no |
| `matriz.filas[0].porCobrar.importe` | 0.00 | 0.00 | no |
| `matriz.filas[0].total` | 0.00 | 0.00 | no |
| `matriz.filas[0].transferencia.importe` | 0.00 | 0.00 | no |
| `matriz.filas[1].efectivo.importe` | 0.00 | 0.00 | no |
| `matriz.filas[1].otras.importe` | 0.00 | 0.00 | no |
| `matriz.filas[1].porCobrar.importe` | 37772.00 | 37772.00 | no |
| `matriz.filas[1].total` | 37772.00 | 37772.00 | no |
| `matriz.filas[1].transferencia.importe` | 0.00 | 0.00 | no |
| `matriz.filas[2].efectivo.importe` | 0.00 | 0.00 | no |
| `matriz.filas[2].otras.importe` | 0.00 | 0.00 | no |
| `matriz.filas[2].porCobrar.importe` | 37772.00 | 37772.00 | no |
| `matriz.filas[2].total` | 37772.00 | 37772.00 | no |
| `matriz.filas[2].transferencia.importe` | 0.00 | 0.00 | no |
| `porTienda[0].cajaFisica` | 25000.00 | 25000.00 | no |
| `porTienda[0].cobrado` | 25000.00 | 25000.00 | no |
| `porTienda[0].cuentaFiscal` | 0.00 | 0.00 | no |
| `porTienda[0].cuentaNoFiscal` | 0.00 | 0.00 | no |
| `porTienda[0].cuentasPorCobrar` | 37772.00 | 37772.00 | no |
| `porTienda[0].porCobrar` | 37772.00 | 37772.00 | no |
| `porTienda[0].total` | 25000.00 | 25000.00 | no |
| `porTienda[0].ubicacionId` | 2 | 2 | no |
| `porTienda[0].vendido` | 37772.00 | 37772.00 | no |
| `resumen[0].cajaFisicaFacturado` | 0.00 | 0.00 | no |
| `resumen[0].importe` | 25000.00 | 25000.00 | no |
| `resumen[0].operaciones` | 2 | 2 | no |
| `resumen[0].porcentaje` | 100.00 | 100.00 | no |
| `resumen[1].cajaFisicaFacturado` | 0.00 | 0.00 | no |
| `resumen[1].importe` | 0.00 | 0.00 | no |
| `resumen[1].operaciones` | 0 | 0 | no |
| `resumen[1].porcentaje` | 0.00 | 0.00 | no |
| `resumen[2].cajaFisicaFacturado` | 0.00 | 0.00 | no |
| `resumen[2].importe` | 0.00 | 0.00 | no |
| `resumen[2].operaciones` | 0 | 0 | no |
| `resumen[2].porcentaje` | 0.00 | 0.00 | no |
| `resumen[3].cajaFisicaFacturado` | 0.00 | 0.00 | no |
| `resumen[3].importe` | 0.00 | 0.00 | no |
| `resumen[3].operaciones` | 0 | 0 | no |
| `resumen[3].porcentaje` | 0.00 | 0.00 | no |
| `tendencia[0].importe` | 37772.00 | 37772.00 | no |
| `totalCobrado` | 25000.00 | 25000.00 | no |

Destination numeric leaves: 62; changed: 0.

### Cruces — four existing dashboard cards

| Card accessor | BEFORE | AFTER | Changed |
|---|---:|---:|:---:|
| `ventasTotal` | 37772.00 | 37772.00 | no |
| `contadoCobrado` | 0.00 | 0.00 | no |
| `ventasCredito` | 37772.00 | 37772.00 | no |
| `utilidad` | 6880.00 | 6880.00 | no |

All numeric dashboard-card leaves: 8; changed: 0.

### Cruces — canonical source groups row by row

| Header accessor | Source rows | BEFORE net | AFTER net | Changed |
|---|---|---:|---:|:---:|
| `encabezado.cobrado.contado` | BEFORE POS: 0 / 0.00<br>AFTER POS: 0 / 0.00 | 0.00 | 0.00 | no |
| `encabezado.cobrado.abonos` | BEFORE ABONO: 2 / 25000.00<br>REVERSO_ABONO: 0 / 0.00<br>AFTER ABONO: 2 / 25000.00<br>REVERSO_ABONO: 0 / 0.00 | 25000.00 | 25000.00 | no |
| `encabezado.cobrado.saldosFavor` | BEFORE ABONO_SALDO_FAVOR: 0 / 0.00<br>REVERSO_ABONO_SALDO_FAVOR: 0 / 0.00<br>AFTER ABONO_SALDO_FAVOR: 0 / 0.00<br>REVERSO_ABONO_SALDO_FAVOR: 0 / 0.00 | 0.00 | 0.00 | no |

### Global — every numeric destination leaf

| Numeric leaf | BEFORE | AFTER | Changed |
|---|---:|---:|:---:|
| `cobrosAnteriores[0].importe` | 25000.00 | 25000.00 | no |
| `cobrosAnteriores[1].importe` | -25000.00 | -25000.00 | no |
| `encabezado.cobrado.abonos` | 25000.00 | 25000.00 | no |
| `encabezado.cobrado.contado` | 0.00 | 0.00 | no |
| `encabezado.cobrado.saldosFavor` | -25000.00 | -25000.00 | no |
| `encabezado.cobrado.total` | 0.00 | 0.00 | no |
| `encabezado.porCobrar.periodo` | 37772.00 | 37772.00 | no |
| `encabezado.vendido.contado` | 0.00 | 0.00 | no |
| `encabezado.vendido.credito` | 37772.00 | 37772.00 | no |
| `encabezado.vendido.total` | 37772.00 | 37772.00 | no |
| `facturacion.facturadoEfectivo` | 0.00 | 0.00 | no |
| `facturacion.facturadoTotal` | 0.00 | 0.00 | no |
| `facturacion.facturadoTransferencia` | 0.00 | 0.00 | no |
| `facturacion.noFacturadoEfectivo` | 0.00 | 0.00 | no |
| `facturacion.noFacturadoTotal` | 37772.00 | 37772.00 | no |
| `facturacion.noFacturadoTransferencia` | 0.00 | 0.00 | no |
| `incongruencias.conteo` | 0 | 0 | no |
| `incongruencias.importe` | 0.00 | 0.00 | no |
| `ivaCobrado` | 0.00 | 0.00 | no |
| `ivaFacturado.base` | 0.00 | 0.00 | no |
| `ivaFacturado.iva` | 0.00 | 0.00 | no |
| `matriz.filas[0].efectivo.importe` | 0.00 | 0.00 | no |
| `matriz.filas[0].otras.importe` | 0.00 | 0.00 | no |
| `matriz.filas[0].porCobrar.importe` | 0.00 | 0.00 | no |
| `matriz.filas[0].total` | 0.00 | 0.00 | no |
| `matriz.filas[0].transferencia.importe` | 0.00 | 0.00 | no |
| `matriz.filas[1].efectivo.importe` | 0.00 | 0.00 | no |
| `matriz.filas[1].otras.importe` | 0.00 | 0.00 | no |
| `matriz.filas[1].porCobrar.importe` | 37772.00 | 37772.00 | no |
| `matriz.filas[1].total` | 37772.00 | 37772.00 | no |
| `matriz.filas[1].transferencia.importe` | 0.00 | 0.00 | no |
| `matriz.filas[2].efectivo.importe` | 0.00 | 0.00 | no |
| `matriz.filas[2].otras.importe` | 0.00 | 0.00 | no |
| `matriz.filas[2].porCobrar.importe` | 37772.00 | 37772.00 | no |
| `matriz.filas[2].total` | 37772.00 | 37772.00 | no |
| `matriz.filas[2].transferencia.importe` | 0.00 | 0.00 | no |
| `porTienda[0].cajaFisica` | 25000.00 | 25000.00 | no |
| `porTienda[0].cobrado` | 25000.00 | 25000.00 | no |
| `porTienda[0].cuentaFiscal` | 0.00 | 0.00 | no |
| `porTienda[0].cuentaNoFiscal` | 0.00 | 0.00 | no |
| `porTienda[0].cuentasPorCobrar` | 37772.00 | 37772.00 | no |
| `porTienda[0].porCobrar` | 37772.00 | 37772.00 | no |
| `porTienda[0].total` | 25000.00 | 25000.00 | no |
| `porTienda[0].ubicacionId` | 2 | 2 | no |
| `porTienda[0].vendido` | 37772.00 | 37772.00 | no |
| `resumen[0].cajaFisicaFacturado` | 0.00 | 0.00 | no |
| `resumen[0].importe` | 0.00 | 0.00 | no |
| `resumen[0].operaciones` | 4 | 4 | no |
| `resumen[0].porcentaje` | 0.00 | 0.00 | no |
| `resumen[1].cajaFisicaFacturado` | 0.00 | 0.00 | no |
| `resumen[1].importe` | 0.00 | 0.00 | no |
| `resumen[1].operaciones` | 0 | 0 | no |
| `resumen[1].porcentaje` | 0.00 | 0.00 | no |
| `resumen[2].cajaFisicaFacturado` | 0.00 | 0.00 | no |
| `resumen[2].importe` | 0.00 | 0.00 | no |
| `resumen[2].operaciones` | 0 | 0 | no |
| `resumen[2].porcentaje` | 0.00 | 0.00 | no |
| `resumen[3].cajaFisicaFacturado` | 0.00 | 0.00 | no |
| `resumen[3].importe` | 0.00 | 0.00 | no |
| `resumen[3].operaciones` | 0 | 0 | no |
| `resumen[3].porcentaje` | 0.00 | 0.00 | no |
| `tendencia[0].importe` | 37772.00 | 37772.00 | no |
| `totalCobrado` | 0.00 | 0.00 | no |

Destination numeric leaves: 63; changed: 0.

### Global — four existing dashboard cards

| Card accessor | BEFORE | AFTER | Changed |
|---|---:|---:|:---:|
| `ventasTotal` | 37772.00 | 37772.00 | no |
| `contadoCobrado` | 0.00 | 0.00 | no |
| `ventasCredito` | 37772.00 | 37772.00 | no |
| `utilidad` | 6880.00 | 6880.00 | no |

All numeric dashboard-card leaves: 8; changed: 0.

### Global — canonical source groups row by row

| Header accessor | Source rows | BEFORE net | AFTER net | Changed |
|---|---|---:|---:|:---:|
| `encabezado.cobrado.contado` | BEFORE POS: 0 / 0.00<br>AFTER POS: 0 / 0.00 | 0.00 | 0.00 | no |
| `encabezado.cobrado.abonos` | BEFORE ABONO: 2 / 25000.00<br>REVERSO_ABONO: 0 / 0.00<br>AFTER ABONO: 2 / 25000.00<br>REVERSO_ABONO: 0 / 0.00 | 25000.00 | 25000.00 | no |
| `encabezado.cobrado.saldosFavor` | BEFORE ABONO_SALDO_FAVOR: 0 / 0.00<br>REVERSO_ABONO_SALDO_FAVOR: 2 / -25000.00<br>AFTER ABONO_SALDO_FAVOR: 0 / 0.00<br>REVERSO_ABONO_SALDO_FAVOR: 2 / -25000.00 | -25000.00 | -25000.00 | no |

### Protected movement hashes and veto

| Movement | BEFORE filaHash | AFTER filaHash | Changed |
|---:|---|---|:---:|
| 43 | `09e77d4626a029d0410bba1f03ed4d1b` | `09e77d4626a029d0410bba1f03ed4d1b` | no |
| 44 | `2a3bf8d23e04ba661aede2d784945029` | `2a3bf8d23e04ba661aede2d784945029` | no |
| 45 | `c7c2503c0b7824268a1a8361bce97088` | `c7c2503c0b7824268a1a8361bce97088` | no |
| 46 | `8fc6f6833a4072709a16cd32fa175fdd` | `8fc6f6833a4072709a16cd32fa175fdd` | no |
| 47 | `0d6555ee54a78c2f6b78c4de74956c8a` | `0d6555ee54a78c2f6b78c4de74956c8a` | no |
| 48 | `f3aececb8780969794aa3a1ffc89f169` | `f3aececb8780969794aa3a1ffc89f169` | no |
| 49 | `22b2a5685bad227978fa3e616964e305` | `22b2a5685bad227978fa3e616964e305` | no |
| 50 | `87dcbd8c128834acffd793b6d62c0dcd` | `87dcbd8c128834acffd793b6d62c0dcd` | no |

| Veto preventImplicitFavor | BEFORE count 2; hash `3abefa7a166da384b8c27c39fe74e5f7` | AFTER count 2; hash `3abefa7a166da384b8c27c39fe74e5f7` | no |

### Frontend shared-reader contract

- Same generated endpoint through `useSharedCuentasDestino`: **PASS**.
- Main contract test: `pnpm --filter @workspace/mariana-textil exec tsx --test src/caja-cobranza.contract.test.ts` — **PASS**.
- The realtime card accessor and Cuentas Destino reader both expose POS, ABONO, and ABONO_SALDO_FAVOR source groups; pure source inspection and the main contract test cover this identity.
