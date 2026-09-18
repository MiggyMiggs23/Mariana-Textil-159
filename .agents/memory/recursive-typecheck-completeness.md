---
name: Conteo completo de errores con pnpm recursivo
description: Evitar que el primer paquete fallido oculte diagnósticos de otros proyectos.
---

Un `pnpm -r` que termina en el primer fallo no acredita el chequeo de todos
los proyectos que alcanzó a anunciar como iniciados.

**Why:** El corte temprano ocultó diagnósticos preexistentes de frontend
mientras la salida principal mostraba solamente los errores de la API.
Además, un proyecto que importa otro puede repetir sus mismos diagnósticos.

**How to apply:** Conservar la salida del comando solicitado y completar
únicamente los paquetes que no llegaron a informar resultado, usando
`--no-bail` para una ejecución recursiva de esos pendientes o ejecutándolos
individualmente. Contar errores únicos por archivo y ubicación, no por
repeticiones entre paquetes. No afirmar que no hay otros errores a partir
del primer fallo del orquestador.

La atribución «preexistente» debe indicar contra qué línea base se comprobó.
Un HEAD anterior a la entrega no sustituye el último punto de aceptación
explícito del propietario.

**Why:** Reproducir errores en el HEAD previo puede ocultar regresiones
introducidas después de un cierre aceptado en cero. El nombre del módulo no
demuestra que el error existiera cuando ese módulo se dio por cerrado.

**How to apply:** Contrastar el punto de aceptación y los commits que añaden
los diagnósticos, con sus padres inmediatos, en copias temporales. Guardar la
revisión exacta junto al log. Los enlaces de paquetes internos deben resolver
los fuentes históricos de la copia, no el workspace actual. Separar evidencia
medida de inferencias y no atribuir a un árbol completo un log sin revisión.