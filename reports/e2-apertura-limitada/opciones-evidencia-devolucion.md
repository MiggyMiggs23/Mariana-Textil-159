# Opciones para resolver la evidencia de devolución

## Condición del propietario

**La apertura limitada está bloqueada hasta resolver esta dependencia.** No se eligió ni implementó ninguna opción. La autorización de recuperación permite recuperar únicamente el servicio anterior; no habilita ingresos de crédito, devoluciones ni cambios de evidencia.

## Qué significa “poder devolver”

Con las reglas E2 preparadas, la devolución exige importe íntegro, nunca aplicado, sin reverso, origen físico en efectivo y evidencia suficiente, además de permisos, sitio, sesión, disponibilidad y controles de concurrencia.

Registrar un origen no significa que todo abono sea devolvible. Devolver importes parciales o abonos ya utilizados exigiría cambiar esas reglas expresamente; no forma parte de ninguna opción aquí comparada.

Los costos siguientes son de esfuerzo relativo, riesgo y demora operativa. No son una cotización monetaria ni horas garantizadas: todavía falta elegir el alcance y autorizar su implementación y verificación.

## A. Generar evidencia desde el primer abono

**Trabajo necesario**

- Registrar el origen físico y la identidad inmutable de cada recepción aplicable.
- Separar el registro/atestación de evidencia del permiso para devolver dinero. El hook actual depende del permiso de devolución, que sigue apagado.
- Integrar los productores ordinario y dirigido dentro de la transacción original, con orden compatible con las aplicaciones legítimas y el FIFO existente.
- Distinguir prueba de origen de atestación “nunca aplicado”: el hook actual inserta en `evidencia_no_aplicada_e2` y rechaza abonos ya aplicados. Llamarlo indiscriminadamente después de todo abono rompería pagos legítimos.
- Preparar y revisar las tablas, funciones, guardas y preflight necesarios; mantener la devolución cerrada mientras no se autorice por separado.
- Verificar atomicidad, rollback, productores omitidos, aplicación inmediata/posterior, concurrencia, duplicados, reinicios y conservación de evidencia.

**Costo:** medio–alto de implementación y verificación; requiere ampliar el SQL propuesto, no solo cambiar una bandera o agregar una llamada.

**Resultado:** los nuevos abonos conservarían evidencia suficiente para evaluar su futura devolución, cuando cumplan las reglas. No reconstruye evidencia antigua.

**Límite operativo:** por sí sola esta opción **no permite devolver de inmediato**: la devolución continúa cerrada hasta completar y autorizar E2. Si se exige disponibilidad de devolución desde el primer día de captura, debe combinarse con C.

## B. Admitir otra evidencia suficiente

**Trabajo necesario**

- Definir qué evidencia inmutable demuestra cliente, importe, origen físico, sitio/sesión y el historial relevante de uso del dinero.
- Revisar los datos realmente conservados antes de afirmar que esa evidencia existe y es suficiente.
- Cambiar y versionar la política/validación de elegibilidad, no simplemente retirar el requisito de prueba.
- Mantener rechazo explícito ante datos incompletos o ambiguos. Un saldo actual, un corte o la ausencia actual de aplicaciones no demuestran por sí solos “nunca aplicado”.
- Verificar aplicaciones y deshacer aplicaciones, reversos, historia incompleta, duplicados, fraude y concurrencia. Cualquier tratamiento manual o excepción requiere autorización adicional.

**Costo:** alto o muy alto, con más incertidumbre y revisión histórica que A. Si la evidencia nunca se guardó, puede resultar imposible acreditar ciertos casos.

**Resultado:** podría admitir orígenes demostrables por otro contrato de evidencia. No garantiza rescatar todos los abonos ni autoriza atribuir o completar historia automáticamente.

**Límite operativo:** tampoco habilita por sí sola la devolución física. Exige que el flujo E2 esté completo, probado y autorizado. No equivale a aceptar saldos o declaraciones como prueba.

## C. Posponer la captura hasta que E2 pueda devolver

**Trabajo inmediato:** mantener ingreso y devolución cerrados, sin aceptar nuevos abonos de este flujo. Continuar el primer corte histórico con tickets.

**Trabajo antes de abrir:** completar el mecanismo de evidencia elegido —A, B o una combinación revisada— y el flujo de devolución, autorizar SQL y ejecución, comprobar atomicidad/concurrencia y acordar la activación coordinada.

**Costo:** bajo inmediato; costo total de completar E2 y mayor espera para habilitar la captura. Evita crear durante esa espera abonos sin una vía operativa de devolución.

**Resultado:** cuando se abra la captura, E2 ya podrá devolver los casos que cumplan sus reglas. No elimina el trabajo de evidencia ni recupera historia incompleta.

## Cómo se relacionan

A y B determinan **cómo probar el origen y la elegibilidad**. C determina **cuándo abrir la captura**. Por eso C puede combinarse con A o B; no son tres opciones necesariamente excluyentes.

Ninguna cambia el primer corte histórico de tickets, modifica FIFO por cuenta propia ni levanta guardas existentes sin autorización.

## Referencias revisadas

- `artifacts/api-server/src/lib/credit-refund.ts`: hooks, permiso de devolución, selección de evidencia, historial y bloqueos.
- `artifacts/api-server/src/lib/credit-refund-contract.ts`: flujo inactivo y diferencia entre candidato y elegibilidad.
- `artifacts/api-server/src/routes/clientes.ts`: productor ordinario y aplicaciones de crédito.
- `artifacts/api-server/src/lib/credit-evidence.ts`: controles del productor y contexto físico.
- `reports/e2/sql/credit-refunds-prepared.sql`: evidencia, inmutabilidad y exigencia de transacción original.
- `artifacts/api-server/src/lib/caja-cash-ledger.ts` y `caja-corte-reader.ts`: alcance de los datos y snapshots del corte; no constituyen por sí mismos un certificado de elegibilidad.