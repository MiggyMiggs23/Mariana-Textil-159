# Recuperación exclusiva del servicio anterior — autorización textual

Registrada antes de consultar la base operativa y antes de cualquier arranque.

## Texto del propietario

> Sí, autorizar únicamente esa recuperación
>
> Antes de arrancar, comprueba por lectura la identidad de la base y las tres guardas de E1. Si algo no coincide, detente.
>
> Y dos cosas:
>
> 1. Comprueba si quedó algo a medias por el reinicio. Yo no había abierto caja ni registrado operaciones, así que del lado mío no hay nada. Confírmame que tampoco quedó una transacción abierta ni un estado parcial por tu parte.
>
> 2. El hallazgo de la devolución es serio y quiero resolverlo antes de activar la apertura limitada.
>
> Si los abonos recibidos con esa apertura no generan la prueba de origen que exige la devolución E2, entonces un cliente que abone en efectivo y pida su dinero de vuelta no podría recibirlo por sistema, ni ahora ni después. Eso es peor que no tener la captura.
>
> Preséntame las opciones, con lo que cuesta cada una:
>
> • Que la captura limitada ya genere esa prueba de origen desde el primer abono.
>
> • Que la devolución acepte otra evidencia para esos casos.
>
> • Posponer la apertura limitada hasta que E2 pueda devolver.
>
> No elijas por tu cuenta. Y déjalo escrito como condición bloqueante de la apertura: no se activa hasta resolverlo.
>
> Después de recuperar el servicio, sigo con el primer corte histórico usando solo tickets, que no depende de nada de esto.

## Límite de esta ejecución

- Sólo recuperar el bundle anterior exacto.
- Antes del arranque: lecturas de identidad, tres guardas E1 y estado transaccional.
- Detenerse ante cualquier discrepancia.
- No aplicar E2, SQL de apertura, migración, fixture, backfill, usuario o sesión de prueba.
- No arrancar el clon E10.
- No repetir ni crear operaciones del propietario.
- La evaluación de opciones de devolución es un entregable separado; no autoriza implementación ni activación.

## Corrección preventiva posterior

Registrada con el workflow detenido y antes de modificar nuevamente su
configuración.

> NO continuar recuperación ni arrancar nada ni DB queries. Una corrección preventiva dentro del comando autorizado: directo node dist con inspection no comprueba hash, y otro autorrestart podría servir bundle NOautorizado. Añade verificación SHA256==655cad5082301d1456184fac8206f317bc0c88e9a33afe4679f806a62e1010c2 ANTES de importar/ejecutar dist al comando gestionado; mismatch aborta (sin alternativa/build). Mantén workflow detenido, envinspectiondev. Es protección del bundle autorizado, no selección/recuperación de otro. Puedes probar únicamente comparación hash aislada, NO wrapper que importe app. Actualiza resultado.md autorizaciónconfigalcance preventivo y exactcommand. No tocar replit/main docs. Devuelveguardconfigfixed sinstart. Si herramienta configuración automáticamente arranca workflow, NO usarla: reporta riesgo y deja detenido.

La corrección autoriza exclusivamente añadir al comando administrado una
comparación fail-closed del SHA-256 anterior a `node`. No autoriza ejecutar el
comando completo, importar el bundle, arrancar, reconstruir, sustituir archivos
ni hacer consultas de base.