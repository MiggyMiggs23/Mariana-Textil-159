---
name: CSS precompilado en maquetas
description: Limitación del CSS extraído de producción en vistas aisladas compiladas con esbuild.
---

Cuando una extracción reutiliza CSS ya compilado, agregar clases de Tailwind al JSX no garantiza que existan sus reglas. Esbuild puede terminar correctamente sin generar esas utilidades.

**Why:** En las propuestas financieras, un grid de seis columnas declarado en JSX no existía en la hoja extraída; los dos destinos bancarios ocuparon todo el ancho pese a que el código describía una agrupación de tres y dos.

**How to apply:** Usar CSS explícito limitado a la maqueta o una compilación real de Tailwind que incluya sus archivos. Verificar tamaños y posiciones computados en escritorio y teléfono; la presencia de clases y un build exitoso no demuestran la composición.

En arneses Vite aislados, importar la hoja fuente real tampoco basta: Tailwind v4 puede detectar candidatos desde la raíz del arnés y omitir los componentes productivos importados desde fuera. Declarar `@source` para el árbol productivo y para los snapshots anteriores.

**Why:** Un diálogo idéntico antes/después apareció sin sus límites de altura y dejó botones fuera del viewport porque el arnés no compilaba las utilidades del componente. Era un defecto de la evidencia, no del motor de captura.

**How to apply:** Antes de modificar un componente por una falla geométrica aislada, comparar su fuente y comprobar las reglas CSS efectivas. Si cambia el alcance de compilación, regenerar también las capturas de referencia.