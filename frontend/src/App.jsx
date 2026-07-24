import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { Layout } from "./components/Layout";
import Login from "./pages/Login";
import FechamentoDia from "./pages/FechamentoDia";
import Historico from "./pages/Historico";
import Estoque from "./pages/Estoque";
import Dashboard from "./pages/Dashboard";
import PainelFinanceiro from "./pages/PainelFinanceiro";
import Calculadora from "./pages/Calculadora";

export default function App() {
  const { user } = useAuth();

  // Sem sessão → tela de login
  if (!user) return <Login />;

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<FechamentoDia />} />
          <Route path="/historico" element={<Historico />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/financeiro" element={<PainelFinanceiro />} />
          <Route path="/calculadora" element={<Calculadora />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
