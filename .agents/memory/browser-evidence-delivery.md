---
name: Capturas de navegador entregables
description: Distinguir observaciones del verificador, archivos de imagen y prueba visual válida.
---

Un identificador de observación del verificador no garantiza una imagen exportable. Antes de presentar una galería, comprobar que sus imágenes existen y muestran realmente la pantalla y el estado que afirma cada pie.

**Why:** Una comprobación de selectores produjo identificadores de navegador que no pudieron resolverse mediante viewImage. Al solicitar exportación, se copiaron capturas de comprobación de sesión, no de los controles verificados. Un HTML con esos archivos habría presentado evidencia incorrecta.

**How to apply:** Separar resultado funcional y entrega visual. Inspeccionar los archivos exportados antes de usarlos y no sustituir una captura ausente por una pantalla de sesión. En pruebas sintéticas, validar los paths efectivamente solicitados y todos los sitios exigidos, no solo un ejemplo representativo.