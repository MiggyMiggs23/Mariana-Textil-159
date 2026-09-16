import os
import re

with open("artifacts/mariana-textil/src/pages/caja/cuentas-destino.tsx", "r", encoding="utf-8") as f:
    content = f.read()

pattern = r'const getPrevHref =.*?}\)\(\)}'
match = re.search(pattern, content, re.DOTALL)

if not match:
    print("Could not find the target block")
    exit(1)

new_block = """const previousHrefEF =
                      data.encabezado.previousDesde &&
                      data.encabezado.previousHasta
                        ? detailHref("CAJA_FISICA", [], {
                            desde: format(
                              parseISO(data.encabezado.previousDesde),
                              "yyyy-MM-dd",
                            ),
                            hasta: format(
                              parseISO(data.encabezado.previousHasta),
                              "yyyy-MM-dd",
                            ),
                            compare: null,
                            preset: "custom",
                          })
                        : currentHrefEF;
                    const previousHrefNF = rowNF
                      ? data.encabezado.previousDesde &&
                        data.encabezado.previousHasta
                        ? detailHref(rowNF.cuentaDestino, [], {
                            desde: format(
                              parseISO(data.encabezado.previousDesde),
                              "yyyy-MM-dd",
                            ),
                            hasta: format(
                              parseISO(data.encabezado.previousHasta),
                              "yyyy-MM-dd",
                            ),
                            compare: null,
                            preset: "custom",
                          })
                        : currentHrefNF
                      : null;
                    const previousHrefF = rowF
                      ? data.encabezado.previousDesde &&
                        data.encabezado.previousHasta
                        ? detailHref(rowF.cuentaDestino, [], {
                            desde: format(
                              parseISO(data.encabezado.previousDesde),
                              "yyyy-MM-dd",
                            ),
                            hasta: format(
                              parseISO(data.encabezado.previousHasta),
                              "yyyy-MM-dd",
                            ),
                            compare: null,
                            preset: "custom",
                          })
                        : currentHrefF
                      : null;

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
                        className={`border-sidebar/10 shadow-sm recon-top-card relative overflow-hidden transition-colors hover:border-primary/60 hover:bg-sidebar/5 h-full ${dashed ? 'border-dashed' : ''}`}
                      >
                        <div className={`recon-icon-box ${colorClass}`}>
                          {icon}
                        </div>
                        <div className="recon-top-card-content flex-1 w-full min-w-0">
                          <span className="recon-top-card-label line-clamp-1">{title}</span>
                          <Link
                            href={currentHref}
                            className={`recon-top-card-value hover:text-primary hover:underline block mb-1`}
                            data-testid={`text-monto-${title.toLowerCase().replace(/\\s+/g, "-")}`}
                          >
                            {formatNumber(importe, { kind: "money" })}
                          </Link>
                          {subtitle && (
                            <span className="recon-top-card-sub mb-2">{subtitle}</span>
                          )}
                          
                          <div className="mt-auto flex flex-col gap-1.5 pt-2 border-t w-full border-sidebar/10">
                            <div className="h-5 flex items-center">
                              {porcentaje !== null ? (
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
                      <div className="grid grid-cols-1 md:grid-cols-3 auto-rows-[1fr] gap-4 md:gap-6">
                        {row && sinFactura !== null ? renderDestinationCard(
                          "Total en efectivo",
                          <Banknote className="h-6 w-6" />,
                          "blue",
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
                          pctFacturado.toString(),
                          null,
                          currentHrefEF_Fact,
                          null,
                          false
                        ) : <div />}
                        {row && sinFactura !== null ? renderDestinationCard(
                          "Efectivo sin factura",
                          <Wallet className="h-6 w-6" />,
                          "blue",
                          sinFactura,
                          null,
                          pctSinFactura.toString(),
                          null,
                          currentHrefEF_Sin,
                          null,
                          false
                        ) : <div />}
                        {rowNF ? renderDestinationCard(
                          formatAccountDestination(rowNF.cuentaDestino),
                          <Building2 className="h-6 w-6" />,
                          "blue",
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
                  })()}"""

# We also need to fix the grid layout string in the content
content = content[:match.start()] + new_block + content[match.end():]

# Remove the surrounding <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
# Wait, let's just make sure the `return (` block inside our IIFE is wrapped in `<div className="grid grid-cols-1 md:grid-cols-3 auto-rows-[1fr] gap-4 md:gap-6">`
# and we replace the surrounding `<div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">` with `<div className="w-full">` or similar if it's there.
# Let's check how the block was structured.
# The `new_block` above returns the `<div className="grid...">`.

# Wait, `getPrevHref` is inside a block that starts with `<div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">`?
# No, let's see line 592:
#                <div className="flex flex-col gap-4 md:gap-6 mb-6">
#                  {(() => {
#                      ...
#                      return (<>...</>)

with open("artifacts/mariana-textil/src/pages/caja/cuentas-destino.tsx.patch", "w", encoding="utf-8") as f:
    f.write(content)

print("Created patch file")
