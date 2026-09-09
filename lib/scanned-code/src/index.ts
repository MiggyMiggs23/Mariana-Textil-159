export type CodigoEscaneadoInterpretado = {
  serie: string | null;
  sku: string | null;
  textoOriginal: string;
};

const SERIE_AL_FINAL = /(?:^|\D)(\d{7})$/;

/**
 * Interpreta etiquetas SKU-SERIE sin alterar búsquedas de texto libre.
 * La serie válida son exactamente siete dígitos consecutivos al final.
 */
export function interpretarCodigoEscaneado(
  textoOriginal: string,
): CodigoEscaneadoInterpretado {
  const normalizado = textoOriginal.trim().toUpperCase();
  const coincidencia = normalizado.match(SERIE_AL_FINAL);
  if (!coincidencia) {
    return { serie: null, sku: null, textoOriginal };
  }

  const serie = coincidencia[1]!;
  let prefijo = normalizado.slice(0, -serie.length);
  if (prefijo.endsWith("-")) prefijo = prefijo.slice(0, -1);
  const sku = prefijo.trim() || null;

  return { serie, sku, textoOriginal };
}

/**
 * Devuelve el identificador canónico que deben consumir los flujos de rollos.
 * Acepta el resultado ya interpretado para evitar volver a analizar un escaneo.
 */
export function normalizarSerieEscaneada(
  entrada: string | CodigoEscaneadoInterpretado,
): string {
  const codigo =
    typeof entrada === "string"
      ? interpretarCodigoEscaneado(entrada)
      : entrada;
  return (codigo.serie ?? codigo.textoOriginal).trim().toUpperCase();
}

export function advertenciaSkuEscaneado(
  codigo: CodigoEscaneadoInterpretado,
  skuRollo: string | null | undefined,
): string | null {
  if (!codigo.serie || !codigo.sku || !skuRollo) return null;
  const skuActual = skuRollo.trim().toUpperCase();
  if (codigo.sku === skuActual) return null;
  return `Esta etiqueta dice ${codigo.sku}, pero el rollo ${codigo.serie} corresponde a ${skuActual}. Verifica la etiqueta.`;
}