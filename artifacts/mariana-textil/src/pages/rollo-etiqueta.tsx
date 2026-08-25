import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Loader2 } from "lucide-react";

export default function RolloEtiqueta() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  useEffect(() => setLocation(`/etiquetas?rolloId=${encodeURIComponent(id ?? "")}`), [id, setLocation]);
  return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
}
