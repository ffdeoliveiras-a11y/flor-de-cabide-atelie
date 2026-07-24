import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  PlusCircle,
  History,
  Boxes,
  LayoutDashboard,
  Wallet,
  Calculator,
  LogOut,
  Menu,
  X,
  Smartphone,
} from "lucide-react";
import { Button } from "./ui/button";
import { CelularModal } from "./CelularModal";
import { useAuth } from "../lib/auth";
import { cn, firstName, greeting } from "../lib/utils";

const navItems = [
  { to: "/", label: "Nova Venda", icon: PlusCircle, end: true },
  { to: "/historico", label: "Histórico", icon: History },
  { to: "/estoque", label: "Estoque", icon: Boxes },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/calculadora", label: "Calculadora", icon: Calculator },
];

export function Layout({ children }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [celularOpen, setCelularOpen] = useState(false);
  const location = useLocation();

  // Fecha o menu mobile ao trocar de página
  const currentPath = location.pathname;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-brand-pink/40 bg-brand-offwhite/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3 sm:px-8">
          {/* Logo */}
          <div className="flex shrink-0 items-center gap-2.5 text-brand-brown">
            <img src="/icone.svg" alt="" className="h-9 w-9" />
            <div className="font-serif text-lg font-semibold leading-none">Flor de Cabide</div>
          </div>

          {/* Navegação desktop (labels sempre visíveis a partir de md) */}
          <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-brand-brown text-white shadow-sm"
                      : "text-brand-text/70 hover:bg-brand-cream"
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Espaçador no mobile */}
          <div className="flex-1 md:hidden" />

          {/* Usuário (desktop) */}
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCelularOpen(true)}
              title="Acessar pelo celular"
            >
              <Smartphone className="h-4 w-4" />
              <span className="hidden xl:inline">Celular</span>
            </Button>
            <span className="text-sm text-brand-text/70">
              {greeting()}, <strong className="text-brand-brown">{firstName(user?.name)}</strong> 🌸
            </span>
            <Button variant="ghost" size="sm" onClick={logout} title="Sair">
              <LogOut className="h-4 w-4" />
              <span className="hidden lg:inline">Sair</span>
            </Button>
          </div>

          {/* Botão de menu (mobile) */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-brand-brown transition-colors hover:bg-brand-cream md:hidden"
            aria-label="Abrir menu"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Menu mobile (lista com palavras) */}
        {menuOpen && (
          <div className="border-t border-brand-pink/40 bg-brand-offwhite px-4 py-3 md:hidden animate-fade-in">
            <p className="px-2 pb-2 text-sm text-brand-text/60">
              {greeting()}, <strong className="text-brand-brown">{firstName(user?.name)}</strong> 🌸
            </p>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = item.end
                  ? currentPath === item.to
                  : currentPath.startsWith(item.to);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium transition-colors",
                      isActive
                        ? "bg-brand-brown text-white"
                        : "text-brand-text/80 hover:bg-brand-cream"
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setCelularOpen(true);
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium text-brand-text/80 transition-colors hover:bg-brand-cream"
              >
                <Smartphone className="h-5 w-5 shrink-0" />
                <span>Acessar pelo celular</span>
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="mt-1 flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut className="h-5 w-5 shrink-0" />
                <span>Sair</span>
              </button>
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-8 sm:py-8">{children}</main>

      {/* Modal de acesso pelo celular (QR code) */}
      <CelularModal open={celularOpen} onClose={() => setCelularOpen(false)} />
    </div>
  );
}
