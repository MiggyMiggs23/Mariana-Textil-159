---
name: Vida de árboles aislados de pruebas
description: Conservar evidencia durable sin acumular copias temporales durante matrices largas.
---

La capacidad libre mostrada por `df` no descarta una cuota o límite de archivos.
No acumular un árbol completo por cada fase de una matriz larga.

**Why:** Una matriz se interrumpió al copiar fuentes con `UNKNOWN: unknown error,
write`; después `mkdtemp` devolvió errno -122 aunque había espacio global libre.
El reinicio del workspace también hizo desaparecer logs y árboles temporales.
No se estableció qué recurso o cuota concreto originó la interrupción.

**How to apply:** Persistir logs, resultados, manifiestos de entradas y hashes
en el proyecto antes de retirar los árboles propios de un ciclo terminal.
Verificar la identidad y ruta de cada temporal antes de limpiarlo. Un fallo de
copia nunca cuenta como prueba negativa; continuar únicamente los ciclos sin
evidencia terminal, tras comprobar que fuentes y controles conservan validez.