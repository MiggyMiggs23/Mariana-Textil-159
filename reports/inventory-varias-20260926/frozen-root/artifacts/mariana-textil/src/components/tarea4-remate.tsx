import { useState } from "react";
import { REMATE_UI_RELEASED } from "@/lib/tarea4-gates";

type Props = {
  rolloId: number;
  marked: boolean;
  canMark: boolean;
  canRemove?: boolean;
  onRemove?: (rolloId: number, motivo: string) => Promise<void>;
  // Release must supply a generated OpenAPI mutation, never ad-hoc fetch.
  onMark: (rolloId: number, motivo: string) => Promise<void>;
};

/** Explicit roll-level action; status is refreshed by the generated API caller. */
export function RemateControl(props: Props) {
  const [motivo, setMotivo] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (!REMATE_UI_RELEASED) return null;
  if (props.marked && !props.canRemove) return <p role="status">Rollo marcado como remate</p>;
  if (!props.marked && !props.canMark) return null;
  return <form onSubmit={async event => {
    event.preventDefault();
    if (pending || !motivo.trim()) return;
    setPending(true);
    setError("");
    try {
      if (props.marked) await props.onRemove!(props.rolloId, motivo.trim());
      else await props.onMark(props.rolloId, motivo.trim());
      setMotivo("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo marcar el rollo.");
    } finally {
      setPending(false);
    }
  }}>
    <label>Motivo obligatorio para rollo {props.rolloId}
      <textarea required value={motivo} disabled={pending}
        onChange={event => setMotivo(event.target.value)} />
    </label>
    {error && <p role="alert">{error}</p>}
    <button type="submit" disabled={pending || !motivo.trim()}>
      {pending ? "Guardando…" : props.marked ? "Retirar remate" : "Marcar remate"}
    </button>
  </form>;
}