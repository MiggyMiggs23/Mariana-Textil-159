import { useState } from "react";
import { Link, useParams } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { ReprintLabelsDialog } from "@/components/reprint-labels-dialog";
import { Button } from "@/components/ui/button";

export default function RolloEtiqueta() {
  const { id } = useParams();
  const rolloId = Number(id);
  const [dialogOpen, setDialogOpen] = useState(true);

  return (
    <AppLayout>
      {!dialogOpen && (
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 p-12 text-center">
          <p className="text-muted-foreground">
            La operación de reimpresión está cerrada.
          </p>
          <Button asChild data-testid="button-back-to-rollo">
            <Link href={`/inventario/rollos/${encodeURIComponent(id ?? "")}`}>
              Volver al rollo
            </Link>
          </Button>
        </div>
      )}
      <ReprintLabelsDialog
        rolloIds={Number.isInteger(rolloId) && rolloId > 0 ? [rolloId] : []}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </AppLayout>
  );
}
