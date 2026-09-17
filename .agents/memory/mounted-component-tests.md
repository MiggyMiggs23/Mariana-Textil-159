---
name: Pruebas sobre componentes realmente montados
description: Evita falsos positivos cuando existen componentes visuales duplicados.
---

Las pruebas de comportamiento visual deben verificar tanto la propiedad esperada como que la aplicación importe y monte ese componente exacto.

**Why:** Una prueba comprobaba la posición centrada en un Toaster duplicado sin uso, mientras el Toaster activo conservaba la posición predeterminada.

**How to apply:** Antes de confiar en una prueba de componente global, rastrea su importación desde la raíz de la app y cubre esa conexión en la regresión.

Las pruebas de producción también deben arrancar el artefacto construido con su configuración real; compilar un helper aisladamente no verifica el paquete desplegable.

**Why:** Un PDF se generó correctamente desde un bundle de prueba, pero el servidor real no arrancó porque sus reglas de dependencias externas eran distintas. Con pnpm, que una dependencia transitiva exista en disco no implica que el entrypoint final pueda importarla.

**How to apply:** Después de añadir una biblioteca con fuentes o recursos de ejecución, verificar el arranque del bundle real con sus reglas de dependencias externas y rutas de recursos. La prueba aislada del generador es complementaria, no sustituta.

Los datos simulados deben atravesar el esquema de respuesta del endpoint exacto antes de alimentar un componente real.

**Why:** Una prueba montó el componente correcto pero añadió un estado que el esquema del detalle eliminaba. Mostró una insignia correcta que la respuesta real nunca podía producir; el SELECT del servidor sí tenía el campo, pero eso no demostraba que llegara al navegador.

**How to apply:** Validar fixtures con el parser de respuesta del detalle, no con el de un listado parecido. No usar casts para hacer aparecer campos ausentes del contrato. Un campo ausente que exige ampliar el contrato debe tratarse según el alcance autorizado.