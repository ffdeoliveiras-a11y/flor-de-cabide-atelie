import * as React from "react";
import { Input } from "./ui/input";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

// Autocomplete de clientes: busca em /customers?q=...
// Se a cliente não existir, o texto livre é mantido (criada ao salvar a venda).
// Enter seleciona a sugestão destacada; sem destaque, deixa o Enter salvar o formulário.
export const CustomerAutocomplete = React.forwardRef(function CustomerAutocomplete(
  { value, onChange, ...props },
  ref
) {
  const [suggestions, setSuggestions] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(-1);
  const timer = React.useRef(null);

  function scheduleSearch(q) {
    if (timer.current) clearTimeout(timer.current);
    if (!q || q.trim().length < 1) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const rows = await api.get(`/customers?q=${encodeURIComponent(q.trim())}`);
        setSuggestions(rows);
        setHighlight(-1);
        setOpen(rows.length > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      }
    }, 200);
  }

  function handleChange(e) {
    onChange(e.target.value);
    scheduleSearch(e.target.value);
  }

  function select(name) {
    onChange(name);
    setOpen(false);
    setSuggestions([]);
    setHighlight(-1);
  }

  function handleKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open && suggestions.length) return setOpen(true);
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, -1));
    } else if (e.key === "Enter") {
      if (open && highlight >= 0 && suggestions[highlight]) {
        e.preventDefault();
        e.stopPropagation();
        select(suggestions[highlight].name);
      } else {
        setOpen(false); // deixa o Enter borbulhar para salvar
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
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        autoComplete="off"
        {...props}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-brand-pink bg-white py-1 shadow-card">
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              onMouseDown={(e) => {
                e.preventDefault();
                select(s.name);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                "cursor-pointer px-3 py-2 text-sm text-brand-text",
                i === highlight ? "bg-brand-cream" : "hover:bg-brand-cream/60"
              )}
            >
              {s.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
