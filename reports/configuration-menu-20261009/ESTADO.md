# CONFIGURACIÓN unificada — 2026-10-09

## Alcance
Solo menú. Baseline: operation-menu-order-20261009/frozen-root.
ADMINISTRACIÓN CONTABLE eliminada del lateral. Tres opciones trasladadas a CONFIGURACIÓN.
Orden: Sitios, Usuarios, Permisos, Camionetas, Choferes, Equipos, Conciliación de Kardex, Conciliaciones documentales, Administrar perfiles A/F, Bitácora.
Botón de borrado permanece al final, sin cambios de autorización/comportamiento.

## Conservación
Cada objeto estático del catálogo permanece idéntico (comparación multiconjunto de líneas completas).
Predicado getVisibleNavGroups idéntico; App, permisos y páginas E11 idénticos al baseline.
Enlaces E11 continúan procediendo del hook autorizado existente; la composición no concede permisos.
Se crea CONFIGURACIÓN también para un usuario con solo enlaces E11 autorizados.
Usuarios y perfiles A/F retienen /usuarios, con identidades de render distintas para evitar keys duplicadas al compartir grupo.
El cierre/guardado sigue siendo el de CONFIGURACIÓN; preferencia antigua del grupo eliminado no se aplica a otros grupos.

## Verificación
- 4 pruebas composición: orden completo, E11 independiente, E11 sin opciones estáticas, CONTADOR sin escalamiento.
- 4 contratos de navegación/permisos.
- 4 pruebas montadas de secciones plegables.
- Typecheck/build congelados PASS.
- Playwright MAIN acotado con API/base desechables: 10 enlaces y hrefs correctos, 2 enlaces distintos a /usuarios, encabezado eliminado ausente, botón de borrado después de Bitácora. Escritorio y móvil aprobados; capture-result.json.
- Capturas configuration-desktop.png y configuration-mobile.png inspeccionadas por MAIN; datos de prueba, sin mocks del menú.

## Activación y limpieza
dist-configuration-menu-20261009: 11 archivos byte-exactos del candidato.
TOML validado, único reinicio web; once hashes correctos al arrancar.
HTML servido idéntico al candidato. API sin cambios/reinicio solicitado, sin publicación externa.
Runtime CLEANED, cleanup.passed=true, apiExited=true, proceso exit 0; clúster/credenciales desechables eliminados.
