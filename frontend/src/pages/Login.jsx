import { useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Logo, Sparkles } from "../components/Logo";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export default function Login() {
  const { login } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const body =
        mode === "login" ? { email, password } : { name, email, password };
      const data = await api.post(path, body);
      login(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError("");
    setInfo("");
  }

  return (
    <div className="flex min-h-screen">
      {/* Painel esquerdo — foto da marca */}
      <div className="relative hidden lg:flex lg:w-1/2 items-end overflow-hidden">
        <img
          src="/login-banner.jpg"
          alt="Flor de Cabide"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        {/* overlay gradiente */}
        <div className="absolute inset-0 bg-gradient-to-t from-brand-brownDark/70 via-brand-brown/20 to-transparent" />
        <div className="relative z-10 p-10 text-white">
          <h1 className="font-serif text-4xl font-semibold drop-shadow">Flor de Cabide</h1>
          <p className="mt-2 text-lg text-white/80 drop-shadow">Sistema de Gestão de Vendas</p>
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex flex-1 items-center justify-center bg-brand-cream px-6 py-10">
        <div className="w-full max-w-[420px]">
          {/* Logo visível só em mobile (em desktop aparece na foto) */}
          <div className="lg:hidden mb-8">
            <Logo size="lg" />
          </div>

          <div className="rounded-2xl bg-brand-offwhite p-8 shadow-lg sm:p-10">
            {/* Título dentro do card */}
            <div className="mb-6">
              <h2 className="font-serif text-2xl text-brand-brown">
                {mode === "login" ? "Bem-vinda de volta" : "Criar conta"}
              </h2>
              <p className="mt-1 text-sm text-brand-text/60">
                {mode === "login"
                  ? "Acesse sua conta para continuar"
                  : "Preencha os dados para se cadastrar"}
              </p>
            </div>

            <Sparkles className="mb-6" />

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    required
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              {info && <p className="text-sm text-emerald-600">{info}</p>}

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() =>
                  setInfo("Entre em contato com o suporte para redefinir sua senha.")
                }
                className="text-sm text-brand-pinkDark transition-colors hover:text-brand-brown hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>

            <div className="mt-6 border-t border-brand-pink/30 pt-4 text-center text-sm text-brand-text/60">
              {mode === "login" ? (
                <>
                  Ainda não tem conta?{" "}
                  <button
                    type="button"
                    className="font-medium text-brand-brown hover:underline"
                    onClick={() => switchMode("register")}
                  >
                    Cadastre-se
                  </button>
                </>
              ) : (
                <>
                  Já tem conta?{" "}
                  <button
                    type="button"
                    className="font-medium text-brand-brown hover:underline"
                    onClick={() => switchMode("login")}
                  >
                    Entrar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
