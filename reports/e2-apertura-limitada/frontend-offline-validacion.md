# Candidato frontend de apertura limitada — NO APLICADO

## Estado

Este candidato se preparó y probó exclusivamente en copias bajo `/tmp`.
**Ningún parche frontend fue aplicado al árbol servido**, no se regeneró el
cliente API y no se modificaron librerías compartidas, build, dist, procesos ni
sesiones reales.

La UI actualmente servida conserva su guarda anterior. El primer corte real en
API antigua puede continuar sin que este trabajo cambie la aplicación.

## Artefactos

- `frontend-candidate-no-aplicado.patch`: prepara la UI y deja ambos permisos
  cliente en `false`.
- `activacion-frontend-income-no-aplicada.patch`: cambio posterior y único de
  `CREDIT_CASH_INCOME_CLIENT_ENABLED = false` a `true`.
- `reversion-frontend-income.patch`: inverso exacto de la activación frontend.
- `frontend-fingerprints.sha256`: preimágenes del árbol servido, postimágenes
  cerrada/activa y hashes de los tres parches.
- `frontend-tests/`: fuentes exactas de las pruebas montadas usadas en copias.
  Los marcadores `__CLOSED_APP_ROOT__` y `__ACTIVE_APP_ROOT__` representan las
  raíces temporales de esas copias.

Los parches de activación y reversión incluyen índices Git completos. La
postimagen del parche de reversión es exactamente la preimagen de activación
(`c941fb1617bbc73ef400325fedfe6dc1c838c3ee` como blob Git).

## Alcance funcional del candidato

1. Se reemplaza la guarda cliente global por permisos independientes:
   - `CREDIT_CASH_INCOME_CLIENT_ENABLED = false`
   - `CREDIT_CASH_RETURN_CLIENT_ENABLED = false`
2. La devolución mantiene además su guarda propia
   `CREDIT_REFUND_CLIENT_ENABLED = false`, sin cambios.
3. El valor por omisión sigue siendo **Transferencia**.
4. Efectivo sólo se ofrece con la combinación cliente autorizada y naturaleza
   explícita `INGRESO_FISICO`; `CORRECCION_CONTABLE` no funciona como atajo.
5. Se usa el hook generado existente `useObtenerSesionCajaActual`, con
   `ubicacionId` del sitio explícitamente seleccionado. No hay contrato nuevo.
6. Antes de habilitar la vista previa se exige sesión presente, `ABIERTA`,
   `cerradaAt === null` y del mismo sitio. Loading, error, ausencia o
   discordancia dejan efectivo bloqueado con mensaje explícito.
7. Antes del mutate se hace `refetch` y se repite la validación de sesión/sitio.
8. El payload efectivo mantiene `ABONO_ORDINARIO` o `ABONO_DIRIGIDO`, movimiento
   backend `ABONO`, `formaPago: EFECTIVO`, `cuentaDestino: CAJA_FISICA`,
   `naturaleza: INGRESO_FISICO`, sitio y sesión verificados. La sesión también
   forma parte del contexto que determina la UUID persistente del borrador.
9. Un lock por `ref` bloquea doble envío antes y durante la revalidación.
10. Transferencia no consulta ni requiere sesión de caja y conserva sus cuentas
    fiscales/no fiscales.

No se agregan roles, permisos, botones de “Abono en Caja”, FIFO nuevo, límites,
retenciones, recibos ni comportamiento de devolución.

## Aplicación offline propuesta

No ejecutar estos pasos sin una autorización posterior:

```sh
sha256sum \
  artifacts/mariana-textil/src/components/cliente-pago-dialog.tsx \
  artifacts/mariana-textil/src/lib/credit-evidence.ts \
  artifacts/mariana-textil/src/lib/credit-evidence.contract.test.ts
# Comparar los tres resultados con las etiquetas preimage del manifiesto.
git apply --check frontend-candidate-no-aplicado.patch
git apply frontend-candidate-no-aplicado.patch
```

Ese primer parche **no activa efectivo**. Sólo después de autorizar la apertura,
coordinar corte/API y aplicar la activación backend correspondiente:

```sh
git apply --check activacion-frontend-income-no-aplicada.patch
git apply activacion-frontend-income-no-aplicada.patch
```

Rollback de captura nueva: apagar primero la UI y después la guarda backend.

```sh
git apply --check reversion-frontend-income.patch
git apply reversion-frontend-income.patch
```

La reversión frontend toca sólo el booleano de ingreso. No cambia consultas de
lectura, corte, PAPER, devolución ni movimientos legítimos ya aceptados. Con la
guarda apagada, el query de sesión queda `enabled: false`.

## Validación aislada realizada

Todas las pruebas usaron hooks generados mockeados y reemplazaron `window.fetch`
por un rechazo `NETWORK_BLOCKED`. No hubo API, DB, login ni secretos.

- Candidato preparado, guardas apagadas:
  - pruebas montadas: **2/2**
  - contrato puro de evidencia: **7/7**
  - typecheck de la copia completa: **0 errores**
- Copia activada por el parche de una línea:
  - pruebas montadas: **4/4**
  - typecheck de la copia completa: **0 errores**

Cobertura observable:

- Transferencia sigue siendo el default y funciona sin caja.
- Payload efectivo contiene cliente, importe, UUID, naturaleza, medio, cuenta,
  sitio y sesión actuales.
- Loading y sesión vacía impiden vista previa y mutate.
- Cambio de sitio detectado por la revalidación impide mutate.
- Doble click produce una sola llamada.
- Devolución sigue cerrada ante submit programático.

Pruebas negativas sobre nuevas copias de fuente:

- quitar el lock: falla `double click lock allows one mutation`;
- quitar la igualdad sesión/sitio: falla el rechazo previo al mutate;
- cambiar la guarda de devolución a `true`: falla
  `refund client gate blocks mutate`.

Cada mutante terminó con código distinto de cero en el objetivo esperado. Las
copias de mutación no se conservaron como fuente de aplicación.