import { Navigate } from 'react-router-dom';
import { getRole } from '../api/auth';

export default function RoleRoute({ roles, children }) {
  const role = getRole();
  if (!roles.includes(role)) return <Navigate to="/" replace />;
  return children;
}
