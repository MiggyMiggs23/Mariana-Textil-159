# Orden de OPERACIÓN — 2026-10-09

- Activo: dist-operation-menu-order-20261009. Baseline congelado: sidebar-collapse-20261009.
- Único cambio productivo: app-navigation.ts; orden Movimientos, POS, Entradas, Salidas, Recibos de abonos, Viajes; cambio de nombre Ventas / POS → POS.
- scope-check.json prueba identidad de cada objeto completo salvo nombre y posición; resto de navegación idéntico. Sin cambios de rutas, permisos, iconos, pantallas o documentos.
- Fuente compartida por escritorio y móvil. Búsqueda sin distinguir mayúsculas en artifacts/*/src y lib: ninguna otra aparición productiva del nombre anterior; pruebas actualizadas al nuevo rótulo/orden; informes y capturas históricos intactos.
- Cuatro contratos de navegación/permisos PASS. Typecheck y build congelados PASS.
- Captura MAIN con Playwright acotado: sesión real contra API/base desechables, sin mocks de menú. Orden de seis enlaces y hrefs comprobados. capture-result.json PASS; capturas escritorio/móvil inspeccionadas.
- Staging de 11 archivos idénticos, TOML validado, único reinicio web, hashes al inicio correctos y HTML servido idéntico al candidato. API no reiniciada, sin publicación externa.
- Runtime desechable CLEANED, cleanup.passed y apiExited true, proceso exit 0. Sin datos de prueba en base real.
