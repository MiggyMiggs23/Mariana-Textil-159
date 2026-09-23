# Tanda D — informe único de cierre

**23 de septiembre de 2026. Procedimiento simple, datos de prueba.**

Autorización íntegra: `autorizacion.txt`. No se ejecutó purga general, no se
repitieron los cinco SQL de Tanda B ya instalados y no se abrieron dirigido,
retenido, devolución, atribución ni Fondo. Remate y E11 limitado se abrieron
con el alcance de los puntos 1 y 2, respectivamente.

## Resultado por tarea y commits separados

| Tarea | Resultado | Commit |
|---|---|---|
| 1. Remate conectado a venta, precio mínimo y borrado individual | **LIBERADA**, con límites de verificación de pantalla indicados abajo | `40a543e` |
| 2. Liberar Tanda B sin decisiones pendientes | **PARCIAL**: E11 lectores/conciliación liberados; E4 detenido técnicamente; demás puertas cerradas | `3867545` |
| 3. Cerrar suite pagos-dirigidos | **DETENIDA**, sin forzar apertura ni declarar verde | `02776df` |
| 4. Preparar purga final sin ejecutar | **PLAN PREPARADO**, ejecución NO-GO hasta resolver requisitos explícitos | `7d8373e` |

El commit adicional de integración conserva los outputs API/UI efectivamente
servidos, configuración de workflows, pruebas HTTP/UI y este informe.
No mezcla los cuatro commits de tarea ni representa otra apertura.

## 1. Remate, precio mínimo y borrado individual

- Marca de remate por **rollo/fuente física**, no una autorización genérica
  por producto o por una bandera enviada desde el navegador.
- Permiso `marcar_remate/autorizar` en matriz: **ADMIN de inicio**, resto
  denegado en ausencia de personalización. Las personalizaciones se conservan.
- ADMIN puede retirar la marca con **motivo obligatorio**; se conserva la
  auditoría. El control de UI está en el detalle del rollo.
- La venta consume la autorización de sus fuentes físicas, incluidas
  BOLSA/FIFO. El detalle de venta conserva la señal histórica de remate;
  retirar después la marca no elimina esa evidencia ni oculta pérdidas.
- Precio mínimo habilitado en Precios individual y masivo: no permite bajar
  del costo cuando existe costo válido. Igual al costo y aumentos se permiten.
  Costo ausente permite asignar precio conforme a la decisión previa; costo
  inválido no se convierte silenciosamente en cero.
- Borrado individual habilitado para producto sin movimientos, existencia
  cero y ADMIN; conserva auditoría y reserva de SKU. **No es purga general.**

SQL aplicado: `tarea1-up.sql`, exclusivamente la tabla `tarea4_rollo_remate`
con sus restricciones. Probado íntegro en PostgreSQL desechable antes de
aplicarlo a la base API. Resultado real: **BEGIN / CREATE TABLE / COMMIT,
exit 0**, sin reparación ni recorte. El clúster de ensayo se detuvo y su
directorio se destruyó. No se insertaron marcas de prueba en la base API.

Verificación: codegen, typecheck API/UI, 9 pruebas unitarias, 4 DOM sobre
componentes reales y 1 integración PostgreSQL de handler/adaptador/resolver,
todas PASS. Incluye motivo, rol, personalización, alcance, auditoría
transaccional y candado compatible con venta. Los mutantes negativos
fallaron y las fuentes restauradas pasaron.

**Límite:** esa integración no ejecutó `crearTicket` de extremo a extremo,
ni borrado/precios contra un esquema completo. No se presenta una venta
financiera autenticada por navegador como probada. Hay cobertura aislada,
build servido y controles de arranque; la aceptación completa queda pendiente.

## 2. E11 limitado y puertas que quedan

Liberados API/UI: **lectura fiscal, lectura financiera saneada según perfil,
identidad y conciliación documental**. La conciliación no paga ni acepta
dinero automáticamente. F por defecto sigue siendo solo fiscal; no se
asignaron usuarios A ni se abrió preparación E5.

