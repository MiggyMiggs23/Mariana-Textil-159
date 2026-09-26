# Tarea 2 — resultados terminales, no cumple todavía

**Entorno destruido al cierre, 26/09/2026 04:23 UTC:** MAIN detuvo el
launcher y autorizó la limpieza. Se eliminó únicamente la rama
`br-steep-field-axnpxgd0`; consulta independiente posterior devolvió
**HTTP 404 branch not found**. Puertos 18227/18228 sin escucha
(`ECONNREFUSED`). Se eliminaron los 735 archivos privados propios de
`/tmp/noche-20260926` y 44 de `private.local/night-disposable`, incluidos
dump, credenciales, sesiones y entorno. Informes/capturas/scripts permanecen.
`cleanup.json` acredita la limpieza y una consulta a appDB en READ ONLY:
2,575 clientes no sistema; cero administrador, sitios, productos, rollos,
tickets anuales e índice experimental propios de esta tarea.
No es una afirmación de igualdad completa de la base ni de ausencia de
fixtures históricos ajenos. Las frases de conservación de más abajo
describen los relevos anteriores a esta autorización final.

**Cierre complementario de cobros:** MAIN entregó seis tickets nativos
nuevos de un sitio con caja abierta; ya se midieron y cobraron correctamente.
El bloqueo histórico de los IDs 2–7 se preserva, pero **no bloquea ahora
la medición de pago**. Véase el apartado final y `payment-fresh/result.json`.

## Entorno y carga efectivamente usados

API congelada final SHA-256
`e62a79333d0ee1433c114656af980e33ff420b728688a121ee586efdfab1b30d`;
frontend mensaje, sin candidato RFC de proveedores. Neon desechable
`noche_20260926`, rama `br-steep-field-axnpxgd0`. Se mantuvo la base de
aplicación sin escrituras ni DDL. La copia inicial contenía 2,575 clientes
no sistema y el cliente sistema. Los workers anteriores añadieron dos
clientes sintéticos: al medir hubo 2,578 filas totales, de las cuales
2,575 son las heredadas solicitadas.

Carga **confirmada mediante COMMIT y recuentos posteriores**, no sólo
generada: 54,750 tickets nuevos, 54,750 líneas/rollos, 41,063 pagos y
13,687 movimientos de crédito; totals incluidos casos de otros workers:
54,762 tickets, 54,762 líneas, 41,065 pagos, 13,692 movimientos.
Tres tiendas sintéticas × 50 tickets/día × 365 días, del 27/09/2025 al
26/09/2026; cuatro productos METRO y distribución circular entre los
2,575 clientes heredados. Esto es un supuesto explícito de carga, **no**
actividad anual real ni simulación de corrección contable de productores.
Los documentos de carga histórica SQL no se usaron para certificar cobros.

`load-results.json` registra 671.3 segundos de carga. Un primer intento
falló y se revirtió por timeout de 180 segundos al comprobar restricciones;
la repetición usó 900 segundos y terminó. No se deshabilitaron triggers,
no se forzó réplica y no se omiten las guardas E5/E11.

## Navegador real, sesión real, antes/después

Tiempos en segundos; mediana y máximo de muestras exitosas. Chromium real,
viewport 1360×1000, sesión nueva por muestra, login y selección inicial
fuera del intervalo. JSON por intento, peticiones y capturas en
`measurements/`; agregación en `summary.json`.

| Operación | Antes mediana / máximo | Con índice mediana / máximo | Resultado |
|---|---:|---:|---|
| Lista de clientes | 2.689 / 3.128 (3) | 2.634 / 2.678 (3) | Falla objetivo de 2 s |
| Buscar nombre existente | 1.333 / 1.390 (3) | 1.268 / 1.330 (3) | Cumple 2 s en estas muestras |
| Estado de cuenta | Sin muestra limpia | Sin muestra limpia | Se renderizó E7 en 6.905–8.009 s, pero solicitudes auxiliares 500: **ERROR**, no éxito |
| Cobro real | Bloqueado | No ejecutado | Sesión del sitio de los tickets ya cerrada; apertura nativa 409 |
| Abrir diálogo de corte | 1.970 / 1.970 (2) | 1.581 / 1.934 (3) | Cumple para diálogo; **no mide confirmar cierre** |
| Crédito, rango anual explícito | 11.792 / 12.355 (3) | 11.496 / 12.024 (3) | Falla objetivo de 3 s |

La primera muestra de corte falló en el arnés: navegación completa reinició
el contexto de sitio a Vista Global. Se corrigió seleccionando el sitio
después de navegar; ese intento fallido permanece en el informe, no fue
reemplazado ni contado como éxito. Las otras operaciones que hacen
navegación completa leen alcance global; la lista usa el sitio sintético
seleccionado, conservando deuda global por contrato. No son pruebas de
red móvil o navegador físico de la tienda.

El crédito sí envió `periodo=personalizado&desde=2025-09-27&hasta=2026-09-26`.
No se presenta un filtro mensual predeterminado como cobertura anual.

## Índice ensayado sólo en copia y rechazado

