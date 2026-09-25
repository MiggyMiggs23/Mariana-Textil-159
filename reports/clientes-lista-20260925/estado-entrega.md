# Candidato listo, pendiente de autorización de activación

API y frontend preparados como `dist-clientes-lista-20260925`, sin publicar
cambios comerciales ajenos. No se reinició la API ni se modificó la base.
La autorización vigente de arranque exige confirmación expresa para activar.

Pruebas backend sobre PostgreSQL desechable con esquema completo y 2575 clientes
sintéticos; pruebas montadas de interfaz y revisión independiente aprobadas.
El navegador verificó búsqueda por Arvizu/RFC/teléfono, orden invertible,
frecuencia/período, deuda/saldo a favor, redacción por permisos y adaptación móvil.
Todas las respuestas de navegador fueron sintéticas. Las capturas no son del
catálogo real.

Rendimiento sobre base real en solo lectura: consulta inicial 557.61 ms;
posteriores 26–35 ms; respuesta de 50 clientes de aproximadamente 25 KB.
Prueba separada con 50,000 tickets sintéticos: 81 ms.
No se requiere índice adicional ni conteo persistente a esta escala medida.
Estos tiempos no constituyen garantía de carga completa en navegador menor a
dos segundos: esa medición contra la nueva API activa queda pendiente de su
activación autorizada. No se realizó una carrera deliberada de peticiones en
navegador; debounce y parámetros se comprobaron en pruebas montadas.