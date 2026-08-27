# Parte 3 — Precios en tres pestañas y costeo de la venta metreada

Fecha de validación: 2026-08-26

## Resultado

**APROBADO**

La Parte 3 quedó implementada y verificada de extremo a extremo. No se desarrolló ningún reporte ni alcance de la Parte 4.

## Alcance entregado

1. **Costo de referencia metreado**
   - Promedio simple del costo por metro de cada rollo recibido en los últimos 12 meses corridos.
   - Cada rollo pesa una vez, sin ponderar por cantidad.
   - La fecha autoritativa es `entradas.fecha`.
   - Los costos nulos no participan.
   - Sin compras en el periodo se usa el último costo conocido y se marca como antiguo.
   - Sin historia se conserva un estado explícito sin costo; nunca se inventa cero.
   - La media usa centavos enteros y redondeo determinista half-up; no depende de punto flotante.

2. **Interruptor por producto**
   - `se_vende_por_metro` es falso por defecto.
   - Solo ADMIN puede modificarlo desde Precios.
   - Los productos en kilos no pueden habilitarlo, tanto por API como por restricción de base de datos.
   - El servidor POS rechaza venta metreada cuando el interruptor está apagado.

3. **Tres modalidades de precio**
   - Rollo, Mayoreo y Menudeo se editan e historizan de forma independiente.
   - Rollo usa costo promedio ponderado de rollos con existencia actual.
   - Mayoreo y Menudeo usan el promedio simple por rollo recibido en los últimos 12 meses.
   - Lista, detalle, historial, gráfica, auditoría y semáforo responden a la modalidad activa.
   - La procedencia del costo se muestra directamente en ambas pantallas, junto con los estados de costo antiguo y sin costo.
   - La compatibilidad de llamadas antiguas conserva Rollo como modalidad por defecto.

4. **Regla POS Mayoreo/Menudeo**
   - Una única constante compartida fija el umbral en 10 metros.
   - `10.000` o más usa Mayoreo; menos de `10.000` usa Menudeo.
   - La evaluación es por línea de producto/color y no acumula líneas ni tickets.
   - El servidor persiste la sugerencia correspondiente.
   - El precio capturado sigue siendo libre. Un precio bajo costo muestra advertencia, pero no bloquea.
   - La falta de precio configurado falla explícitamente.

5. **Costo congelado**
   - Cada línea metreada calcula el costo una sola vez al emitir el ticket.
   - Se congelan costo unitario y costo total con el mismo instante de `tickets.created_at`.
   - El producto cantidad × dinero usa aritmética entera exacta y redondeo half-up.
   - Recepciones posteriores no alteran tickets ya emitidos.
   - Sin historia, ambos costos permanecen nulos.
   - La base exige el par completo de costos o ambos nulos y prohíbe `rollo_id` en líneas metreadas.

## Seguridad y compatibilidad

- Los endpoints de Precios permanecen restringidos a ADMIN.
- La UI no es la única barrera: reglas de modalidad, kilos e interruptor se validan en servidor y base.
- Precio cero o nulo no produce `Infinity` ni `-Infinity`.
- Las migraciones de arranque son repetibles y conservan datos históricos.
- La revisión arquitectónica final dio **PASS**, sin bloqueadores de seguridad, precisión decimal, promedio no ponderado, congelado no retroactivo ni alcance indebido.

## Pruebas automatizadas

| Verificación | Resultado |
| --- | ---: |
| Typecheck completo del workspace | APROBADO |
| Precios y costo de referencia, unitarias | 9/9 |
| Regla compartida de 10 m | 2/2 |
| Contratos frontend | 16/16 |
| Precios y costo de referencia, integración Neon | 2/2 |
| POS/caja completo | 22/22 |
| Migración final de tipos de línea | 1/1 |
| `git diff --check` | APROBADO |

Las pruebas que escribieron datos se ejecutaron exclusivamente en una rama Neon desechable y en una base vacía creada dentro de ella. `current_database()` se verificó antes de ejecutar la matriz. No se crearon usuarios, sesiones ni fixtures en development. La rama y la URL temporal se eliminaron al finalizar.

## Evidencia E2E protegida

La API se apuntó temporalmente a la rama Neon desechable y se recorrieron las pantallas con una sesión ADMIN creada únicamente por el seed aislado:

- Las tres pestañas de Precios cargaron y mostraron sus precios y bases de costo correctos.
- El producto por metro mostró Mayoreo 120, Menudeo 150 y costo de referencia 50.
- El producto en kilos mostró bloqueado el interruptor y las modalidades metreadas.
- El detalle mostró historial y gráfica por modalidad, sin texto `Infinity`.
- POS sugirió Menudeo 150 en `9.999` m, Mayoreo 120 en `10.000` m y volvió a Menudeo 150 al bajar.
- Con `9.999` m y precio capturado 49 contra costo 50, la advertencia permaneció visible y **Confirmar Venta** quedó habilitado.
- No se emitió ningún ticket durante la prueba visual.

La primera pasada E2E descubrió que editar manualmente un precio metreado podía dejar la línea en estado transitorio `idle`. Se corrigió para que solo las líneas por rollo requieran validación asíncrona; la repetición pasó correctamente.

## Estado operativo final

- API Server: ejecutándose sin errores de arranque.
- Mariana Textil web: ejecutándose.
- Esquemas de venta por metro, precios y líneas de ticket: verificados en arranque.
- Base y workflows normales restaurados después de la E2E aislada.
