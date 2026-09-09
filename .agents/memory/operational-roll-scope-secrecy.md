---
name: Secreto de rollos fuera de alcance
description: Orden obligatorio de validaciones para no revelar inventario, reservas ni clientes de otras ubicaciones.
---

Validar primero que el rollo pertenece a una ubicación que el actor puede operar. Fuera de ese alcance debe responderse como inexistente, sin serie ni detalles. Solo después pueden evaluarse producto, estado, costo y reservas.

**Why:** Un mensaje de alcance o bloqueo puede confirmar que el rollo existe y revelar serie, salida y cliente de otra ubicación. Los mensajes informativos enriquecidos son correctos únicamente sobre inventario que el actor ya tiene derecho a ver.

**How to apply:** En servicios operativos, separar ubicación autorizada de cualquier ubicación enviada por el cliente. Ejecutar búsquedas de reservas y construir detalles después de la comprobación de alcance; cubrir también el caso fuera de alcance que está reservado.