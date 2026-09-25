# Reinicio temporal de datos de prueba

## Estado

Implementado, ensayado y **activado con autorización expresa del propietario**.
`TEST_RESET_ENABLED = true` en `artifacts/api-server/src/lib/test-reset/manifest.ts`.
Se reiniciaron API y frontend para activar el botón; **no se ejecutó ningún
reset ni instalación de DDL en la base de la aplicación**. La comparación
`activation-before.json` / `activation-after.json` de las 107 tablas no detectó
diferencias de conteos ni huellas de contenido. `test_reset_history` sigue
ausente: se creará atómicamente únicamente en el primer uso confirmado.
El esquema se leyó con pg_dump schema-only para ensayar una copia estructural
completa; no se copiaron datos de negocio ni actores.

La API activa se construyó desde las fuentes embebidas del bundle retenido,
agregando exclusivamente el reinicio. No se liberó el candidato comercial.
Procedencia en `activation-build-inputs.json`; verificación de bytes al arrancar
en `api-artifact.sha256`. API y frontend sirven `dist-test-reset-active-20260925`.
Arranque efectivo: inspection, sin inicializadores, backfill ni monitor.
Salud HTTP 200; GET del reinicio sin autenticación rechaza con 401.

## Uso después de una activación autorizada

1. Iniciar sesión como ADMIN.
2. Al fondo del menú lateral, debajo de la línea roja, elegir **Borrar datos de prueba**.
3. Leer el alcance fijo y escribir exactamente **BORRAR**.
4. Confirmar una sola vez y esperar. No cerrar ni repetir ante una respuesta incierta.
5. Después del éxito se abre el inicio de sesión con un aviso claro de borrado
   y cierre de sesiones. Volver a iniciar sesión.

El listado protegido/borrable vive exclusivamente en el manifiesto del servidor.
El diálogo informa el alcance; no permite elegir tablas.
Cada ejecución confirmada deja actor y hora en `test_reset_history`, protegido
incluso de reinicios posteriores. Un fallo antes del commit revierte el reset.

## Qué comprobar en pantalla

- Catálogo, precios vigentes, proveedores, usuarios, permisos, sitios,
  camionetas, choferes, equipos y configuración siguen disponibles.
- Sin operaciones de prueba, existencias, rollos, deudas ni saldos de Fondo.
- Las sesiones anteriores ya no permiten operar.
- Primer documento nuevo: folio 1 (contador previo en cero).
- Primer rollo nuevo: serie 10000001.
- No hay botón para roles diferentes de ADMIN.

## Protección futura de clientes

En `artifacts/api-server/src/lib/test-reset/manifest.ts`, cambiar:

```ts
export const PROTECT_CUSTOMERS = true;
```

Liberar esa versión **antes** de importar clientes reales. El servidor conserva
todos los clientes y la interfaz refleja automáticamente este modo.
En ambos modos se elimina el crédito y se conserva el cliente interno.

## Verificación

- `backend-tests.log`: ocho pruebas aprobadas contra PostgreSQL desechable.
- Esquema real completo: 107 tablas, 80 funciones y 206 triggers restaurados.
- Verificación de tablas protegidas, 78 tablas vaciadas, saldos, contadores,
  sesiones, modos de clientes, conservación de guards y rollback forzado.
- HTTP real: flag cerrado, anónimo, no ADMIN, confirmación incorrecta,
  éxito tras commit, cookie vencida, sesiones inválidas y nuevo login.
- Servicios de producción crean entrada, rollo y ticket después del reset:
  folios 1 y serie 10000001.
- Exclusión multiproceso probada mediante lease PostgreSQL.
- Seis pruebas montadas de interfaz aprobadas y typecheck frontend/backend.
- Build frontend aislado aprobado; no sustituyó la versión servida.
- Navegador real sobre ese build, con todas las respuestas API sintéticas:
  botón ADMIN al fondo, confirmación exacta, un solo POST ante doble clic,
  navegación completa al login y aviso persistente al recargar sin pantalla rota.
  No ADMIN/servicio deshabilitado: botón ausente. Esta prueba no realizó borrados;
  el borrado real se comprobó por separado en PostgreSQL desechable.
- Capturas en `artifacts/mariana-textil/reports/test-reset-20260925/`:
  `sidebar-admin.png`, `dialog-empty.png`, `after-reset-login.png`.

## Activación y retiro

La activación del 25 de septiembre de 2026 fue autorizada expresamente
«Sí, activar sin borrar datos». No autoriza ejecutar el borrado ni futuros
reinicios ajenos. No reconstruir/publicar todo HEAD: contiene un candidato
comercial no liberado. Integrar solo cambios autorizados sobre el bundle retenido.
Retirar las instancias antiguas antes de arrancar una API habilitada: los
binarios anteriores no conocen el protocolo de exclusión.
La API habilitada exige inspection boot y lease exclusivo, sin inicializadores
ni monitores operativos concurrentes. La bitácora nueva se instala atómicamente
en la primera ejecución autorizada; no se instala en el arranque ordinario.

Cuando el propietario empiece a operar de verdad, retirar:
- Carpeta backend `src/lib/test-reset`, ruta y sus registros.
- Conexiones del lease en `src/index.ts` y `src/lib/server-lifecycle.ts`.
- Endpoints OpenAPI y regenerar clientes/validadores.
- Componente frontend `test-system-reset`, sus montajes en AppLayout
  y el aviso temporal de Login; pruebas específicas y configuración.

No basta con ocultar el botón. Conservar la evidencia histórica de uso;
fuera de esta excepción siguen vigentes las prohibiciones ordinarias de borrado.