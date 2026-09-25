# Activación autorizada y verificada

API y frontend activos como `dist-clientes-lista-20260925`, sin publicar
cambios comerciales ajenos. El propietario autorizó expresamente:
«Sí, activar sin modificar datos». MAIN realizó la activación y confirmó
hashes correctos e inspection boot sin inicializadores.

Accesos rápidos en el orden solicitado: A–Z, Más movimientos, Última actividad,
Deuda pendiente. El orden inicial sigue siendo última actividad descendente.

El observador independiente comparó las 108 tablas con transacciones
REPEATABLE READ READ ONLY antes y después: identidad de base y esquema iguales;
cero diferencias de conteos o huellas SHA-256 de contenido en todas las tablas.
Evidencia: `activation/before.json`, `activation/after.json`, y observador
reproducible `activation/capture.mjs`. No se ejecutó ningún reset.

Comprobaciones HTTP exclusivamente GET por el proxy:
- `/api/healthz`: HTTP 200, `status: ok`, 18.143 ms.
- `/api/clientes/listado` sin autenticación: HTTP 401, 2.553 ms.

No se inició sesión ni se recuperaron cookies o credenciales existentes.
Estas dos mediciones no representan el tiempo del listado autenticado.

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
dos segundos: no se midió el recorrido autenticado completo contra la nueva
API activa para evitar crear sesiones o acceder a credenciales ajenas.
No se realizó una carrera deliberada de peticiones en
navegador; debounce y parámetros se comprobaron en pruebas montadas.