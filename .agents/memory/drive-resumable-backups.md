---
name: Respaldos binarios a Drive mediante carga reanudable
description: Evitar bloqueos del proxy multipart y comprobar integridad y privacidad del respaldo externo.
---

Para respaldos binarios, preferir la API de carga reanudable de Drive: iniciar con metadata JSON mediante la conexión y enviar los bytes a la URL HTTPS de sesión devuelta por Google. No registrar ni presentar esa URL temporal.

**Why:** El envío multipart de un dump, tanto binario como codificado en base64, recibió HTML de Cloudflare con HTTP 403; la carga reanudable funcionó. Ese rechazo no era evidencia de credenciales OAuth vencidas.

**How to apply:** Ante una respuesta no JSON, conservar el estado HTTP y comprobar si el archivo existe antes de reintentar. Verificar carpeta y permisos, descargar el archivo guardado y comparar tamaño y SHA-256 con el respaldo local. No considerar una respuesta de subida exitosa como prueba suficiente de integridad.