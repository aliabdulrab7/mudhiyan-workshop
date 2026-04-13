import { Navigate } from 'react-router-dom';
import { isLoggedIn } from '../api/auth';

export default function PrivateRoute({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  return children;
}
