---
name: Puertas de captura frente a SQL directo
description: Cómo distinguir una captura cerrada en la aplicación de una prohibición efectiva en PostgreSQL.
---

Cuando el requisito es impedir una captura por cualquier vía, verificar por separado las rutas/helpers de aplicación y un INSERT SQL completamente válido, con las guardas instaladas intactas.

**Why:** Un ensayo financiero encontró que los flags de aplicación rechazaban las capturas, pero las funciones SQL sólo validaban su integridad y admitían los mismos datos bien formados. Las pruebas de solicitudes incompletas y código antiguo no detectaban esa diferencia.

**How to apply:** Usar una base desechable autorizada y fixtures válidos para actor, sitio, sesión, operación y referencias. Revertir siempre las sondas; si el INSERT se admite, registrarlo como fallo de cierre, no como aprobación. Un error de FK, sintaxis o fixture no prueba que la puerta esté cerrada. No modificar los triggers antes de medir el comportamiento instalado; cualquier corrección operativa requiere su alcance y autorización propios.

Las guardas de capacidades aún incompletas deben retirarse por separado, sin retirar sus validaciones permanentes.

**Why:** El riesgo señalado por el propietario no es sólo acceso SQL indebido: un productor futuro podría crear un cobro que aún no tenga pantalla para verlo, aplicarlo ni conciliarlo. Las distintas capacidades pueden quedar listas en momentos distintos.

**How to apply:** Probar la retirada de cada cierre con las demás puertas aún bloqueadas, seguido de reinstalación. Exigir errores explícitos: nunca normalizar o reclasificar silenciosamente una captura prohibida para lograr guardarla.