# Continuación — devolución comercial y pendientes nocturnos

## Autorizaciones

La autorización parcial se guardó literalmente como primera escritura en
`reports/autorizacion-propietario-devolucion-rollo-parcial-20260925.txt`.
Complementa `reports/autorizacion-propietario-devolucion-rollo-20260925.txt`.
Ambas decisiones están registradas en replit.md y
reports/prompt-u-respuestas-2026-09-18.md.

Se cancela la deuda atribuible al rollo completo y se devuelve lo realmente
pagado por él desde caja abierta del día, solo ADMIN y con motivo. Nunca
saldo a favor. El reparto incierto se bloquea, no se supone.

## Resultado: devolución construida, NO liberada

Hay candidato de API, interfaz en detalle de nota, contrato, esquema y
protecciones SQL. Es independiente de la devolución de recibos E5 y no
abre esa puerta. Contempla cantidades completas, serie conservada, tienda
receptora, cancelación dirigida de deuda y salida actual de efectivo,
idempotencia y recuperación ante respuesta incierta. Bloquea proporciones
que no se resuelven en centavos exactos y liquidaciones cuya fuente no
demuestra dinero pagado.

Las puertas de API, interfaz y SQL permanecen CLOSED. No se aplicó el SQL
comercial a la base de la aplicación ni se sustituyeron sus bundles servidos.
La autorización monetaria ya no es el bloqueo; el bloqueo actual es técnico.

### Ensayos y límite exacto

- 94/94 pruebas focalizadas de API/proyecciones/lectores reportadas por
  implementación; incluyen pruebas negativas. Interfaz: 12/12 en la tanda
  focalizada. No equivalen a aceptación PostgreSQL.
- Typecheck global posterior PASS, todos los paquetes seleccionados, cero
  diagnósticos: `typecheck-final.log`.
- Instalación SQL CLOSED en PostgreSQL desechable y rechazo de captura
  directa cerrada: PASS.
- Tres intentos de ensayo positivo: primero alias reservado en fixture;
  segundo envoltura E1 vacía en fixture. Ambos corregidos sin relajar
  constraints ni borrar evidencia.
- Tercer intento: el servicio ejecuta `SELECT ... FOR SHARE` sobre
  `commercial_return_gate`; el rol restringido tiene SELECT y no UPDATE,
  por lo que PostgreSQL devuelve 42501. **Cero casos positivos de
  devolución completados**. Los casos concurrentes y adversariales
  posteriores no fueron alcanzados.
- Se detuvo la tanda, sin cuarto intento ni apertura como atajo.

Detalles y logs: `reports/devolucion-comercial/READINESS.md`,
`main-closed-rehearsal*.log`, `main-positive-rehearsal*.log`.
La propuesta técnica pendiente es una función de bloqueo de lectura muy
limitada; no conceder UPDATE sobre la puerta ni cambiar a superusuario
para obtener una prueba positiva.

**No publicar/recompilar el candidato sobre la base actual como si estuviera
liberado.** Sus lectores nuevos necesitan el esquema comercial, todavía no
instalado allí. El bundle anterior sigue sirviendo.

## Pendientes de la noche

| Trabajo | Resultado real |
|---|---|
| E5 navegador | Recepción dirigida 1000 pendiente/aplicado 0; rechazo y nueva propuesta ADMIN; A prepara sin aplicar; ADMIN aplica 500; 500 siguen retenidos. Devolución E5 sigue denegada. 19 escrituras verificadas con acuse y lectura posterior, ninguna incierta. |
| E11 visibilidad | F ve factura no vacía de 1160; nota no facturada 404; A tuvo fiscal 403 en recorrido inicial. |
| E11 conciliación | NO completada. Se preparó reloj de períodos instrumentado solo en copia. Tras corregir problemas del reloj de ensayo, GET fiscal autenticado devolvió 409 REVISION_OBSOLETA. No hubo snapshots, decisiones ni avisos fiscales. No se demostró fuga de datos ni causa raíz del conflicto. |
| Permisos | 4 guards exactos permisos.editar acreditados (TERMINAL, CAJA, SUPERVISOR, BODEGA), con fingerprints intactos y control positivo ADMIN. Pendientes API: 377; UI+API: 421. El arnés no localizó el control elegible, por lo que no se cuentan nuevas celdas UI. Las 357 sin significado permanecen sin inventar. |
| Rendimiento anual | Preparación de actores sintéticos por API completada. Primer seed falló por cast entero, corregido. Segundo seed quedó en COMMIT más allá de 300 s; MAIN canceló ese backend preciso. Se comprobó después ausencia del proceso/conexión y cero filas anuales confirmadas. No hay mediciones nuevas ni cumplimiento demostrado de objetivos. |

Los triggers diferidos de validación de grafo son una hipótesis del coste de
COMMIT anual, no una consulta culpable identificada. No se deshabilitaron.

Evidencias: `browser/outcome.json`, `browser/fiscal-result.json`,
capturas bajo `browser/`, `permissions/result.json`,
`performance/blocked-result.json`.

## Aislamiento y cierre

Preparación desde esquema efectivo en solo lectura, sin copiar datos ni
usuarios de aplicación. Seed canónico y actores sintéticos únicamente.
MAIN detuvo los servidores de ensayo y destruyó el directorio y clúster
privados completos: `preparation/teardown.json`.
No hubo purga de la aplicación ni apertura de Fondo, E12, atribución
histórica o devolución general E5.

No se declaran terminadas las tareas pendientes. No pedir al propietario
que pruebe la devolución en la aplicación: continúa cerrada.

## Commits por trabajo

- `59dbf846`: candidato comercial CLOSED, autorización y ensayos PostgreSQL fallidos.
- `457b6880`: recorrido E5 y bloqueo fiscal E11 documentados.
- `f5766ec7`: cuatro guardas exactas de permisos.
- `1aca45c3`: carga anual bloqueada y cancelación comprobada.

La captura `served-login-unchanged.jpg` confirma únicamente que el login del
bundle conservado sigue visible; no acredita devolución comercial operativa.