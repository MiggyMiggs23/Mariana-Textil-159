export const TIPOS_EQUIPO = [
  "COMPUTADORA_POS",
  "IMPRESORA_ENTRADAS",
  "IMPRESORA_SALIDAS_NOTAS",
  "IMPRESORA_ETIQUETAS",
  "IMPRESORA_TICKETS",
  "PISTOLA_ESCANER",
  "SMARTPHONE_ESCANER",
] as const;

export type TipoEquipo = (typeof TIPOS_EQUIPO)[number];

export interface DefinicionTipoEquipo {
  label: string;
  checklist: readonly { key: string; label: string }[];
}

/** Canonical equipment names and setup requirements used by every consumer. */
export const DEFINICIONES_EQUIPO: Readonly<Record<TipoEquipo, DefinicionTipoEquipo>> =
  Object.freeze({
    COMPUTADORA_POS: {
      label: "Computadora POS",
      checklist: [
        {
          key: "PAPEL_NAVEGADOR_80MM",
          label:
            "Tamaño de papel del navegador en Roll Paper 80 mm para la impresora de tickets",
        },
        { key: "MARGENES_NINGUNO", label: "Márgenes del navegador en Ninguno" },
        { key: "ESCALA_REAL", label: "Escala en Tamaño real" },
        {
          key: "IMPRESORA_PREDETERMINADA",
          label: "Impresora de tickets predeterminada correcta",
        },
      ],
    },
    IMPRESORA_ENTRADAS: {
      label: "Impresora de entradas",
      checklist: [
        {
          key: "ENTRADA_REAL",
          label: "Instalada y probada con una entrada real",
        },
        {
          key: "PAPEL_NAVEGADOR_CARTA",
          label: "Tamaño de papel del navegador en Carta",
        },
        { key: "MARGENES_NINGUNO", label: "Márgenes del navegador en Ninguno" },
        { key: "ESCALA_REAL", label: "Escala en Tamaño real" },
      ],
    },
    IMPRESORA_SALIDAS_NOTAS: {
      label: "Impresora de salidas/notas",
      checklist: [
        {
          key: "SALIDA_REAL",
          label: "Instalada y probada con una salida real",
        },
        {
          key: "NOTA_REAL",
          label: "Instalada y probada con una nota real",
        },
        {
          key: "PAPEL_NAVEGADOR_A5",
          label: "Tamaño de papel del navegador en A5",
        },
        { key: "MARGENES_NINGUNO", label: "Márgenes del navegador en Ninguno" },
        { key: "ESCALA_REAL", label: "Escala en Tamaño real" },
        {
          key: "PAPEL_COLOR_SITIO_BANDEJA",
          label: "Papel de color del sitio en la bandeja correcta para salidas",
        },
      ],
    },
    IMPRESORA_ETIQUETAS: {
      label: "Impresora de etiquetas",
      checklist: [
        { key: "ETIQUETA_REAL", label: "Instalada y probada con una etiqueta real" },
        {
          key: "MEDIDA_100X70",
          label: "Medida de etiqueta 100 × 70 mm configurada",
        },
      ],
    },
    IMPRESORA_TICKETS: {
      label: "Impresora térmica de tickets",
      checklist: [
        { key: "TICKET_REAL", label: "Instalada y probada con un ticket real" },
        { key: "PAPEL_80MM", label: "Papel de 80 mm cargado" },
      ],
    },
    PISTOLA_ESCANER: {
      label: "Pistola Escáner",
      checklist: [
        { key: "TECLADO_ESPANOL", label: "Configurada a teclado español" },
        {
          key: "QR_ROLLO",
          label: "Probada leyendo un QR de rollo del sistema",
        },
      ],
    },
    SMARTPHONE_ESCANER: {
      label: "Smartphone Escáner",
      checklist: [
        {
          key: "SESION_CAMARA",
          label: "Sesión iniciada y permisos de cámara concedidos",
        },
        {
          key: "QR_ROLLO",
          label: "Probado leyendo un QR de rollo del sistema",
        },
      ],
    },
  });

export const CHECKLIST_KEYS_EQUIPO = Object.freeze(
  Array.from(
    new Set(
      TIPOS_EQUIPO.flatMap((tipo) =>
        DEFINICIONES_EQUIPO[tipo].checklist.map((item) => item.key),
      ),
    ),
  ),
);

export function checklistEquipo(tipo: TipoEquipo) {
  return DEFINICIONES_EQUIPO[tipo].checklist;
}

export function esChecklistEquipoValido(tipo: TipoEquipo, key: string): boolean {
  return checklistEquipo(tipo).some((item) => item.key === key);
}