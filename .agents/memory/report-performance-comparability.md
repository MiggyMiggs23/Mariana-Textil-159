---
name: Comparabilidad de rendimiento de reportes
description: Separar el efecto de presentación de cambios de entorno y evitar errores del arnés en reportes compuestos.
---

Una medición histórica sobre Neon y clientes copiados no es una línea base causal para una repetición local con clientes sintéticos. Comparar presentación activada/desactivada sobre la misma carga, API y entorno; informar aparte los tiempos históricos.

**Why:** Al repetir la carga anual de crédito, la paginación ya estaba publicada. Una mejora frente a la medición histórica podía mezclar cambios de infraestructura con el costo de renderizado.

**How to apply:** Medir hasta el reporte visible más dos frames, conservar todas las respuestas y totales, exigir estado terminal y limpieza. No contar el 401 de la comprobación anónima previa al login como fallo del intervalo medido. En reportes compuestos, delimitar las aserciones al contenedor de la fuente evaluada: tablas de fuentes diferentes pueden compartir identificador. Las exportaciones deben usar la misma autenticación y alcance de la petición real, sin registrar credenciales.