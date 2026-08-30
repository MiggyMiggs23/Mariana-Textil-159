---
name: Sobrantes concurrentes de auditoría
description: Regla conservadora cuando un sobrante cambia de ubicación entre el cierre y la confirmación.
---

En una confirmación por lotes, reúne los pares de todas las fases y toma un
único conjunto global de candados consultivos antes de bloquear cualquier fila.
Después vuelve a leer los candidatos sin `FOR UPDATE`; solo el subconjunto cuyo
producto, ubicación y estado siguen iguales puede tomar candados de fila. Todo
candidato cambiado queda en resolución manual sin bloquear su rollo.

**Why:** Si se bloquea la fila usando un par leído antes de esperar el candado
consultivo, el rollo pudo moverse a otro par mientras se esperaba. Tomar entonces
su fila sin poseer el par nuevo recrea un ciclo fila/candado. Además, marcarlo
aplicado sin un movimiento de kardex oculta la carrera.

**How to apply:** Incluye faltantes, sobrantes y cualquier fase que bloquee
rollos en el conjunto inicial. La comparación previa a `FOR UPDATE` debe cubrir
todo campo que determine pares del motor. Solo marca aplicado cuando la
operación genera un ajuste documentado.