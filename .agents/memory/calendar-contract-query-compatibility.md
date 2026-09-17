---
name: Contratos de calendario y filtros
description: Evitar cambios de selección de registros al eliminar coerciones Date de contratos generados.
---

Al corregir la generación de fechas calendario, auditar también los parsers de parámetros de consulta y preservar sus límites históricos de timestamps.

**Why:** La transformación global de esquemas alcanza tanto respuestas como queries. Un consumidor que preparaba un Date antes de validar deja de funcionar cuando el contrato exige una cadena. Adaptarlo a un helper de día completo puede además cambiar qué registros devuelve un filtro, aunque los tipos ya pasen.

**How to apply:** Validar el día como cadena primero. Cuando una consulta de timestamps necesita límites internos, comparar los instantes exactos y la inclusividad contra el código anterior. No introducir una política nueva de zona horaria o fin de día como efecto secundario de arreglar el vencimiento.