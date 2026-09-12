---
name: Identidad de base en E2E
description: Verificación obligatoria de la base real antes de crear o usar identidades efímeras.
---

Antes de usar identidades o sesiones E2E, comprobar el nombre de base resuelto por el proceso que atenderá el navegador y compararlo con el nombre aislado esperado. No basta con que exista una rama temporal o con que el archivo de entorno haya sido correcto al crearse.

**Why:** Un intento de reinicio puede sobrescribir o sustituir el archivo de entorno temporal; si el login posterior funciona, eso no demuestra que la API siga conectada a la rama aislada.

**How to apply:** Antes del setup y nuevamente después de cada reinicio/override, consultar `current_database()` desde el mismo proceso o conexión que usará la E2E. Detenerse si no coincide exactamente con la base desechable esperada. Si el navegador necesita autenticación, no crear ni resetear usuarios en desarrollo: dirigir temporalmente el API a la base verificada mediante un override restringido fuera del repositorio, y restaurar el workflow normal y eliminar el override al terminar.