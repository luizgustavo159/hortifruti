import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Login } from "./pages/Login";
import { Caixa } from "./pages/Caixa";
import { Estoque } from "./pages/Estoque";
import { Descontos } from "./pages/Descontos";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminLogs } from "./pages/AdminLogs";
import { AdminPerfil } from "./pages/AdminPerfil";
import { AdminPoliticas } from "./pages/AdminPoliticas";
import { AdminRelatorios } from "./pages/AdminRelatorios";
import { isAuthenticated } from "./lib/auth";

function ProtectedRoute({ children }) {
  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/caixa"
          element={
            <ProtectedRoute>
              <Caixa />
            </ProtectedRoute>
          }
        />
        <Route
          path="/estoque"
          element={
            <ProtectedRoute>
              <Estoque />
            </ProtectedRoute>
          }
        />
        <Route
          path="/descontos"
          element={
            <ProtectedRoute>
              <Descontos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/logs"
          element={
            <ProtectedRoute>
              <AdminLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/perfil"
          element={
            <ProtectedRoute>
              <AdminPerfil />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/politicas"
          element={
            <ProtectedRoute>
              <AdminPoliticas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/relatorios"
          element={
            <ProtectedRoute>
              <AdminRelatorios />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
