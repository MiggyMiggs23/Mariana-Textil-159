---
name: Fidelidad de catálogos reconstruidos
description: Distinguir pérdida de atributos en el fixture de un cambio indebido en la base real.
---

Una reconstrucción desde definiciones de esquema y enums declarativos no demuestra igualdad de todos los atributos PostgreSQL. Comparar renglones antes de atribuir un rechazo de hash a cambios en la base real.

**Why:** Un diagnóstico autorizado reprodujo exactamente el esperado aprobado, pero el fixture perdió el modo ALWAYS de un trigger y las posiciones numéricas de enums incrementales. Un enum conservaba su orden relativo pese a números diferentes; otro tenía un orden declarado distinto del instalado.

**How to apply:** `pg_get_triggerdef` no conserva `tgenabled`. Recrear enums desde arrays asigna posiciones nuevas; distinguir etiquetas, orden relativo y `enumsortorder` bruto. Documentar esas diferencias sin normalizar hashes ni reparar la base sin autorización.

Para nuevos preflights, el propietario autorizó comparar etiquetas de enums
por orden relativo, no por su numeración interna. Conservar la captura cruda
y todos los atributos ajenos a esa numeración.

**Why:** PostgreSQL puede asignar posiciones distintas a un enum incremental
y a otro creado de una vez, aun conservando exactamente etiquetas y orden.

**How to apply:** Exigir que renumerar pase y que cambiar orden o conjunto
falle. Esta excepción de comparación no autoriza modificar enums/triggers,
ni presentar como aditivo un SQL que sustituye objetos existentes.