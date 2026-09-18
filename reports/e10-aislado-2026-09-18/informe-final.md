# E10 Fondo de Mariana — resultado de la fase aislada

## Estado
Ensayo funcional aislado aprobado. E10 permanece deshabilitado en la operativa y NO se declara cerrado. No se aplicó SQL a heliumdb; su aplicación necesita autorización separada. No se construyeron E9/E12 ni se retomó E1.

## Destino y conservación
Copia retenida: socket /tmp/e10-0918-pg, puerto 55432, base e10_ensayo_20260918, systemIdentifier 7686927739928200230. PostgreSQL sin TCP. El arnés rechaza otros destinos antes de conectar y comprueba la identidad efectiva. No se crearon usuarios ni sesiones. Los 31 usuarios existentes permanecen iguales; sesiones: 0. El servidor privado de navegador está detenido; la copia se conserva hasta el cierre completo.

## Resultados solicitados
- PostgreSQL + router HTTP real: PASS, 211 aserciones.
- Conciliación al centavo entre saldo e historial; final tras navegador: 18 movimientos, -1000.00. Es un saldo ficticio deliberadamente negativo por pruebas de inversos, NO un saldo inicial operativo.
- Arqueos con sobrante +5.50 y faltante -10.25 persistidos y comprobados desde nuevas conexiones. La prueba de navegador confirmó cierre, recarga y persistencia del sobrante.
- Inverso exacto: el original permanece, con enlace a la corrección; no se permite invertir dos veces ni invertir un inverso.
- Retiro ordinario sin fondos rechazado; un inverso contable sí puede dejar saldo negativo.
- Mariana fija; solicitudes que intentan otra ubicación o campos no autorizados rechazadas.
- Sólo ADMIN obtiene datos en endpoints y CSV. Auditoría genérica excluye Fondo para no-ADMIN aunque posean permiso de auditoría. Notificaciones genéricas excluyen Fondo.
- Navegador privado: ingreso 2000.25, arqueo 1005.75 con diferencia 5.50, inverso 2000.25 y CSV real con ambas filas: PASS. Sin login ni renovación de sesión.
- Verificación final sólo lectura: las 66 tablas originales conservaron conteos y hashes de filas; auditoría conservó exactamente sus 3454 filas originales no-Fondo. Únicas adiciones permitidas: tres tablas Fondo y 21 eventos de auditoría Fondo.

## Lectores financieros canónicos, antes y después
Alcance ADMIN global, clientes activos; ventana 2000-01-01 a 2099-12-31. Se ejecutaron las funciones de producción, no fórmulas estimadas ni resultados de caché.

| Indicador | Antes | Después |
|---|---:|---:|
| Ventas | 16000.00 | 16000.00 |
| Contado cobrado | 0.00 | 0.00 |
| Cobranza de clientes | 0.00 | 0.00 |
| Deuda de clientes / cartera FIFO | 0.00 | 0.00 |

También se comprobó igualdad inmediatamente después de cada movimiento suplementario, no sólo al acabar una secuencia con efecto neto cero.

## Tiempos medidos
| Fase | Duración |
|---|---:|
| Snapshot | 801.341 ms |
| Dump | 1094.057 ms |
| Inicialización del clúster | 6485.327 ms |
| Verificación semántica de la copia | 247.103 ms |
| Aplicación atómica del DDL | 2661.091 ms |
| Proceso final de ensayo funcional | 2409.533 ms |
| Verificación sólo lectura posterior al navegador | 952.982 ms |
| Suite backend permitida | 8197.311 ms |
| Suite frontend permitida | 62351.734 ms |

La restauración terminó y fue verificada, pero su duración real no quedó medida. Se descartó una cifra que medía una reentrada sin trabajo. Tampoco se atribuye una duración inventada al suplemento TRUNCATE. Estas fases ocurrieron en intentos distintos; no se suman como duración total del proyecto.

## Verificación de código y límites de aceptación
- Selección segura actual: backend 69/69, frontend 368/368; ambos controles de bloqueo de red aprobados. 101 archivos en el manifiesto frontend, conservando los 100 originales.
- Baseline aislada HEAD: backend 59/59 y frontend 361/361.
- Build frontend aprobado. Se reconstruyó con Fondo deshabilitado tras el navegador; no se habilitaron variables globales.
- Typecheck frontend aprobado; E10 sin diagnósticos. El typecheck raíz sigue con seis errores de E1, reproducidos exactamente en HEAD anterior. No se modificaron para salir del alcance.
- No se ejecutó la suite integral que crea usuarios/sesiones, seeds u otros movimientos heredados. Las selecciones seguras NO equivalen a toda la suite del repositorio.
- Hay evidencia semántica RED de mutantes reales de dinero, guard ADMIN, payload, evidencia inicial, CSV, privacidad, caché por rol y exportación pendiente. No se acredita como prueba semántica la mera detección textual de código. No se afirma cobertura de mutación completa de cada prueba nueva: faltan, entre otros, mutantes de retirada de triggers y de planificación concurrente.
- En la prueba móvil se detectó desbordamiento en las cabeceras de detalle; se corrigió el acomodo y el build pasó. No se repitió el recorrido completo de navegador tras ese ajuste de estilos.

## SQL operativo para revisión — NO APLICADO
Archivo: reports/e10-aislado-2026-09-18/sql/operativo.sql
SHA-256: a7eb52a85b3b3b6072d1b88941b9998bcafe15b253e52b0520b8bfc8cc43cdb4
30 sentencias superiores; tres tablas, una secuencia, ocho índices explícitos, cuatro funciones y ocho triggers, además de claves y restricciones. Sólo inserta metadata del Fondo fijo; NO carga dinero inicial. Inventario: sql/inventario-objetos.md.

La versión consolidada contiene los tres bloqueos BEFORE TRUNCATE. El suplemento pertenece al historial del ensayo, no debe aplicarse además del SQL consolidado sobre una instalación nueva.

## Evidencia principal
- rehearsal-resultados.json: ensayo, tiempos y lectores canónicos.
- post-browser-preservacion.json: comparación final contra el baseline original.
- browser-resultados.json: recorrido real y capturas.
- current-safe-final.log: selección segura final sin fallos.
- baseline-typecheck.log y typecheck-final.log: atribución de los seis errores previos.
- suite-inventario.md: selección permitida y suites bloqueadas.
- mutantes-resultados.json y reportes específicos: alcance real y límites de pruebas negativas.

No se solicita ni se presume autorización operativa en este informe.
