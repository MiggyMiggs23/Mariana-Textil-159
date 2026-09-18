# E2 / apertura limitada E3 — preparación sin activación

## Resultado

Se preparó el backend para una apertura posterior y puntual de ingresos físicos de
crédito. La entrega **no activa** capturas:

- `CREDIT_CASH_INCOME_CAPTURE_ENABLED = false`
- `CREDIT_CASH_RETURN_CAPTURE_ENABLED = false`
- `CREDIT_PENDING_RECEIPTS_ENABLED = false`
- `CREDIT_HISTORICAL_ATTRIBUTION_ENABLED = false` (lector existente, sin cambios)
- `CREDIT_REFUNDS_ENABLED = false` (preparación E2 existente, sin activación)

No existe un booleano global que abra a la vez ingresos y devoluciones. Los
valores no se leen de variables de entorno, cuerpos HTTP ni sesiones.

## Contrato preparado

La futura apertura de ingreso en efectivo sólo admite la tupla:

1. naturaleza `INGRESO_FISICO`;
2. medio `EFECTIVO`;
3. productor `ABONO_ORDINARIO` o `ABONO_DIRIGIDO`;
4. movimiento `ABONO`.

El flujo ordinario comprueba la guarda antes de abrir una transacción, reclamar
la UUID o adquirir locks. El adaptador común vuelve a comprobarla antes de
insertar. El pago dirigido declara explícitamente productor y tipo.

La validación vigente de contexto conserva actor actual, TIENDA activa, sesión
`ABIERTA`, `cerradaAt = null` y correspondencia exacta entre sesión y sitio. Se
conservan el `FOR SHARE` de identidad/sitio/sesión, el advisory lock de crédito y
el row lock del cliente.

Las devoluciones sólo reconocen `REVERSO_ABONO` + `REVERSO` y continúan
bloqueadas por su permiso independiente y por la guarda E2. Los cobros retenidos
siguen bloqueados por su propia guarda y además no satisfacen el productor ABONO.
La atribución histórica continúa inactiva.

El rollback de una futura activación consiste en volver el permiso de ingreso a
`false`: bloquea capturas nuevas, no elimina movimientos legítimos y no participa
en rutas de lectura. No se modificó `credit-evidence-read.ts`; el efectivo
esperado de abonos previamente aceptados continúa leyéndose.

## Parche de activación posterior — no aplicado

El archivo `activacion-income-no-aplicada.patch` contiene el cambio exacto y
único propuesto:

```diff
-export const CREDIT_CASH_INCOME_CAPTURE_ENABLED = false;
+export const CREDIT_CASH_INCOME_CAPTURE_ENABLED = true;
 export const CREDIT_CASH_RETURN_CAPTURE_ENABLED = false;
```

Aplicarlo requerirá autorización posterior, revisión del corte real en curso y
el protocolo operativo correspondiente. No abre devolución, retenidos ni
atribución.

## Gap de interfaz

La interfaz servida conserva su guarda de efectivo anterior y no se modificó por
la prohibición expresa de frontend/HMR. Por ello esta preparación backend no
constituye una captura E3 operable desde la UI actual. Si se autoriza la
activación, hará falta un parche frontend **offline y separado** que exponga
solamente ABONO + INGRESO_FISICO + EFECTIVO, capture una sesión abierta del sitio
correcto y mantenga devolución/retención/atribución cerradas. Ese parche no forma
parte de esta entrega.

## Protocolo y límites observados

- Base de comparación documental: commit
  `1ad2cad601a667c586e084accbf52b3ca3b7cef7`; el árbol ya contenía trabajo
  concurrente no atribuible a esta preparación.
- Línea base histórica E2: 149 pruebas, 144 pasan y cinco fallos conocidos,
  según `reports/e2/preparacion-y-limites.md`; no se volvió a ejecutar.
- Pruebas objetivo offline finales: **67/67 pasan**, cero fallos. Incluyen flags
  separados, productor/tipo exactos, ausencia de devoluciones en efectivo,
  caja/sitio, retenidos cerrados, rollback `true -> false`, lector preservado y
  mutantes aislados de fuente.
- Una primera ejecución objetivo obtuvo 66/67 por una expectativa textual
  femenina/masculina; se corrigió el texto sin cambiar la política y la
  reconfirmación final fue 67/67.
- `pnpm run typecheck` del paquete alcanzó los archivos modificados pero terminó
  con un único diagnóstico preexistente/concurrente en
  `src/lib/limited-startup-preflight.test.ts:191` (`TS2345`), fuera de este
  ownership. No se atribuye una línea base verde.
- Las pruebas establecen URLs de base deliberadamente inalcanzables o interceptan
  imports/conexiones; no consultaron ni escribieron PostgreSQL, secretos,
  usuarios o sesiones.
- No se ejecutaron build, dist, start/restart, inicializadores, DDL, migraciones,
  consultas de base ni escrituras operativas.
- No se editaron frontend, OpenAPI, codegen, `index.ts`, startup ni el archivo
  principal de Replit.

## Archivos de esta preparación

- `artifacts/api-server/src/lib/credit-evidence-contract.ts`
- `artifacts/api-server/src/lib/credit-evidence.ts`
- `artifacts/api-server/src/routes/clientes.ts`
- `artifacts/api-server/src/routes/pagos-dirigidos.ts`
- `artifacts/api-server/src/lib/credit-refund.ts`
- `artifacts/api-server/src/lib/credit-evidence-contract.test.ts`
- `artifacts/api-server/src/lib/credit-evidence.mock.test.ts`
- `artifacts/api-server/src/lib/credit-refund.safe.test.ts`
- `artifacts/api-server/src/lib/credit-refund.mock.test.ts`
- `artifacts/api-server/src/routes/e1-customer-mutations.offline.test.ts`
- `scripts/src/e1-core-mutant-harness.mjs`
- `reports/e2-apertura-limitada/aplicacion.md`
- `reports/e2-apertura-limitada/activacion-income-no-aplicada.patch`

## Revisión recomendada

1. Confirmar que ambos permisos productivos permanecen en `false`.
2. Revisar que el parche no aplicado cambia sólo `income` a `true`.
3. Reconfirmar 67 pruebas offline y resolver/aislar el diagnóstico concurrente
   antes de declarar typecheck canónico verde.
4. Revisar el parche frontend offline aún no creado.
5. Coordinar una activación posterior con quien posee index/startup y con el
   operador del corte real; esta entrega no autoriza reinicio ni aceptación
   operativa.