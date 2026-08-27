# Validación — Parte 2: salida a mostrador y ticket mixto

Fecha: 26 de agosto de 2026  
Tarea: Salida a mostrador y ticket mixto

## Resultado

**APROBADO.** La salida a mostrador retira por completo los rollos del inventario controlado, el estado legado `ABIERTO` quedó eliminado y el POS admite tickets con líneas de rollo y metraje en una sola venta.

## Aislamiento de datos

- Las pruebas que escriben datos se ejecutaron en la rama Neon desechable `task40-parte2-verification`.
- Se preparó una base vacía para inventario/POS y otra base vacía con el nombre exigido por el guard de reportes.
- Antes de cada suite se aplicaron el esquema, el seed y las migraciones de arranque actuales.
- Se verificó `current_database()` antes de ejecutar las suites.
- No se crearon usuarios, sesiones, tickets ni movimientos de prueba en development.

## Pruebas automatizadas

| Área | Resultado |
|---|---:|
| Inventario y salida terminal a mostrador | 19 aprobadas, 0 fallidas |
| POS, cobro, cancelación y caja | 18 aprobadas, 0 fallidas |
| Migración repetible de Salidas | 1 aprobada, 0 fallidas |
| Migración legacy de modalidad por línea | 1 aprobada, 0 fallidas |
| Servicio transaccional de Salidas | 7 aprobadas, 0 fallidas |
| Contrato HTTP/arquitectura de Salidas | 5 aprobadas, 0 fallidas |
| Seguridad HTTP y permisos | 43 aprobadas, 0 fallidas |
| Integración de reportes | 4 aprobadas, 0 fallidas |

El caso de aceptación explícito crea y cobra un ticket mixto con:

- 2 rollos `NORMAL`;
- 8 metros `METREADO`;
- costo unitario y costo total metreados en `null`;
- rechazo de producto por kilo cuando se intenta vender como `METREADO`.

## Verificación de development, solo lectura

Después de ejecutar las migraciones de arranque:

| Comprobación | Resultado |
|---|---:|
| Rollos `ABIERTO` | 0 |
| Rollos `MOSTRADOR` | 4 |
| Rollos `MOSTRADOR` con `cantidad_actual = 0` | 4 |
| Tickets históricos | 13 |
| Líneas históricas | 37 |
| Líneas `NORMAL` | 37 |
| Líneas `METREADO` históricas | 0 |
| Columna `tickets.tipo` | ausente |

## Invariantes confirmados

- `MOSTRADOR` es terminal y conserva `SALIDA_MOSTRADOR` como movimiento histórico no reversible.
- Una salida a mostrador usa `destino_id = null`; no inventa una ubicación física.
- La única ruta pública de retiro es `POST /salidas/mostrador`; la ruta directa legada de Inventario fue retirada del servidor, OpenAPI y clientes generados para impedir salidas sin documento.
- El tipo de venta pertenece a cada línea, no al encabezado del ticket.
- El upgrade de tickets legacy desvincula de forma intencional los rollos de líneas `METREADO`, conserva el resto de la línea y registra el identificador anterior en auditoría antes de imponer el constraint nuevo.
- El metraje solo acepta productos en metros, no toca existencias y no requiere rollo.
- Si falta cualquier costo metrado, costo, utilidad y margen permanecen pendientes; nunca se convierten a cero.
- Los reportes separan rollos en metros, rollos en kilos y metraje en metros.
- La Parte 3 (costeo metrado y nuevas reglas de precio) permanece fuera de alcance.

## Aplicación en ejecución

- `pnpm run typecheck` aprobó en todas las librerías y artefactos.
- Los workflows gestionados de API y web reiniciaron correctamente; la API aplicó todas las verificaciones de esquema y quedó escuchando sin errores de arranque.
- La pasada E2E de solo lectura aprobó en escritorio y móvil:
  - login completo y utilizable;
  - `/pos` y `/salidas` redirigen a login sin sesión;
  - ancho móvil de 390 px sin desbordamiento horizontal;
  - sin excepciones JavaScript ni respuestas 5xx.
- No se inició sesión ni se enviaron formularios en development. Los únicos 401 observados fueron los esperados de `/api/auth/me`.
- Evidencia visual: `reports/parte-2-final-preview.jpg`.

## Revisión final

La revisión de arquitectura terminó en **PASS**, sin bloqueadores ni hallazgos de severidad alta. Confirmó el retiro del bypass legado, la atomicidad del documento de mostrador, modalidad por línea, costos metreados nulos, reportes pendientes y migraciones repetibles.