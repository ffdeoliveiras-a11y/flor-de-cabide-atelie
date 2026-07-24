import * as React from "react";
import { Input } from "./ui/input";
import { api } from "../lib/api";
import { brl, cn } from "../lib/utils";

// Autocomplete de produtos do estoque.
// Ao digitar busca em /products?q=...; ao selecionar, chama onSelect(produto)
// para preencher marca/custo/venda. Texto livre também é permitido.
export const ProductAutocomplete = React.forwardRef(function ProductAutocomplete(
  { value, onChange, onSelect, ...props },
  ref
) {
  const [items, setItems] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(-1);
  const timer = React.useRef(null);

  function scheduleSearch(q) {
    if (timer.current) clearTimeout(timer.current);
    if (!q || q.trim().length < 1) {
      setItems([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const rows = await api.get(`/products?q=${encodeURIComponent(q.trim())}`);
        setItems(rows);
        setHighlight(-1);
        setOpen(rows.length > 0);
      } catch {
        setItems([]);
        setOpen(false);
      }
    }, 200);
  }

  function handleChange(e) {
    onChange(e.target.value);
    scheduleSearch(e.target.value);
  }

  function choose(p) {
    onSelect(p);
    setOpen(false);
    setItems([]);
    setHighlight(-1);
  }

  function handleKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open && items.length) return setOpen(true);
      setHighlight((h) => Math.min(h + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, -1));
    } else if (e.key === "Enter") {
      if (open && highlight >= 0 && items[highlight]) {
        e.preventDefault();
        e.stopPropagation();
        choose(items[highlight]);
      } else {
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Input
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onFocus={() => items.length > 0 && setOpen(true)}
        autoComplete="off"
        {...props}
      />
      {open && items.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-brand-pink bg-white py-1 shadow-card">
          {items.map((p, i) => (
            <li
              key={p.id}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(p);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm",
                i === highlight ? "bg-brand-cream" : "hover:bg-brand-cream/60"
              )}
            >
              <span className="text-brand-text">
                {p.name}
                {p.brand ? (
                  <span className="text-brand-text/50"> · {p.brand}</span>
                ) : null}
              </span>
              <span className="flex items-center gap-2 whitespace-nowrap text-xs">
                <span className="font-medium text-brand-brown">{brl(p.sale_value)}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5",
                    p.quantity > 0
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-600"
                  )}
                >
                  est: {p.quantity}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
