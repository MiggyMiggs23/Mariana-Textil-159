# Stock mínimo y «Qué comprar»: verificación del 2026-09-11

## Estado

**No aprobado para operación.** Se implementó la primera versión y se detectaron fallos. Se conserva sin corregir esos fallos por instrucción expresa del dueño. No se activó la función en ningún sitio mediante esta verificación.

Se ejecutó la migración aditiva mediante el arranque habitual de la API; el registro confirma `ensureStockMinimosSchema` terminado. No se ejecutaron consultas manuales contra la base, no se crearon usuarios ni administradores temporales y no se modificó el motor de inventario.

## Resultado de los doce puntos solicitados

| Punto | Resultado | Evidencia y límite |
|---|---|---|
| 1. Typecheck completo y codegen sin diferencias | Aprobado | `pnpm run typecheck` terminó con código 0. Codegen terminó con código 0; comparación SHA-256 de archivos generados antes/después idéntica. |
| 2. Suites de inventario, reportes, alertas y permisos | Parcial, con fallos | La tanda segura sin DB produjo 59 aprobadas, 2 fallidas y 1 omitida. La suite nueva del motor produjo 8 aprobadas y 1 omitida. Total: 67 aprobadas, 2 fallidas y 2 omitidas. No se ejecutaron las suites de integración que requieren base aislada o crean usuarios. |
| 3. Sitio apagado idéntico al anterior | Parcial; no aprobado completo | Navegador con API simulada: no consulta productos ni muestra sus valores, también al cambiar de sitio. Pruebas del motor verifican el cortocircuito. No se comparó el tablero real ni todas las cifras reales. La revisión encontró que PUT permite guardar configuración de mínimos cuando el sitio está apagado. |
| 4. Encender, capturar mínimos y dejar otros vacíos | Parcial | Navegador: PATCH de habilitación, PUT numérico y PUT con null correctos; mínimo vacío se muestra como «Sin mínimo». El fixture de lectura era estático: no verifica persistencia real. Evaluación pura sin mínimo no abre alerta. |
| 5. Bajar existencia y entregar alerta a destinatarios con enlace | No aprobado completo | Pruebas sintéticas de destinatarios: activos asignados al sitio más ADMIN/SUPERVISOR, sin duplicados. No se redujo inventario real ni se verificó entrega real. Se detectó enlace que no aplica sitio/producto en la pantalla destino. |
| 6. No repetir la alerta | Parcial | Prueba sintética de episodio estable y reapertura después de recuperación aprobada. No se verificó concurrencia ni persistencia de notificaciones en PostgreSQL. |
| 7. Ejecutar reconstruirCacheExistencias y conservar mínimos | No ejecutado | Se verificó separación de tablas en código. La prueba de reconstrucción real fue omitida expresamente: no se ejecutó la función contra la base ni se presenta el análisis del código como sustituto. |
| 8. Poca historia no apaga otros renglones | Parcial | Navegador con dos renglones sintéticos mostró sugerencia en uno e información insuficiente en otro. Las pruebas de umbral pasaron. La historia real calculada desde salidas omite productos sin consumo y requiere corrección. |
| 9. Consumo y venta distintos, advertencia visible | Parcial | Navegador confirma nombres y valores separados y advertencia de no sumar consumo entre sitios. Falta acreditar la clasificación de SALIDA_MOSTRADOR como venta real; la revisión la señala como riesgo de sobreconteo. |
| 10. Abrir sugerencia y comprobar movimientos | No aprobado completo | El diálogo abre y muestra ecuación, movimientos, episodios y conciliación con datos sintéticos. La conciliación del servidor compara dos sumas del mismo conjunto; no demuestra independientemente cada cifra de la fila. Los episodios no guardan el movimiento desencadenante. |
| 11. Una constante y cambio de umbral | Aprobado con alcance limitado | Se confirmó una constante HISTORY_MIN_MONTHS=3. En dos copias del módulo cargadas en memoria se cambió 3→4: la misma fila pasó a «Sin información suficiente» sin alterar venta, existencia, mínimo, cobertura ni meses de historia. El archivo original no se modificó. No se acepta por ello el cálculo de historia de filas sin salidas. |
| 12. Teléfono | Parcial | Reporte revisado a 390×844 con tabla desplazable. No se completó el flujo móvil de captura de mínimos ni la interacción móvil de evidencia. |

## Fallos de pruebas

Archivo: `artifacts/api-server/src/notification-feed.contract.test.ts`.

1. `notification feed is session scoped and publishes three sound families`.
2. `resolved directed payments leave the derived feed immediately and use a persisted notice`.

Son aserciones sobre el código fuente que no coinciden con la implementación actual. No equivalen por sí solas a demostrar una entrega errónea de notificaciones en ejecución. No se modificaron las aserciones ni el código para hacerlas pasar.

## Hallazgos funcionales de la revisión

- **Historia sin consumo:** `aggregateLedgerEvidence`, en `artifacts/api-server/src/lib/reportes-que-comprar.ts`, determina la primera observación a partir de salidas. Un producto recibido hace meses y sin salidas queda con cero meses de historia. La lógica de meses transcurridos usa componentes UTC en lugar del calendario local.
- **Faltantes fuera del periodo:** la consulta de episodios solo limita la fecha superior; el conteo puede incluir episodios anteriores al periodo.
- **Venta real:** `CUSTOMER_SALE_TYPES` incluye `SALIDA_MOSTRADOR`. Ese movimiento acredita salida física; falta demostrar su correspondencia con venta efectiva al cliente, sin doble conteo.
- **Conciliación no independiente:** `buildEvidenceReconciliation` calcula ambos lados desde el mismo conjunto de movimientos. No contrasta de forma independiente meses, venta real, cobertura y episodios mostrados.
- **Episodios sin movimiento origen:** `artifacts/api-server/src/lib/stock-minimos.ts` inserta episodios sin `movimiento_id`; falta la trazabilidad pedida hasta el movimiento desencadenante.
- **Señal de inmovilidad:** el servidor entrega `noMovimiento`; el componente `artifacts/mariana-textil/src/components/reportes/que-comprar-report.tsx` interpreta otras claves. La señal no aparece correctamente.
- **Enlace de alerta:** `artifacts/api-server/src/routes/notificaciones.ts` enlaza a `/inventario?ubicacionId=…&productoId=…`, pero Inventario no aplica esos parámetros al selector del encabezado y al producto.
- **Captura con sitio apagado:** el servicio admite PUT de mínimo aun con la función apagada. La interfaz oculta la captura, pero falta la restricción equivalente en el servidor.

No se corrigieron estos hallazgos automáticamente.

## Alcance preservado

- Destinatarios confirmados por el dueño: todos los activos asignados al sitio, más ADMIN y SUPERVISOR.
- No se creó campo de encargado. La posible designación de responsable quedó pendiente en `replit.md`.
- Se trasladó solo el mapa Mes × color. No se retiraron tablas ni pestañas.
- El archivo del motor de inventario permanece sin cambios.
- No se añadieron cálculos monetarios ni plazos de reposición inventados.
- No se considera la igualdad de una respuesta simulada una prueba de persistencia o de exactitud de datos reales.

## Ejecuciones adicionales

La API y la interfaz arrancan. La captura no autenticada muestra el acceso de sesión, sin fallo de renderizado. Las pruebas de navegador usaron exclusivamente interceptaciones de API y datos sintéticos.

Una invocación inicial de pruebas desde la raíz no encontró `tsx` y no ejecutó pruebas; se utilizó el comando correcto dentro de `@workspace/api-server`. No hubo cambios de aplicación para resolver ese error de invocación.