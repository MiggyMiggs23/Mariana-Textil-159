# Tarea 1 — inventario ejecutable, ejecución bloqueada por handoff

**Actualización final:** el handoff llegó y la campaña se ejecutó. Este documento conserva el plan inicial; el resultado vigente está en `resultado.md`, `final-ledger.json` y `window-released.json`.

Se identificó la matriz exacta en `reports/trabajo-nocturno-20260925/tarea-7/ledger.json`, conciliada con su baseline histórico. Ejecutado `node reports/noche-20260926/tarea-1/inventory.mjs`: 433 celdas, 52 API históricas, 12 combinadas históricas; pendientes 381 API y 421 combinadas. **Cero cierres nuevos**, cero solicitudes nuevas y cero observaciones nuevas de navegador hasta recibir la copia preparada.

`inventory.json` contiene las 433 filas, con 64 planes concretos: método, ruta parametrizada (sin reutilizar IDs históricos), tipo y estado de fixture, pantalla y candidato a control, error exacto y criterios de aceptación. Las rutas fuente y textos de controles son candidatos a verificar, no evidencia de presencia ni clic. `owner-357.csv` conserva literalmente las 357 preguntas del propietario; no se asignó significado, endpoint ni botón a esas filas.

## Handoff necesario

Se requiere del worker `night-disposable` el manifest privado de copia: URL local exclusiva, identidad PostgreSQL y directorio del cluster, PID API y origen UI que sirven esa misma copia, identidad/hash del build, credenciales sintéticas por rol, sitio/piso elegible y permiso de escritura de fixtures. No se iniciará aplicación ni workflow desde esta tarea.

Para fingerprints confiables se necesita ventana sin otros escritores o base exclusiva de permisos. Una copia compartida con carga/browser concurrentes NO permite atribuir cambios a una denegación. Preferible base/API exclusiva para permisos, o handoff serial al finalizar los demás.

Fixtures nuevos necesarios: producto/proveedor, cliente no sistema, cinco rollos con costo y disponibilidad, entrada pendiente de costo, salida extraordinaria reversible, salida cliente cancelable y otra facturable, ticket pendiente con caja abierta, contenedor EN_TRANSITO, auditoría abierta con piso/participación y otra elegible para confirmación, rollo con reimpresión pendiente de revisión, camioneta/chofer/equipo. La preparación anterior de referencia es `reports/tanda-h/permissions/runtime.mjs`; **no ejecutar ese archivo**: contiene identidad e IDs de campaña retirada.

## Criterios conservados

- 357 sin operación son decisión pendiente; no pueden probarse con solicitudes inventadas.
- Los 24 mapeados sin guard seleccionado y los 40 sin botón requieren autenticación y recursos nuevos.
- E11 `PERFIL_DENEGADO`, permiso exterior `ver` o puerta legacy 409 no cierran el guard interior; no se desactivan ni se amplían permisos para producir un verde.
- Un permiso efectivo distinto del histórico se reporta como drift; no se fuerza a falso.
- Se requieren controles elegibles y verificación de no escritura; un 403 genérico, una página sin recurso o una captura histórica no pasan.
- Revisión estática de Etiquetas confirmó UI ADMIN y API con guard `editar` más ADMIN: no constituye discrepancia demostrada ni autoriza quitar el requisito ADMIN.
- No se modificó fuente de producción, matriz, flags, base activa, servicios ni workflows; no se hizo commit ni liberación.

## Verificación realizada

El ejecutable offline terminó con código 0 y sus aserciones de identidad/unicidad por baseline y cantidades. No se afirma que esta verificación sea una prueba autenticada ni prueba del botón.