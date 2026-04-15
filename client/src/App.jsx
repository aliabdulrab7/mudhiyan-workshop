import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout       from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import Dashboard    from './pages/Dashboard';
import NewOrder     from './pages/NewOrder';
import ScanPage     from './pages/ScanPage';
import LoginPage    from './pages/LoginPage';
import TrackPage    from './pages/TrackPage';
import BranchesPage    from './pages/BranchesPage';
import ReportsPage     from './pages/ReportsPage';
import TechniciansPage from './pages/TechniciansPage';
import InventoryPage   from './pages/InventoryPage';
import ServicesPage    from './pages/ServicesPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login"         element={<LoginPage />} />
        <Route path="/track/:token"  element={<TrackPage />} />

        {/* Protected */}
        <Route path="/*" element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/"     element={<Dashboard />} />
                <Route path="/new"  element={<NewOrder />} />
                <Route path="/scan"     element={<ScanPage />} />
                <Route path="/branches"    element={<BranchesPage />} />
                <Route path="/reports"     element={<ReportsPage />} />
                <Route path="/technicians" element={<TechniciansPage />} />
                <Route path="/inventory"   element={<InventoryPage />} />
                <Route path="/services"    element={<ServicesPage />} />
                <Route path="*"         element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
