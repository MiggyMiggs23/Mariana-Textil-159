# Prompt L — ampliación de autorización para activar el cambio

El propietario respondió afirmativamente a:

> ¿Autorizas un reinicio normal del API para activar el cambio a ocho dígitos?
>
> Esto amplía la autorización de “solo UPDATE”: el arranque puede actualizar fechas de permisos, avanzar secuencias y generar alertas. No modificaré esos inicializadores ni crearé usuarios o sesiones de prueba.

Respuesta textual:

> Sí, autorizo ese reinicio y sus escrituras normales

No se proporcionaron comentarios adicionales.

El alcance se limita al `UPDATE` del contador de series y al arranque normal necesario para activar el código. No autoriza cambiar otros folios, alterar el esquema físico, modificar inicializadores, crear usuarios o sesiones de prueba, ni restaurar o modificar catálogos.

Antes del `UPDATE` se revalidará que no existan rollos ni series asignadas, bajo bloqueo transaccional. Si existen, no se ejecutará.