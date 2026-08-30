---
name: Revalidación de candidatos tras prebloqueo
description: Evita ampliar dentro del ciclo un conjunto de pares calculado con lecturas obsoletas.
---

En una operación por lote, leer todos los pares y ordenarlos no basta. Después
de adquirir el conjunto consultivo, vuelve a leer los candidatos sin candados de
fila. Solo los que conservan identidad, producto, ubicación y estado pueden
tomarse con `FOR UPDATE` y entrar al ciclo; los demás deben abortar
controladamente o quedar para resolución manual.

**Why:** Un candidato puede cambiar de par mientras la transacción espera uno de
los candados calculados. Bloquear luego su fila con la lectura vieja permite que
la función interna descubra y solicite un par nuevo dentro del ciclo, recreando
un interbloqueo aunque el conjunto inicial estuviera ordenado.

**How to apply:** Úsalo siempre que los pares del lote provengan de estado
mutable. Incluye en la comparación todo campo que determine los pares o la
operación permitida, y verifica de nuevo las filas después de `FOR UPDATE`.