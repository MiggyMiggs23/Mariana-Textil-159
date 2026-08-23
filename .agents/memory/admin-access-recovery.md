---
name: Recuperación de acceso administrativo
description: Criterio para restablecer credenciales administrativas cuando la conexión predeterminada de Neon no coincide con la usada por la API.
---

Para recuperar una cuenta administrativa, operar mediante la misma conexión de base de datos que utiliza la API, restablecer también el bloqueo temporal de acceso y validar el resultado contra el endpoint real de inicio de sesión.

**Why:** La rama predeterminada seleccionada por una herramienta externa de Neon puede no ser la conexión efectiva del servidor en ejecución; una actualización aparentemente exitosa no garantiza que la API vea el cambio.

**How to apply:** En recuperaciones futuras, evitar almacenar o imprimir la clave, conservar auditoría del desbloqueo y no confirmar el acceso hasta obtener una autenticación HTTP exitosa seguida de una comprobación de sesión.