---
name: Vigencia de validaciones en confirmaciones
description: Los resúmenes previos al guardado separan la revisión del usuario de la validación operativa final.
---

Un resumen de confirmación no congela la disponibilidad de recursos compartidos. Revalidar al confirmar y, cuando haya un contenedor seleccionado, consultar su disponibilidad vigente antes de enviar; conservar siempre la validación transaccional del servidor.

**Why:** La captura puede permanecer intacta mientras otro operador recibe el contenedor. Volver a ejecutar una validación contra la misma caché no detecta ese cambio. Se acepta la consulta adicional al confirmar para detener el envío y permitir revisar la captura.

**How to apply:** Bloquear confirmaciones duplicadas antes de esperar la consulta, conservar el borrador ante errores y no imprimir antes del éxito del guardado. En pruebas, distinguir cambiar la respuesta futura del servidor de actualizar la caché del componente.