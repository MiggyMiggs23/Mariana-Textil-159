# E1 — Decisiones aprobadas después del Bloque 0

**17 de septiembre de 2026. Estado: diseño aprobado; no implementado.**

Esta constancia registra la respuesta textual del propietario posterior a la revisión del Bloque 0. **No es autorización para ejecutar DDL, insertar datos, arrancar inicializadores ni activar capturas.** El SQL concreto y la base objetivo siguen sujetos a presentación y autorización separada, guardada en `reports/` antes de la primera escritura.

Alcance original: `attached_assets/Pasted--E1-Origen-del-dinero-y-evidencia-de-cr-dito-Correspond_1789682720691.txt`. Plan general: `reports/prompt-u-plan-de-implementacion.md`. No se reanuda P ni se cierra su Grupo 1.

## 1. Respuesta textual del propietario

> Apruebo la propuesta completa: recepción pendiente en tabla separada, atribución inmutable como hecho aparte, clave de operación única, y rechazo explícito a productores antiguos sin transición permisiva.
>
> Sí a la cuarta naturaleza. Tienes razón: autorizar una venta a crédito no recibe dinero, no lo devuelve y no corrige un registro anterior. Forzarla en «corrección contable» haría que cada venta a crédito apareciera como corrección en todo reporte que lea ese campo, y eso ensuciaría precisamente la distinción que estamos construyendo.
>
> Las cuatro categorías quedan así: ingreso físico, devolución física, corrección contable y operación de crédito sin movimiento de dinero.
>
> Aplícala también a los reversos automáticos al cancelar una venta a crédito, si tampoco mueven dinero físico. Revísalo y dime en qué categoría queda cada uno de los siete productores que listaste, para que quede explícito y ninguno a interpretación.
>
> Confírmame que ninguna categoría es opcional: todo movimiento nuevo declara exactamente una.
>
> Buen hallazgo el del ajuste por baja incobrable en clientes-admin.ts. No estaba en el plan y habría quedado escribiendo sin origen. Inclúyelo entre los productores cubiertos y anótalo como omisión del plan.
>
> Sobre la suite y las pruebas que crean usuarios: la prohibición se mantiene. No modifiques esas suites ni las ejecutes. Reporta el conteo de lo que sí corriste y di explícitamente qué quedó sin verificar por esa razón, sin presentarlo como suite completa. Eso conecta con un pendiente que ya traíamos —las 28 suites que crean usuarios— y cuando le entremos, ese es el trabajo.
>
> Confírmame también que la clave de operación no se reutiliza entre productores distintos: dos operaciones de naturaleza distinta no deben poder colisionar por usar la misma clave.

## 2. Contrato de naturaleza: exactamente una, obligatoria

El contrato aprobado para **todo movimiento nuevo**, sin excepciones por productor, contiene exactamente uno de estos cuatro valores:

1. Ingreso físico.
2. Devolución física.
3. Corrección contable.
4. Operación de crédito sin movimiento de dinero.

No se permiten ausencia, `null`, valores desconocidos, listas de categorías ni valores por defecto. La naturaleza declarada debe ser compatible con el hecho y con el productor; no basta aceptar cualquiera de las cuatro cadenas. El signo del importe, el tipo `ABONO`/`REVERSO` o el medio de pago por sí solos no prueban que hubo dinero.

Ingreso/devolución física describen dinero realmente recibido/devuelto. El medio distingue efectivo de transferencia: la sesión de caja se exige cuando hay efectivo real, no por una transferencia ni por una recaptura contable.

Los históricos no se reclasifican ni se editan. Esta es una regla aprobada para implementar, **no una validación ya instalada**.

### Matriz de los siete productores

| Productor | Naturaleza exigida según el hecho | Fuente revisada |
|---|---|---|
| Venta a crédito al autorizar nota | **Operación de crédito sin movimiento de dinero.** Crea la obligación, no recibe dinero. | `artifacts/api-server/src/lib/pos.ts:1858–1866` |
| Abono ordinario | **Ingreso físico** cuando se recibe dinero nuevo. Si se trata de una recaptura de corrección sin dinero nuevo, **corrección contable**, declarada expresamente y con evidencia de la recaptura; nunca ingreso físico por defecto. | `artifacts/api-server/src/routes/clientes.ts:2180–2205` |
| Abono dirigido, inmediato o aprobado después | **Ingreso físico** si el dinero se recibe al registrar ese abono; **corrección contable** si es una recaptura sin dinero nuevo, con la misma exigencia de declaración y evidencia. La aplicación posterior de un cobro retenido pertenece a E5 y no se implementa ni se cuenta como recepción en E1. | `artifacts/api-server/src/routes/pagos-dirigidos.ts:127–137` |
| Reverso de abono | **Devolución física** solo cuando realmente se devuelve dinero; **corrección contable** cuando se anula un registro sin devolverlo. No hereda automáticamente la naturaleza del abono original. | `artifacts/api-server/src/routes/clientes.ts:2298–2321` |
| Reverso automático al cancelar una venta a crédito | **Operación de crédito sin movimiento de dinero.** La inserción revisada invierte `VENTA_CREDITO`, referencia el cargo original y usa `formaPago: CREDITO`; ese movimiento no registra una devolución física. | `artifacts/api-server/src/lib/pos.ts:1369–1427` |
| Ajuste manual | **Corrección contable.** Su signo no lo convierte en ingreso o devolución física; si hay dinero real, debe documentarse el hecho físico por su operación correspondiente, no disfrazarlo de ajuste. | `artifacts/api-server/src/routes/clientes.ts:2411–2429` |
| Ajuste por baja incobrable | **Corrección contable.** Reduce la deuda por incobrabilidad, no cobra ni devuelve dinero. **Omisión detectada del plan:** este escritor SQL directo queda incluido expresamente en E1. | `artifacts/api-server/src/routes/clientes-admin.ts:185–190` |

