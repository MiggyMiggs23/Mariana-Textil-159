import os
import re

with open("artifacts/mariana-textil/src/pages/caja/cuentas-destino.tsx", "r", encoding="utf-8") as f:
    content = f.read()

top_part, rest = content.split('<div className="space-y-12">', 1)

ventas_cards_match = re.search(r'(<section className="space-y-6">\s*<h2 className="recon-heading border-b pb-2 mb-4">Ventas</h2>\s*<div className="grid w-full min-w-0 grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">.*?</div>)', rest, re.DOTALL)
ventas_cards_block = ventas_cards_match.group(1) + '\n              </section>'

ventas_cards_block = ventas_cards_block.replace('xl:grid-cols-4', 'xl:grid-cols-3')

por_cobrar_card_regex = r'(<Card className="border-sidebar/10 shadow-sm recon-top-card border-dashed">.*?<div className="recon-icon-box amber">.*?<Clock className="h-6 w-6" />.*?</div>.*?<div className="recon-top-card-content">.*?<span className="recon-top-card-label">Por cobrar</span>.*?Notas de crédito al día.*?</span>.*?</div>\s*</Card>)'
ventas_cards_block = re.sub(por_cobrar_card_regex, '', ventas_cards_block, flags=re.DOTALL)

matriz_match = re.search(r'(<div>\s*<Card className="h-full">\s*<CardHeader>\s*<CardTitle className="text-lg flex items-center gap-2">\s*Matriz de Operaciones \(Ventas\).*?</div>\s*</section>)', rest, re.DOTALL)
matriz_block = '<section className="space-y-6">\n                ' + matriz_match.group(1)

cobrado_card_match = re.search(r'({topStats\.filter\(\(stat\) => stat\.title === "Cobrado"\)\.map\(\(stat\) => {.*?</Card>\s*\);\s*}\)})', rest, re.DOTALL)
cobrado_card_block = cobrado_card_match.group(1)

abonos_table_match = re.search(r'(<div className="xl:col-span-2 flex flex-col gap-6 h-full">\s*<Card className="flex-1 flex flex-col">.*?</Card>\s*</div>)', rest, re.DOTALL)
abonos_table_block = abonos_table_match.group(1).replace('xl:col-span-2', '')

rest_after_abonos = rest.split('</Card>\n                  </div>\n                </div>')[1]

