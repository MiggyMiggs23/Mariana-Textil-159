---
name: Devolución física construida pero inactiva
description: La preparación del flujo no autoriza eludir las guardas que bloquean su operación.
---

La devolución física puede construirse completa, pero debe permanecer inactiva mientras sigan las guardas de efectivo de crédito. No se eluden mediante otra naturaleza, otra tabla o un camino alternativo.

**Why:** El propietario reconoció expresamente que pedir devolución operativa y conservar la guarda que la bloquea era contradictorio; autorizó construirla inactiva, no abrir esa guarda.

**How to apply:** Separar preparación de código, activación y aceptación operativa. Conservar los bloqueos de aplicación y SQL; cualquier activación necesita autorización posterior. Autorizar código tampoco autoriza escrituras de pruebas, migraciones o inicializadores.

## Reversión después de aceptar dinero

Cerrar la captura no equivale a regresar a un lector anterior que desconocía esos ingresos. Conservar lectores, snapshots y movimientos legítimos aunque se vuelvan a cerrar los permisos de escritura.

**Why:** Un rollback puede conservar todas las filas y aun así ocultar efectivo aceptado al volver a una fórmula que no lo incluía.

**How to apply:** Revertir la habilitación manteniendo la versión de lectura compatible con los datos ya aceptados; no restaurar automáticamente un bundle o checkpoint anterior al cambio financiero.

## Evidencia al habilitar productores

Cuando una prueba solo puede registrarse en la transacción de origen, la futura activación de su consumidor no recupera la evidencia omitida.

**Why:** Una recepción legítima puede quedarse sin elegibilidad demostrable para devolución aunque conserve íntegro el saldo y la devolución se habilite más adelante.

**How to apply:** Revisar la conservación de evidencia antes de abrir el productor. Separar registrar la prueba de habilitar la devolución; no suponer que una activación posterior o un backfill recuperarán una prueba que debía nacer en la transacción original. Consultar las condiciones de autorización vigentes en replit.md antes de proponer una apertura.