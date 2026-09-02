# Verificación de duración de sesiones

**Fecha local:** 2026-09-01  
**Cambio:** inactividad de 8 horas y tope absoluto fijo de 16 horas.

## Política aplicada

- Una sesión nueva vence inicialmente ocho horas después del login.
- Cada petición autenticada puede mover el vencimiento por inactividad hasta ocho horas desde esa petición.
- Ninguna actividad puede mover el vencimiento más allá de dieciséis horas desde `created_at`.
- La galleta usa el mismo tope absoluto de dieciséis horas mediante `maxAge`.
- No existen duraciones distintas por rol ni bloqueo con PIN.

## Seguridad verificada

La suite integrada comprobó que una sesión nueva recibe aproximadamente ocho horas de vigencia por inactividad. Al simular una sesión creada quince horas antes, una petición válida movió `expira_at` solamente hasta la hora dieciséis original, sin convertir el absoluto en deslizante.

Logout elimina primero la fila correspondiente de `sesiones` y después limpia la galleta. Reutilizar el mismo identificador después de salir devuelve 401 con el mensaje existente: “La sesión venció. Inicia sesión de nuevo.”

Resultados:

- Contrato específico de duración: **3/3**.
- Suite completa de seguridad, incluida la nueva verificación integrada: **47/47**.

## Medición con 30 usuarios simulados

La medición se ejecutó en una rama Neon desechable, con base vacía, esquema y seed actuales. Se crearon treinta usuarios simulados y treinta sesiones independientes únicamente en esa base. Se enviaron al mismo tiempo treinta peticiones autenticadas a `/api/auth/me`; cada petición recorrió el middleware real y renovó `expira_at`.

| Medida | Resultado |
|---|---:|
| Solicitudes correctas | 30/30 |
| Tiempo de pared del lote concurrente | 522.57 ms |
| Duración promedio de la petición completa | 424.64 ms |
| p95 de petición completa | 489.53 ms |
| Duración promedio del `UPDATE` aislado | 291.20 ms |
| p95 del `UPDATE` aislado | 348.82 ms |
| Máximo del `UPDATE` aislado | 348.94 ms |

Estos números incluyen latencia de red hacia Neon y contención del pool en el entorno de desarrollo; no son una predicción exacta de producción. El lote sí muestra que escribir en cada petición representa una parte material de la latencia cuando treinta usuarios coinciden.

### Propuesta no implementada

Conservar la validación en cada petición, pero escribir `expira_at` solo cuando la nueva fecha adelante el vencimiento guardado por un umbral significativo, por ejemplo cinco minutos. Esto mantendría el límite de ocho horas con una diferencia máxima conocida y reduciría escrituras repetidas durante actividad continua. No se implementó porque la especificación pide reportar primero el costo y decidir el umbral por separado.

## Limpieza de sesiones vencidas

No existe una rutina de producción que borre o marque automáticamente las sesiones cuyo `expira_at` ya pasó. La única eliminación normal encontrada ocurre en logout; las demás eliminaciones pertenecen a limpieza de pruebas. Con sesiones de dieciséis horas absolutas, las filas vencidas seguirán acumulándose si el usuario no cierra sesión.

No se construyó una limpieza en este cambio. Debe decidirse por separado si las filas se borran, se archivan o se conservan como evidencia de acceso.

## Aislamiento

No se crearon usuarios, sesiones ni ADMIN en development. Toda mutación y la medición se ejecutaron en la rama desechable, que se elimina completa al terminar.