# Tanda E — informe final consolidado

Fecha: 2026-09-23. Este informe resume lo realmente acreditado; **Tanda E no tiene PASS E2E general**.

## Liberación y runtime observados

- Candidato servido: `dist-tanda-e-20260923`.
- API: `artifacts/api-server/dist-tanda-e-20260923/index.mjs`, SHA-256 `1d22663f0cda69c2907d4171f902f51532cf45c013a8ccbd042a83c421bac80d`.
- UI: `artifacts/mariana-textil/dist-tanda-e-20260923/index.html`, SHA-256 `5e90c451021013e5e1da297168a3213d044d1163d2e68c23b2ed40d8968d8b27`.
- Los TOML finales son válidos y apuntan a esos artefactos. API y UI se reiniciaron una vez cada una. La API observada fue PID 21218, con inicializadores, backfill y monitor pausados por inspection boot; health respondió HTTP 200. La captura verificó la pantalla de login; el mensaje seguro para HTTP 500 se acreditó por comprobación enfocada de fuente y bundle, no provocando un error en la aplicación.
- Typecheck API/UI, build API/UI y check enfocado del mensaje de login terminaron en cero. El inventario de 23 hashes está en `build/build-bundles.sha256`.

## Resultado por tarea

### Tarea 1 — navegador real: **PARCIAL**

Se usó una copia desechable real con actores y sesiones sintéticos, nunca development. Tras los arreglos iniciales se acreditó:

- E4 sin motivo: denegado, sin fila.
- E4 CAJA con insuficiencia genuina: denegado, sin fila.
- Desbloqueo ADMIN genuino: aceptado y durable.
- Precio de lista bajo costo: denegado.
- Venta bajo costo sin marca: denegada.
- Rollo marcado como remate: precio bajo costo permitido por validación; **la venta no se completó**.
- Cierre: fondo `500.00`, salidas `525.00`, esperado `-25.00`, contado `0.00`, diferencia `25.00`, cero cobros y sesión cerrada: PASS para ese recorrido.

Los primeros bloqueos fueron defectos SQL corregidos; después apareció procedencia incompleta del fixture, reparada solo en la copia. La política válida de una sesión por sitio y fecha impidió reutilizar el sitio cerrado. Se preparó un segundo sitio con procedencia válida, pero el worker de navegador dejó de entregar evidencia durante más de 30 minutos y fue detenido. Permanecen **BLOCKED/no completados**: cobro en efectivo, cobro por transferencia, Nota y abono E3, recibo/reimpresión, venta real de remate y salida ordinaria con saldo suficiente desde CAJA.

La lectura final sí encontró avance parcial en el segundo sitio: sesión 47 abierta y Ticket 112 por 150.00, con consumo físico, pero **sin cobro ni asociación a una sesión de caja**. No se interpreta como PASS del cobro. El estado final redactado está en `tarea-1/final-state.txt`.

La copia PostgreSQL, servidores aislados, dump de esta tarea, credenciales, secreto de sesión y árbol privado fueron destruidos; se conservaron 18 capturas y evidencia redactada. No se tocaron respaldos preexistentes. Commit de Tarea 1: `075bcfb`.

### Tarea 2 — correcciones estrechas: **LIBERADA**

Los defectos de aliases E11 y E5 eran DDL reales. Los dos operadores acotados terminaron `BEGIN / DO / COMMIT` en la base efectiva `heliumdb`; solo cambiaron aliases locales, sin relajar `plpgsql.variable_conflict` ni abrir E5. También quedaron incluidos el mensaje seguro de login para 500, el binding escalar POS y la lectura operacional de saldo E4. No se ampliaron roles, gates ni reglas. Commit: `4dc21d8`.

La evidencia de aplicación redactada está en `tarea-2/04-effective-preflight-redacted.log`, `05-e11-application-status.log`, `06-e5-application-status.log` y `07-function-definition-hashes.sha256`. El trabajador informó PASS del ensayo aislado E11, pero no quedó disponible su salida original; se conserva el script de prueba y se declara esta limitación sin reconstruir un log.

