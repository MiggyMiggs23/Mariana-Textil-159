---
name: Auditoría append-only en pruebas
description: Regla para verificar auditoría sin introducir excepciones de mutación en bases de integración.
---

La auditoría permanece append-only también en pruebas. Las suites no deben instalar marcadores, flags, nombres de base ni otras excepciones que habiliten UPDATE o DELETE; conservan los registros y dejan que la eliminación de la rama desechable limpie todo.

**Why:** Cualquier mecanismo activable por un rol con DDL o ajustes de sesión puede recrearse en una base no desechable y anular la integridad del historial.

**How to apply:** Usar siempre una rama temporal, fixtures únicos y pruebas repetibles que toleren registros previos. Limpiar tablas operativas solo cuando no viole referencias de auditoría y eliminar la rama completa al terminar.