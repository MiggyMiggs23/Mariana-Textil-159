# Tarea 3 — suite pagos-dirigidos

## Resultado

**BLOQUEADA; no se cierra la suite.**

La única suite actor que falta en la consolidación anterior sigue siendo
`artifacts/api-server/src/pagos-dirigidos.integration.test.ts`. El auditor
conserva correctamente `INCOMPLETE_OR_FAIL`, con 27 rutas probadas y el error
único `Missing route evidence: artifacts/api-server/src/pagos-dirigidos.integration.test.ts`
(`reports/actor-suites/tanda-c-final-audit.json`).

El estado operativo recibido para esta tarea abre solamente E3 ordinario:
Tanda B está instalada pero sus puertas operativas continúan OFF y dirigido
continúa OFF. No se abrió ninguna puerta, no se tocó DB real, no se arrancó una
aplicación y no se ejecutó la suite de integración.

## Puerta cerrada exacta

La captura física habilitada para E3 ordinario no habilita un pago dirigido:

- `artifacts/api-server/src/lib/credit-evidence-contract.ts:125-135` concede la
  excepción de ingreso físico únicamente cuando el productor es
  `ABONO_ORDINARIO`; `ABONO_DIRIGIDO` continúa sujeto a la puerta general de
  captura de efectivo cerrada.
- `artifacts/api-server/src/routes/pagos-dirigidos.ts:183-215` intenta persistir
  el pago de cliente como `ABONO_DIRIGIDO` y finalizar su evidencia física.
- La suite usa `EFECTIVO`/`CAJA_FISICA` en su pago dirigido principal
  (`pagos-dirigidos.integration.test.ts:244-252`). Por tanto, E3 ordinario ON no
  vuelve ensayable esa expectativa.

Además, aun después de una futura apertura autorizada, la fixture existente no
está lista para una corrida honesta contra el contrato E1 vigente:
`clientBody` omite `sitioOrigenId`, `naturaleza`, `operacionClave` y la sesión de
caja; la aprobación usa `{}`; y los pagos FIFO/reversos posteriores también
omiten evidencia E1. El diagnóstico previo ya conserva el fallo real: la
solicitud devuelve 400 antes de alcanzar la expectativa 409
(`reports/actor-suites/group2-static.json`, `policyBlockers.directedPayments`).
No se cambió a transferencia o corrección contable para eludir la puerta, ni se
debilitaron aserciones.

## Prueba pendiente exacta

Se requiere primero una decisión explícita del propietario que abra la captura
dirigida correspondiente, separada de E3 ordinario. Después, sin tocar el
contrato de negocio para fabricar verde:

1. adaptar únicamente la fixture de
   `artifacts/api-server/src/pagos-dirigidos.integration.test.ts` para aportar
   identidad E1 auténtica (`sitioOrigenId`, naturaleza, UUID de operación y,
   para efectivo físico, sesión de caja abierta del mismo sitio) en cada
   productor que hoy la omite;
2. conservar los casos y aserciones actuales, incluidos 400/409, no mutación del
   ledger pendiente, aprobación/rechazo, FIFO, reversos, notificaciones,
   proyección y reporte;
3. ejecutar por MAIN, en PostgreSQL 16 local desechable y destruido por el
   runner:

   ```sh
   env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 \
     node lib/db/src/run-isolated-tests.mjs \
     --actor-ids=artifacts/api-server/src/pagos-dirigidos.integration.test.ts
   ```

4. exigir salida nativa sin skips/fake pass y terminal con destrucción
   acreditada; después volver a consolidar esa evidencia con las 27 rutas ya
   calificadas mediante `reports/actor-suites/audit.mjs`.

Mientras dirigido siga OFF, ejecutar esa integración sólo repetiría un fallo de
política conocido y no demostraría la funcionalidad autorizada.

## Única pasada barata, pura y sin aplicación

Comando ejecutado:

```sh
pnpm --filter @workspace/api-server exec tsx --test \
  src/pagos-dirigidos.contract.test.ts \
  src/pagos-dirigidos-block1.contract.test.ts \
  src/lib/credit-evidence-contract.test.ts \
  src/lib/e3-collection.test.ts
```

Resultado: **exit 1; 39 pruebas, 37 PASS, 2 FAIL, 0 skipped**.

Los contratos puros de cola/revisión, E1 y E3 pasaron. Los dos fallos son
expectativas estáticas antiguas de `pagos-dirigidos-block1.contract.test.ts`
sobre una pestaña independiente `pagos-dirigidos` y su exportación desde
`reportes.tsx`; la pantalla actual compone otras pestañas y ya no contiene esos
tokens. No se alteró la suite para ponerla verde. Esta pasada no importó la
aplicación, no abrió servidor, no usó PostgreSQL y no escribió datos.

## Cambios y límites

- Único archivo agregado: este informe.
- Cero cambios a suites, producción, gates, aplicaciones, workflows o DB.
- Cero usuarios creados o usados; cero credenciales; cero skips.
- Sin commit: corresponde a MAIN.