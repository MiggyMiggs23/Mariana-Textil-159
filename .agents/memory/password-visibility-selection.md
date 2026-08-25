---
name: Selección al mostrar contraseñas
description: Por qué alternar el tipo de un campo de contraseña requiere restaurar la selección después del commit.
---

Al alternar un input entre `password` y `text`, capturar foco y selección antes de la interacción y restaurarlos después de que el navegador procese el cambio de tipo.

**Why:** En Chromium la selección puede conservarse durante `pointerdown` y `click`, pero colapsarse en el primer frame posterior al commit; restaurarla solo durante el layout ocurre demasiado pronto.

**How to apply:** Evitar que el click sobrescriba la selección capturada en `pointerdown`, mantener el foco y repetir la restauración después del commit. Los resets por envío deben ocurrir en captura/layout para volver a oculto antes de pintar.