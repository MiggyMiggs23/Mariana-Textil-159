# P12 — alcance respecto de E4

## Fuentes y decisión vigente

- `reports/prompt-u-respuestas-2026-09-18.md:21`: **“P12 (E12)”**. Pago/retiro
  superior al saldo registrado se bloquea; ADMIN desbloquea con motivo/historial.
- Precisión posterior reflejada en `replit.md`, sección P12/E12: la excepción
  ADMIN aplica **solo a caja**, nunca a retiro del Fondo. Corrección contable
  E10 es otra operación; no autoriza sobregiro de retiro.
- El plan E4 asigna clasificación/revisión de egreso existente y su efecto
  inmediato en corte; E12 asigna pago/orígenes, saldo y bloqueo/desbloqueo P12.

## Límite técnico concreto

E4 **no implementa** comparación contra saldo disponible ni desbloqueo de
insuficiencia. No hay campo, permiso, endpoint o estado de “sobregiro autorizado”
en el contrato E4. Aceptar una extraordinaria revisa su evidencia; NO constituye
el desbloqueo ADMIN de P12 y no debe reinterpretarse como tal.

La dependencia pendiente corresponde al motor E12: validación transaccional por
origen antes de producir egreso, bloqueo por insuficiencia y evidencia inmutable
del desbloqueo de **caja** vinculada a la misma intención idempotente.
Ese motor deberá reutilizar el bloqueo de sesión y, para caja física, el lector
canónico E2; no comparar solo `fondoInicial`, ni un saldo obtenido fuera de la
transacción. Fondo jamás usa excepción. Las cuentas no físicas no deben
confundirse con efectivo esperado del corte.

La regla P12 es vigente; lo diferido a E12 es su implementación, no una decisión
que permita pagos por encima del saldo. Por tanto esta entrega preparada OFF
**no debe presentarse como liberación que ya cumple P12**. Antes de liberar
productores de pagos/retiros bajo esa regla se debe integrar y validar dicho
motor/alcance. No se amplía E4 para inventar permisos de sobregiro ni se inicia
E12 en este trabajo. La revisión posterior de gastos no reemplaza ese control.