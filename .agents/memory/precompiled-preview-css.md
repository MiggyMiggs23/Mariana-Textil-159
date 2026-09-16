---
name: CSS precompilado en maquetas
description: Limitación del CSS extraído de producción en vistas aisladas compiladas con esbuild.
---

Cuando una extracción reutiliza CSS ya compilado, agregar clases de Tailwind al JSX no garantiza que existan sus reglas. Esbuild puede terminar correctamente sin generar esas utilidades.

**Why:** En las propuestas financieras, un grid de seis columnas declarado en JSX no existía en la hoja extraída; los dos destinos bancarios ocuparon todo el ancho pese a que el código describía una agrupación de tres y dos.

**How to apply:** Usar CSS explícito limitado a la maqueta o una compilación real de Tailwind que incluya sus archivos. Verificar tamaños y posiciones computados en escritorio y teléfono; la presencia de clases y un build exitoso no demuestran la composición.