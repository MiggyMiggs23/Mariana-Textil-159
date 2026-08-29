# Parte 10 — Verificación del catálogo por tela y BOLSA

Fecha de verificación: 29 de agosto de 2026.

## Resultado

- Base verificada: `heliumdb.public`.
- Normalización idempotente: cero cambios aplicables y cero colisiones previstas.
- Seed BOLSA idempotente: los cuatro productos iniciales existen.
- Productos que permanecen con color `Base`: 98. No se modificaron porque no hubo autorización para inferir su color.
- Pruebas de POS en Neon desechable: 34 aprobadas, 0 fallidas.
- Entradas BOLSA en Neon desechable: 7 aprobadas, 0 fallidas.
- Contratos de Productos, Auditoría, POS y etiquetas: aprobados.
- Build y typecheck globales: aprobados.
- Revisión arquitectónica final: PASS.

## Cambios de color y SKU autorizados

| Tela | Antes | Después |
| --- | --- | --- |
| Manta Libanito | Base / `MANLIB-BAS` | Crudo / `MANLIB-CRU` |
| Manta Libano | Base / `MANLIB-BAS2` | Crudo / `MANLIB-CRU2` |
| Pellon Adherible | Base / `PELADH-BAS` | Blanco / `PELADH-BLA` |
| Pellon Bordado | Base / `PELBOR-BAS2` | Blanco / `PELBOR-BLA` |
| Pellon Bordatec | Base / `PELBOR-BAS` | Blanco / `PELBOR-BLA2` |
| Pellon Escolar | Base / `PELESC-BAS` | Blanco / `PELESC-BLA` |

Los seis productos tenían cero rollos y cero reimpresiones. No hubo colisiones de variante ni SKU.

## Productos BOLSA iniciales

| Tela | Color | SKU |
| --- | --- | --- |
| Cascabel 15 Mm | Oro | `CAS15MM-ORO` |
| Cascabel 22 Mm | Oro | `CAS22MM-ORO` |
| PomPon 25 Mm | Blanco | `POM25MM-BLA` |
| PomPon 38 Mm | Blanco | `POM38MM-BLA` |

## 98 productos `Base` pendientes de decisión humana

