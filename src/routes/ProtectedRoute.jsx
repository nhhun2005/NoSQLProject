import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';
export default function ProtectedRoute({
  children,
  requireAdmin = false
}) {
  const user = useSelector(state => state.user);
  const location = useLocation();
  if (!user.isAuthenticated) {
    return <Navigate to="/login" replace state={{
      from: location.pathname + location.search + location.hash
    }} />;
  }
  if (requireAdmin && user.account.role?.toLowerCase() !== 'admin') return <Navigate to="/about" replace />;
  return children;
}
