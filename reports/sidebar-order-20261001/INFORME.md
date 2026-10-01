# Reorganización del menú lateral

Activado únicamente frontend `dist-sidebar-order-20261001`. Workflow RUNNING y once guardas de archivos válidas. API y datos sin cambios.

Orden solicitado aplicado:
- DIRECTORIO: Clientes, Proveedores, Reportes, Próximos Contenedores.
- CONFIGURACIÓN: Sitios, Usuarios, Permisos, Camionetas, Choferes, Equipos, Bitácora.
- ADMINISTRACIÓN CONTABLE: Conciliaciones documentales, Administrar perfiles A/F, Conciliación de Kardex.

Se conservó la visibilidad efectiva de cada entrada. La exclusión original de CONTADOR de Configuración acompaña solo a las entradas originales, no se impone a las trasladadas desde Directorio. Kardex conserva su autorización independiente de las opciones E11. No se modificaron nombres, rutas, páginas, íconos, las secciones restantes ni Borrar datos de prueba.

Verificación: siete pruebas comparativas aprobadas, incluyendo 28,672 combinaciones de permisos/roles, comparaciones renderizadas y 672 combinaciones de compuertas E11. Rutas/componentes y código de permisos conservados. Build y typecheck del candidato aprobados. La suite anterior conserva un fallo preexistente de expresión regular de requiredRoles, documentado y fuera de alcance; no se alteraron rutas para satisfacerlo.

No se realizó recorrido autenticado en navegador; la verificación de enlaces compara sus destinos y componentes antes/después.