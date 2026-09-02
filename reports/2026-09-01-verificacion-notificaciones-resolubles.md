# Verificación — Notificaciones resolubles y lectura

Fecha: 2026-09-01  
Zona horaria: America/Mexico_City

## Decisiones

### Riesgo de crédito

Una alerta de crédito requiere simultáneamente:

1. saldo pendiente mayor que cero según la proyección FIFO del libro mayor existente;
2. fecha de vencimiento definida;
3. estar vencida o vencer dentro de tres días naturales.

Tres días permiten seguimiento preventivo sin convertir cada venta lejana en una alerta permanente. No se creó un cálculo de saldo paralelo: se conserva `loadCustomerCreditProjections`.

Medición de solo lectura en development:

- candidatos por tipo de movimiento antes de aplicar riesgo: **1**;
- alertas accionables después: **0**.

La desaparición es correcta: el único candidato no cumplía la condición completa.

### Solicitudes resueltas

Una solicitud PENDIENTE permanece activa. Una APROBADA o RECHAZADA se muestra al solicitante durante **cuatro días completos desde `resueltaAt`** y después desaparece. Cuatro días cubren una resolución del viernes hasta el martes siguiente.

Se evaluó escribir una notificación guardada al resolver. Sería más durable y permitiría lectura explícita, pero duplicaría el evento en otra tabla, requeriría una escritura adicional y una política de idempotencia/migración. Para este alcance se conservó la ventana corta solicitada, sin tabla nueva.

### Identificadores

La ruta individual es `/notificaciones/{tipo}/{id}/leer`, donde `tipo` es `credito` o `sistema`. Los ids numéricos de ambas tablas son independientes y pueden colisionar; el tipo forma parte obligatoria de la identidad. Antes, una colisión podía marcar la fila de crédito equivocada al intentar atender una fila de sistema.

## Conteo y costo

El globo ya usa el tamaño del feed. El endpoint de conteo ahora reproduce para ADMIN las mismas fuentes activas: alertas derivadas, solicitudes deduplicadas, notificaciones guardadas y límite de 100.

Cinco muestras de solo lectura:

- conteo anterior, solo dos `count(*)`: **1.01 ms** promedio;
- conteo unificado con derivados: **7.00 ms** promedio;
- guardadas sin leer: **1**;
- eventos activos: **2**.

El aumento absoluto es aproximadamente 6 ms y queda muy por debajo del intervalo de polling de 15 segundos. La implementación usa una carga FIFO masiva y consultas paralelas, no una consulta por cliente.

## Lectura

- `leer-todas` conserva una transacción, no borra y devuelve la suma real de filas actualizadas.
- La lectura individual atiende ambas tablas sin ambigüedad.
- El panel muestra el botón solo para ADMIN.
- El botón se deshabilita cuando no hay guardadas sin leer.
- Feed, conteo e historial se invalidan al completar.
- La interfaz distingue “notificación guardada” de “evento derivado”.
- Si quedan derivados, explica que desaparecen al atender su condición.

## Verificación

- Contrato de riesgo de crédito: aprobado.
- Contrato de feed, ventana, conteo e ids tipados: aprobado.
- Contrato frontend del botón y las dos clases: aprobado.
- Frontend completo: **89/89** pruebas aprobadas.
- Backend seguro de notificaciones, clientes y contratos POS/ticket: **38/38** pruebas aprobadas.
- `pnpm run typecheck`: aprobado.
- `pnpm run build`: aprobado.
- No se ejecutó DELETE ni se añadieron tablas de descartes.
- No se añadieron usuarios ni sesiones en development.

Las suites mutantes de POS, clientes y alertas de integración exigen una rama Neon desechable mediante `TEST_DATABASE_URL`. No se ejecutaron contra development. Las suites unitarias/contractuales, typecheck y build completos se ejecutan como parte del cierre de esta tarea.

La presentación usa un popover limitado a `min(92vw, 420px)` y una zona desplazable de 380 px, por lo que no desborda en teléfono. La captura del preview protegido puede redirigir al acceso si no existe sesión; no se crean credenciales para forzar la inspección.

Evidencia móvil: `reports/evidence/notificaciones-mobile.jpg`. El preview redirigió al acceso con 401 esperados por ausencia de sesión; API y web permanecieron operativas.