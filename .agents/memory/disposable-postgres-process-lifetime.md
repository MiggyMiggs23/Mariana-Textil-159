---
name: Vida de procesos PostgreSQL desechables
description: Verificar existencia actual del servidor al cruzar llamadas de herramientas, sin confundir datos conservados con proceso activo.
---

No asumir que un PostgreSQL desechable sigue activo porque el operador dejó
su directorio y declaró que conservaría el proceso. Comprobar su estado actual
antes de reutilizarlo o detenerlo.

**Why:** Tras restauraciones correctas, ambos procesos desechables ya habían
terminado al intentar cerrarlos en una llamada posterior. Los datos seguían
conservados y los PID files habían quedado obsoletos.

**How to apply:** Contrastar PID, `pg_ctl status` y disponibilidad del socket.
Registrar una parada fallida como tal, y distinguir «ya detenido, directorio
conservado» de una parada ejecutada con éxito. No reiniciar ni borrar para
fabricar una evidencia de limpieza.