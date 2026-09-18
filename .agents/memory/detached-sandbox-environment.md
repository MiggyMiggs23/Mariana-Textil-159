---
name: Entorno de procesos desacoplados
description: Diferencias no evidentes entre el workspace y procesos lanzados desde el sandbox de ejecución.
---

Los procesos desacoplados lanzados desde el sandbox de ejecución no deben asumir que heredarán el `PATH` Nix ni los secretos disponibles para los workflows del workspace. Además, respuestas de conectores que contienen credenciales pueden envolver la URI en texto descriptivo en vez de devolverla como valor plano.

**Why:** Un arnés de verificación puede fallar antes de ejecutar pruebas porque no encuentra Node o pnpm, no ve un secreto del workspace o intenta usar como URI toda la respuesta textual del conector.

**How to apply:** Al lanzar verificaciones desacopladas, pasar explícitamente las rutas de runtime necesarias, usar credenciales temporales limitadas a bases desechables cuando proceda y extraer/validar internamente la URI sin imprimirla.

Un servicio iniciado por `pg_ctl` dentro de un comando finito puede desaparecer al terminar la ejecución del shell aunque haya informado que arrancó correctamente.

**Why:** La limpieza de procesos hijos de la herramienta no equivale a detener o borrar la base; los archivos de la restauración permanecen, pero el proceso que la sirve puede dejar de existir.

**How to apply:** Si una restauración desechable debe quedar disponible entre turnos, ejecutar su `postgres` directamente como tarea de shell en segundo plano, con socket privado y sin escucha de red. Comprobar conexión después de arrancarlo. Distinguir siempre ese proceso local del API pausado: conservar la restauración no autoriza reiniciar la aplicación.

El cuaderno del navegador de pruebas puede compartir archivos con el workspace sin heredar sus secretos. No confundir esa frontera con credenciales ausentes o un fallo de login de la aplicación.

**Why:** Se comprobó presencia de credenciales en el shell, pero ausencia/inaccesibilidad en el cuaderno; insistir con APIs de entorno del navegador no las hizo disponibles. La sesión real sí funcionó al obtenerla mediante el login normal desde el runtime autorizado.

**How to apply:** Cuando el usuario autorice autenticación real, usar credenciales existentes sólo en el proceso que las hereda y transferir únicamente la sesión mediante un archivo temporal protegido fuera del proyecto. Nunca imprimir valores, inyectarlos en el frontend ni guardarlos en informes. Verificar el rol efectivo, cerrar sesión normalmente y eliminar el archivo. Una cuenta ADMIN no acredita cobertura CAJA.