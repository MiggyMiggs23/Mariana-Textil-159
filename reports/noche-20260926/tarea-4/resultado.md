# Tarea 4 — auditoría multiusuario

**Resultado: recorridos cubiertos con defecto concurrente reproducido.**

Se crearon seis usuarios ADMIN sintéticos propios mediante pantalla, IDs **243–248**; el rol elevado evita confundir esta prueba de colaboración con la matriz de permisos. Sitio sintético **835**, pisos **14/15/16**, entrada nativa **4**, auditoría nativa **2**. La preparación del sitio/pisos se hizo por API autenticada; los escaneos y uniones fueron UI real.

| Caso | Resultado |
|---|---|
| Tres sesiones simultáneas, UA móvil, pisos distintos | Aprobado: tres series y conteo compartido 3 |
| Rollo de otro piso | Aprobado: `10000028`, esperado `01 Acceso configurado`, real `02 Segundo`, autor conservado |
| Mismo rollo por dos usuarios simultáneos | La persistencia conserva una fila, autor y piso originales; **falló la UI concurrente** |
| Sexto usuario | Aprobado en recuperación independiente: HTTP 409, `AUDIT_PARTICIPANT_LIMIT`, mensaje explícito de cinco usuarios |
| Computadora fija / teclado tipo pistola | Aprobado: `10000032`, usuario 246, piso 14, sin selector para cambiar piso |

## Defecto observado

En el intento simultáneo del duplicado apareció una página completa con texto técnico rojo **`REVISION_OBSOLETA: Conflicto concurrente; recarga y confirma de nuevo`**, en lugar de mantener el recorrido utilizable. Las primeras comprobaciones posteriores quedaron contaminadas por esa pantalla. Las capturas originales se conservan en `audit/same-roll-two-users-0.png` y `audit/sixth-user-rejected-0.png`; el segundo archivo **no** prueba capacidad: ese 409 inicial era conflicto, no rechazo por cupo.

Se repitieron únicamente login/unión y lecturas; no se volvió a enviar el escaneo ya persistido. `audit-independent-recovery/result.json` demuestra el rechazo correcto por cupo. Una comprobación de escritorio inicialmente confundió la fila `FALTANTE` del snapshot con un escaneo existente y por ello no envió la serie. Se leyó de nuevo, se confirmó `FALTANTE`, y `desktop-keyboard-scan/result.json` documenta el único escaneo posterior, correcto. Lectura final: **5 escaneados**, una fila del duplicado y escritorio con autor/piso correctos.

## Interpretación del piso de acceso

Se respetó el **primer piso activo del orden configurado**, denominado aquí `01 Acceso configurado`. No se inventó una equivalencia con el acceso físico del sitio. Se usó entrada real de teclado en Chromium con UA escritorio; **no** se probó una pistola física ni seis aparatos físicos.

La auditoría se dejó abierta y no se confirmó ninguna aplicación sobre inventario. Navegadores y heartbeats del ensayo fueron cerrados al terminar.