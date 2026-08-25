import fullLogo from "@/assets/mariana-textil-logo.png";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  variant?: "full" | "mark";
  className?: string;
};

export function BrandLogo({
  variant = "full",
  className,
}: BrandLogoProps) {
  return (
    <img
      src={fullLogo}
      alt="Mariana Textil S.A. de C.V."
      className={cn("block object-contain", className)}
      draggable={false}
      data-logo-variant={variant}
    />
  );
}