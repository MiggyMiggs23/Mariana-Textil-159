---
name: Identidad de base en E2E
description: Verificar la conexión efectiva tanto para aislamiento E2E como para diagnósticos de datos ausentes.
---

Antes de usar identidades o sesiones E2E, comprobar el nombre de base resuelto por el proceso que atenderá el navegador y compararlo con el nombre aislado esperado. No basta con que exista una rama temporal o con que el archivo de entorno haya sido correcto al crearse.

**Why:** Un intento de reinicio puede sobrescribir o sustituir el archivo de entorno temporal; si el login posterior funciona, eso no demuestra que la API siga conectada a la rama aislada.

**How to apply:** Antes del setup y nuevamente después de cada reinicio/override, consultar `current_database()` desde el mismo proceso o conexión que usará la E2E. Detenerse si no coincide exactamente con la base desechable esperada. Si el navegador necesita autenticación, no crear ni resetear usuarios en desarrollo: dirigir temporalmente el API a la base verificada mediante un override restringido fuera del repositorio, y restaurar el workflow normal y eliminar el override al terminar.

Para diagnosticar datos ausentes, una integración Neon instalada no demuestra que apunte a la misma base que la aplicación.

**Why:** Un conector puede resolver una base parcial o distinta; no encontrar allí movimientos no demuestra que falten en la aplicación.

**How to apply:** Identificar el pool configurado y comprobar `current_database()` y las tablas necesarias mediante solo lectura antes de interpretar conteos. Distinguir la conexión del shell de posibles overrides del workflow y no atribuir un caso concreto a datos que no se han encontrado.

No declarar inaccesible el proceso de la API porque un filtro de procesos por `node` no lo encuentra: Node puede mostrar `MainThread` como nombre de proceso.

**Why:** Un filtro por nombre produjo un diagnóstico incorrecto de inaccesibilidad. El PID de los logs sí estaba disponible y su ejecutable confirmó que era Node; se pudo consultar el pool existente sin reiniciar.

**How to apply:** Examinar la lista completa y comprobar el ejecutable/CWD del PID conocido antes de concluir que falta acceso. El GET de salud y una identidad histórica no sustituyen la consulta actual del pool. No reiniciar normalmente para diagnosticar: los inicializadores pueden escribir antes de la autorización.