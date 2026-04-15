import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout       from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import RoleRoute    from './components/RoleRoute';
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
import LabelPrintPage from './pages/LabelPrintPage';

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
                <Route path="/branches"    element={<RoleRoute roles={["workshop"]}><BranchesPage /></RoleRoute>} />
                <Route path="/reports"     element={<RoleRoute roles={["workshop"]}><ReportsPage /></RoleRoute>} />
                <Route path="/technicians" element={<RoleRoute roles={["workshop"]}><TechniciansPage /></RoleRoute>} />
                <Route path="/inventory"   element={<RoleRoute roles={["workshop"]}><InventoryPage /></RoleRoute>} />
                <Route path="/services"    element={<RoleRoute roles={["workshop"]}><ServicesPage /></RoleRoute>} />
                <Route path="/orders/:id/label" element={<LabelPrintPage />} />
                <Route path="*"         element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
