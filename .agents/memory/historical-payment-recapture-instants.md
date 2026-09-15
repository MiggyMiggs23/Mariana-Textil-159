---
name: Instantes exactos en recapturas históricas
description: Diferenciar una corrección de abono de un selector ordinario de fecha.
---

Para una recaptura correctiva, conservar el instante exacto de captura
original comprobado, incluidos sus milisegundos y desplazamiento. No pasar
por un selector que normalice el día a mediodía ni usar una hora por omisión.
Comparar antes de escribir contra el instante del cargo correspondiente y
exigir la diferencia positiva cuando la corrección depende de esa secuencia.

**Why:** En notas históricas con veto de favor implícito, conservar el día
pero adelantar la hora puede volver a colocar el abono antes del cargo.
La recaptura entonces produce favor en vez de pagar la nota, aunque el
reverso y el abono hayan quedado correctamente registrados.

**How to apply:** En correcciones autorizadas por reverso y recaptura,
imprimir ambos instantes en Ciudad de México y su diferencia exacta antes
de operar. Verificar después la fecha persistida, reparto y favor. Si el
reparto falla, detenerse: no encadenar más movimientos para forzar el saldo.