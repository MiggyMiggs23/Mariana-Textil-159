---
name: Separación de devoluciones comerciales y de recepción
description: No reutilizar evidencia de dinero nunca aplicado ni reversos para un retorno comercial nuevo.
---

No confundir el flujo de devolución de una recepción nunca aplicada con la devolución comercial de mercancía: su evidencia y sus efectos contables son distintos.

**Why:** La preparación histórica de devoluciones de recepción exigía dinero íntegro nunca aplicado y utilizaba reversos. Reutilizarla para un retorno comercial puede invertir la venta o el corte, aunque la interfaz parezca equivalente.

**How to apply:** Consultar la autorización vigente en replit.md y distinguir los productores y sus restricciones antes de abrir guardas. La antigua decisión de mantener toda devolución física inactiva fue sustituida por una autorización específica de rollo completo; no usar esta memoria como prohibición monetaria.

## Reversión después de aceptar dinero

Cerrar la captura no equivale a regresar a un lector anterior que desconocía esos ingresos. Conservar lectores, snapshots y movimientos legítimos aunque se vuelvan a cerrar los permisos de escritura.

**Why:** Un rollback puede conservar todas las filas y aun así ocultar efectivo aceptado al volver a una fórmula que no lo incluía.

**How to apply:** Revertir la habilitación manteniendo la versión de lectura compatible con los datos ya aceptados; no restaurar automáticamente un bundle o checkpoint anterior al cambio financiero.

## Evidencia al habilitar productores

Cuando una prueba solo puede registrarse en la transacción de origen, la futura activación de su consumidor no recupera la evidencia omitida.

**Why:** Una recepción legítima puede quedarse sin elegibilidad demostrable para devolución aunque conserve íntegro el saldo y la devolución se habilite más adelante.

**How to apply:** Revisar la conservación de evidencia antes de abrir el productor. Separar registrar la prueba de habilitar la devolución; no suponer que una activación posterior o un backfill recuperarán una prueba que debía nacer en la transacción original. Consultar las condiciones de autorización vigentes en replit.md antes de proponer una apertura.