---
name: Catálogos operativos con permisos restringidos
description: Cómo conservar flujos operativos cuando el rol no puede abrir módulos administrativos relacionados.
---

Si un rol conserva una operación pero pierde acceso al módulo administrativo que mantiene sus catálogos, exponer un catálogo operativo mínimo bajo el permiso de la operación y hacer que esa pantalla lo consuma.

**Why:** Proteger los endpoints administrativos de sitios, productos o proveedores puede romper Entradas o Salidas aunque sus permisos sigan habilitados; reutilizar el endpoint administrativo también concede más lectura de la necesaria.

**How to apply:** Crear endpoints de solo lectura con campos mínimos, datos activos y el permiso del flujo consumidor; mantener las rutas administrativas con su guardia propia y cubrir ambos comportamientos en pruebas de seguridad.