new_cobranza_cards = """
                <div className="flex flex-col gap-4 md:gap-6">
                  {(() => {
                    const row = cuentasSegundaFila.find(
                      (item) => item.cuentaDestino === "CAJA_FISICA",
                    );
                    const rowNF = cuentasSegundaFila.find(
                      (item) => item.cuentaDestino === "CUENTA_NO_FISCAL",
                    );
                    const rowF = cuentasSegundaFila.find(
                      (item) => item.cuentaDestino === "CUENTA_FISCAL",
                    );

                    const sinFactura = row
                      ? formatCentsAsMoney(
                          calculateCashSinFacturaCents(
                            row.importe,
                            row.cajaFisicaFacturado,
                          ),
                        )
                      : null;
                    
                    if (row && sinFactura !== null) {
                      assertCashDifferenceInCents({
                        cobrado: row.importe,
                        facturado: row.cajaFisicaFacturado,
                        sinFactura,
                      });
                    }
                    
                    const cobradoTotalStr = header?.cobrado.total || "0";
                    const cobradoTotalNum = Number(cobradoTotalStr);
                    const pctFacturado = cobradoTotalNum > 0 && row ? (Number(row.cajaFisicaFacturado) / cobradoTotalNum) * 100 : 0;
                    const sinFacturaCents = row ? calculateCashSinFacturaCents(row.importe, row.cajaFisicaFacturado) : 0;
                    const pctSinFactura = cobradoTotalNum > 0 ? ((sinFacturaCents / 100) / cobradoTotalNum) * 100 : 0;

                    const currentHrefEF = detailHref("CAJA_FISICA", []);
                    const currentHrefEF_Fact = detailHref(
                      "CAJA_FISICA",
                      ["POS", "ABONO", "ABONO_SALDO_FAVOR"],
                      { facturado: true },
                    );
                    const currentHrefEF_Sin = detailHref(
                      "CAJA_FISICA",
                      ["POS", "ABONO", "ABONO_SALDO_FAVOR"],
                      { facturado: false },
                    );
                    const currentHrefNF = rowNF
                      ? detailHref(rowNF.cuentaDestino, [])
                      : "#";
                    const currentHrefF = rowF
                      ? detailHref(rowF.cuentaDestino, [])
                      : "#";
                      
                    const getPrevHref = (dest: string) => {
                      if (!data.encabezado.previousDesde || !data.encabezado.previousHasta) return detailHref(dest, []);
                      return detailHref(dest, [], {
                        desde: format(parseISO(data.encabezado.previousDesde), "yyyy-MM-dd"),
                        hasta: format(parseISO(data.encabezado.previousHasta), "yyyy-MM-dd"),
                        compare: null,
                        preset: "custom",
                      });
                    };
                    
                    const previousHrefEF = getPrevHref("CAJA_FISICA");
                    const previousHrefNF = rowNF ? getPrevHref(rowNF.cuentaDestino) : null;
                    const previousHrefF = rowF ? getPrevHref(rowF.cuentaDestino) : null;

                    const renderDestinationCard = (
                      title: string,
                      icon: React.ReactNode,
                      colorClass: string,
                      importe: string,
                      importeAnterior: string | null,
                      porcentaje: string | null,
                      variation: string | null,
                      currentHref: string,
                      previousHref: string | null,
                      showVariation: boolean,
                      subtitle?: string,
                      dashed?: boolean
                    ) => (
                      <Card
                        data-destination={title}
                        className={`border-sidebar/10 shadow-sm recon-top-card relative overflow-hidden transition-colors hover:border-primary/60 hover:bg-sidebar/5 h-full ${dashed ? 'border-dashed bg-amber-50/30 dark:bg-amber-950/10 border-amber-500/50' : ''}`}
                      >
                        <div className={`recon-icon-box ${colorClass}`}>
                          {icon}
                        </div>
                        <div className="recon-top-card-content flex-1 w-full min-w-0">
                          <span className="recon-top-card-label line-clamp-1">{title}</span>
                          <Link
                            href={currentHref}
                            className={`recon-top-card-value hover:text-primary hover:underline block mb-1 ${dashed ? 'text-amber-700 dark:text-amber-500' : ''}`}
                            data-testid={`text-monto-${title.toLowerCase().replace(/\\s+/g, "-")}`}
                          >
                            {formatNumber(importe, { kind: "money" })}
                          </Link>
                          {subtitle && (
                            <span className="recon-top-card-sub mb-2">{subtitle}</span>
                          )}
                          
                          <div className="mt-auto flex flex-col gap-1.5 pt-2 border-t w-full border-sidebar/10">
                            <div className="h-5 flex items-center">
                              {porcentaje ? (
                                <span className="text-[11px] font-bold text-muted-foreground bg-sidebar/5 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  {formatNumber(porcentaje, { kind: "percentage", percentageInput: "percent" })} DEL TOTAL
                                </span>
                              ) : (
                                <span className="h-5 block" />
                              )}
                            </div>
                            {compare && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground truncate mr-2">Ant.</span>
                                {previousHref && importeAnterior !== null ? (
                                  <Link
                                    href={previousHref}
                                    className="font-medium hover:text-primary hover:underline whitespace-nowrap"
                                  >
                                    {formatNumber(importeAnterior, { kind: "money" })}
                                  </Link>
                                ) : (
                                  <span className="block" />
                                )}
                              </div>
                            )}
                            {compare && (
                              <div className="h-5 flex items-center justify-end">
                                {showVariation ? (
                                  <Link href={currentHref} className="flex justify-end hover:opacity-80">
                                    {renderVariation(variation)}
                                  </Link>
                                ) : (
                                  <span className="h-5 block" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    );

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                        {row && sinFactura !== null ? renderDestinationCard(
                          "Total en efectivo",
                          <Banknote className="h-6 w-6" />,
                          "green",
                          row.importe,
                          row.importeAnterior,
                          row.porcentaje,
                          row.variacionPorcentaje,
                          currentHrefEF,
                          previousHrefEF,
                          true
                        ) : <div />}
                        {row && sinFactura !== null ? renderDestinationCard(
                          "Efectivo facturado",
                          <FileText className="h-6 w-6" />,
                          "blue",
                          row.cajaFisicaFacturado,
                          null,
                          pctFacturado > 0 ? pctFacturado.toString() : null,
                          null,
                          currentHrefEF_Fact,
                          null,
                          false
                        ) : <div />}
                        {row && sinFactura !== null ? renderDestinationCard(
                          "Efectivo sin factura",
                          <Wallet className="h-6 w-6" />,
                          "amber",
                          sinFactura,
                          null,
                          pctSinFactura > 0 ? pctSinFactura.toString() : null,
                          null,
                          currentHrefEF_Sin,
                          null,
                          false
                        ) : <div />}
                        {rowNF ? renderDestinationCard(
                          formatAccountDestination(rowNF.cuentaDestino),
                          <Store className="h-6 w-6" />,
                          "amber",
                          rowNF.importe,
                          rowNF.importeAnterior,
                          rowNF.porcentaje,
                          rowNF.variacionPorcentaje,
                          currentHrefNF,
                          previousHrefNF,
                          true
                        ) : <div />}
                        {rowF ? renderDestinationCard(
                          formatAccountDestination(rowF.cuentaDestino),
                          <CreditCard className="h-6 w-6" />,
                          "blue",
                          rowF.importe,
                          rowF.importeAnterior,
                          rowF.porcentaje,
                          rowF.variacionPorcentaje,
                          currentHrefF,
                          previousHrefF,
                          true
                        ) : <div />}
                        {header ? renderDestinationCard(
                          "Por cobrar",
                          <Clock className="h-6 w-6" />,
                          "amber",
                          header.porCobrar.periodo,
                          header.porCobrar.periodoAnterior,
                          null,
                          header.porCobrar.variacionPorcentaje,
                          detailHref("TODAS", ["CREDITO"]),
                          header.previousDesde && header.previousHasta ? detailHref("TODAS", ["CREDITO"], { desde: format(parseISO(header.previousDesde), "yyyy-MM-dd"), hasta: format(parseISO(header.previousHasta), "yyyy-MM-dd"), compare: null, preset: "custom" }) : detailHref("TODAS", ["CREDITO"]),
                          true,
                          "Notas de crédito al día",
                          true
                        ) : <div />}
                      </div>
                    );
                  })()}
                </div>
"""

new_cobranza_section = f"""
              {{/* SECTION: COBRANZA (FIRST) */}}
              <section className="space-y-6">
                <h2 className="recon-heading border-b pb-2 mb-4 text-2xl font-bold">Cobranza</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
                  {cobrado_card_block}
                </div>
                
                {new_cobranza_cards}
              </section>
"""

new_abonos_section = f"""
              <div data-preview="collection-detail-row" className="grid grid-cols-1 gap-6">
                {abonos_table_block}
              </div>
"""

new_content = top_part + '<div className="space-y-12">\n' + \
              new_cobranza_section + '\n' + \
              matriz_block + '\n' + \
              ventas_cards_block + '\n' + \
              new_abonos_section + \
              rest_after_abonos

with open("artifacts/mariana-textil/src/pages/caja/cuentas-destino.tsx.new", "w", encoding="utf-8") as f:
    f.write(new_content)

print("Created artifacts/mariana-textil/src/pages/caja/cuentas-destino.tsx.new")
