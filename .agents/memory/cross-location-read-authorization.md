---
name: Lectura global sin operación global
description: Separación obligatoria entre revisión multi-sitio y mutaciones operativas restringidas al sitio.
---

Los roles de revisión pueden consultar documentos fuera de su ubicación solo mediante autorizaciones de lectura dedicadas. Nunca se debe ampliar un helper compartido de validación operativa para conceder esa visibilidad.

**Why:** Un bypass agregado a un helper usado por lecturas y escrituras permite que un rol no operativo cobre, cancele o modifique caja fuera de su sitio si alguna vez obtiene permisos granulares.

**How to apply:** Mantener el bypass multi-sitio en handlers GET específicos. Las mutaciones conservan la regla ADMIN o ubicación propia, y deben probarse con un rol revisor que tenga permisos granulares para confirmar que aun así recibe 403.