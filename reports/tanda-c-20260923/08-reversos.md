# 08 — Reversos: alcance real de comparar el triple posterior

## Alcance y criterio

Revisión estática de las nueve vías de `replit.md:838-846`, más la nota histórica 10. No se consultó la base, no se ejecutaron scripts, pruebas, servidores ni operaciones; los ejemplos siguientes son escenarios aritméticos, no incidentes acreditados. Se leyeron las memorias `normal-vs-fifo-locking.md`, `inventory-audit-concurrent-surplus.md` y `review-confirmation-freshness.md`. No se propone alterar FIFO, crédito ni el orden de candados.

**Regla evaluada, no implementada:** permitir la comprobación si el rollo actual coincide exactamente en **sitio, cantidad y estado con el resultado POST del movimiento que se quiere revertir**. Comparar con el estado anterior, con el sitio contable del movimiento o simplemente con la inexistencia de IDs posteriores sería otra regla. “Pasa” significa que esta comprobación no lo impide; siguen aplicando los demás controles existentes.

**Límite de evidencia:** `lib/db/src/schema/rollos.ts:93-141` guarda sitio del asiento, cantidad firmada y `saldoPosterior`, que es saldo agregado producto/sitio, no cantidad posterior del rollo. No guarda un triple posterior general ni estado previo por movimiento. Los triples indicados abajo se deducen únicamente de cada escenario y su productor; **no son propiedades persistidas disponibles para implementar hoy la regla**. Tampoco hay que confundir el sitio del asiento de salida A con el sitio POST del rollo T.

Base común: `artifacts/api-server/src/lib/inventario.ts:2659-2759` bloquea, evita cancelar dos veces el mismo origen, reserva la venta de ticket a cancelación documental y excluye la reactivación de la misma baja/rollo. `inventario.ts:2762-2819` invierte el signo y escribe en el sitio original, pero actualiza solo cantidad/estado del rollo, no sitio/piso. `inventario.ts:2840-2864` infiere estado por tipo, no restaura una fotografía histórica. En las referencias abreviadas siguientes, `inventario.ts`, `pos.ts`, `salidas.ts` y `supplier-trace.ts` están en `artifacts/api-server/src/lib/`.

A/B son sitios operativos; T es tránsito. Todos los ejemplos usan **un rollo identificado R**, metros exactos a tres decimales y saldos de kardex atribuibles al escenario, sin otros rollos.

## 1. ALTA/RECEPCIÓN después de traslado

**Código:** alta disponible `inventario.ts:557-586`; recepción `inventario.ts:1381-1398`; traslado/recepción `inventario.ts:1583-1616,1707-1740`; reverso `inventario.ts:2779-2809,2842-2844`.

R recibe 50.000 m en A: POST=(A,50.000,DISPONIBLE). Viaja a T y se recibe en B: actual=(B,50.000,DISPONIBLE). Revertir la recepción original resta 50.000 de la cantidad actual y de A; deja R=(B,0.000,PROGRAMADO), kardex A=−50.000/B=50.000/T=0.000.

**Triple:** bloquea por sitio. Sin traslado posterior, actual=POST y permite la corrección inmediata hasta 0.000/PROGRAMADO. Si operaciones posteriores realmente restablecen (A,50.000,DISPONIBLE), el triple **permite**, aunque existan IDs posteriores. La recepción ya acreditada en documentos no se resuelve automáticamente por pasar el triple.

## 2. VENTA administrativa después de otra restitución

**Código:** venta tradicional `inventario.ts:1853-1907`, en particular `1892-1893`; reverso de venta `2776-2796,2845-2846`; reverso de salida `2855-2856`.

R de 50.000 m se traslada A→B y se vende administrativamente en B. Para METRO tradicional sin vaciado, POST venta=(B,50.000,VENDIDO), kardex B=0.000. Revertir la antigua salida A→T agrega 50.000 en A y deja R=(B,50.000,DISPONIBLE). Revertir luego la venta suma 50.000 en B, conserva cantidad 50.000 y estado DISPONIBLE: kardex A=50.000/B=50.000, un solo R de 50.000 m en B.

**Triple:** al evaluar la venta en ese punto bloquea por estado. Si la regla se aplicara también a la antigua salida, aquella ya habría sido detenida por su POST distinto del actual. Una venta errónea sin restitución posterior conserva (B,50.000,VENDIDO): permite su corrección. No se usa el ejemplo obsoleto “activar VENDIDO”: `inventario.ts:1331-1347` lo rechaza.

## 3. Ticket parcial con remanente trasladado

**Código/porciones comprobadas:** `inventario.ts:2169-2190` descuenta solo los metros solicitados y registra `TICKET_METRO_METREADO`; `pos.ts:1486-1534` selecciona también ese tipo, revierte **cada VENTA** del ticket y llama a `reverseTicketLineConsumptions`. `inventario.ts:2785-2795` incluye expresamente ese documento entre las ventas que sí suman cantidad. `supplier-trace.ts:288-335` registra reversos de los consumos originales; no convierte una cancelación total en recepción de una porción devuelta. `pos.ts:1456-1475,1655-1666` impide ticket ya cancelado y salida ligada entregada.

