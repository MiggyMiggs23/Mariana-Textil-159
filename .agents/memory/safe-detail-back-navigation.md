---
name: Regreso seguro en pantallas de detalle
description: Regla para combinar historial real, fallback interno y restauración de estado visual sin salir de la aplicación.
---

Una flecha de regreso debe usar el historial real únicamente cuando la entrada actual demuestra que existe una entrada anterior creada por la misma sesión JavaScript de la SPA. Un acceso directo, una pestaña nueva o una recarga inicia otra sesión y siempre debe ir al fallback interno.

**Why:** El historial del navegador puede contener una página externa y una recarga conserva entradas antiguas sin conservar la sesión que las creó. Además, enlaces de router envueltos o estados reemplazados durante impresión pueden convertir un regreso controlado en navegación de documento o perder la evidencia de seguridad. El desplazamiento real también puede vivir en contenedores internos y no en `window`.

**How to apply:** Centralizar el control en un ancla con `href` válido; interceptar solo el clic normal. Con evidencia segura, guardar el scroll y retroceder; sin ella, navegar al fallback. Toda llamada a `replaceState` debe fusionar la metadata existente. Persistir filtros, pestañas y modos visibles por entrada, registrar los contenedores reales de scroll y mantener formularios, diálogos y mutaciones sensibles como estado local.