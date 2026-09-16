const fs = require("fs");

const content = fs.readFileSync(".local/prompt-j-preview/src/ReconciledCuentas.tsx", "utf-8");

// The replacement starts from `{/* SECTION: COBRANZA */}`
const startIndex = content.indexOf("{/* SECTION: COBRANZA */}");

// And goes all the way to `{/* Incongruencias Alert */}` or the end of the sections. Let's see what's after "Desglose por Tienda".
const chartIndex = content.indexOf("Flujos Diarios por Cuenta");
const incongruenciasIndex = content.indexOf("{/* Incongruencias Alert */}");

const newContent = content.substring(0, startIndex) + `{/* SECTION: COBRANZA */}
              <section className="space-y-6">
                <h2 className="recon-heading border-b pb-2 mb-4">Cobranza</h2>
                
                {(() => {
                  const row = cuentasSegundaFila.find(r => r.cuentaDestino === "CAJA_FISICA");
                  const rowNF = cuentasSegundaFila.find(r => r.cuentaDestino === "CUENTA_NO_FISCAL");
                  const rowF = cuentasSegundaFila.find(r => r.cuentaDestino === "CUENTA_FISCAL");
                  
                  const totalCents = row ? Math.round(Number(row.importe) * 100) : 0;
                  const facturadoCents = row ? Math.round(Number(row.cajaFisicaFacturado) * 100) : 0;
                  const sinFacturaCents = totalCents - facturadoCents;
                  const cajaFisicaSinFactura = (sinFacturaCents / 100).toFixed(2);
                  
                  const currentHrefEF = detailHref("CAJA_FISICA", []);
                  const currentHrefEF_Fact = detailHref("CAJA_FISICA", ["POS", "ABONO", "ABONO_SALDO_FAVOR"], { facturado: true });
                  const currentHrefEF_Sin = detailHref("CAJA_FISICA", ["POS", "ABONO", "ABONO_SALDO_FAVOR"], { facturado: false });
                  const currentHrefNF = rowNF ? detailHref(rowNF.cuentaDestino, []) : "#";
                  const currentHrefF = rowF ? detailHref(rowF.cuentaDestino, []) : "#";
                  
                  const cobradoStat = topStats.find(s => s.title === "Cobrado");

                  return (
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                      {/* Left: Total cobrado */}
                      <div className="xl:col-span-1">
                        {cobradoStat && (
                          <Card className="h-full border-sidebar/10 shadow-sm flex flex-col">
                            <CardContent className="p-6 flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="recon-icon-box green">
                                  <Banknote className="h-6 w-6" />
                                </div>
                                <span className="recon-top-card-label font-bold text-sm text-sidebar">Total cobrado</span>
                              </div>
                              <Link
                                href={detailHref("TODAS", cobradoStat.fuentes)}
                                className="inline-block text-4xl font-black text-green-700 dark:text-green-400 hover:text-primary hover:underline mb-6"
                              >
                                {formatNumber(cobradoStat.amount, { kind: "money" })}
                              </Link>
                              
                              <div className="space-y-3">
                                {cobradoStat.breakdown.map((part) => (
                                  <Link
                                    key={part.label}
                                    href={detailHref("TODAS", part.fuentes)}
                                    className="flex items-center justify-between text-sm hover:text-primary group border-b border-sidebar/10 pb-2 last:border-0 last:pb-0"
                                  >
                                    <span className="text-muted-foreground group-hover:underline">{part.label}</span>
                                    <span className="font-bold text-sidebar group-hover:underline">
                                      {formatNumber(part.amount, { kind: "money" })}
                                    </span>
                                  </Link>
                                ))}
                              </div>
                              <div className="mt-4 text-xs text-muted-foreground">
                                Neto del periodo, incluidos reversos
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>

                      {/* Right: Destinos */}
                      <div className="xl:col-span-2">
                        <Card className="h-full border-sidebar/10 shadow-sm">
                          <CardHeader className="pb-4">
                            <div className="flex items-center gap-3">
                              <div className="recon-icon-box blue w-8 h-8 rounded">
                                <Banknote className="h-4 w-4" />
                              </div>
                              <CardTitle className="text-lg">Destinos</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="recon-dest-group">
                              {/* 3 cash regions */}
                              <Link href={currentHrefEF} className="hover:bg-muted/30 p-3 rounded-lg border border-transparent hover:border-sidebar/10 transition-colors">
                                <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Efectivo</div>
                                <div className="text-xl font-black text-sidebar mb-1">{row ? formatNumber(row.importe, { kind: "money" }) : "$0.00"}</div>
                                {row && row.porcentaje && <div className="text-xs text-primary bg-primary/10 inline-block px-1.5 rounded font-medium">{formatNumber(row.porcentaje, { kind: "percentage", percentageInput: "percent" })}</div>}
                              </Link>
                              <Link href={currentHrefEF_Sin} className="hover:bg-muted/30 p-3 rounded-lg border border-transparent hover:border-sidebar/10 transition-colors">
                                <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Efectivo sin factura</div>
                                <div className="text-xl font-black text-sidebar">{formatNumber(cajaFisicaSinFactura, { kind: "money" })}</div>
                              </Link>
                              <Link href={currentHrefEF_Fact} className="hover:bg-muted/30 p-3 rounded-lg border border-transparent hover:border-sidebar/10 transition-colors">
                                <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Efectivo facturado</div>
                                <div className="text-xl font-black text-sidebar">{row ? formatNumber(row.cajaFisicaFacturado, { kind: "money" }) : "$0.00"}</div>
                              </Link>
                              
                              {/* 2 bank regions */}
                              <Link href={currentHrefNF} className="hover:bg-muted/30 p-3 rounded-lg border border-transparent hover:border-sidebar/10 transition-colors">
                                <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Cuentas no fiscales</div>
                                <div className="text-xl font-black text-sidebar mb-1">{rowNF ? formatNumber(rowNF.importe, { kind: "money" }) : "$0.00"}</div>
                                {rowNF && rowNF.porcentaje && <div className="text-xs text-primary bg-primary/10 inline-block px-1.5 rounded font-medium">{formatNumber(rowNF.porcentaje, { kind: "percentage", percentageInput: "percent" })}</div>}
                              </Link>
                              <Link href={currentHrefF} className="hover:bg-muted/30 p-3 rounded-lg border border-transparent hover:border-sidebar/10 transition-colors">
                                <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Cuentas fiscales</div>
                                <div className="text-xl font-black text-sidebar mb-1">{rowF ? formatNumber(rowF.importe, { kind: "money" }) : "$0.00"}</div>
                                {rowF && rowF.porcentaje && <div className="text-xs text-primary bg-primary/10 inline-block px-1.5 rounded font-medium">{formatNumber(rowF.porcentaje, { kind: "percentage", percentageInput: "percent" })}</div>}
                              </Link>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  );
                })()}
              </section>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Abonos y saldos a favor */}
                <Card className="h-full border-sidebar/10 shadow-sm flex flex-col">
                  <CardHeader>
                    <CardTitle>Abonos y saldos a favor</CardTitle>
                    <CardDescription>Neto del periodo, incluidos reversos</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 flex flex-col">
                    {data.cobrosAnteriores.length > 0 ? (
                      <div className="flex-1 overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/20">
                              <TableHead>Cuenta destino</TableHead>
                              <TableHead>Origen</TableHead>
                              <TableHead className="text-right">Importe</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.cobrosAnteriores.map((cobro) => {
                              const currentHref = detailHref(cobro.cuentaDestino, [cobro.fuente]);
                              return (
                                <TableRow key={`${cobro.cuentaDestino}-${cobro.fuente}`}>
                                  <TableCell className="font-bold">{formatAccountDestination(cobro.cuentaDestino)}</TableCell>
                                  <TableCell className="text-muted-foreground">{cobro.fuente === "ABONO" ? "Abonos" : "Saldos a favor"}</TableCell>
                                  <TableCell className="text-right font-mono font-bold">
                                    <Link href={currentHref} className="text-sidebar hover:text-primary hover:underline">
                                      {formatNumber(cobro.importe, { kind: "money" })}
                                    </Link>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="p-6 text-center text-muted-foreground">Sin abonos en el periodo</div>
                    )}
                    <div className="p-4 border-t bg-muted/10 grid grid-cols-2 gap-4 mt-auto">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-semibold">Base facturada</p>
                        <p className="text-lg font-bold text-sidebar mt-1">{formatNumber(data.ivaFacturado.base, { kind: "money" })}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase font-semibold">IVA facturado</p>
                        <p className="text-lg font-bold text-sidebar mt-1">{formatNumber(data.ivaFacturado.iva, { kind: "money" })}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Desglose por Tienda */}
                <Card className="h-full border-sidebar/10 shadow-sm flex flex-col">
                  <CardHeader>
                    <CardTitle>Desglose por tienda</CardTitle>
                    <CardDescription>Venta y cobro acumulado por ubicación</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead>Tienda</TableHead>
                          <TableHead className="text-right">Cobrado</TableHead>
                          <TableHead className="text-right">Por cobrar</TableHead>
                          <TableHead className="text-right font-bold">Vendido</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.porTienda.map((t) => (
                          <TableRow key={t.ubicacionId}>
                            <TableCell className="font-bold flex items-center gap-2">
                              <Store className="w-4 h-4 text-muted-foreground" />
                              {t.nombreUbicacion}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {formatNumber(t.cobrado, { kind: "money" })}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {formatNumber(t.porCobrar, { kind: "money" })}
                            </TableCell>
                            <TableCell className="text-right font-mono font-black text-sidebar">
                              {formatNumber(t.vendido, { kind: "money" })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

` + content.substring(incongruenciasIndex);

fs.writeFileSync(".local/prompt-j-preview/src/ReconciledCuentas.tsx", newContent);
