import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import NewOrder from './pages/NewOrder';
import ScanPage from './pages/ScanPage';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new" element={<NewOrder />} />
          <Route path="/scan" element={<ScanPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
