---
name: Verificación de captura por rollo
description: Criterio de aceptación para cambios en el flujo de captura de Entradas.
---

En cualquier cambio al flujo de Entradas, comprobar en navegador que una cantidad capturada se pueda editar, otra eliminar y luego recapturar antes de confirmar la línea.

**Why:** La primera implementación mostraba edición de la línea, pero no permitía modificar una cantidad individual; typecheck, build e inspección visual no detectaron esa diferencia.

**How to apply:** Antes de guardar, expandir el detalle del borrador y confirmar cantidades, totales y marcadores “Serie por asignar”. Después descartar el borrador para no dejar inventario de prueba.