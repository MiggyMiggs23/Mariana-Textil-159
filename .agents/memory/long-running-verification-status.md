---
name: Estado explícito de verificaciones largas
description: Evidencia de terminación y seguimiento de respaldos y procesos desacoplados.
---

No inferir éxito porque desapareció un proceso. Exigir archivo de estado terminal, código de salida y resultados de las comparaciones antes de declarar una verificación aprobada. Dar actualizaciones breves durante esperas largas y reportar bloqueos.

**Why:** Un arranque fallido puede quedar oculto durante una espera. En una restauración, pg_ctl sin archivo de log dejó descriptores de salida heredados por PostgreSQL y el ejecutor esperó aunque el arranque parecía haber ocurrido. También se observaron servidores desechables terminados al finalizar la llamada de shell.

**How to apply:** Arrancar PostgreSQL con un log dedicado; ejecutar arranque, comprobación y cierre en una misma ejecución controlada cuando el entorno no preserve procesos. Registrar el estado y la salida explícitamente, conservar los intentos fallidos y reanudar desde el respaldo existente en vez de repetir capturas del origen.

Si la restauración debe sobrevivir entre llamadas, ejecutar el proceso PostgreSQL directamente como una tarea de shell en segundo plano. Un indicador `keptAlive` en el reporte describe el instante de su escritura, no garantiza que el servidor siga disponible después.

**Why:** El entorno puede terminar el PostgreSQL hijo al finalizar el comando de respaldo, aunque ese comando haya completado y verificado correctamente la restauración.

**How to apply:** Ante una conexión local rechazada, comprobar y volver a arrancar únicamente el clúster desechable existente mediante su socket Unix. No renovar el respaldo del origen ni reiniciar la API para resolver la vida útil del proceso local. Detener la tarea desechable al terminar.

Los tiempos de una fase reanudable sólo se atribuyen a la ejecución real de esa fase, no a la comprobación de que ya estaba hecha.

**Why:** Una reanudación midió un no-op de milisegundos y lo rotuló como restauración completa. La equivalencia de la copia estaba comprobada, pero no demostraba esa duración.

**How to apply:** Medir hasta la salida terminal del subproceso que realiza el trabajo. Conservar las duraciones originales por intento; si faltan, declarar la fase no medida. No repetir una restauración o modificar una copia conservada sólo para obtener una cifra. Una orden expresa de conservarla prevalece sobre el cierre habitual de recursos desechables.