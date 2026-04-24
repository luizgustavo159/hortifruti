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
import { hasRequiredRole, isAuthenticated } from "./lib/auth";

function ProtectedRoute({ children, requiredRole }) {
  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }
  if (!hasRequiredRole(requiredRole)) {
    return <Navigate to="/caixa" replace />;
  }
  return children;
}

export default function App() {
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
      </Routes>
    </BrowserRouter>
  );
}
