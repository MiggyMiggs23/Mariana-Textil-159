# Menú plegable — 2026-10-09

## Entrega
Activo en workspace: dist-sidebar-collapse-20261009. Candidato exacto: web/.
Baseline: reports/optional-delivery-20261008/frozen-root.
Solo dos archivos productivos: app-layout.tsx, sidebar-sections.tsx.
Catálogo app-navigation, permisos, App y E11 comparados SHA-256: idénticos al baseline.
Solo reinicio web; once hashes correctos al arrancar, HTML servido idéntico al probado.
Sin publicar ni cambiar/reiniciar API o modificar base real.

## Comportamiento y alcance
Seis títulos pedidos como botones con flechas, aria-expanded/controls y teclado nativo.
Sin opciones nuevas, reordenamiento, cambios de permisos o visibilidad por rol.
Preferencias por ID de usuario en localStorage, sin caducidad y sin borrado al logout.
Persistencia en el mismo navegador/perfil; no sincronización entre dispositivos.
Ruta activa abre temporalmente el grupo, incluyendo /tickets/:id → OPERACIÓN; no cambia la preferencia guardada.
El usuario puede plegar manualmente también la sección actual; al navegar/recargar vuelve a abrirse.
Sin alterar Tiempo Real, FONDO MARIANA, ni grupos vacíos.

## Verificación
- Cuatro pruebas de componentes reales PASS: remount, identidad, ruta/recarga, storage inválido y contenido oculto.
- Typecheck y build congelados PASS.
- Suite histórica navegación: 6 PASS, 1 FAIL. Fallo de aserción de requiredRoles en App, reproducido idénticamente contra baseline anterior, sin relación con este cambio; no se modificó esa prueba ni App.
- Testing autenticado PASS, result.json: seis grupos, flechas, 34 enlaces en orden, reload, ruta activa, logout/login en contexto conservado, identidad ADMIN/CAJA y móvil 390×844 sin desbordamiento.
- Ajustes del arnés durante la pasada para esperar a que se renderice el menú después del login; no cambios del candidato tras verificar.
- Capturas reales desktop-open, desktop-closed, after-relogin, mobile-open, mobile-closed. MAIN inspeccionó los pares abierto/cerrado. El dashboard puede estar cargando en la captura desktop-open: evidencia del menú, no del dashboard.

## Limpieza
run-7w2hoE/result.json: CLEANED, cleanup.passed=true, apiExited=true.
Proceso aislado exit 0; clúster y credenciales de prueba eliminados.
