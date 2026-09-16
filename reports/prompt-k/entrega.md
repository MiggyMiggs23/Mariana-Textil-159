# Prompt K — implementación y evidencia

## Alcance

Implementados Entradas, Movimientos y Sitios. Usuarios, Clientes y Proveedores
productivos permanecen sin cambios. No se construyó borrado, ni se modificaron
inventario escritor, motor de captura, crédito, Caja, impresión o Tiempo Real.
Los cambios en consumidores de locations de POS/Etiquetas son únicamente la
adaptación de argumentos a la firma generada; siguen solicitando activos.

## Comprobaciones completadas

- Typecheck raíz: todos los paquetes/librerías seleccionados terminaron, cero
  diagnósticos y cero fallos del proceso.
- Codegen: salida estable, sin diferencias antes/después de regenerar.
- Contratos y pruebas puras: 39 casos de Entradas, agrupación, resolvedor,
  permisos de sitios y arnés. La primera tanda tuvo 37 aprobados y dos
  aserciones antiguas desactualizadas; el contrato correspondiente se actualizó
  al resolvedor compartido y hook agrupado, conservando exportación/preset, y
  sus tres casos aprobaron. No se ejecutaron suites que escriban datos.
- Consulta real `getKardexGrouped`: tres casos ejecutados bajo PostgreSQL
  `transaction_read_only=on`, contra `heliumdb/public`.
  `grouped-readonly-probe.json` registra identidad, guardia y resultado.
  **Los tres devolvieron cero filas:** demuestra construcción y ejecución SQL,
  no semántica con registros reales. Casos positivos cubiertos por fixtures
  puros; no se insertaron movimientos para aparentar cobertura.
- Revisión de código: corregidos parser de fechas del historial, restablecimiento
  indebido de página al volver y alias de subconsultas. La revisión final
  confirma resueltos esos bloqueos.
- API y frontend reiniciados normalmente. Inicializadores completados, backfill
  de compras `inserted: 0`, health `200 {"status":"ok"}`.
- Captura real del preview: pantalla de ingreso renderizada, sin iniciar sesión.
  Los 401 de consultas protegidas corresponden a la ausencia de sesión.

## Evidencia visual y límites

El arnés `.local/prompt-k-check` importa las pantallas/componentes productivos
y sus versiones anteriores. Solo reemplaza layout/contexto de autenticación y
frontera HTTP; usa datos sintéticos y no permite tráfico a la API real.
**No equivale a una E2E autenticada ni acredita permisos ejecutados con usuarios reales.**

La primera ejecución se interrumpió por CSS incompleto del arnés: Tailwind no
detectaba clases de los componentes externos. El diálogo de captura resultó
idéntico byte a byte antes/después. Se corrigió exclusivamente el alcance de
compilación del arnés, sin tocar el motor ni forzar clics. Las capturas
anteriores a esa corrección no se consideran evidencia visual final.

La comprobación final conserva **12 capturas** (antes/después, escritorio/móvil
para cada pantalla), sin solicitudes fuera del entorno aislado y sin fallos
actuales de los recorridos. El informe conserva también el historial de dos
pasos de prueba corregidos: confirmar localmente la línea antes de alternar
tabs y navegar a un documento antes de usar Atrás (paginar no agrega una
entrada al historial del navegador).

- Entradas: dos rollos capturados y línea confirmada únicamente en memoria;
  alternancia Historial/Captura sin perder la línea, sin POST de guardar.
  Historial con fechas, página posterior a la primera y regreso conservado.
- Movimientos: filtro, página 2, documento/rollo, Atrás conservando página 2 y
  expansión con enlaces documentales y series.
- Sitios: inactivos administrativos, reactivación interceptada en el arnés y
  catálogo restringido activo-only.
- Sin permiso de crear: no aparece la creación/captura de Entradas.

`verification-report.json` contiene resultados y procedencia. Queda registrado
un aviso de React durante el recorrido aislado de Movimientos: actualización
de un componente mientras se renderiza otro. No bloqueó el recorrido y no se
presenta la consola como completamente limpia.

Galería autocontenida: [`antes-y-despues.html`](antes-y-despues.html).

## Clientes y borrado

Hallazgo financiero abierto y auditoría de referencias:
[`resultado.md`](resultado.md). La ruta genérica de purga de usuarios ya
existía y no se modificó. No se elimina ningún sitio o usuario.

Propuesta de Clientes: [`visual/propuesta-clientes.html`](visual/propuesta-clientes.html),
con capturas de escritorio y móvil y procedencia en `visual/README.md`.
Es una propuesta estática aislada, sin cifras globales ni integración en
Clientes/Proveedores.