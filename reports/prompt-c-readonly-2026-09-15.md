# Prompt C — evidencia financiera READONLY

- Estado: **PASS** para la lectura ejecutada.
- Comando exacto: `pnpm --filter @workspace/api-server exec tsx ../../.local/operations/prompt-c-readonly.ts`.
- Escrituras, migraciones, login, secretos, sesión de usuario y ejecutores operativos: **0**.
- Evidencia JSON completa: `reports/prompt-c-readonly-2026-09-15.json`.
- Las cifras son un baseline «BEFORE» de los cambios de frontend; no se afirma una ejecución posterior.

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

PASS: todas las assertions ejecutadas en este informe pasaron; fallos registrados: 0. Esto no significa que no hubiera assertions.

No se observó una discrepancia de conteo/importe entre el agregado de Cuentas Destino y el detalle canónico en estos alcances.
