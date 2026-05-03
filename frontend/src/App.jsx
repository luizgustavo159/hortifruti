import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./animations.css";
import { AdminConfiguracao } from "./pages/AdminConfiguracao";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminFuncionarios } from "./pages/AdminFuncionarios";
import { AdminLogs } from "./pages/AdminLogs";
import { AdminPerfil } from "./pages/AdminPerfil";
import { AdminPoliticas } from "./pages/AdminPoliticas";
import { AdminRelatorios } from "./pages/AdminRelatorios";
import { Caixa } from "./pages/Caixa";
import { Descontos } from "./pages/Descontos";
import { Estoque } from "./pages/Estoque";
import { Login } from "./pages/Login";
import { apiFetch } from "./lib/api";
import {
  clearToken,
  clearUser,
  getUser,
  hasRequiredRole,
  isAuthenticated,
  setUser,
} from "./lib/auth";

function ProtectedRoute({ children, requiredRole }) {
  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  const currentUser = getUser();
  if (!currentUser) {
    return <div style={{ padding: "24px" }}>Carregando permissões...</div>;
  }

  if (requiredRole && !hasRequiredRole(requiredRole)) {
    return <Navigate to="/caixa" replace />;
  }

  return children;
}

export default function App() {
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const bootstrapSession = async () => {
      if (!isAuthenticated()) {
        setSessionReady(true);
        return;
      }

      if (getUser()) {
        setSessionReady(true);
        return;
      }

      try {
        const profile = await apiFetch("/auth/me");
        setUser(profile);
      } catch (_error) {
        clearToken();
        clearUser();
      } finally {
        setSessionReady(true);
      }
    };

    bootstrapSession();
  }, []);

  if (!sessionReady) {
    return <div style={{ padding: "24px" }}>Carregando sessão...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={isAuthenticated() ? <Navigate to="/caixa" replace /> : <Login />}
        />

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
            <ProtectedRoute requiredRole="manager">
              <Descontos />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/logs"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminLogs />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/perfil"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminPerfil />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/politicas"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminPoliticas />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/relatorios"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminRelatorios />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/funcionarios"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminFuncionarios />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/configuracao"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminConfiguracao />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to={isAuthenticated() ? "/caixa" : "/"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
