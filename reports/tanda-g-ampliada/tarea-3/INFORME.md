# Tarea 3 — simulación mensual ampliada

## Estado y bloqueo

Preparado el arnés; **no se han ejecutado días ni se afirma resultado mensual**.
La entrega inicial MAIN contiene `tanda_ga_month` dentro del clúster compartido
55442. Adelantar el reloj de ese postmaster afectaría las otras bases de los
trabajadores, por lo que no se hace. Se requiere un postmaster exclusivo para la
copia mensual y un reloj de proceso aislado compartido por PostgreSQL y el arnés.
No basta con cambiar `Date` de JavaScript: `abrirSesionCaja` obtiene la fecha de
PostgreSQL. No se borra `sesiones_caja_dias`, no se reescribe historia, no se
modifican funciones SQL ni reglas de negocio. MAIN controla preparación y arranque.

## Ejecución preparada

1. MAIN debe restaurar la copia mensual en su postmaster exclusivo. Mantener el
   nombre `tanda_ga_month`, los siete sitios y cuatro unidades del manifiesto.
2. Proveer `MONTH_DATA_DIRECTORY`, `MONTH_PG_PORT`,
   `MONTH_CLOCK_EXCLUSIVE=MAIN_CONFIRMED_NO_OTHER_WORKER_DATABASES` y
   `MONTH_CLOCK_CONTROLLER` (ejecutable privado bajo `.local/tanda-g-ampliada/`).
   El controlador recibe un instante ISO UTC, avanza exclusivamente el reloj de
   procesos de ese postmaster y del arnés, sin escribir filas históricas.
   Ejemplo de mecanismo admisible: libfaketime con fichero de timestamp compartido
   sólo por dichos procesos; los temporizadores monotónicos deben quedar reales.
3. Compilar con `node reports/tanda-g-ampliada/tarea-3/build.mjs`.
4. MAIN ejecuta `.local/tanda-g-ampliada/month-run.mjs` con
   `NODE_ENV=test`, `REQUIRE_ISOLATED_TEST_DATABASE=1`, `TEST_DATABASE_URL`
   apuntando exclusivamente a la copia mensual y las variables de aislamiento
   del paquete DB apuntando a un testigo local distinto, nunca la base app.
   No se deben publicar credenciales ni variables de conexión en los resultados.

No reutilizar una copia parcialmente consumida como si fuese nueva; el arnés
rechaza un diario previo. Una falla conserva `results.json`, `journal.jsonl` y
el paso pendiente si hubo interrupción. Los fallos de productores se reportan:
no se corrigen alterando el producto ni abriendo compuertas.

## Supuestos y verificaciones

Carga sintética razonable y modesta, **no volumen comercial observado**:
30 fechas consecutivas; tres tiendas; cuatro bodegas; entrada diaria por sitio
con cuatro paquetes/rollos de diez unidades de cada producto nativo; cuatro
transferencias diarias bodega→tienda; por tienda/día cuatro tickets de contado y
cuatro notas de crédito, abonos antes de la siguiente exposición, anticipo de
100, salida E4 de 100, cancelación de ticket no cobrado y corte diario.
El anticipo queda disponible para la siguiente nota, no se elimina por SQL.

Productores reales del código congelado y PostgreSQL real. El abono llama al
handler final real de clientes con actor real; **no acredita cobertura HTTP ni
middleware**. Las transferencias usan el productor inmediato real y no acreditan
el flujo documental completo de salidas. Las cancelaciones son no cobradas, no
reembolsos de ventas cobradas.

Cada paso escribe antes/después y expectativas de saldo de cliente e inventario
por sitio/producto/unidad (28 celdas), comparando físico, caché y ledger.
Incluye rollos individuales, movimientos de crédito, sesiones, cobros y salidas
de caja. Los cortes se conservan por sesión y se exige diferencia cero.
Después de cada cierre se intenta abrir de nuevo y se exige el rechazo de una
sesión por sitio/fecha, preservando la regla de producción.

Cada paso también compara el efectivo esperado del último corte de cada tienda
contra deltas independientes del escenario: cobro +1500, abono +importe,
anticipo +100, E4 -100 y cero para las demás operaciones. Una nueva sesión debe
partir de 5000. Esto complementa, sin sustituirlo, el cierre con diferencia cero.