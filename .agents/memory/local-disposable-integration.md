---
name: Integración local sin clonar Neon
description: Motivo y alcance de usar PostgreSQL local desechable para automatizar pruebas con población restringida.
---

Para integración automatizada se eligió PostgreSQL local desechable, sin sustituir la base Neon de la aplicación ni extender esta decisión a E2E.

**Why:** La conexión Neon disponible era un MCP del agente, no un aprovisionador invocable por los scripts del proyecto. La instancia local evita exigir otra credencial y evita clonar datos o actores de una rama real. La ausencia de una URL manual no justifica ejecutar suites cuyos fixtures contradigan la población autorizada.

**How to apply:** Mantener explícita la diferencia entre integración local y E2E en Neon. Una preparación o una suite de esquema aprobada no acredita las demás integraciones; reportar por separado las bloqueadas por su población. Si se requiere probar comportamiento específico de Neon, acordar ese alcance antes de cambiar el proveedor de pruebas.