R=100.000 m en A; ticket metreado, sin salida ligada, vende 50.000: POST=(A,50.000,DISPONIBLE). Remanente trasladado y recibido en B: actual=(B,50.000,DISPONIBLE). Cancelar ticket suma 50.000 a R en B, pero escribe +50.000 en A: R=(B,100.000,DISPONIBLE), kardex A=50.000/B=50.000. No se trata de la venta tradicional que conserva cantidad.

**Triple:** bloquea por sitio. **Corrección legítima que también bloquearía:** R=50.000 en A → ticket X vende 10.000 (POST 40.000/DISPONIBLE) → ticket Y vende 20.000 (actual 20.000/DISPONIBLE), ambos sin salida entregada. Cancelar X erróneo debe poder sumar sus 10.000 y dejar 30.000 conservando Y; el triple estricto rechaza porque 20.000≠40.000. Si primero se cancela Y, vuelve a 40.000 y el triple permite X. La presencia de posteriores ya revertidos no es veto.

## 4. TRANSFERENCIA_SALIDA

**Código:** salida de A y entrada en T dentro de `inventario.ts:1583-1616`; recepción `1707-1740`; inversa sin restaurar sitio ni pareja `2798-2819,2855-2856`.

R=50.000 A → despacho: POST de esa fase=(T,50.000,EN_TRANSITO), kardex A=0.000/T=50.000. Tras recibir en B, actual=(B,50.000,DISPONIBLE). Revertir solamente la salida de A agrega 50.000 en A sin quitar B; R sigue en B/50.000/DISPONIBLE, kardex A=50.000/B=50.000.

**Triple:** tras recepción bloquea por sitio/estado. **Antes de recibir, pasa**: actual=(T,50.000,EN_TRANSITO), igual al POST. El algoritmo aun así deja R DISPONIBLE en T y kardex A=50.000/T=50.000; la contrapartida permanece. El triple no comprueba la integridad de la operación pareada. Cancelar correctamente un despacho erróneo requiere una operación documental que retire T y restituya A, no invertir una sola pata.

## 5. TRANSFERENCIA_ENTRADA: dos productores diferentes

**Código:** entrada técnica a T `inventario.ts:1604-1616`; entrada de recepción real en B `1707-1740`; estado inferido `2857-2858`. Recepción documental llama al motor y marca RECIBIDA en `salidas.ts:1538-1560`; el reverso genérico no actualiza ese documento (`inventario.ts:2798-2821`).

**Recepción real:** R=50.000 recibido en B; POST=(B,50.000,DISPONIBLE). Revertir inmediatamente +50.000 de entrada B deja kardex B=0.000 y R=(B,50.000,EN_TRANSITO); documento sigue recibido. **Pasa el triple y sigue mal.** No se exige movimiento posterior.

**Rastro técnico antes de recibir:** R salió de A; +50.000 en T deja POST=(T,50.000,EN_TRANSITO). Revertir esa entrada inmediatamente resta 50.000 a T, conserva 50.000/EN_TRANSITO y permite que la recepción ordinaria posterior reste otros 50.000 de T y sume 50.000 a B: final T=−50.000/B=50.000. **También pasa el triple antes de recibir.** Si se intenta revertir la entrada de T después de recibir en B, sí bloquea por sitio/estado. No son dos nombres del mismo momento operativo.

## 6. AJUSTE_POSITIVO consumido por baja posterior

**Código:** ajuste/baja `inventario.ts:2274-2313`; inversa y cantidad `2762-2796`; estado desde BAJA `2859-2861`.

R=(A,50.000,DISPONIBLE) → +10.000: POST=(A,60.000,DISPONIBLE) → baja completa −60.000: actual=(A,0.000,BAJA). Revertir +10.000 calcula cantidad −10.000 y estado DISPONIBLE, kardex −10.000. Es cálculo del motor; no afirmación de persistencia comprobada contra PostgreSQL.

**Triple:** bloquea por cantidad/estado. Si la baja posterior errónea se revierte y restituye exactamente 60.000/DISPONIBLE en A, permite revertir +10.000 hasta 50.000. **Falso rechazo posible:** 50.000→+10.000→ajuste independiente −2.000=58.000; corregir el +10.000 puede legítimamente dejar 48.000 manteniendo −2.000, pero el triple exige 60.000 y lo impide.

## 7. AJUSTE_NEGATIVO anterior a otra baja

**Código:** `inventario.ts:2282-2313,2779-2796,2859-2861`. La exclusión por reactivación es de la baja concreta y el rollo concreto (`2738-2759`), no una comprobación universal de bajas posteriores.

R=50.000 en A → −10.000: POST=(A,40.000,DISPONIBLE) → baja completa −40.000: actual=(A,0.000,BAJA). Revertir el primer −10.000 deja 10.000 DISPONIBLES y kardex +10.000 aunque la baja completa posterior sigue vigente.

