# Revisión final backend E4

## Corrección de tipo

Import de `Tx` desde `./inventario` en vez de `@workspace/db`. Es el mismo tipo
que utiliza `lib/pos.ts`, derivado de `db.transaction`; no `any`, sin import
runtime. JS emitido byte-idéntico: SHA-256
`1a6f82af4c5fb7b474453191e9c4e8a7cf84448da8ca2d7de05ff50f021f76ee`.
MAIN solo necesita repetir `bash reports/tanda-b-20260922/e4/run-backend-types.sh`.

## Revisión de adaptador, rutas y finanzas

- Todas las escrituras E4 del adaptador reciben la misma transacción que abre
  la ruta. No conexión propia, auto-DDL o SQL al importar.
- Captura toma clave idempotente y candado de sesión. El cierre real toma el
  mismo `FOR UPDATE` sobre `sesiones_caja`: la salida queda antes del snapshot
  de cierre o se rechaza por sesión cerrada. Reintento ya registrado puede
  devolver su resultado después del cierre sin nuevo egreso.
- Revisión toma candado de fila E4 y CAS; no bloquea/modifica la sesión ni
  importes. Reintentos devuelven snapshot de su operación, mientras el refetch
  del detalle devuelve la versión actual.
- IDs, actor e IP son de servidor; body no puede suplantarlos. Scope/rol se
  validan otra vez en servicio. Proveedor y extraordinaria no se infieren.
- OFF conserva el bloque de captura previo; campos E4 explícitos se rechazan
  antes de getSesion/transaction. Nuevo endpoint revisión verifica gate antes
  de parse/transaction. Lector E4 retorna mapa vacío antes de execute.
- El egreso se inserta en la tabla original; los acumuladores por cuenta no
  filtran por revisión. No balance cliente, Fondo ni segundo egreso.
- Cambios de revisión no vuelven a congelar un corte cerrado. La metadata
  actual puede cambiar y el snapshot financiero E2 no cambia.
- El proveedor conserva cuentas existentes; EXTRAORDINARIA solo caja física.
  No productor E12 ni pago partido.

## Riesgos y límites explícitos para liberación futura

1. SQL **no ejecutado**: constraints/triggers, instalación/reversión y
   concurrencia PostgreSQL real requieren validación separada. Los tests
   sintéticos no la sustituyen. DDL no backfillea históricos; falla si los
   objetos ya existen, evitando reinstalación silenciosa.
2. La reversión SQL exige tablas vacías. Si ya hay evidencia, retornar código
   OFF conservando esquema/egresos; no borrar comprobantes ni simular retornos.
3. **Resuelto por coordinación MAIN:** selector `e4CashOutPermission` mantiene
   `cortes` OFF y selecciona `cobros_pagos` ON para captura/listado/catálogo mínimo.
   Usa middleware existente; no añade otro resolvedor ni concede filas.
   Revisión conserva `cortes/ver` más autoridad/tienda. Esto elimina la
   dependencia accidental de CAJA respecto de permisos administrativos.
   Contrato frontend actualizado y dos controles nuevos preparados; MAIN
   ejecuta solo E4-PERMISSIONS-ON/OFF y types.
4. Mariana usa la constante histórica 1 tanto en POS como en E4/DDL; no cambiar
   solo una representación en una liberación.
5. Comprobante opcional es un enlace HTTPS ya disponible; no hay upload,
   descarga servidor ni almacenamiento de bytes nuevo.
6. No se ejecutó router HTTP completo ni bundle: MAIN valida frontend y tipos;
   la evidencia backend aceptada cubre servicio, adaptador real con executor
   sintético, parsers reales y controles negativos por caso.
7. P12 está asignada expresamente a E12; véase `p12-alcance.md`. No se ofrece
   autorización de sobregiro en E4 ni se afirma implementado el motor P12.

## Selección de commit

`backend-commit-pathspec.txt` enumera **exactamente la porción backend/contratos**
y el directorio de evidencia E4 completo (incluye evidencia frontend cuando
MAIN la termine). Puede usarse con `git add --pathspec-from-file=...` por MAIN.
No se ejecutó ese comando aquí.

MAIN debe sumar los archivos frontend E4 que administra y su informe único.
No incluir `.agents/agent_assets_metadata.toml` (metadatos ajenos a la tarea),
paquetes protegidos, directorios dist ni temporales de pruebas. No usar
`git add .`. `reports/tanda-b-20260922/protegidos-inicial.sha256` es evidencia
de MAIN fuera de la porción backend; MAIN decide agregarla.