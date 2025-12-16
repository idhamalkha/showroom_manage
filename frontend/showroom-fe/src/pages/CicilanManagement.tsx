import { useAuth } from '../providers/AuthProvider';
import FinanceCicilanDashboard from '../components/Finance/FinanceCicilanDashboard';
import { useSearchParams } from 'react-router-dom';
import { CheckCircleIcon, ClipboardDocumentListIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function CicilanManagementPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const kd_client = searchParams.get('kd_client') ? parseInt(searchParams.get('kd_client')!) : undefined;
  const kd_cicilan = searchParams.get('kd_cicilan') ? parseInt(searchParams.get('kd_cicilan')!) : undefined;

  // Determine which views to show based on user role
  const isFinanceStaff = user?.role === 'Finance' || user?.role === 'finance' || user?.role === 'Owner' || (user as any)?._token_role === 'finance';
  const isSalesStaff = user?.role === 'Sales' || user?.role === 'sales' || (user as any)?._token_role === 'sales';

  const showFinanceView = isFinanceStaff;
  const showCustomerView = isSalesStaff || !!kd_client || !!kd_cicilan;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 rounded-2xl shadow-lg p-8 text-white relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-40 h-40 bg-blue-400 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-slate-400 rounded-full blur-3xl"></div>
        </div>
        
        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <ClipboardDocumentListIcon className="w-8 h-8" />
            <h1 className="text-3xl font-bold">
              {showFinanceView ? '📊 Cicilan Management' : '📋 Payment Tracking'}
            </h1>
          </div>
          <p className="text-blue-100 text-lg">
            {showFinanceView
              ? 'Monitor cicilan schedules, track collections, and manage payment workflows'
              : 'View your cicilan schedule and payment history'}
          </p>
        </div>
      </div>

      {/* Main Dashboard */}
      <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-200">
        <FinanceCicilanDashboard
          kd_client={kd_client}
          kd_cicilan={kd_cicilan}
          showCustomerView={showCustomerView}
          showFinanceView={showFinanceView}
        />
      </div>
    </div>
  );
}
