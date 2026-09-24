# Tanda G ampliada — preparación, sin pruebas

> **HISTORICAL_DESTROYED — NO EJECUTAR.** Este handoff describe exclusivamente la preparación histórica. El 24/09/2026 a las 05:38 UTC MAIN completó la destrucción de copias, servidores y credenciales temporales. La raíz privada ya no existe y los doce puertos privados están cerrados; ver `month-stop.json` y `teardown-final.json`. Los comandos, rutas, identidades de procesos y estados siguientes no son instrucciones vigentes ni recursos disponibles. Resultado consolidado final: `../INFORME.md` y `../INFORME.html`.

## Estado

Captura fresca de la base efectiva de API PID3575 mediante pg_dump con `default_transaction_read_only=on`. Identidad y SHA256 en `source-identity.json`; no se afirma quiescencia. Ninguna escritura en la base original, ningún workflow, inicializador ni aplicación de prueba ejecutados.

HEAD congelado al comenzar: `ee1bb641e0513b7df18027ad351a72ebbe99af74`. El árbol de trabajo y HEAD pueden avanzar por trabajo paralelo: la identidad del archivo git, no el HEAD posterior, identifica este baseline. API y UI compilados exclusivamente en `.local/tanda-g-ampliada/frozen-source`. Hashes y manifiesto UI en `build-identity.json`. Las dependencias @workspace apuntan a bibliotecas congeladas.

PostgreSQL16.10 privado, localhost55442, directorio `.local/tanda-g-ampliada/cluster`, **detenido**. Cinco bases:

| Worker | Base | API | UI |
|---|---|---|---|
| permissions | tanda_ga_permissions | 43851 | 43861 |
| inventory | tanda_ga_inventory | 43852 | 43862 |
| month | tanda_ga_month | 43853 | 43863 |
| performance | tanda_ga_performance | 43854 | 43864 |
| failure | tanda_ga_failure | 43855 | 43865 |

Referencias: `tanda_ga_template` y testigo vacío `tanda_ga_witness`. `copy-identities.json` contiene identidades SQL, matriz CONNECT, siete roles, sitios, ADMIN canónico y metraje cero. Cada login ga_* solo conecta a su base hermana asignada; no es superusuario. Los datos restaurados siguen siendo sensibles.

## Fixtures y contratos

`fixture-manifest-redacted.json`: nueve actores naturales (siete roles y dos CAJA adicionales), tres tiendas y cuatro bodegas, cliente de crédito compartido, proveedores nacional/importación, cuatro productos METRO/KILO/PIEZA/BOLSA. Cada producto/sitio tiene ocho rollos de cantidad10: 224 rollos con proveedor → entrada → RECEPCION trazable. Existencia/rollos/ledger=80 por producto/sitio. Tres sesiones de caja abiertas, solo tiendas; no duplicarlas.

Actores restaurados desactivados, renombrados y rehasheados, sesiones de autenticación eliminadas **solo en copias**. Matriz de permisos restaurada sin modificación ni overrides nuevos. Ningún gate abierto, ningún producto con venta por metraje habilitada.

Credenciales privadas: `.local/tanda-g-ampliada/credentials.json` (actores), `worker-databases.json` (login DB de cada worker), `session-secret`. No imprimirlas ni incorporarlas a reportes. Árbol0700 y secretos0600.

El esquema real se conserva privado en `actual-schema.sql`; dump original y template también privados. Los workers usan su URL asignada con REQUIRE_ISOLATED_TEST_DATABASE=1 y NODE_ENV=test; el testigo distingue la identidad de aplicación de la base de prueba. La API se importa en modo test y arranca con API_INSPECTION_BOOT, sin inicializadores ni monitores escritores. Los grants ordinarios no transfieren propiedad de tablas: cualquier ALTER TABLE de la propuesta de protección requiere que MAIN lo aplique como operador únicamente en inventory, después de verificar la identidad.

## Lanzamiento exclusivo de MAIN

Usar el wrapper persistente de MAIN, no procesos hijos efímeros del subagente:

1. `node reports/tanda-g-ampliada/setup/lifecycle.mjs start`
2. `node reports/tanda-g-ampliada/setup/lifecycle.mjs api permissions`
3. `node reports/tanda-g-ampliada/setup/lifecycle.mjs ui permissions`

Sustituir permissions por el worker correspondiente. Cada pareja tiene puertos y base separados. Los launchers validan PID/directorio/puerto y SQL, construyen entorno mínimo y no heredan credenciales de aplicación ni flags. Mantener procesos vivos desde MAIN. No hay pruebas realizadas; un build correcto no equivale a runtime verificado.

`prepare.mjs --capture --prepare` está reservado para una preparación nueva con árbol privado inexistente. `freeze.mjs` congela/compila una vez; `--finalize` recalcula manifiesto desde el archivo existente. `lifecycle.mjs seal` ya fue ejecutado y no debe repetirse.

## Limpieza precisa y repetible

Primero conservar evidencia no secreta en reports. Luego:

`node reports/tanda-g-ampliada/setup/lifecycle.mjs teardown`

`node reports/tanda-g-ampliada/setup/lifecycle.mjs teardown --remove`

Valida PID propio antes de señales y directorio/puerto antes de detener PostgreSQL. `--remove` elimina exclusivamente `.local/tanda-g-ampliada`, incluyendo dumps, fuentes, bases y credenciales. Reporte durable: `teardown-verification.json`. No elimina informes ni toca la aplicación.