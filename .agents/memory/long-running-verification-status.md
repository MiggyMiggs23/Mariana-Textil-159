---
name: Estado explícito de verificaciones largas
description: Evidencia de terminación y seguimiento de respaldos y procesos desacoplados.
---

No inferir éxito porque desapareció un proceso. Exigir archivo de estado terminal, código de salida y resultados de las comparaciones antes de declarar una verificación aprobada. Dar actualizaciones breves durante esperas largas y reportar bloqueos.

**Why:** Un arranque fallido puede quedar oculto durante una espera. En una restauración, pg_ctl sin archivo de log dejó descriptores de salida heredados por PostgreSQL y el ejecutor esperó aunque el arranque parecía haber ocurrido. También se observaron servidores desechables terminados al finalizar la llamada de shell.

**How to apply:** Arrancar PostgreSQL con un log dedicado; ejecutar arranque, comprobación y cierre en una misma ejecución controlada cuando el entorno no preserve procesos. Registrar el estado y la salida explícitamente, conservar los intentos fallidos y reanudar desde el respaldo existente en vez de repetir capturas del origen.