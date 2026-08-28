---
name: Auditoría append-only en pruebas
description: Regla para verificar auditoría sin introducir excepciones de mutación en bases de integración.
---

La auditoría permanece append-only también en pruebas. Las suites no deben instalar excepciones que habiliten UPDATE o DELETE. Si la auditoría impide borrar un fixture, se conserva completo en vez de limpiar parcialmente sus dependencias.

**Why:** Cualquier mecanismo activable por un rol con DDL o ajustes de sesión puede recrearse en una base no desechable y anular la integridad del historial.

**How to apply:** Usar una rama temporal, fixtures únicos y pruebas repetibles. Decidir qué registros se retienen antes de mutarlos; eliminar la rama completa al terminar.