---
name: Subidas binarias con MIME dinámico
description: Convención para cargas de archivos cuyo MIME y nombre se conocen solo al seleccionar el archivo.
---

Cuando un endpoint binario admite varios tipos de archivo y requiere headers derivados del `File`, usar el wrapper HTTP tipado directamente con la ruta completa `/api/...`, el `Content-Type` real y el nombre real del archivo.

**Why:** El generador puede fijar un único MIME del contrato y omitir headers dinámicos. Además, el wrapper no siempre tiene una URL base configurada; una ruta sin `/api` puede terminar en el servidor web y devolver 404.

**How to apply:** Después de regenerar clientes, validar una carga desde el control visual real para cada MIME admitido. No considerar suficiente una carga manual por API.