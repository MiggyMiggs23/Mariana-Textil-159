# Tanda D — tarea 4, entrega auxiliar a MAIN

**Resultado: plan final preparado sin ejecución; NO-GO para purgar hoy.**

Se leyó la autorización de Tanda D: la tarea 4 exige preparar, no ejecutar. Entregable principal: [`purga-final-preparada.md`](purga-final-preparada.md).

## Alcance cubierto

- Matriz explícita de borrado candidato, conservación, derivados/contadores y bloqueo por desconocidos; incluye E1/E2, Fondo, **E3 y Tanda B instaladas técnicamente**, no sólo su antiguo estado preparado.
- Conservación de auditoría permanente, catálogo, propietarios, usuarios, permisos/configuración y objetos privados; excepción de borrado individual de productos no se convierte en purga de catálogo.
- Precedencias FK y método para obtener/verificar el grafo actual completo en una fase futura autorizada; no se afirma haber consultado DB.
- Secuencias/folios preservados por defecto, series de ocho dígitos, recibos E3 incluidos y cualquier reset sujeto a decisión expresa.
- Respaldo íntegro nuevo/restaurado, ownership/ACL, copia remota privada verificada, almacenamiento externo separado, ensayo autorizado, validación transaccional/postcommit/postarranque y recuperación.
- Revisión textual de los dos operadores históricos: no aptos para repetir sobre el catálogo actual, ni se ejecutaron sus modos dry-run.
- Mecanismo de autorización futura en dos puertas (propietario + revisión técnica por protección). Append-only es bloqueo real: no TRUNCATE como evasión, DISABLE, CASCADE, cambio de owner/rol ni manipulación de auditoría.

## Fuentes y límites

Se revisaron `autorizacion.txt`, el procedimiento Tanda C tarea 10, el plan Prompt H, fuentes de ambos scripts históricos, declaraciones Drizzle/DDL E3 y Tanda B, contrato de ownership de referencias de Prompt F, referencias de documentos privados, memoria `replit.md` y el cierre `reports/liberacion-simple-20260923/continuacion-resultado.md`.

Este último acredita documentalmente instalación E3/Tanda B y supera el informe inicial detenido; no equivale a una comprobación viva hecha por esta tarea. Aperturas/cambios concurrentes de Tanda D deben entrar en el manifiesto final antes de ejecutar.

Sólo se crearon estos dos Markdown. Sin consultas DB/SQL, red, ejecución de scripts, ensayos, apps, workflows, borrados, cambios de código principal, cambios de `replit.md` o commits. No se abrieron dumps ni se incluyeron secretos/PII. Revisión de consistencia documental, no prueba funcional; no corresponde captura de app porque esta tarea prohíbe ejecutarla y no cambia UI.

## Detenido con motivo / aceptación

La ejecución necesita decisión del propietario de comenzar operación real y finalizar la regla simple temporal; entonces vuelve **íntegro** el procedimiento completo. Faltan autorización nueva por alcance/campos, catálogo vivo exhaustivo, cierre FK/lógico, mecanismo compatible con append-only, respaldo fresco restaurado y verificado, ensayo y preflight, revisión de operador y ventana de ejecución/reanudación. Ningún antecedente histórico satisface automáticamente esas puertas.

Preparación aceptable si MAIN confirma que el plan describe qué conservar/borrar sólo tras aprobación, enumera E3/Tanda B y deja explícitos bloqueos sin presentar PASS ni acciones no realizadas. No hay script nuevo que armar accidentalmente.

**Commit de esta tarea: ninguno por instrucción de delegación. MAIN consolida este auxiliar en el único informe final de Tanda D y gestiona el commit si corresponde.**