---
name: Administradores temporales para E2E
description: Convención para autenticación y limpieza segura de pruebas visuales en desarrollo.
---

Para pruebas E2E autenticadas, crear un ADMIN temporal único en lugar de asumir que la contraseña inicial del seed sigue vigente. Al terminar, eliminar dentro de una transacción la sesión y la auditoría generadas por ese usuario antes de borrar la cuenta.

**Why:** La contraseña seed debe cambiarse en instalaciones usadas, y los logins crean referencias de auditoría que impiden borrar directamente el usuario temporal.

**How to apply:** Usar esta convención solo para pruebas visuales que necesiten sesión real; no modificar credenciales de cuentas existentes y confirmar la limpieza aunque la prueba falle.