Suite completa E11 más pruebas de esta apertura: **69/69 PASS, cero skips**.
Los escenarios OFF se conservan con runtime aislado. La asignación con
subgate cerrado se rechaza antes de SQL, incluso para ADMIN.

| Puerta que permanece cerrada | Qué habilita / qué falta |
|---|---|
| `E4_CASH_OUT_ENABLED` API/UI | Salidas extraordinarias y a proveedor. **Bloqueo técnico**, no decisión pendiente: el control de saldo está acoplado a E12 OFF. Hay que separar y verificar insuficiencia de caja y excepción ADMIN motivada antes de abrir. No abrí Fondo para evitar el bloqueo. |
| `E12_SUPPLIER_CASH_ENABLED` / `E12_ENABLED` | Pagos a proveedor desde caja/Fondo, mezcla e inversos a sus orígenes. Requiere autorización explícita de conexión con Fondo y reconocimiento del saldo inicial que corresponda. Las reglas de insuficiencia/inversos ya están decididas; no se pregunta de nuevo por ellas. |
| `E9_ENABLED` API/UI | Entrega completa de tiendas y recepción que genera ingreso en Fondo. Falta autorizar esa conexión y Fondo operativo con saldo inicial sin duplicaciones. Su gate también abre comandos: no se encendió como supuesto visor. |
| `E3_DIRECTED_ENABLED` | Abono dirigido, distinto de abono ordinario. Falta apertura expresa y validación de su procedencia física; el efectivo ordinario abierto no autoriza `ABONO_DIRIGIDO`. |
| `E5_ENABLED` API/UI | Dirigido retenido, propuestas, aplicación y devolución del cobro nunca aplicado. Requiere apertura expresa de esas operaciones y de Fondo si se usa para devolución. No basta con tener instaladas sus tablas. |
| `E5_CONTADOR_A_ENABLED` y `E11_E5_PREPARATION_ENABLED` | Permitir a CONTADOR con perfil A vigente preparar propuestas E5, sin autorizar dinero. Depende de apertura E5 y autorización del puente de preparación. |
| `E11_PROFILE_ASSIGNMENT_ENABLED` API/UI | Asignación de perfiles A. La selección nominal de quién será A corresponde al propietario; no la inventó el agente. No impide las lecturas F ya habilitadas. |
| `E7_ENABLED` API/UI | Atribución/lectores dependientes de E5. Sigue cerrada por autorización pendiente y dependencia de E5; abrir solo E7 provocaría 503 por diseño. |
| Fondo y devolución física/atribución no incluidas arriba | Mantienen sus guardas particulares; no se abren por cambiar un gate de lectura. Hace falta autorización explícita de esos flujos y comprobar sus dependencias. |

E11 mantiene la revocación defensiva A→F por cambio de rol/actividad y la
recuperación administrativa documental de operaciones. Esa recuperación no
ejecuta productores ni mueve dinero. No amplía la asignación de perfiles.

## 3. Pagos dirigidos: motivo exacto de detención

E3 ordinario abierto solo exceptúa `ABONO_ORDINARIO`; el caso físico
`ABONO_DIRIGIDO` continúa cerrado. Además, la fixture de la suite necesita
identidad E1 y sesión de caja válidas. No se reemplazaron por bypass.

La evidencia integral previa permanece **27/28 e INCOMPLETE_OR_FAIL**.
La pasada pura de esta tarea produjo **37 PASS, 2 FAIL, 0 skips (39 pruebas)**.
Los dos fallos son expectativas estáticas antiguas sobre pestaña/exportación
independiente de pagos dirigidos; no se eliminaron para fabricar un verde.
Por tanto, **la suite no queda cerrada**. No abrí ninguna puerta para hacerla pasar.

## 4. Purga final: qué queda listo y qué está detenido

Plan detallado en `purga-final-preparada.md`, preparado sin ejecutar:

- **Conservar:** catálogos de productos/clientes/proveedores, precios y costos,
  usuarios, permisos y personalizaciones, sitios y configuración, perfiles,
  definiciones DDL de recuperación y auditoría permanente.
