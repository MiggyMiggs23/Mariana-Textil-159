import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, type InputProps } from "@/components/ui/input";

export interface PasswordInputProps extends Omit<InputProps, "type"> {
  visibilityResetKey?: string | number | boolean;
  toggleTestId?: string;
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      className,
      disabled,
      id,
      visibilityResetKey,
      toggleTestId,
      ...props
    },
    forwardedRef,
  ) => {
    const [isVisible, setIsVisible] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const selectionRef = React.useRef<{
      start: number | null;
      end: number | null;
      direction: "forward" | "backward" | "none" | null;
    } | null>(null);
    const shouldRestoreSelectionRef = React.useRef(false);
    const selectionCapturedForToggleRef = React.useRef(false);

    React.useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);

    React.useLayoutEffect(() => {
      setIsVisible(false);
    }, [visibilityResetKey]);

    React.useLayoutEffect(() => {
      if (!shouldRestoreSelectionRef.current) return;
      shouldRestoreSelectionRef.current = false;
      selectionCapturedForToggleRef.current = false;

      const restoreSelection = () => {
        const input = inputRef.current;
        const selection = selectionRef.current;
        if (!input) return;

        input.focus({ preventScroll: true });
        if (selection && selection.start !== null && selection.end !== null) {
          input.setSelectionRange(selection.start, selection.end, selection.direction ?? "none");
        }
      };

      restoreSelection();
      const frameId = window.requestAnimationFrame(restoreSelection);
      const timeoutId = window.setTimeout(restoreSelection, 0);
      return () => {
        window.cancelAnimationFrame(frameId);
        window.clearTimeout(timeoutId);
      };
    }, [isVisible]);

    const rememberSelection = () => {
      const input = inputRef.current;
      if (!input) return;
      selectionRef.current = {
        start: input.selectionStart,
        end: input.selectionEnd,
        direction: input.selectionDirection,
      };
    };

    const toggleVisibility = () => {
      if (!selectionCapturedForToggleRef.current) {
        rememberSelection();
      }
      shouldRestoreSelectionRef.current = true;
      setIsVisible((current) => !current);
    };

    const actionLabel = isVisible ? "Ocultar contraseña" : "Mostrar contraseña";
    const VisibilityIcon = isVisible ? EyeOff : Eye;

    return (
      <div className="relative">
        <Input
          {...props}
          id={inputId}
          ref={inputRef}
          type={isVisible ? "text" : "password"}
          disabled={disabled}
          className={cn("pr-12", className)}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex min-h-11 min-w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-50"
          onPointerDown={(event) => {
            rememberSelection();
            selectionCapturedForToggleRef.current = true;
            event.preventDefault();
          }}
          onClick={toggleVisibility}
          disabled={disabled}
          aria-label={actionLabel}
          aria-controls={inputId}
          aria-pressed={isVisible}
          title={actionLabel}
          data-testid={toggleTestId}
        >
          <VisibilityIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    );
  },
);

PasswordInput.displayName = "PasswordInput";

export { PasswordInput };