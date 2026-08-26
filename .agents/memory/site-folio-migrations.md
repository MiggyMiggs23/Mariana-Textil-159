---
name: Migración de folios por sitio
description: Orden seguro y referencias estables al convertir folios globales en secuencias por ubicación.
---

Al convertir un folio global en secuencias por sitio, elimina primero la unicidad global y solo después asigna números repetidos entre ubicaciones. Las referencias internas deben reconstruirse desde identificadores o relaciones estables, nunca desde el folio humano que será renumerado.

**Why:** Renumerar antes de retirar la restricción falla en cuanto dos sitios reciben el mismo número. Además, referencias históricas guardadas como folio pueden no ser confiables; la relación movimiento → rollo → entrada sí identifica el documento correcto.

**How to apply:** En migraciones similares, conserva los conteos, cambia referencias humanas a IDs antes o mediante una relación estable, retira la unicidad antigua, renumera por partición y finalmente crea la unicidad compuesta y reconstruye los contadores.