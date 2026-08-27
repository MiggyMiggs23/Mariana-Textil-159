---
name: Sitio afectado en auditoría
description: Prioridad entre el sitio de una operación auditada y la ubicación asignada a quien la ejecuta.
---

El sitio explícito del evento auditado tiene prioridad sobre la ubicación asignada al actor. Solo se deriva desde el actor cuando la operación no aportó un sitio.

**Why:** Una persona puede operar sobre otro sitio; en particular, un ADMIN puede no tener ubicación asignada y aun así reimprimir una etiqueta o modificar datos de un sitio concreto. Sustituir el sitio afectado por el del actor borra o falsea la trazabilidad.

**How to apply:** Al enriquecer eventos de auditoría, conservar primero los snapshots y el sitio suministrados por el flujo operativo. Completar valores faltantes desde el actor y congelar el nombre correspondiente al sitio final.