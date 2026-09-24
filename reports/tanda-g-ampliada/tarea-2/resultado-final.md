# Tarea 2 — resultado final

**Resultado: defecto reproducido; protección DB ensayada en copia, NO liberada.** No se modificaron producto, migraciones, gates ni DB de aplicación. MAIN instaló/retiró exclusivamente el CHECK temporal de `tanda_ga_inventory` en localhost55442. Copia, API y fixtures se conservan para teardown MAIN.

## Identidad y alcance

Fuente congelada por setup: ee1bb641e0513b7df18027ad351a72ebbe99af74, archivo SHA256 f823aa8a7f5560240ea9b2811c9a2fc73df6b3a72c8d016a148b947725694fc4; API SHA256 d4a5a83bbaa5fc130f68217df5da4039d26db325f59345ee2958adabdcc0b0a9. Etiqueta de ejecución solicitada currentsource61d-strict no sustituye estos hashes: no se ejecutó checkout histórico separado 61d. DB worker ga_inventory, API43852, ADMIN natural de copia. Conexión aplicación sustituida por witness vacío y TEST_DATABASE_URL aislada; identidad SQL/proceso comprobada.

Inventario de todos los escritores localizados, fronteras HTTP/servicio/DB y semántica física vs ledger: `inventario-escritores.md`. No se concluye exhaustividad de imposibilidad por ejecutar una matriz.

## Evidencia numérica real

Dos sitios836/837 × METRO/KILO/PIEZA/BOLSA × -2,0,1.5,2,±9999999.999,10000000:

- Baseline preliminar:224 casos de servicio con rollback;32/32 controles cantidad2.
- Fase CHECK:224 servicios +56 API;48/48 controles de comparación.
- Baseline final sin CHECK:224 servicios +56 API;44/44 controles.
- Comparación pareada:280 casos equivalentes (`comparison.json`).

| Frontera / -2 | Baseline sin CHECK | Con CHECK cantidad_actual>=0 |
|---|---|---|
| crearRollo directo METRO/KILO | Aceptado en ambos sitios | Rechazado DB |
| crearRollo directo PIEZA/BOLSA | Rechazado helper entero positivo | Rechazado helper |
| crearEntrada directo, cuatro unidades | **Aceptado**, incluido discreto entero negativo | Rechazado DB |
| activarRollo directo METRO/KILO | Aceptado | Rechazado DB |
| activarRollo directo PIEZA/BOLSA | Rechazado helper | Rechazado helper |
| ajustarRollo directo, cuatro unidades | Rechazado | Rechazado |
| activar HTTP METRO/KILO, ambos sitios | **200; actual=-2.000; RECEPCION=-2** | **500; PROGRAMADO10.000; sin movimientos** |
| activar HTTP PIEZA/BOLSA | 400, sin cambio | 400, sin cambio |
| activar HTTP cantidad2, cuatro unidades | 200 | 200 |

El CHECK protege persistencia, no transforma error500 en validación amigable. Tampoco implica que entrada HTTP acepte negativos: route mantiene su guarda independiente. Los límites mezclan precisión quantity/costo; código/mensaje por caso se conservan sin atribuir automáticamente todos los errores a signo.

## Productores adicionales / estados / sitios

38/38 cadenas con CHECK;54/54 sin CHECK ampliadas, todas rollback:

- Transferencia inmediata ida/vuelta, cantidad conservada10 y ledger -10/+10; origen obsoleto bloqueado.
- Movimiento real a ubicación TRANSITO y recepción al segundo sitio; repetición de recepción bloqueada (8 escenarios baseline).
- Venta y reversión vuelve a DISPONIBLE10.
- Mostrador y salida extraordinaria MERMA terminan cantidad0; venta posterior bloqueada.
- FIFO BOLSA válido2 genera ledger-2; negativo e insuficiencia rechazados.
- Reactivación auditoría sin evidencia rechaza `INVALID_REACTIVATION_EVIDENCE` (8 escenarios baseline). **No es prueba positiva de reactivación con evidencia válida.**
- Reconstrucción caché real se invocó dentro de cada cadena. No se verificó en esta tanda igualdad completa de todas las filas del caché tras reconstrucción.

Una fila de rollo tiene ubicación única y serie UNIQUE; eso no demuestra que todas las vistas/ledger sean coherentes o que un objeto real no se duplique con otra serie. Las pruebas aquí son secuenciales: carreras concurrentes, todos los compuestos de POS/salidas y auditoría válida siguen sin cobertura nueva. Metraje permanece cerrado: no se habilitó ni ejecutó consumo productivo metreado. Costos/pisos/metadatos e inicializadores están inventariados estáticamente, no ensayados como matrices de mutación.

## Prueba NaN / infinito: protección adicional propuesta, NO aplicada

`nonfinite.json`: UPDATE real de cantidad_actual en copia, cada caso rollback a savepoint, fila inicial/final idéntica. NaN **sí cabe en numeric(10,3)** y `NaN >= 0` devuelve true. ±Infinity producen SQLSTATE22003 por typmod. En SQL, Infinity>=0 también es true; no confiar solo en comparación si se cambia typmod.

El CHECK ensayado impide negativos, **no todo valor físico inválido**. PROPUESTA revisada para decisión del dueño, sin ADD nuevo:

`CHECK (cantidad_actual >= 0 AND cantidad_actual <> 'NaN'::numeric)`

La expresión revisada devuelve false para NaN/-2 y true para0/2. La exclusión de ±Infinity depende hoy de numeric(10,3); alternativa futura más explícita: cantidad_actual>=0 AND cantidad_actual NOT IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric). No se aplicó ninguna variante ni se presentó como prueba de constraint instalado. Cantidad_inicial>=0/finita, unidad discreta y relación estado/cantidad siguen propuestas separadas, no decisiones ejecutadas.

## Corruptos existentes / adopción

ADD CHECK normal debe escanear y falla ante negativos existentes. No se saneó automáticamente. NOT VALID omite escaneo inicial pero veta nuevas filas y updates que incumplan, incluso updates de otros campos de una fila corrupta; no certifica/sanea anteriores. VALIDATE falla mientras existan incumplimientos. Inventariar, preservar evidencia y decidir corrección trazable por fila; no convertir todo a cero ni reescribir ledger. La copia contiene negativos del baseline final deliberadamente; no reinstalar ADD normal sobre ella esperando éxito.

Nunca aplicar no-negatividad global a movimientos.cantidad: -2 de consumo y -10 de salida/transferencia son asientos legítimos. CHECK físico no resuelve consistencia entre tablas, estado incompatible ni todos los casos de doble sitio.

## Entrega y límites

Scripts reproducibles build/run/matrix/chains/nonfinite/compare y operador exclusivo MAIN quedan en este directorio. JSON conserva hechos y errores; secretos/handoff quedan privados en .local y fuera de commits. Bundles generados se eliminan al finalizar esta tarea; no se eliminan bases, credenciales ni servidores (responsabilidad MAIN).

Conclusión honesta: METRO/KILO activación negativa reproducida HTTP200 en ambos sitios; además entrada directa acepta negativos en las cuatro unidades. CHECK temporal bloqueó la escritura y preservó atomicidad observada del caso. Adopción/corrección producto pendiente del propietario; no afirmar que todo inventario imposible esté cerrado.