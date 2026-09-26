import { useRef, useState } from "react";
import { useGetCurrentUser, useListLocations, getListLocationsQueryKey, type CreditEvidenceInput, type CreditNature } from "@workspace/api-client-react";
import { useLocationScope } from "@/lib/location-scope";
import { createCreditOperationDraft, creditEvidenceProblem, creditNatureLabels } from "@/lib/credit-evidence";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function useCreditEvidenceDraft(fixedNature?: CreditNature) {
  const { selectedLocationId } = useLocationScope();
  const [site, setSite] = useState("");
  const [nature, setNature] = useState<CreditNature | "">(fixedNature ?? "");
  const [note, setNote] = useState("");
  const [justification, setJustification] = useState("");
  const operation = useRef(createCreditOperationDraft());
  const metadata = {
    sitioOrigenId: Number(site || selectedLocationId || 0),
    naturaleza: nature || undefined,
    sesionCajaId: null,
    notaOrigenId: note ? Number(note) : null,
    origenJustificacion: justification.trim() || null,
  };
  return {
    site: site || (selectedLocationId ? String(selectedLocationId) : ""), setSite,
    nature, setNature, note, setNote, justification, setJustification,
    problem: (medium?: string) => creditEvidenceProblem(metadata, medium),
    build(producer: string, intent: unknown, medium?: string): CreditEvidenceInput {
      const problem = creditEvidenceProblem(metadata, medium);
      if (problem) throw new Error(problem);
      return { ...metadata, naturaleza: nature as CreditNature, operacionClave: operation.current.keyFor(producer, [metadata, intent]) };
    },
    accepted() { operation.current.accepted(); },
    reset() { operation.current.accepted(); setSite(""); setNature(fixedNature ?? ""); setNote(""); setJustification(""); },
  };
}

export function CreditEvidenceFields({ draft, kind, medium }: {
  draft: ReturnType<typeof useCreditEvidenceDraft>;
  kind: "payment" | "reversal" | "correction" | "credit";
  medium?: string;
}) {
  const { data: user } = useGetCurrentUser();
  const { data: locations, error: locationsError } = useListLocations(undefined, { query: { queryKey: getListLocationsQueryKey(), enabled: user?.rol === "ADMIN" } });
  const sites = user?.rol === "ADMIN"
    ? (locations ?? []).filter(site => site.activa && site.tipo === "TIENDA")
    : user?.ubicacion ? [user.ubicacion] : [];
  const choices: CreditNature[] = kind === "payment" ? ["INGRESO_FISICO", "CORRECCION_CONTABLE"] : ["DEVOLUCION_FISICA", "CORRECCION_CONTABLE"];
  const problem = draft.problem(medium);
  return <div className="space-y-3 rounded-md border p-3">
    <Label>Sitio operativo de origen</Label>
    <Select value={draft.site} onValueChange={draft.setSite}>
      <SelectTrigger aria-label="Sitio operativo de origen"><SelectValue placeholder="Selecciona el sitio real" /></SelectTrigger>
      <SelectContent>{sites.map(site => <SelectItem key={site.id} value={String(site.id)}>{site.nombre}</SelectItem>)}</SelectContent>
    </Select>
    {locationsError && <p role="alert" className="text-xs text-destructive">No se pudieron cargar los sitios; vuelve a consultar antes de registrar.</p>}
    {(kind === "payment" || kind === "reversal") ? <>
      <Label>Naturaleza del movimiento</Label>
      <Select value={draft.nature} onValueChange={value => draft.setNature(value as CreditNature)}>
        <SelectTrigger aria-label="Naturaleza del movimiento"><SelectValue placeholder="Declara lo ocurrido" /></SelectTrigger>
        <SelectContent>{choices.map(value => <SelectItem key={value} value={value}>{creditNatureLabels[value]}</SelectItem>)}</SelectContent>
      </Select>
    </> : <p className="text-sm">{draft.nature && creditNatureLabels[draft.nature]}</p>}
    {draft.nature === "CORRECCION_CONTABLE" && <>
      <Label>Nota de origen identificada (ID, opcional)</Label>
      <Input type="number" min="1" value={draft.note} onChange={event => draft.setNote(event.target.value)} aria-label="Nota de origen identificada" />
      <Label>Justificación del sitio y evidencia de la corrección</Label>
      <Textarea value={draft.justification} onChange={event => draft.setJustification(event.target.value)} placeholder="Explica el origen; si no identificas la nota, justifica el sitio elegido." />
    </>}
    {problem && <p className="text-xs text-amber-800" role="status">{problem}</p>}
  </div>;
}