### Tarea 3 — navegación de cifras: **COMPLETADA CON LÍMITES**

Se añadieron rutas reales y autorizadas desde cifras E3/E4/E7/E9/remate a sus detalles/documentos. Permanecen sin enlace falso los retenidos/E5 cuya capacidad documental está cerrada y los históricos sin identidad documental recuperable. Commit: `0ba3646`.

### Tarea 4 — color semántico: **COMPLETADA**

Se retiró color decorativo y se documentaron significados de estado/navegación en E3/E4/E7/E9/remate. Typecheck y cobertura enfocada disponible pasaron. Las suites DOM conjuntas no ejecutaron aserciones porque el runner Node no carga el PNG estático del layout; esa limitación de infraestructura **no es PASS generalizado**. Commit: `b98ec0d`.

### Tarea 5 — impresión A5: **PROTOCOLO LISTO; PRUEBA FÍSICA PENDIENTE**

Existe un protocolo reproducible en `tarea-5-impresion-a5.md` para imprimir desde otra computadora con sesión ADMIN, impresora compatible A5 y dos copias documentales (una sola copia en el controlador), y comparar la reimpresión. Incluye equipo, configuración y lista de aceptación. No hubo impresora física ni observación del propietario, por lo que no existe PASS físico. Commit: `861c1ab`.

### Tarea 6 — documentación: **COMPLETADA**

Las nueve dudas conservan estos estados:

| Duda | Estado final |
|---|---|
| D1 | Resuelta documentalmente: Prompt H y la purga del 13/09 están separados. |
| D2 | Resuelta solo para la copia desechable autorizada; base permanente, retención y futura restauración/purga siguen por decidir. |
| D3 | Resuelta: aplicación normal usa `DATABASE_URL`; pruebas aisladas autorizadas usan `TEST_DATABASE_URL` distinta y verifican identidad. |
| D4 | Abierta: encabezados/pies y aceptación física deben decidirse por formato; no hay regla universal. |
| D5 | Resuelta documentalmente: episodios históricos no se presentan como runtime actual. |
| D6 | Resuelta documentalmente: el FAIL de `f8818255` se conserva para esa revisión y no invalida correcciones posteriores. |
| D7 | Parcial: remate/matriz y piso están resueltos; siguen abiertos 69 vetos, purga/no DELETE y amplitud SISTEMAS/precios; extraordinarias conserva excepción ADMIN. |
| D8 | Resuelta documentalmente y presente en fuente/build/runtime: Nota/Ticket usa nombre dinámico. No hubo verificación autenticada final específica de ambas variantes. |
| D9 | Resuelta documentalmente; el procedimiento de purga es referencia NO-GO y la operación continúa cerrada. |

Commit de Tarea 6: **el commit final que contiene este informe y `replit.md`; su identificador es autorreferencial y MAIN lo registra al crearlo**.

## Decisiones y límites que permanecen

No son puertas nuevas:

1. Decidir si habrá base de pruebas permanente, su retención y la política futura de restauración/purga; la autorización actual solo cubre la copia desechable.
2. Resolver D4 por cada formato y ejecutar la aceptación física A5 de Tarea 5.
3. Resolver en D7 los 69 vetos, purga frente a no DELETE y alcance SISTEMAS/precios.
4. Si se desea cerrar la matriz E2E de Tarea 1, ejecutar en un entorno desechable válido únicamente los recorridos bloqueados, sin saltar procedencia ni la regla de una sesión por sitio/día.
5. Mantener sin páginas ficticias los links E7 a E5 cerrado y los históricos sin identidad documental.

Fondo/E10, E12, E5 monetario, retiro dirigido/retenido, atribución histórica E1 y purga continúan cerrados. Ningún resultado de esta tanda los habilita.