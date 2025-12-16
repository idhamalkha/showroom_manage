import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from "./providers/AuthProvider";
import { Toaster } from 'sonner';
import Login from "./pages/Login"; 
import Dashboard from "./pages/Dashboard";
import Sidebar from "./components/Sidebar/Sidebar";
import SearchBar from "./components/SearchBar/SearchBar";
import HrdManagement from "./components/HRD/HrdManagement";
import './styles/layout.css';
import Kinerja from './components/HRD/Kinerja';
import { useState } from 'react';
import HrdDetailModal from './components/HRD/HrdDetailModal';
import DashSales from './components/Sales/Dashboard/DashSales';
import DashHrd from './components/HRD/Dashboard/DashHrd';
import Transaksi from './components/Sales/Transaksi/Transaksi';
import MobilManagement from './components/Sales/MobilManagement/MobilManagement';
import DashFinance from './components/Finance/DashFinance';
import FinanceApprovalPage from './pages/FinanceApproval';
// import BankRekonsiliasiPage from './pages/BankRekonsiliasi';
import LaporanKeuangan from './components/Finance/LaporanKeuangan';
// import InvoiceManualForm from './components/Finance/InvoiceManualForm';
import CicilanManagementPage from './pages/CicilanManagement';
import CutiApprovalPage from './pages/CutiApprovalPage';
import LemburApprovalPage from './pages/LemburApprovalPage';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { accessToken, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    // sementara menunggu, tampilkan placeholder agar tidak redirect salah
    return <div style={{padding:20}}>Loading...</div>;
  }

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function Layout() {
  // state untuk modal profile
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileDetail, setProfileDetail] = useState(null);
  const { user } = useAuth();

  // Determine default dashboard berdasarkan role
  const getDefaultDashboard = () => {
    const userRole = user?.role || user?.jabatan?.nama_jabatan?.toLowerCase() || '';
    
    if (userRole.toLowerCase().includes('sales')) {
      return '/dash_sales';
    } else if (userRole.toLowerCase().includes('hrd')) {
      return '/hrd_dashboard';
    } else if (userRole.toLowerCase().includes('finance')) {
      return '/dash_finance';
    }
    return '/dash_sales'; // fallback
  };

  return (
    <div className="layout-container">
      <Sidebar />
      <main className="main-content">
        <header className="topbar-wrapper">
          <SearchBar 
            onProfileClick={(detail) => {
              setProfileDetail(detail);
              setProfileModalOpen(true);
            }}
          />
        </header>
        <div className="content-area">
          <Routes>
            <Route path="/" element={<Navigate to={getDefaultDashboard()} replace />} />
            <Route path="/hrd_management" element={<HrdManagement />} />
            <Route path="/hrd_dashboard" element={<DashHrd />} />
            <Route path="/kinerja" element={<Kinerja />} />
            <Route path="/cuti_approval" element={<CutiApprovalPage />} />
            <Route path="/lembur_approval" element={<LemburApprovalPage />} />
            <Route path="/dash_sales" element={<DashSales />} />
            <Route path="/dash_finance" element={<DashFinance />} />
            <Route path="/cicilan_management" element={<CicilanManagementPage />} />
            <Route path="/transaksi_sales" element={<Transaksi />} />
            <Route path="/mobil_sales" element={<MobilManagement />} />
            <Route path="/finance_approval" element={<FinanceApprovalPage />} />
            {/* <Route path="/bank_rekonsiliasi" element={<BankRekonsiliasiPage />} /> */}
            <Route path="/laporan_keuangan" element={<LaporanKeuangan />} />
            {/* <Route path="/invoice_manual" element={<InvoiceManualForm />} /> */}
            <Route path="*" element={<Navigate to={getDefaultDashboard()} />} />
          </Routes>
        </div>
      </main>

      {/* Render modal di sini, di luar struktur header/content */}
      {profileModalOpen && profileDetail && (
        <HrdDetailModal
          detail={profileDetail}
          onClose={() => {
            setProfileModalOpen(false);
            setProfileDetail(null);
          }}
          onPhotoSelect={async () => {
            // handle photo upload
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      {/* Global toast notifications */}
      <Toaster
        position="top-right"
        richColors
        theme="light"
        expand
        closeButton
        visibleToasts={5}
      />
      
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
