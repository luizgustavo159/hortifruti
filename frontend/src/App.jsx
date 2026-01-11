import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Login } from "./pages/Login";
import { Caixa } from "./pages/Caixa";
import { Estoque } from "./pages/Estoque";
import { Descontos } from "./pages/Descontos";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminLogs } from "./pages/AdminLogs";
import { AdminPerfil } from "./pages/AdminPerfil";
import { AdminPoliticas } from "./pages/AdminPoliticas";
import { AdminRelatorios } from "./pages/AdminRelatorios";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/caixa" element={<Caixa />} />
        <Route path="/estoque" element={<Estoque />} />
        <Route path="/descontos" element={<Descontos />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/logs" element={<AdminLogs />} />
        <Route path="/admin/perfil" element={<AdminPerfil />} />
        <Route path="/admin/politicas" element={<AdminPoliticas />} />
        <Route path="/admin/relatorios" element={<AdminRelatorios />} />
      </Routes>
    </BrowserRouter>
  );
}
