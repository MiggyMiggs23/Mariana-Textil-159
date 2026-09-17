---
name: Caché financiera ante cambios de sesión
description: Por qué invalidar consultas al iniciar sesión no evita mostrar cifras de otro usuario o alcance.
---

Las consultas financieras deben separar cachés por identidad y alcance efectivo, y no mostrar ni exportar datos hasta comprobar que la respuesta corresponde al contexto autorizado vigente.

**Why:** Vaciar la caché en logout no cubre una sesión que expira y se reemplaza por otra. Invalidar consultas permite que React Query muestre inmediatamente la respuesta anterior mientras vuelve a consultar; `isLoading` puede ser falso aunque ese dato provenga de un usuario con acceso global.

**How to apply:** Probar la transición de una sesión global a una restringida compartiendo el mismo QueryClient, sin ejecutar logout. Incluir cambios de rol o sitio del mismo usuario. La comprobación visual debe fallar cerrado y nunca sustituir la autorización del servidor.