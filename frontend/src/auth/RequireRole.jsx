import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function RequireRole({ role, children }) {
  const { auth } = useAuth();
  if (!auth || auth.role !== role) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
