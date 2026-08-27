---
name: Exclusividad de audio entre pestañas
description: Criterio de seguridad para coordinar sonidos cuando varias pestañas reciben el mismo evento.
---

La reproducción de notificaciones debe depender de un mecanismo realmente exclusivo entre pestañas. Si el navegador no ofrece uno, el comportamiento debe fallar cerrado y permanecer silencioso.

**Why:** Una elección de líder basada en lectura/escritura de almacenamiento compartido permite carreras en las que dos pestañas reproducen antes de enterarse del evento de la otra.

**How to apply:** Para cualquier sonido deduplicado entre pestañas, adquirir exclusividad antes de drenar la cola; no convertir errores de coordinación en permiso para reproducir.