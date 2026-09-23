# Tanda B — entrega vigente r5, preparada OFF, no liberada

**Resultado MAIN: `PASS_PREPARED_OFF`, exit 0. Fase B NO EJECUTADA.**
No autoriza instalar SQL en la base de la API, reiniciar, cambiar workflow,
bundle activo o permisos, ni liberar funcionalidades.

## Archivos de entrega

- [Manifiesto final vigente](r5/final-manifest.json) y
  [SHA-256](r5/final-manifest.sha256).
- [Terminal final del orquestador](r5/evidencia/run-main-terminal.json).
- [Ensayo y cleanup](r5/evidencia/rehearsal-r5/terminal.json).
- [Texto de fase B conservado, NO EJECUTADA](r5/fase-b-NO-EJECUTADA.txt).
- [Texto operativo de fase B para revisión](fase-b-texto-para-revision.txt):
  **BORRADOR NO EJECUTADO**, sin autorización implícita de instalación.
- [Resultado único y límites](../tanda-c-20260923/07-resultado-paquete-b0-b1.md).
- Inventario adicional de entrega: `delivery-inventory.json` y
  `delivery-inventory.sha256`. Incluye el terminal final r5 y la salida CLI del
  finalizador, escritos después del inventario de `final-manifest.json`.

El `manifest.json` de esta raíz es **preliminar histórico**: se conserva
intacto, no es el resultado final. Las revisiones r1–r4 y sus FAIL tampoco se
reescribieron. Los archivos sellados de r5 no fueron modificados para redactar
esta entrega. El inventario adicional excluye únicamente sus dos propios
archivos dentro del paquete; registra enlaces sin seguir dependencias externas.
También cubre los 23 archivos de salida API/UI y las fuentes externas que
identifican las autorizaciones, SQL, comparación y pruebas de esta entrega.

## Identidad de fuentes y resultado

- API/UI reutilizadas: `cc628aed315a4bbfd3e6cb8766d28200ce400842`.
- SQL externo: `91dfbd26e544d1fc4d0a1e57d95ec61ecad3af6f`.
- Comparador enum, commit separado: `817830d3f8d4ce2d00434c0d2e9433b47dd38a9a`.
- Correcciones SQL puramente sintácticas: `a5ffecf` y `91dfbd2`.
- Manifiesto final r5 SHA-256:
  `b8550e72e090cfbebde64f09375737868b94260409180f0d325c6a144cfe6716`.
- API candidata SHA-256:
  `deaa31522316a38baff0bebfbcf2a418565e9b031775abe0249a51f520bfc670`.
- UI `index.html` SHA-256:
  `118cfee92b28955f81685aeb0bc6d5c4d99f7233e5e5c681403aad5feaa64af6`.

B0 es captura real READ ONLY preservada, revalidada por CLI en r5. B1 es B0
más el delta exacto del SQL ensayado y los cuatro reemplazos E1 autorizados
expresamente. No se reconstruyó el catálogo completo ni se repararon enums.

En PostgreSQL desechable r5: proyección y auxiliares PASS, arranque real del
candidato en **modo inspección** y loopback PASS, cuerpos HTTP OFF observados,
invariancia de catálogo/filas/secuencias PASS y cleanup PG exit 0/destruido.
El control E2 pasó sobre el mismo fixture de r4; no se ejecutó nuevamente en
r5 porque el candidato ya pasó.

Esto **no** acredita arranque normal de producción, cobertura funcional de
todos los cuerpos PL/pgSQL, integración por actor autenticado, todos los
endpoints de cada módulo, ni navegación/UI end-to-end. La inspección usa un
fixture mínimo, no un clon integral de la base. La disponibilidad pública E7
respondió exactamente `200 {"enabled":false}`; no fue una puerta abierta.