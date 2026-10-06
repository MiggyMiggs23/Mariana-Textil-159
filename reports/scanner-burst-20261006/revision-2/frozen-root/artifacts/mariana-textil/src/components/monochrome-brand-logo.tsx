import monochromeLogo from "@/assets/mariana-textil-logo-monochrome.png";
import { cn } from "@/lib/utils";

export function MonochromeBrandLogo({ className }: { className?: string }) {
  return (
    <img
      src={monochromeLogo}
      alt="Mariana Textil S.A. de C.V."
      className={cn("block object-contain", className)}
      draggable={false}
      data-logo-source="original-monochrome"
      data-testid="monochrome-brand-logo"
    />
  );
}