**Triple:** bloquea por cantidad/estado. Revertida de verdad la baja posterior, vuelve a 40.000/DISPONIBLE y permite restituir los primeros 10.000 hasta 50.000. **Corrección independiente bloqueada:** 50.000→−10.000→+2.000=42.000; corregir el −10.000 conservando +2.000 daría 52.000, pero 42.000≠POST 40.000.

## 8. Baja manual inmediata en tránsito

**Código:** ajustar admite EN_TRANSITO (`inventario.ts:2267-2286`), guarda BAJA/0.000 (`2311-2327`); el reverso infiere DISPONIBLE desde BAJA (`2859-2861`), sin restaurar sitio (`2798-2804`); recibir exige EN_TRANSITO (`1692-1696`).

R=(T,50.000,EN_TRANSITO) → baja −50.000: POST=(T,0.000,BAJA), kardex T=0.000. Reverso inmediato deja R=(T,50.000,DISPONIBLE), kardex T=50.000. El documento de traslado espera un rollo en tránsito y la recepción lo rechazará.

**Triple:** **permite**, pues actual=POST antes del reverso. No restaura EN_TRANSITO ni arregla el algoritmo. La corrección es legítima en intención (baja capturada por error), pero la inversa actual es incorrecta. No debe “solucionarse” prohibiendo toda baja reversible o suponiendo un movimiento posterior inexistente.

## 9. Reverso de CANCELACION

**Código:** no hay exclusión de CANCELACION entre `inventario.ts:2670-2685`; control de origen ya cancelado `2715-2726`; CANCELACION no cambia cantidad por la lista de `2779-2796`, y conserva estado por `2862-2863`; su inversa se registra en `2806-2819`.

R=50.000 en A → ajuste +10.000=60.000 → cancelar ese ajuste: R=50.000, kardex=50.000. POST de esa CANCELACION=(A,50.000,DISPONIBLE). Revertir **esa cancelación**, todavía no revertida, agrega +10.000 al kardex, pero deja R=50.000/DISPONIBLE: kardex=60.000.

**Triple:** **permite**; el movimiento elegido es el último y actual=POST. La intención de deshacer una cancelación equivocada puede ser legítima, pero no está implementada como reconstrucción de sus efectos. El control antirrepetición del primer ajuste no impide seleccionar la cancelación como otro origen.

## Nota 10. DEVOLUCION histórica

El enum incluye DEVOLUCION (`lib/db/src/schema/enums.ts:66-80`). La búsqueda estática de productores en `artifacts/api-server/src` no encontró inserción operativa actual de un movimiento de inventario de ese tipo. No se verificó si existen filas históricas. El reverso genérico no lo excluye y conserva cantidad/estado (`inventario.ts:2779-2796,2862-2863`).

**Ejemplo condicional:** si existe una devolución histórica +50.000 con R=(A,50.000,DISPONIBLE), su reverso resta 50.000 de kardex y conserva los 50.000 disponibles. Si ese era su POST, el triple permite y sigue mal. Si no se puede acreditar el POST histórico, la regla no es evaluable con rigor: no inventar fotografía ni convertir incertidumbre en prueba de legitimidad o fraude.

## Balance y correcciones legítimas

El triple bloquea los escenarios contaminados 1, 2, 3, 4 después de recepción, 6 y 7; **no evita** 4 antes de recepción, las dos variantes inmediatas de 5, 8, 9 ni la hipótesis 10. Es una precondición, no un inversor correcto ni una prueba de dependencia documental.

No es una regla cronológica: R=50.000 → +5.000=55.000 → −2.000=53.000 → reverso del −2.000=55.000. Para corregir +5.000, actual coincide con POST: **debe permitir llegar a 50.000**, aun habiendo movimientos posteriores. Igual sucede con una corrección −5.000/+5.000 en T que restaura exactamente cantidad/sitio/estado pendientes. Fuente del cálculo: `inventario.ts:2274-2313,2779-2796`. No asegura por sí sola que todos los documentos o contrapartidas estén resueltos.

En contraste, la cancelación independiente del ticket X (apartado 3) y los ajustes independientes (6/7) muestran correcciones legítimas que la igualdad estricta sí bloquearía. Resolverlo exige definir operación completa, dependencias activas y evidencia suficiente; no basta eliminar todos los asientos posteriores ni ignorar la pareja de traslado sin resolverla. Si se diseña una validación futura, se debe revalidar bajo los candados ya establecidos, no confiar en una revisión de pantalla.

## Preguntas al propietario

1. ¿La unidad reversible es movimiento, ticket completo o documento de traslado con todas sus patas y efectos? ¿Se prohíbe la inversa aislada de transferencias?
2. ¿Deben admitirse las correcciones independientes de tickets/ajustes descritas aunque el triple difiera, mediante una vía documentada distinta?
3. ¿Cómo autorizar y acreditar correcciones históricas sin fotografía POST, sin inventar datos ni imponer un veto universal?
4. ¿Se necesita deshacer una CANCELACION como operación real? ¿Debe conservarse siempre el estado previo, incluido EN_TRANSITO?
5. ¿Qué evidencia, permisos y revisión se exigen antes de corregir los algoritmos pendientes? Este informe no autoriza cambios.