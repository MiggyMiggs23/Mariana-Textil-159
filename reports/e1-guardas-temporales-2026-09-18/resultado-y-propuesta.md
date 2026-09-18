# E1 — guardas SQL removibles: ensayo completado

**PASS: 84/84 controles. Instaladas únicamente en el clon. Base operativa sin cambios; API pausada.**

## Qué se propone aplicar, pendiente de otra autorización

Tres funciones y tres triggers adicionales. No se modifica ninguna función, trigger ni restricción permanente de E1. Las seis sentencias DDL exactas están en sql/01-install-cash.sql, sql/02-install-pending.sql y sql/03-install-attribution.sql. La propuesta transaccional reunida está en instalacion-transaccional-propuesta.sql: mismos fragmentos, orden, límites y candado que se midieron; su presentación NO autoriza ejecutarla en la operativa ni sustituye la comprobación de identidad y el supervisor externo.

SHA-256 de la propuesta transaccional: `4ec88685b4c3d1e8906e10734e2e2ef46c94885c829c1a6f865b872bff7f55e5`. Los hashes individuales de los seis archivos de instalación/retiro figuran en `alcance-y-retiro.md`.

| Guarda | Rechazo explícito | Retirada independiente |
|---|---|---|
| Efectivo físico de crédito, entrante y devolución | E1C01: E1: la captura física de efectivo de crédito está deshabilitada. | sql/11-remove-cash.sql |
| Cobros retenidos | E1P01: E1: el cobro retenido de crédito está deshabilitado. | sql/12-remove-pending.sql |
| Atribución histórica | E1A01: E1: la atribución histórica de crédito está deshabilitada. | sql/13-remove-attribution.sql |

La guarda de efectivo comprueba la fila final AFTER INSERT y sólo bloquea EFECTIVO con INGRESO_FISICO o DEVOLUCION_FISICA. No confunde una corrección contable con efectivo recibido. Las otras dos son AFTER INSERT STATEMENT: bloquean la captura entera, incluso un INSERT de cero filas. Las validaciones permanentes de cada fila conservan su orden y sus errores.

**Ninguna guarda transforma, reclasifica ni guarda de otro modo una entrada prohibida.** Las pruebas de bloqueo exigieron el SQLSTATE y mensaje exactos y comprobaron ausencia de cambios persistentes; las de retirada exigieron que la fila admitida tuviera exactamente los datos pretendidos.

## Qué se probó

- 24 controles de evidencia y validación permanente: todos aprobados, incluidas las tres sondas que antes exponían las brechas SQL.
- Siete fases de seis controles: todas instaladas; retirada y reinstalación individual de efectivo, pendientes y atribución.
- Dos fases de nueve controles: inventario, siete combinaciones permitidas de productor/contrato y conservación, antes y después de todos los retiros.
- La retirada de cada guarda abrió sólo su vía. Las otras dos siguieron rechazando con sus propios mensajes. La retirada de efectivo permitió tanto el ingreso como la devolución física sintéticos.
- Se reinstaló cada guarda desde su archivo original; las definiciones finales coincidieron exactamente con las instaladas al inicio.

Los siete productores conservan compatibilidad SQL con contratos válidos permitidos. Esto no se presenta como una segunda ejecución de sus rutas: las pruebas reales de rutas de la entrega anterior siguen documentadas por separado. Tampoco es una prueba de concurrencia, inventario físico ni interfaz.

## Medición real en el clon

| Transacción | BEGIN → COMMIT confirmado | Candado adquirido → confirmación de COMMIT |
|---|---:|---:|
| install-all | 29.141 ms | 28.675 ms |
| remove-cash | 21.164 ms | 20.757 ms |
| reinstall-cash | 9.899 ms | 9.624 ms |
| remove-pending | 10.664 ms | 10.313 ms |
| reinstall-pending | 46.427 ms | 45.670 ms |
| remove-attribution | 6.008 ms | 5.487 ms |
| reinstall-attribution | 5.199 ms | 4.837 ms |

**Instalación conjunta: 29.141 ms. Ensayo supervisado: 5.689 s.** Inicio registrado 2026-09-18T00:35:33.283Z y fin 2026-09-18T00:35:38.972Z, equivalentes al 17 de septiembre, 18:35:33–18:35:38, Ciudad de México. El total no incluye la lectura de manifiestos anterior al inicio registrado.

Los siete COMMIT recibieron confirmación; los siete backends DDL cerraron y se comprobó su desaparición. Ningún supervisor de 30 segundos se agotó. Espera/adquisición inicial del candado: 0.212 ms. El tiempo de candado mostrado llega hasta la confirmación recibida por el cliente, no mide el instante interno exacto en que PostgreSQL lo liberó.

Son tiempos locales de este clon, no una promesa de duración operativa. En un destino con actividad, la espera puede variar; el límite de espera de candado es 2 s y el de sentencia 15 s. Si el COMMIT fuera ambiguo, se detiene y se inspecciona: no se reintenta ni se adivina una reparación.

## Conservación

- Las 66 tablas conservaron exactamente sus filas y conteos, incluyendo los fixtures del ensayo anterior. Huella completa final igual a la inicial.
- Las 55 funciones y los 23 triggers permanentes inspeccionados conservaron sus definiciones y estados. Se agregaron sólo las tres funciones y tres triggers temporales.
- Los tres históricos originales siguen intactos y sin campos E1 atribuidos.
- Ledger: 16 filas; operaciones: 13; cobros retenidos: 0; atribuciones: 0, antes y después.
- Todos los fixtures y las inserciones de diagnóstico de este ensayo se revirtieron. Esto no afirma que los nextval locales se reviertan: una secuencia puede avanzar pese al rollback.
- Cero conexiones a la base operativa. Sin API, login, bootstrap, inicializadores, activación de flags ni cambios del respaldo o Drive.

## Cómo se retirarán cuando corresponda

Cada archivo 11/12/13 contiene sólo dos instrucciones: DROP TRIGGER de esa tabla y DROP FUNCTION de esa guarda. Deben ejecutarse en una transacción con identidad comprobada, límites y candado de su tabla. No hay CASCADE, IF EXISTS, función compartida ni modificación de las validaciones permanentes. Una ausencia o dependencia inesperada hace fallar la transacción. Las guardas restantes no se tocan.

- **Efectivo:** retirar cuando E2 (corte/devolución) y E3 (captura/recibo) estén completos, coordinados y autorizados.
- **Cobros retenidos:** retirar cuando E3 y E5, sus permisos y sus lectores permitan ver, aplicar y conciliar lo recibido. No basta con poder insertarlo.
- **Atribución histórica:** retirar únicamente al autorizar su flujo y las reglas de evidencia/origen. El plan no la asigna automáticamente a E2, E3 o E5.

Quitar la guarda SQL no habilita por sí solo la aplicación; sus flags y autorizaciones también necesitan la entrega correspondiente. El estado final del clon queda con **las tres guardas presentes y cerradas**.

## Estado y evidencia

**La corrección está comprobada en el clon, no aplicada a la operativa. Se espera autorización operativa separada. No se reanuda la API.**

- resultado-medido.json: 84 resultados, siete transacciones, mediciones y conservación.
- revision-previa.json: manifiesto exacto presentado antes de ejecutar.
- ejecucion.log: proceso finalizado con código 0 y PASS.
- sql-y-alcance.html: SQL y condiciones de retirada presentados.
- Autorización del clon: reports/e1-ejecucion-2026-09-17/autorizacion-guardas-clon.md.
