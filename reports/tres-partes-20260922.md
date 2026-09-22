# Tres partes — informe único

## Parte 1 — verificada, sin cambios ni reinicio

La autorización íntegra se guardó, antes de cualquier otra escritura, en
`reports/e2-liberacion-20260922/autorizacion-tres-partes-20260922.txt`.
También se guardó íntegro el mismo mensaje, que incluye la autorización de
bases desechables de Tanda B, en `reports/autorizacion-tanda-b-20260922.txt`.
Ambas copias se compararon byte por byte con el adjunto original.

El workflow real ya contenía exactamente:

```
cd /home/runner/workspace && exec bash reports/e2-paquete-liberacion-preparado-20260921/api-start-audit.sh
```

No fue necesario modificarlo ni reiniciar. Verificación:

- Workflow `artifacts/api-server: API Server`: running, puerto 8080.
- PID `3800`; `TracerPid=0`.
- Bundle `artifacts/api-server/dist-e2-20260927/index.mjs`:
  `008dfd54d93f6a1606370d44cb2086673669c51278c92ebb6a5a63f4d503e7f5`.
- Entorno del proceso: `API_INSPECTION_BOOT=1`.
- Petición autorizada a `/api/healthz`: HTTP 200, `{"status":"ok"}`.
- Traza E2 antes y después:
  `a367379f2de3eab58bffe328cf91ec5d3f5c7bb6178dd55b28547e6993ff52ea`.
- `reports/arranques-api.log` contiene el arranque de PID `3800` a
  `2026-09-22T15:31:16.789Z`, con hash completo correcto, modo inspección,
  preflight `passed` y exit 0.

No se aplicó SQL ni se escribió en la base de la API.

Revisión de Parte 1: `eb07aa3947f16d8964d46f3b0b56d40f7f157d19`.

## Parte 2 — preparada, verificada y entregada; no liberada

Las decisiones nuevas sustituyen la exclusividad ADMIN anterior en `replit.md`
y `reports/prompt-u-respuestas-2026-09-18.md`: recaptura por permiso de matriz,
ADMIN por defecto, personalizable para otros actores permitidos por E1, sin
veto ADMIN fijo. CONTADOR, SISTEMAS y BODEGA continúan excluidos por E1. La
liberación propuesta abre efectivo ordinario, no dirigido/retenido, devolución,
atribución ni Fondo.

Paquete sellado: `reports/e3-apertura-preparada-20260922/`.
Outputs finales: `artifacts/api-server/dist-e3-apertura-20260922/` y
`artifacts/mariana-textil/dist-e3-apertura-20260922/`.

| Elemento | SHA-256 |
|---|---|
| API candidata | `44e27767ca02ee21b8ba0cdcea56331adcb949229df942a8b2387dc306dfcbd6` |
| Manifiesto | `c61e63cb4da2ac3227b2fd1450779b140498f3fae1d9722a243cf5097af21201` |
| Inventario runtime | `769372ea19bfb79009f26393ccf9192c3b8bd6cebcbc08aa85d9dedfef81cfc0` |
| Inventario integral del paquete | `159fee6dd3a1387dc945389c7c43341f8ffd7fea61de938512f031f9e8640388` |
| Fase B final para autorizar | `8eebf2fdae6bdce1393a9b359c3dfcbba06d9c20d3a0bcdbab523d4d80e3a742` |

La base de procedencia es `eb07aa3947f16d8964d46f3b0b56d40f7f157d19` **más**
`source-corrections.patch` y `activation.patch`, ambos fijados en el manifiesto.
No se presenta como una compilación de HEAD limpio. El snapshot físico permite
conservar el candidato mientras Tanda B modifica las fuentes vivas; el preflight
no depende de hashes de esas fuentes vivas.

Solo el snapshot abre E3 ordinario, matriz y la excepción de efectivo ordinario.
La fuente de desarrollo conserva OFF. Se corrigieron los consumidores E1/E2
para esa excepción acotada y la traducción local de `CreditEvidenceError` en
rutas E3, sin cambiar el manejador global ni abrir otros productores.

**Verificaciones:**

- Captura de expectativas con conexión efectiva del PID 3800, READ ONLY con
  ROLLBACK; dump solo esquema, sin copiar usuarios ni datos operativos.
- Reconstrucción fiel B0 y SQL 01 + SQL 03 exclusivamente en PostgreSQL nuevo.
  B1 catálogo `2cffb4df1f91f827e1a48e6049dfb0f65ebf386bafec17060acdc0f91b99dd16`;
  atributos `e360831b5e3d0ea63408d8c592d4bc88ea33eb0340d3e25896e2b6feb50cfe24`.
- Arranque real aceptado `r1b`: preflight, modo INSPECTION, healthz 200, workers
  absolutos y registro efectivo de arranque de PID 11847. Catálogo, hashes de
  filas y secuencias con `is_called` idénticos antes/después del arranque.
- Once casos funcionales HTTP aprobados: cobro efectivo, movimiento/operación/
  recibo relacionados, reintento idempotente, recaptura por permisos y exclusión
  E1, atomicidad completa, FK e inmutabilidad.
- Tres controles con defecto: cierre SQL del efectivo, permiso prematuro de
  recaptura y fallo de la última auditoría. La escritura fallida no dejó
  movimiento, operación, aplicaciones, recibo ni incremento del contador de
  folio. Se comprobó también sensibilidad a cambios de valores con igual conteo.
- API y frontend typecheck PASS. Inventarios runtime e integral PASS.
- Todos los procesos candidatos y clusters nuevos detenidos y destruidos.

**Fallos conservados:** R0 expuso la guarda de efectivo todavía cerrada en
fuente; el log de la primera confirmación acreditó esa causa antes de llegar
a SQL. No se atribuyó causalidad a un segundo 500 sin log ni se declaró allí
probado el mutante SQL. R1 falló al exigir inmediatamente la salida asíncrona
de inspección; se conservó y se añadió espera acotada, sin quitar aserciones.
R1b es la evidencia aceptada, incluyendo el control SQL con fuente habilitada.

La fase B está en `fase-b-FINAL-PARA-AUTORIZAR.txt` y comienza:
**«a partir del momento en que el propietario pegue el texto»**.
Incluye pines, respaldo/ventana exclusiva, SQL acotado y límites de reversión.
No se ejecutó ni se recibió esa autorización. El paquete CLOSED anterior y
E2 permanecen intactos, al igual que PID 3800, workflow, bundle, log y traza.

## Parte 3 — se inicia solo después de presentar la entrega E3