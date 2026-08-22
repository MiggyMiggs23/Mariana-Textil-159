import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import type { Producto } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";

type ProductComboboxProps = {
  products: Producto[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  testId?: string;
  activeOnly?: boolean;
};

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX");
}

function productLabel(product: Producto): string {
  return `${product.tela} ${product.color}`;
}

export function ProductCombobox({
  products,
  value,
  onValueChange,
  placeholder = "Escribe tela, color o SKU...",
  testId = "input-product-search",
  activeOnly = true,
}: ProductComboboxProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const previousValueRef = useRef(value);
  const selected = products.find((product) => String(product.id) === value);
  const [query, setQuery] = useState(selected ? productLabel(selected) : "");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => {
    if (previousValueRef.current === value) return;
    previousValueRef.current = value;
    if (!value) {
      if (!open) setQuery("");
      return;
    }
    const nextSelected = products.find((product) => String(product.id) === value);
    if (nextSelected) setQuery(productLabel(nextSelected));
  }, [open, products, value]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const filtered = useMemo(() => {
    const needle = normalizeSearch(query.trim());
    return products
      .filter((product) => !activeOnly || product.activo)
      .filter((product) => {
        if (!needle) return true;
        return normalizeSearch(
          `${product.tela} ${product.color} ${product.sku}`,
        ).includes(needle);
      });
  }, [activeOnly, products, query]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  const selectProduct = (product: Producto) => {
    onValueChange(String(product.id));
    setQuery(productLabel(product));
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-3 z-10 h-4 w-4 text-muted-foreground" />
      <Input
        role="combobox"
        aria-expanded={open}
        aria-controls={`${testId}-results`}
        autoComplete="off"
        value={query}
        placeholder={placeholder}
        className="pl-9 pr-9"
        data-testid={testId}
        onFocus={(event) => {
          setOpen(true);
          event.currentTarget.select();
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          onValueChange("");
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setHighlightedIndex((current) =>
              Math.min(current + 1, Math.max(0, filtered.length - 1)),
            );
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setHighlightedIndex((current) => Math.max(0, current - 1));
          } else if (event.key === "Enter" && open && filtered.length > 0) {
            event.preventDefault();
            selectProduct(filtered[highlightedIndex] ?? filtered[0]!);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {selected && (
        <Check className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-emerald-600" />
      )}

      {open && (
        <div
          id={`${testId}-results`}
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {filtered.length === 0 ? (
            <div
              className="px-3 py-6 text-center text-sm text-muted-foreground"
              data-testid={`${testId}-empty`}
            >
              Sin resultados para <strong>“{query}”</strong>
            </div>
          ) : (
            filtered.map((product, index) => (
              <button
                key={product.id}
                type="button"
                role="option"
                aria-selected={String(product.id) === value}
                className={`flex w-full items-center justify-between gap-4 rounded-sm px-3 py-2 text-left transition-colors ${
                  index === highlightedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/60"
                }`}
                data-testid={`${testId}-option-${product.id}`}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectProduct(product);
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {product.tela} — {product.color}
                  </span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {product.sku}
                  </span>
                </span>
                <span className="shrink-0 rounded bg-muted px-2 py-1 text-[10px] font-bold">
                  {product.unidad}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}