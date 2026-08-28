---
name: Sobrantes concurrentes de auditoría
description: Regla conservadora cuando un sobrante cambia de ubicación entre el cierre y la confirmación.
---

Si un sobrante ya aparece `DISPONIBLE` en el sitio auditado al momento de confirmar, debe quedar en resolución manual. No se marca como aplicado cuando no existe un ajuste o traslado trazable que generar.

**Why:** El sitio o estado puede cambiar después de congelar el resultado. Declarar la discrepancia aplicada sin un movimiento de kardex oculta la carrera y afirma una corrección que la confirmación no realizó.

**How to apply:** En toda confirmación de auditoría, vuelve a bloquear y leer el rollo. Solo marca aplicado cuando la operación genera un ajuste documentado; si el estado actual ya impide ese movimiento, conserva inventario y deriva a revisión manual.