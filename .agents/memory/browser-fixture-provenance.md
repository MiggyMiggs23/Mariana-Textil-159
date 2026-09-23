---
name: Procedencia completa de fixtures de navegador
description: Preparar cadenas documentales y sesiones antes de probar cobros reales en una copia desechable.
---

Un fixture de rollo disponible con costo no basta para ensayar una venta: debe tener entrada, proveedor concordante, recepción y existencia coherentes con las guardas reales.

**Why:** Una prueba autenticada superó la validación de precio, pero no pudo crear documentos porque faltaba la procedencia del fixture. Corregir o eludir la guarda habría cambiado una regla válida.

**How to apply:** Validar la cadena completa antes de entregar el entorno al navegador, usando las mismas relaciones que consulta el productor. Conservar la diferencia entre defecto de producto y preparación incompleta.

Planificar el cierre después de todas las operaciones de la sesión.

**Why:** La regla de una sesión por sitio y fecha impide abrir otra tras cerrar; reparar después los fixtures no permite continuar en el mismo sitio.

**How to apply:** Si ya se cerró, preservar ese historial y preparar otro sitio sintético en la copia. Nunca reabrir, cambiar fechas ni desactivar la guarda para continuar una prueba.