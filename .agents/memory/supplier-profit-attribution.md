---
name: Atribución de utilidad al proveedor
description: Motivo para conservar una atribución distinta de los filtros históricos de ventas.
---

No homogeneizar automáticamente la nueva utilidad por proveedor con la atribución usada por los reportes antiguos.

**Why:** El usuario eligió expresamente el proveedor de la entrada después de conocer que los reportes de ventas anteriores usaban el proveedor del rollo. La diferencia es deliberada, no un descuido que deba corregirse por consistencia.

**How to apply:** Al refactorizar consultas compartidas, preservar esta decisión incluso cuando ambas referencias coincidan en todos los datos actuales. No reasignar proveedores históricos para hacerlas coincidir.