---
name: Índices aditivos con drift de esquema
description: Cómo actuar cuando un push de esquema mezcla índices seguros con cambios destructivos ajenos.
---

Si una aplicación general del esquema propone truncar una tabla por una restricción antigua no relacionada, debe abortarse sin confirmar. Para un cambio limitado a índices, aplicar exclusivamente los índices requeridos mediante DDL aditivo e idempotente.

**Why:** Un sincronizador de esquema puede detectar drift histórico y combinar el cambio solicitado con una operación destructiva que no forma parte del alcance; aceptar el prompt pondría datos reales en riesgo.

**How to apply:** Verificar que la operación general no hizo cambios, usar `CREATE INDEX IF NOT EXISTS` solo para los índices aprobados y documentar la divergencia pendiente sin intentar corregirla como parte de otra función.