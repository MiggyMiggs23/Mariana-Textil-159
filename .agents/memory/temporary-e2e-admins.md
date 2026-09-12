---
name: E2E autenticadas aisladas
description: Aislamiento de pruebas visuales con sesión; población de datos regida por replit.md.
---

Nunca crear ADMIN temporales, sesiones, fixtures ni otros datos E2E en la base activa de la aplicación, incluyendo `executeSql` con `environment: "development"`.

**Why:** Una E2E autenticada se ejecutó contra la base activa y luego limpió directamente usuario, sesión y auditoría. Aunque el predicado solo alcanzó la cuenta temporal, ese procedimiento pone datos reales en riesgo y dificulta distinguir una limpieza segura de una pérdida de acceso.

**How to apply:** Crear una rama Neon desechable y una base vacía dentro de ella; aplicar esquema y seed actuales conforme a la regla de población de `replit.md`; configurar `TEST_DATABASE_URL` distinta de `DATABASE_URL`; apuntar API y navegador de prueba exclusivamente a esa base. Al terminar, eliminar solo la rama; nunca ejecutar limpieza de usuarios, sesiones o auditoría en la base de la app.