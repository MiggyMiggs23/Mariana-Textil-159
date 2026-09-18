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

Para cargadores de pruebas Node, usar también el corredor canónico. Un
evaluador CommonJS puede proporcionar `require` global y ocultar errores
que sí aparecen al importar el mismo bundle bajo ESM.

Los datos simulados deben atravesar el esquema de respuesta del endpoint exacto antes de alimentar un componente real.

**Why:** Una prueba montó el componente correcto pero añadió un estado que el esquema del detalle eliminaba. Mostró una insignia correcta que la respuesta real nunca podía producir; el SELECT del servidor sí tenía el campo, pero eso no demostraba que llegara al navegador.

**How to apply:** Validar fixtures con el parser de respuesta del detalle, no con el de un listado parecido. No usar casts para hacer aparecer campos ausentes del contrato. Un campo ausente que exige ampliar el contrato debe tratarse según el alcance autorizado.

En pruebas SSR, los dobles de infraestructura deben conservar los enums y
constantes reales. La identidad del componente y los datos deben comprobarse
en todos sus representantes, sin fijar el número de ramas responsive.

**Why:** Un enum fabricado permitía que las opciones parecieran completas
aunque el contrato real cambiara. Un badge correcto oculto podía ocultar un
representante móvil incorrecto; exigir exactamente uno o dos badges solo
sustituía una fragilidad por otra.

**How to apply:** Reexportar constantes reales, aislar los hooks de red y
observar el componente real. SSR no calcula CSS: declarar ese límite y
comprobar todos los representantes, incluidas las etiquetas derivadas de
estados comerciales, sin acoplarse a clases ni conteos fijos.

Al reescribir un contrato monolítico, conservar todas sus obligaciones vigentes,
no sólo la primera aserción que fallaba.

**Why:** Sustituir un contrato de varias pantallas y exportaciones por una sola
tarjeta produjo un verde parcial que había eliminado cobertura válida.

**How to apply:** Inventariar las comprobaciones anteriores y asignar a cada una
un resultado observable. La fragilidad de una aserción textual no autoriza
eliminar su obligación. Antes de declarar imposible el aislamiento, comprobar
los generadores públicos y los handlers registrados por el router real.

Para probar filtros de confidencialidad, usar las formas que emiten los productores reales de eventos; no deducirlas del nombre de las tablas.

**Why:** Un fixture atribuyó a Caja un módulo que el productor real utilizaba para el Fondo. Ajustar el filtro a ese fixture permitió que los eventos reales del Fondo pasaran, aunque las pruebas simuladas quedaran verdes.

**How to apply:** Derivar módulo, acción y entidad del productor canónico, incluyendo variantes de ingreso, inverso y arqueo. Los controles negativos de otros dominios también deben usar eventos reales. Ejecutar los generadores SQL usados por producción sobre datos controlados, no reconstrucciones aproximadas de sus consultas.