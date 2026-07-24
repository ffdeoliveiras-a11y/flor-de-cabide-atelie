import { useState, useEffect } from "react";

// Igual ao useState, mas guarda o valor no localStorage para não perder o que
// estava sendo preenchido ao trocar de aba ou atualizar a página.
export function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignora cota cheia / modo privado */
    }
  }, [key, value]);

  return [value, setValue];
}
