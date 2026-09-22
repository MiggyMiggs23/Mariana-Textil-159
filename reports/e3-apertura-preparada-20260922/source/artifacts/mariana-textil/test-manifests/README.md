# Manifiesto seguro de contratos frontend

`safe.txt` es la copia canónica de los mismos 99 archivos del manifiesto
histórico `reports/behavior-contracts/suite.manifest`. Sus rutas son relativas
al paquete frontend para que el runner también pueda ejecutarlo desde un clon.

No contiene `skip` ni amplía o reduce la línea base de 354 pruebas. Los únicos
tres archivos excluidos ya estaban fuera de la línea base por requerir procesos,
red o navegador:

- `src/pages/entrada-etiquetas-pdf-regression.test.mjs`
- `src/pages/laser-documents-pdf-regression.test.mjs`
- `src/pages/laser-other-documents-pdf-regression.test.mjs`

Ejecute la suite con `node ../../scripts/src/frontend-test-runner.mjs` desde
este directorio. El runner usa únicamente `tsconfig.render-tests.json`, cuyo
transform JSX es automático; no modifica componentes de producción ni instala
dependencias.