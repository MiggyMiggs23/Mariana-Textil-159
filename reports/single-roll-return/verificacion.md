# Exclusión entre reverso y reactivación de la misma baja

Fecha: 2026-09-17.

## Advertencia cerrada

La restitución se identifica por **movimiento de baja exacto y rollo exacto**.
No se bloquean los reversos en general, ni por el solo hecho de que el rollo
haya tenido cualquier reactivación histórica.

1. **Reactivación primero:** el intento de revertir esa baja se rechaza:
   > Esta baja de auditoría no puede revertirse porque el mismo rollo ya fue reactivado desde ella. Consulta el movimiento de reactivación relacionado.
2. **Reverso primero:** el intento de reactivar esa baja se rechaza:
   > Este faltante de auditoría no puede reactivarse porque su baja ya fue revertida. Consulta el movimiento de reversión relacionado.

Ambas respuestas contienen el enlace al movimiento que ya devolvió el rollo.
La interfaz muestra un enlace clicable; el detalle del rollo desplaza, enfoca y
resalta el renglón exacto del kardex.

Las consultas se ejecutan después del candado del rollo y antes de escrituras.
Si un reverso termina mientras la reactivación espera, se devuelve el rechazo
explicativo con enlace, no solamente un aviso genérico de estado desactualizado.
Los reintentos idempotentes existentes conservan su semántica.

## Verificación ejecutada

| Grupo | Resultado |
|---|---:|
| Suite original | 354/354 |
| T: motor | 15/15 |
| T: interfaz | 6/6 |
| T: contrato de impresión | 1/1 |
| Corrección: motor | 5/5 |
| Corrección: interfaz | 3/3 |
| **Total** | **384/384** |

Cero fallos, omisiones, canceladas o pendientes. `pnpm run typecheck` completo:
cero diagnósticos, todos los paquetes completados.

Evidencia:
- `original-354.txt`
- `backend-20.txt` — 15 anteriores y 5 de esta corrección.
- `frontend-9.txt` — 6 anteriores y 3 de esta corrección.
- `print-1.txt`
- `typecheck.txt`, `exits.json`
- `negatives/` — ocho pruebas nuevas vistas fallar ante defectos semánticos
  en copias aisladas y pasar después de restaurarlas.

Se verificó que el rollo conserva **50.125**, no 100.250, después de cada
rechazo en los escenarios simulados; no se añade un segundo movimiento.
Los reversos ordinarios sin reactivación y los que tienen una procedencia
distinta siguen permitidos.

Los casos de orden y espera usan dobles transaccionales deterministas y
comprobación de orden de candados. **No son una prueba concurrente contra
PostgreSQL real.** No se crearon usuarios ni sesiones, ni se escribieron
movimientos de mercancía real. La captura de aplicación sin sesión confirma
la pantalla de acceso, no una operación autenticada.

## Otro camino encontrado — reportado, no corregido

**Revertir genéricamente la salida de un traslado que ya fue recibido puede
duplicar la cantidad contable entre origen y destino.**

Secuencia ilustrativa, identificada por lectura de código, no ejecutada sobre
mercancía real:

1. Un rollo de 50 unidades se traslada de A a B y se recibe normalmente.
2. El movimiento original `TRANSFERENCIA_SALIDA` de A aún no tiene un reverso.
3. El endpoint genérico de reverso admite ese tipo; no comprueba que su
   traslado ya tenga recepción ni revierte la entrada correspondiente en B.
4. El reverso agrega +50 al kardex de A, mientras B conserva sus +50.
   El rollo físico sigue siendo uno en B y su cantidad individual no cambia.
   La cantidad contable agregada puede mostrar 100.

Alcance del hallazgo: camino por el **endpoint genérico de reverso**, con los
permisos requeridos; no se afirma que exista un botón específico para hacerlo
desde una salida recibida.

Fuentes:
- `artifacts/api-server/src/routes/inventario.ts`: ruta `/rollos/:id/revertir`;
  autoriza y remite el movimiento al motor.
- `artifacts/api-server/src/lib/inventario.ts`: `moverRollo` y
  `recibirTransferencia` mantienen movimientos separados por sitio;
  `revertirMovimiento` agrega la inversa al sitio del original;
  `estadoAntesDe` admite `TRANSFERENCIA_SALIDA`;
  `refreshCache` obtiene la cantidad mediante la suma del kardex.

La protección contra repetir el reverso del **mismo movimiento** no impide
este caso: la recepción es otro movimiento. **No se corrigió este camino**,
conforme a la instrucción de reportar las combinaciones adicionales.

La recepción normal repetida y la recepción posterior a cancelar un traslado
están protegidas por estado del documento, marca de recibido y estado del
rollo. Esta revisión es estática y acotada; no acredita ausencia exhaustiva de
cualquier otra combinación histórica.