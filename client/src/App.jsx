import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ToastProvider';
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
import RepairOptionsPage from './pages/RepairOptionsPage';
import RolesPage       from './pages/RolesPage';
import SpecializationsPage from './pages/SpecializationsPage';
import LabelPrintPage from './pages/LabelPrintPage';
import OrdersPage         from './pages/OrdersPage';
import WorkshopStatusPage from './pages/WorkshopStatusPage';
import SpecMapPage        from './pages/SpecMapPage';
import SchedulerPage      from './pages/SchedulerPage';
import FlowPage           from './pages/FlowPage';
import BulkAssignPage     from './pages/BulkAssignPage';
import ControlTowerPage   from './pages/ControlTowerPage';

export default function App() {
  return (
    <ToastProvider>
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
                <Route path="/orders"  element={<OrdersPage />} />
                <Route path="/branches"    element={<RoleRoute roles={["workshop"]}><BranchesPage /></RoleRoute>} />
                <Route path="/reports"     element={<RoleRoute roles={["workshop"]}><ReportsPage /></RoleRoute>} />
                <Route path="/technicians" element={<RoleRoute roles={["workshop"]}><TechniciansPage /></RoleRoute>} />
                <Route path="/inventory"   element={<RoleRoute roles={["workshop"]}><InventoryPage /></RoleRoute>} />
                <Route path="/services"    element={<RoleRoute roles={["workshop"]}><ServicesPage /></RoleRoute>} />
                <Route path="/repair-options" element={<RoleRoute roles={["workshop"]}><RepairOptionsPage /></RoleRoute>} />
                <Route path="/roles"           element={<RoleRoute roles={["workshop"]}><RolesPage /></RoleRoute>} />
                <Route path="/specializations"    element={<RoleRoute roles={["workshop"]}><SpecializationsPage /></RoleRoute>} />
                <Route path="/workshop-status"   element={<RoleRoute roles={["workshop"]}><WorkshopStatusPage /></RoleRoute>} />
                <Route path="/spec-map"          element={<RoleRoute roles={["workshop"]}><SpecMapPage /></RoleRoute>} />
                <Route path="/scheduler"         element={<RoleRoute roles={["workshop"]}><SchedulerPage /></RoleRoute>} />
                <Route path="/flow"             element={<RoleRoute roles={["workshop"]}><FlowPage /></RoleRoute>} />
                <Route path="/bulk-assign"      element={<RoleRoute roles={["workshop"]}><BulkAssignPage /></RoleRoute>} />
                <Route path="/control-tower"    element={<RoleRoute roles={["workshop"]}><ControlTowerPage /></RoleRoute>} />
                <Route path="/orders/:id/label" element={<LabelPrintPage />} />
                <Route path="*"         element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  );
}
