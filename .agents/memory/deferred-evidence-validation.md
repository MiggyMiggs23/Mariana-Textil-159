---
name: Evidencia diferida y cambios posteriores
description: Límites de los constraint triggers al finalizar evidencia derivada de otras tablas.
---

Una validación diferida sobre el movimiento de origen no garantiza por sí sola que las tablas relacionadas conserven ese estado hasta el commit.

**Why:** `SET CONSTRAINTS ... IMMEDIATE` puede consumir la validación pendiente antes de insertar otra aplicación en la misma transacción. Si esa segunda escritura no dispara ninguna protección, una finalización inicialmente correcta queda desactualizada.

**How to apply:** Revisar todas las escrituras que puedan invalidar evidencia, también después de forzar restricciones inmediatas. Protegerlas sin impedir aplicaciones legítimas de transacciones futuras. La inspección y los mutantes de texto no acreditan la semántica PostgreSQL: comprobar ese orden en una base aislada únicamente con autorización específica.