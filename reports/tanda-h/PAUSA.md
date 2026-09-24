# Tanda H — pausa solicitada

Guardado el 2026-09-24, 06:41 UTC. Reanudar desde este archivo; no repetir aplicaciones confirmadas ni interpretar candidatos como liberados.

## Aplicado a la base de la aplicación

- `rollos_physical_quantity_nonnegative_check`, validado: cantidad_actual >= 0 y distinta de NaN.
- Ensayo previo real en copia: 56/56 casos. Aplicación confirmada por COMMIT; evidencia en `application/physical-check-result.json`, commit `111c347`.
- Las 107 tablas conservaron filas y hashes antes/después. No se repararon datos, no se hicieron operaciones de prueba ni login en la base de la aplicación.
- No quitar ni reaplicar por suposición; al continuar verificar catálogo efectivo.

## Código guardado, todavía NO liberado

- `c5ad7db`: crearEntrada rechaza cantidades negativas, no finitas o mal formadas en cuatro unidades. Se preserva cero según semántica anterior.
- Prueba real antes/después SIN CHECK: anterior 28 expectativas fallidas de 44; corregido 44/44. API typecheck pasó.
- El candidato compilado privado fue eliminado al cerrar los entornos; reconstruir un candidato nuevo desde fuente comprobada. La API activa conserva dist-tanda-g-strict-candidate: NO contiene aún esta corrección del productor.
- Declaración de CHECK e índices en fuente NO implica que los índices estén aplicados.

## Índices: SOLO ensayados en copia

- `a369cc4`: declaraciones de los dos índices autorizados; `de4f31c`: preparación; `4186279`: mediciones.
- `tickets_pendientes_corte_ga_candidate` y `tickets_contabilizados_sitio_fecha_ga_candidate`.
- SQL exacto en `tarea-2/approved-indexes.sql`. No se aplicaron a la base de la aplicación todavía.
- Comparación de resultados de consultas y operaciones: iguales. Hashes de todas las tablas de negocio iguales. La tabla de autenticación `sesiones` cambió por las mediciones autenticadas: `paired-proof.json` conserva datasetEqual:false; `business-paired-proof.json` explica la excepción, sin confundirla con sesiones_caja.
- Siguiente paso: revisar esa evidencia y catálogo real, aplicar exclusivamente los dos índices autorizados con operador acotado y guardar resultado. No usar push de esquema.

## Rendimiento: objetivos aún no acreditados

- Copia anual: 54,750 tickets adicionales. Corte servidor ~32–50 ms después; crédito ~374–417 ms.
- Crédito navegador después: 8.11 s; no cumple <3 s. Petición ~579 ms; 261,672 nodos DOM y trabajo de script/layout/style dominan la preparación visual. Se propone virtualización/paginación o no montar tablas masivas ocultas SIN cambiar las cifras; no implementado.
- Corte: navegación completa con reselección de sitio 2.799 s; abrir corte 961 ms, petición 110 ms. No hay tres muestras comparables que certifiquen <2 s.
- Estado de cuenta E7 detenido en autorización, sin petición de exportación: no atribuir a SQL. Investigar frontera de autenticación/E7 y llegar a estado realmente listo.
- Cobro: tres operaciones reales confirmadas por productores nativos, 131.76/26.30/16.38 ms. Falta medir clic→confirmación en navegador.
- No repetir carga sobre copia consumida: todas las copias fueron eliminadas.

## Permisos

- Commits `c4365e9` y `f5ac3f6`; resultados en `permissions/`.
- 24 solicitudes únicas ejecutadas: 19 denegaciones por guardas exteriores y cinco 409 de vía histórica. Ninguna llegó a una guarda específica nueva; cero nuevas celdas directas acreditadas.
- Pendientes 381 = 357 sin operación identificada + 18 guardas exteriores + 6 históricas.
- CSV de las 357 y preguntas del propietario guardados. No inventar significado ni abrir E11/otras puertas para forzar pruebas.
- Siete roles autenticados, controles positivos y capturas reales; sin bypass demostrado y sin cambio de matriz.

## Cierre seguro

- `.local/tanda-h` eliminado, incluyendo copias, dumps, credenciales, fuentes congeladas y builds privados.
- Los siete puertos privados cerrados; procesos API/UI/PostgreSQL y wrapper terminados. Evidencia: `setup/pause-teardown.json`.
- La aplicación permanece funcionando, mismos builds; health devolvió ok después del cierre. No se reiniciaron workflows en esta pausa.
- Los scripts de preparación se conservan como evidencia histórica: antes de reutilizarlos, actualizar identidad efectiva, baseline de fuente y rutas; no confiar en PID 177 ni en copias eliminadas.

## Al reanudar

1. Leer resultados guardados y comprobar fuente, workflow y catálogo efectivo.
2. Crear solo las copias frescas necesarias para terminar lo pendiente.
3. Aplicar índices con autorización ya recibida y evidencia revisada; reconstruir/liberar el productor corregido de manera acotada.
4. Terminar mediciones de navegador y diagnóstico de tiempos sin cambiar significado financiero. No confundir latencia nativa con pantalla.
5. Consolidar informe único de resultados, commits y bloqueos; eliminar los nuevos temporales.

Esta pausa no declara completada la petición anterior.