Las alternativas de una fila son condiciones excluyentes, **no categorías simultáneas u opcionales**. Cuando el productor admite más de un hecho, la petición debe declarar cuál ocurrió y aportar sus datos obligatorios; no se adivina desde el importe o una nota libre. Declarar una corrección no concede permiso para hacerla ni permite eludir la autorización o evidencia correspondiente.

La clasificación del reverso automático se refiere al movimiento de crédito inspeccionado. No afirma que una cancelación completa carezca de otros efectos, como restituir inventario, ni autoriza construir una devolución física de dinero en E1.

## 3. Identidad de operación y aislamiento entre productores

La clave efectiva de reintento se separará por productor: **`(productor, claveDeReintento)`**. No se buscará una coincidencia solo por el UUID recibido. Cada flujo genera su propia clave y la conserva en sus reintentos.

- Igual UUID en dos productores distintos no identifica la misma operación ni permite devolver o consumir el resultado del otro productor.
- Dentro del mismo productor, igual clave y contenido canónico idéntico devuelve la operación original; no inserta otra.
- La naturaleza forma parte del contenido inmutable de la operación, junto con cliente, importe, origen y demás datos relevantes. Misma clave del mismo productor con naturaleza o contenido distintos se rechaza con conflicto.
- **Cambiar la naturaleza no abre un segundo espacio de deduplicación dentro del mismo productor:** hacerlo permitiría duplicar un cobro alterando ese campo.
- La reserva de identidad, su comprobación y la escritura del movimiento deben ser atómicas. Unicidad respaldada por la base, no solo por una consulta previa.
- Se conservan las protecciones específicas ya existentes: ticket autorizado, estado de solicitud dirigida y reverso único por movimiento original.

Esto precisa la clave única aprobada, sin extender el trabajo al cobro de tickets ni implementar la aplicación diferida de E5.

## 4. Conservación y activación

Se mantienen las decisiones aprobadas: recepción pendiente en tabla separada, fuera del libro que consume FIFO; atribución histórica como hecho aparte inmutable; rechazo de productores antiguos sin transición permisiva. No se activa la captura nueva de efectivo ni el cobro retenido. No se atribuyen los tres históricos.

La atribución se construirá para ADMIN y SUPERVISOR con evidencia y motivo obligatorios, respetando el alcance autorizado. Al relacionar un histórico se comprobarán identidad y fecha exacta, no solo su ID. El propietario sigue determinando la suficiencia de la evidencia y el sitio real.

## 5. Verificación efectivamente ejecutada en esta respuesta

- Pruebas unitarias/contratos ejecutadas: **0**.
- Pruebas de integración/E2E ejecutadas: **0**.
- Suites ejecutadas: **0**.
- Typechecks ejecutados: **0**.
- Consultas a la base, migraciones, escrituras de datos y reinicios: **0**.
- Se revisaron estáticamente los productores citados, en particular el reverso automático y la baja incobrable. La revisión de código y la comprobación de formato del diff no se cuentan como pruebas funcionales.

**Sin verificar todavía:** ejecución real de los siete productores; obligatoriedad en servidor/base; aislamiento FIFO del retenido; invariantes monetarias antes/después; integridad actual de los históricos; permisos negativos; unicidad concurrente y reintentos; vínculo con sesión; instalación efectiva de restricciones; typecheck y suite completa.

Las suites que crean usuarios o sesiones **no se ejecutan ni se modifican**. La referencia a **28 suites** es el pendiente indicado por el propietario, no un recuento nuevo realizado en esta respuesta. Esa prohibición impide verificar por esas suites los flujos de integración que dependen de tales fixtures; no se declara equivalente una selección reducida, mocks o inspección estática. Además, la implementación y la autorización de escrituras siguen pendientes.