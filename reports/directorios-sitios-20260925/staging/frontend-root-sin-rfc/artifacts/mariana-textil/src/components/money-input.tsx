import * as React from "react";
import { Input, type InputProps } from "@/components/ui/input";

export interface MoneyInputProps
  extends Omit<InputProps, "type" | "inputMode" | "value" | "onChange" | "min" | "max" | "step"> {
  value: string;
  onValueChange: (value: string) => void;
}

export function normalizeMoneyInput(nextDisplay: string, previousValue = ""): string {
  if (nextDisplay.includes("-")) return previousValue;

  const withoutPresentation = nextDisplay.replace(/[$,\s]/g, "");
  if (!/^\d*(?:\.\d*)?$/.test(withoutPresentation)) return previousValue;

  const [integer = "", fraction] = withoutPresentation.split(".");
  if (fraction !== undefined && fraction.length > 2) return previousValue;

  const normalizedInteger = integer.replace(/^0+(?=\d)/, "");
  if (fraction !== undefined) return `${normalizedInteger || "0"}.${fraction}`;
  return normalizedInteger;
}

export function formatMoneyInput(value: string): string {
  if (!value) return "";

  const [integer = "0", fraction] = value.split(".");
  const groupedInteger = (integer || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction === undefined ? groupedInteger : `${groupedInteger}.${fraction}`;
}

function logicalCharacterCount(value: string): number {
  return [...value].filter((character) => /\d|\./.test(character)).length;
}

export function moneyCaretPosition(nextDisplay: string, selectionStart: number, formattedValue: string): number {
  const insertedLeadingZero =
    /^\s*\./.test(nextDisplay) && formattedValue.startsWith("0.") ? 1 : 0;
  const logicalTarget =
    logicalCharacterCount(nextDisplay.slice(0, selectionStart)) + insertedLeadingZero;
  if (logicalTarget === 0) return 0;

  let logicalSeen = 0;
  for (let index = 0; index < formattedValue.length; index += 1) {
    if (/\d|\./.test(formattedValue[index])) logicalSeen += 1;
    if (logicalSeen === logicalTarget) return index + 1;
  }
  return formattedValue.length;
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onValueChange, ...props }, forwardedRef) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);

    const formattedValue = formatMoneyInput(value);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextDisplay = event.currentTarget.value;
      const selectionStart = event.currentTarget.selectionStart ?? nextDisplay.length;
      const nextValue = normalizeMoneyInput(nextDisplay, value);
      const nextFormattedValue = formatMoneyInput(nextValue);
      const nextCaret =
        nextValue === value && nextDisplay !== formattedValue
          ? Math.max(0, Math.min(selectionStart - 1, nextFormattedValue.length))
          : moneyCaretPosition(nextDisplay, selectionStart, nextFormattedValue);

      onValueChange(nextValue);
      requestAnimationFrame(() => {
        inputRef.current?.setSelectionRange(nextCaret, nextCaret);
      });
    };

    return (
      <Input
        {...props}
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={formattedValue}
        onChange={handleChange}
      />
    );
  },
);

MoneyInput.displayName = "MoneyInput";