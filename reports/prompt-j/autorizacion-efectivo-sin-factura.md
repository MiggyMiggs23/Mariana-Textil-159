# Autorización específica: efectivo sin factura

Respuesta textual del propietario:

> Sí, autorizo esa diferencia para mostrar Efectivo sin factura

Comentarios textuales:

> Sí, autorizo mostrar Efectivo sin factura como la diferencia entre Efectivo cobrado y Efectivo facturado, usando los dos valores que ya vienen en la misma respuesta del servidor.
>
> Tres condiciones:
>
> 1. Es la única cifra derivada que autorizo. La regla de que ninguna cifra financiera se calcula en el navegador sigue vigente para todo lo demás. Hiciste bien en preguntar.
> 2. Efectivo facturado + Efectivo sin factura debe sumar exactamente Efectivo cobrado, al centavo, y quiero una prueba que lo afirme y que falle si alguna vez deja de cumplirse.
> 3. Las tres cifras se leen con el mismo peso: total en efectivo, cuánto es de ventas facturadas y cuánto sin factura. La parte sin factura no puede quedar como una etiqueta chiquita debajo del total, que es justo el problema que tiene hoy la de facturado

Identificador de respuesta:
`inv_18wN1nIEeAOk68W8M7YJFqcqD0eTwUYIAV:call_pa0EGXjiPfLm8e5B5elwUb7Q`

## Alcance

Única excepción autorizada a la prohibición de derivar cifras financieras en el navegador: restar Efectivo facturado de Efectivo cobrado, con ambos valores de una misma respuesta. La identidad se verificará en centavos exactos, mediante una prueba de regresión que falle ante cualquier descuadre.

Los tres importes tendrán igual jerarquía visual, también en pantalla estrecha. No se autoriza cambiar otras consultas, predicados o cálculos.

Estado actualizado: el propietario aprobó la última composición reconciliada y autorizó integrarla, con Cobrado en el periodo después de ventas/operación y antes de Estado por Tienda. La diferencia autorizada está implementada con centavos enteros; sus pruebas comprueban exactitud y rechazo de un descuadre de un centavo. La respuesta original anterior autorizaba únicamente la diferencia; la aprobación visual e integración corresponden a la instrucción posterior del propietario. Los casos financieros reales ausentes y el recorrido autenticado permanecen fuera de la evidencia de estas pruebas.