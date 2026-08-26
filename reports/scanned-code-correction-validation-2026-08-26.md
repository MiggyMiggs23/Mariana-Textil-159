# Corrección — Intérprete de códigos escaneados

Fecha: 2026-08-26

## Resultado

- Pruebas unitarias del intérprete: **11/11 aprobadas**.
  - Incluye los ocho casos de la tabla solicitada y cadena vacía.
  - Incluye rechazo de ocho dígitos consecutivos y mensaje de discrepancia de SKU.
- Contrato de `CampoEscaneo` y advertencias: **3/3 aprobadas**.
- Contrato defensivo del servidor: **3/3 aprobadas**.
- Typecheck completo del workspace: **aprobado**.
- `git diff --check`: **aprobado**.
- Revisión arquitectónica: **PASS**, sin bloqueos funcionales o de seguridad.

## POS con datos reales de development

Se ejecutó una consulta de solo lectura; no se modificaron usuarios, sesiones ni inventario.

| Entrada | Resultado |
|---|---|
| `TAF-BLA-1002874` | serie `1002874`, SKU `TAF-BLA`, un solo rollo |
| `1002874` | serie `1002874`, SKU `TAF-BLA`, el mismo rollo |

En ambos casos la búsqueda de productos quedó vacía, evitando que un escaneo exacto produzca una lista ambigua.

## Búsqueda textual

- `interpretarCodigoEscaneado("gabardina azul")` conserva el texto original y devuelve `serie: null`, `sku: null`.
- POS, Etiquetas e Inventario conservan la rama `ILIKE` cuando no hay serie.
- La base de development consultada no contiene actualmente rollos cuyo SKU, tela o color incluya `gabardina`; por eso una consulta positiva con esa palabra no puede afirmarse sobre los datos actuales sin insertar datos de prueba.
- No se insertaron datos en development para forzar el resultado.

## Advertencia de SKU

- La función compartida produce: `Esta etiqueta dice TAF-BLA, pero el rollo 1002874 corresponde a GABMET-AZU. Verifica la etiqueta.`
- POS, Etiquetas y Ajustes muestran una alerta visible.
- Salida Nueva muestra una notificación y agrega el rollo después de advertir; la advertencia no retorna ni bloquea la operación.
- La serie sigue siendo la identidad autoritativa.

## Puntos conectados

### Cliente y servidor

- POS — `/pos/buscar`
- Salida Nueva — `/salidas/rollos/serie/:serie`
- Etiquetas — `/etiquetas/rollos`
- Ajustes — `/rollos`

### Campos no relacionados con etiquetas de rollo

- Entradas captura cantidades.
- Recepción de Salidas captura URL/folio.

Ambos usan el mismo `CampoEscaneo` y por ello pasan por el intérprete, pero desactivan la sustitución por serie para conservar su semántica.

## Verificación física pendiente

Este entorno no puede afirmar como aprobada la prueba de diez lecturas consecutivas con una pistola real. El contrato automatizado sí confirma que cada entrega limpia el campo cuando corresponde y recupera el foco, pero la aceptación con hardware debe ejecutarse en dispositivo.