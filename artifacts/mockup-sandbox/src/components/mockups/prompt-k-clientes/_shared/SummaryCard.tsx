import { Card, CardContent } from "@/components/ui/card";

type SummaryCardProps = {
  label: string;
  value?: string;
};

/*
 * Shared, local copy of the Proveedores summary-card markup. Values are
 * intentionally placeholders in this visual reference; this component has no
 * API, financial store, auth context, or server dependency.
 */
export function SummaryCard({ label, value = "—" }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="p-4 flex flex-col gap-1">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="text-2xl font-bold">{value}</span>
      </CardContent>
    </Card>
  );
}