- **Borrado candidato, solo con alcance futuro aprobado:** documentos y líneas
  de prueba, movimientos/crédito/pagos y sus aplicaciones, rollos e inventario
  operativo, logística, cajas/cortes y evidencia operativa E1/E2/E3/E4/E12/E9/E5/E11.
  Una clasificación candidata no autoriza hoy a borrar evidencia append-only.
- **Remate nuevo:** marcas activas de rollos de prueba antes de borrar esos
  rollos, únicamente si ambos están autorizados; conservar marcas de rollos
  conservados, permisos de matriz y auditoría de alta/retiro.
- **Contadores y secuencias:** conservar por defecto. Cualquier reset requiere
  objetivo por clave/campo y prevención de reutilización/colisión.
- **Orden:** identificar destino y catálogo vigente; clasificar todas las
  tablas/filas y dependencias lógicas; verificar respaldo restaurado; ensayar;
  eliminar hijos/vínculos antes de padres según grafo real; reconstruir
  derivados con funciones canónicas; comprobar restricciones diferidas,
  secuencias, referencias y comparación íntegra de datos conservados.
  No existe un orden seguro de DELETE que por sí solo venza append-only.
- **Archivos:** conservar documentos de catálogos; los objetos externos
  candidatos requieren inventario de referencias y una fase explícita
  posterior. Un rollback SQL no restaura objetos borrados.
- **Verificación:** no basta contar filas: comparar valores completos de lo
  conservado, comprobar ausencia exacta de lo aprobado para borrar, cero
  huérfanos, saldos/derivados coherentes y permisos/protecciones intactos.

**NO-GO técnico para ejecutar:** los operadores históricos no cubren todas
las protecciones append-only y tablas nuevas. Falta un mecanismo de excepción
expreso, estrecho y ensayado; no preparé un bypass, TRUNCATE evasivo ni
desactivación de triggers. También faltan catálogo vivo final, respaldo fresco
restaurado y autorización de ejecución. El plan está preparado, **no un
operador ejecutable aprobado**.

Al decidir el propietario comenzar con datos reales, termina la regla simple
y se restablece el procedimiento completo antes de la purga final. No se
ejecutó ahora ninguna purga, ni siquiera su dry-run.

## Servicio, evidencia y límites finales

- API/UI sirven `dist-tanda-d-20260923`; se conservaron bundles anteriores.
- API PID observado **17277**, modo INSPECTION, inicializadores/backfill/monitor
  pausados. `/api/healthz`: **200**, `{"status":"ok"}`.
- UI: comando literal validado mediante parser TOML y `bash -n`; servido antes
  en puerto **18097**, HTML/assets comparados con el directorio candidato.
  Workflows reiniciados una vez y en ejecución.
- E7 disponibilidad: 200/false; atribución E7: 403.
- E5 sin sesión responde ahora **401**, porque E11 autentica antes del gate E5.
  Ese 401 **no prueba** que E5 esté abierto ni cerrado: su cierre se verifica
  separadamente en constantes/frontera y pruebas. No se ocultó la expectativa
  anterior de 403 que dejó de aplicar al abrir E11.
- Navegador: pantalla de login cargada. La pasada autenticada quedó bloqueada
  porque el runner no pudo acceder de forma segura a las credenciales; no se
  inventó usuario, no se restableció contraseña y no se escribieron operaciones
  de negocio para una prueba. El intento del tester a `/api/health` no fue el
  endpoint correcto de salud; MAIN verificó `/api/healthz` por separado.

Pendiente de aceptación funcional autenticada: marca/retiro desde UI, venta
completa en remate y su historial, piso de precio en ambas pantallas, borrado
individual y conservación de auditoría, lectores/conciliación por perfil.
Estos límites no se presentan como fallos comprobados de esas funciones,
pero tampoco como una certificación de extremo a extremo.

Soportes: `tarea1.md`, `tarea1-tests/`, `tarea1-live-sql.log`,
`tarea1-build-cleanup.log`, `tarea2.md`, `tarea3.md`, `tarea4.md`,
`ui-port-proof.json` y `http-served.json`. Este archivo es el informe consolidado;
los soportes conservan la cronología y no cambian sus resultados históricos.