- `124` — **Bombay** / Base / `BOM-BAS`
- `130` — **Borrega** / Base / `BOR-BAS2`
- `129` — **Borreguin** / Base / `BOR-BAS`
- `99` — **Bramante Fantasia** / Base / `BRAFAN-BAS`
- `98` — **Bramante Liso** / Base / `BRALIS-BAS`
- `121` — **Cambaya** / Base / `CAM-BAS2`
- `119` — **Campesina** / Base / `CAM-BAS`
- `69` — **Cuadrille 90** / Base / `CUA90-BAS`
- `71` — **Cuadrille Mariana** / Base / `CUAMAR-BAS`
- `70` — **Cuadrille San Miguel** / Base / `CUASANMIG-BAS`
- `126` — **Dubetina** / Base / `DUB-BAS`
- `134` — **Dublin** / Base / `DUB-BAS2`
- `53` — **Encaje** / Base / `ENC-BAS`
- `67` — **Etamina Beige Hueso Buena** / Base / `ETABEIHUE-BAS`
- `66` — **Etamina Blanca Buena** / Base / `ETABLABUE-BAS`
- `64` — **Etamina Blanca Economica** / Base / `ETABLAECO-BAS`
- `68` — **Etamina Color Buena** / Base / `ETACOLBUE-BAS`
- `65` — **Etamina Color Economica** / Base / `ETACOLECO-BAS`
- `108` — **Fieltro Blanco** / Base / `FIEBLA-BAS`
- `109` — **Fieltro Color** / Base / `FIECOL-BAS`
- `136` — **Flannel Estampado** / Base / `FLAEST-BAS`
- `135` — **Flannel Liso** / Base / `FLALIS-BAS`
- `137` — **Flannel Michelin** / Base / `FLAMIC-BAS`
- `51` — **Forro Cartera 60gms** / Base / `FORCAR60G-BAS`
- `52` — **Forro Cartera 70gms** / Base / `FORCAR70G-BAS`
- `78` — **Franela 250** / Base / `FRA250-BAS`
- `73` — **Franela 50** / Base / `FRA50-BAS`
- `74` — **Franela 60** / Base / `FRA60-BAS`
- `77` — **Franela Blanca 1.5** / Base / `FRABLA15-BAS`
- `76` — **Franela Cilo Baby** / Base / `FRACILBAB-BAS`
- `75` — **Franela Festonada** / Base / `FRAFES-BAS`
- `96` — **Gabardina Ambassador** / Base / `GABAMB-BAS`
- `93` — **Gabardina Camisera** / Base / `GABCAM-BAS`
- `94` — **Gabardina Ducatti** / Base / `GABDUC-BAS`
- `95` — **Gabardina Gap** / Base / `GABGAP-BAS`
- `92` — **Gabardina Metepec** / Base / `GABMET-BAS`
- `97` — **Gabardina Ripstop** / Base / `GABRIP-BAS`
- `152` — **Guata 100** / Base / `GUA100-BAS`
- `153` — **Guata 150** / Base / `GUA150-BAS`
- `154` — **Guata 200** / Base / `GUA200-BAS`
- `151` — **Guata 70** / Base / `GUA70-BAS`
- `122` — **Indiolino** / Base / `IND-BAS`
- `148` — **Jerga Cocina** / Base / `JERCOC-BAS`
- `149` — **Jerga Piso** / Base / `JERPIS-BAS`
- `128` — **Licra Metalica** / Base / `LICMET-BAS`
- `127` — **Licra Metalica Foil** / Base / `LICMETFOI-BAS`
- `81` — **Loneta Asturcon** / Base / `LONAST-BAS`
- `83` — **Loneta Buena Colores** / Base / `LONBUECOL-BAS`
- `84` — **Loneta Buena Cruda 82** / Base / `LONBUECRU-BAS`
- `80` — **Loneta Economica Color** / Base / `LONECOCOL-BAS`
- `79` — **Loneta Economica Cruda** / Base / `LONECOCRU-BAS`
- `82` — **Loneta Tripoli** / Base / `LONTRI-BAS`
- `139` — **Macuco** / Base / `MAC-BAS`
- `120` — **Mandilero** / Base / `MAN-BAS`
- `87` — **Manta Chipre** / Base / `MANCHI-BAS`
- `88` — **Manta Cresponada Blanca Cruda** / Base / `MANCREBLA-BAS`
- `89` — **Manta Cresponada Color** / Base / `MANCRECOL-BAS`
- `90` — **Manta Prelavada Blanca Cruda** / Base / `MANPREBLA-BAS`
- `91` — **Manta Prelavada Color** / Base / `MANPRECOL-BAS`
- `72` — **Marquiset** / Base / `MAR-BAS`
- `142` — **Mascota** / Base / `MAS-BAS2`
- `141` — **Mascotin** / Base / `MAS-BAS`
- `143` — **Mascoton** / Base / `MAS-BAS3`
- `114` — **Mezclilla 10 Oz** / Base / `MEZ10OZ-BAS`
- `115` — **Mezclilla 12 Oz** / Base / `MEZ12OZ-BAS`
- `116` — **Mezclilla 14 Oz** / Base / `MEZ14OZ-BAS`
- `111` — **Mezclilla 4 Oz** / Base / `MEZ4OZ-BAS`
- `112` — **Mezclilla 6 Oz** / Base / `MEZ6OZ-BAS`
- `113` — **Mezclilla 8 Oz** / Base / `MEZ8OZ-BAS`
- `110` — **Mezclilla Stretch** / Base / `MEZSTR-BAS`
- `125` — **Microfibra** / Base / `MIC-BAS`
- `147` — **Microtrapo** / Base / `MIC-BAS2`
- `58` — **Paliacate** / Base / `PAL-BAS`
- `138` — **Pique Vera** / Base / `PIQVER-BAS`
- `145` — **Plastico Cristal** / Base / `PLACRI-BAS`
- `146` — **Plastico Mantel** / Base / `PLAMAN-BAS`
- `144` — **Plastico Mantel Mascota** / Base / `PLAMANMAS-BAS`
- `131` — **Polar** / Base / `POL-BAS`
- `59` — **Popelina Blanca** / Base / `POPBLA-BAS`
- `60` — **Popelina Color** / Base / `POPCOL-BAS`
- `62` — **Poquetin Alpes** / Base / `POQALP-BAS`
- `61` — **Poquetin Doble Ancho** / Base / `POQDOBANC-BAS`
- `63` — **Poquetin Rayado** / Base / `POQRAY-BAS`
- `150` — **Relleno** / Base / `REL-BAS`
- `123` — **Sms Cubrebocas** / Base / `SMSCUB-BAS`
- `132` — **Soccer** / Base / `SOC-BAS`
- `133` — **Sportoc** / Base / `SPO-BAS`
- `118` — **Tafetan Camuflajeado** / Base / `TAFCAM-BAS`
- `117` — **Tafetan Estampado Temporada** / Base / `TAFESTTEM-BAS`
- `140` — **Toalla** / Base / `TOA-BAS`
- `55` — **Tricot 3 Metros** / Base / `TRI3MET-BAS`
- `56` — **Tricot Adherible** / Base / `TRIADH-BAS`
- `100` — **Tul 15** / Base / `TUL15-BAS`
- `101` — **Tul 70** / Base / `TUL70-BAS`
- `103` — **Tul Estrella** / Base / `TULEST-BAS`
- `102` — **Tul Glitter** / Base / `TULGLI-BAS`
- `54` — **Tuzor** / Base / `TUZ-BAS`
- `57` — **Yute** / Base / `YUT-BAS`

## Validaciones de cierre adicionales

- Motor de inventario en Neon desechable: **21/21**, incluyendo rechazo atómico de ajuste y activación fraccionarios para BOLSA.
- Historial y analítica de clientes exponen por separado cajas BOLSA, bolsas sueltas y total de bolsas.
- Contratos de clientes: **2/2**; contratos principales de la Parte 10: **4/4**.
- Typecheck global y builds de API/web aprobados después de estas validaciones.