La evidencia previa mostró aproximadamente 52,017 búsquedas de líneas
por ticket y 156,051 bloques de buffer en ese agregado, además del reporte
anual lento. Se ensayó un índice cubriente
`noche_perf_ticket_lineas_cover(ticket_id) INCLUDE
(importe,costo_total_congelado,tipo)` únicamente sobre la copia.
Se conservó todo índice existente, incluidos los dos candidatos históricos
ya instalados; no se borraron para producir una mejora artificial.

El agregado SQL de diagnóstico pasó de **151.382 ms a 184.663 ms**;
el navegador siguió por encima de los objetivos. El ensayo **no demuestra
mejora**: se rechazó y se retiró solamente ese índice temporal de la copia.
No hay DDL recomendado para producción en este resultado.
Evidencia: `indexes-before.json`, `index-experiment.json`,
`index-decision.json`. El agregado SQL es diagnóstico representativo,
no sustituto del tiempo íntegro del endpoint o navegador.

En una muestra del reporte, la petición de clientes duró ~2.066 s mientras
la vista lista requirió ~11.677 s. Por ello no es correcto atribuir todo
el tiempo a un índice faltante; hacen falta perfilado de renderizado y
revisión de carga de pantalla. No se cambió fuente ni bundle congelado.

## Bloqueos y efectos preservados

* Los seis tickets nativos entregados, IDs 2–7, pertenecen al sitio 1.
  Su sesión de caja 1 ya estaba CERRADA; abrir otra el mismo día devuelve
  409 «Ya existe una sesión de caja para la fecha operativa de hoy,
  abierta o cerrada». Las sesiones sintéticas 5–7 corresponden a otros
  sitios y no autorizan trasladar esos tickets. `payment-blocker.json`
  prueba que los seis siguen sin cobrar. No se reescribió el sitio, la
  fecha o la historia de una sesión cerrada, ni se inventó un tiempo de pago.
* Estado de cuenta: `/api/clientes/8/comportamiento-pago` y
  `/api/clientes/cartera` devolvieron HTTP 500. El panel E7 posterior
  devolvió 200, pero no blanquea los errores anteriores de la pantalla.
  MAIN debe diagnosticar la causa con sus herramientas y revisar los
  500/503 de otros recorridos. Este worker no leyó logs de API/workflows
  debido a su restricción de alcance; conserva evidencia HTTP y SQL.
* Durante el COMMIT masivo pendiente, una prueba de UPDATE de usuario
  dentro de transacción revertida devolvió SQLSTATE 40001, «E5: grafo
  ocupado; abortar transacción completa, sin espera global». El login
  concurrente de esa ventana devolvió 500; tras terminar la carga los
  logins usados para estas muestras fueron 200. No confundir ese efecto
  de carga con la causa de los 500 previos del worker de flujos.

**Ventana de escritura liberada.** Ningún loader quedó ejecutándose.
API y proxy siguen a disposición de MAIN; no se reiniciaron ni se
destruyeron. La rama, copia y secretos privados deben limpiarse únicamente
cuando MAIN autorice el cierre global. No se hicieron commits.

## Complemento final: seis cobros reales, objetivo cumplido

MAIN autorizó una última ventana con los tickets nativos
109513–109518 (folios 13–18), generados mediante entrada/POS reales de la
copia, todos del sitio 840 **NOCHE PERF 1**, sesión abierta 5.
No se recargó el año ni se tocaron índices. Se midió desde pulsar
**Confirmar Pago** hasta confirmación visible exitosa y dos frames de
renderizado, con sesión real nueva por muestra.

| Ticket | Importe | Tiempo navegador | POST |
|---|---:|---:|---|
| 109513 | 100.00 | 1.602 s | 200 |
| 109514 | 100.00 | 1.505 s | 200 |
| 109515 | 100.00 | 1.518 s | 200 |
| 109516 | 100.00 | 1.372 s | 200 |
| 109517 | 100.00 | 1.508 s | 200 |
| 109518 | 100.00 | 1.522 s | 200 |

**6/6 PASS; mediana 1.513 s, máximo 1.602 s; todos menores de 2 s.**
Lectura SQL posterior independiente, transacción READ ONLY: cada ticket
cobrado, exactamente un pago en EFECTIVO de 100.00, sesión 5 y sitio 840.
Los seis tickets antiguos 2–7 siguen sin cobrar. No se duplicó ningún pago.

El API es el mismo SHA congelado. Esta pasada usa el frontend aprobado por
MAIN para la corrección de inventario PIEZA, `index.html` SHA-256
`09e9fb57f7fc495b98107b86d796e5cbce980aa5755a62a6bb47a87bd98ad9c9`;
MAIN declaró que ese cambio no toca el pago. Por tanto se registra la
versión diferente, **no** se afirma que sea el bundle mensaje anterior.
Las etiquetas `before`/`after` de estos seis fixtures son dos cohortes
del mismo estado; **no** constituyen una comparación de índices.

Hubo un intento previo sin escritura que abrió Cartera en vez de Caja
operativa; falló al buscar Cobrar y está archivado como
`payment-fresh/blocked-cartera-route-attempt.json`. Se corrigió la navegación
antes de confirmar el primer pago. Los seis resultados/capturas finales y
la lectura independiente están en `payment-fresh/`.

Ventana final liberada; servidor/copia conservados para la destrucción
global que autorice MAIN después de detener su launcher.