import { useEffect, useState } from 'react';
import { Tab } from '@headlessui/react';
import { API_BASE } from '../../api/host';
import { useAuth } from '../../providers/AuthProvider';
import LoadingSpinner from '../LoadingSpinner';
import PaymentRecordModal from '../Finance/PaymentRecordModal';
import ActiveCicilanDashboard from './ActiveCicilanDashboard';
import CicilanReportDashboard from './CicilanReportDashboard';
import OverdueAlertDashboard from './OverdueAlertDashboard';
import {
  DocumentCurrencyDollarIcon,
  CalendarIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';


interface Invoice {
  kd_invoice: number;
  kd_transaksi: number;
  nomor_invoice: string;
  status: 'outstanding' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  total_amount: number;
  paid_amount: number;
  remaining: number;
  tanggal_jatuh_tempo: string;
  client_name: string;
  created_at: string;
}


interface FinanceSummary {
  total_outstanding: number;
  total_paid_this_month: number;
  overdue_count: number;
  overdue_amount?: number;
}

export default function DashFinance() {
  const { accessToken, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [agingReport, setAgingReport] = useState<any>(null);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);

  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    loadAllData();
  }, [accessToken]);

  async function loadAllData() {
    try {
      setLoading(true);
      setError(null);
      
      const headers: HeadersInit = accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : {};

      // Load invoices, aging, and overdue cicilan in parallel
      const [invoicesRes, agingRes, overdueRes] = await Promise.all([
        fetch(`${API_BASE}/finance/invoices?limit=50`, { headers }),
        fetch(`${API_BASE}/finance/invoices/aging`, { headers }),
        fetch(`${API_BASE}/finance/cicilan/overdue?limit=50`, { headers })
      ]);

      if (!invoicesRes.ok) {
        throw new Error(`Failed to load invoices: ${invoicesRes.status}`);
      }
      if (!agingRes.ok) {
        throw new Error(`Failed to load aging report: ${agingRes.status}`);
      }
      if (!overdueRes.ok) {
        throw new Error(`Failed to load overdue cicilan: ${overdueRes.status}`);
      }

      const invoicesData = await invoicesRes.json();
      const agingData = await agingRes.json();
      const overdueData = await overdueRes.json();

      setInvoices((invoicesData.invoices || []).sort((a: Invoice, b: Invoice) => 
        new Date(b.tanggal_jatuh_tempo).getTime() - new Date(a.tanggal_jatuh_tempo).getTime()
      ));
      setAgingReport(agingData);

      // Calculate summary - using cicilan overdue data for accuracy
      const totalOutstanding = (invoicesData.invoices || [])
        .filter((inv: Invoice) => inv.status !== 'paid')
        .reduce((sum: number, inv: Invoice) => sum + inv.remaining, 0);

      // Use cicilan overdue data for overdue metrics
      const overdueCicilan = overdueData.data || [];
      const overdueAmount = overdueCicilan.reduce((sum: number, item: any) => sum + (item.jumlah || 0), 0);

      setSummary({
        total_outstanding: totalOutstanding,
        total_paid_this_month: 0, // Could be calculated from recent payments
        overdue_count: overdueCicilan.length,
        overdue_amount: overdueAmount
      });
    } catch (err: any) {
      console.error('Failed loading finance data:', err);
      setError(err?.message || 'Failed to load finance data');
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount || 0);

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      outstanding: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Outstanding' },
      partial: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Partial' },
      paid: { bg: 'bg-green-100', text: 'text-green-700', label: 'Paid' },
      overdue: { bg: 'bg-red-100', text: 'text-red-700', label: 'Overdue' },
      cancelled: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Cancelled' }
    };
    const badge = badges[status] || badges.outstanding;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const displayName = (user && (user.nama || user.nama_karyawan || user.fullName || user.name)) || 'Finance Team';

  const rawAvatar = user?.avatar_url || user?.avatar || user?.foto || null;
  const avatarUrl = rawAvatar
    ? rawAvatar.startsWith("http")
      ? rawAvatar
      : `${API_BASE}${rawAvatar}`
    : "/avatar.png";

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className={`dashsales-container dashboard-container p-0 space-y-6${ready ? ' dashsales-ready' : ''}`}>
      {/* Top: Finance Summary - Full Width */}
      <div className="rounded-xl shadow-md p-8 flex items-center gap-8 dashsales-top-card dashsales-card w-full bg-gradient-to-br from-white via-blue-50/30 to-white border border-slate-200">
        <div className="flex-1">
          <h3 className="dashsales-title text-2xl">
            💼 Finance Overview, {displayName}
          </h3>
          <p className="dashsales-subtitle mt-2 text-slate-600">
            {invoices.length > 0
              ? `${invoices.length} outstanding invoices requiring attention • ${summary?.overdue_count || 0} overdue`
              : 'All invoices are paid ✓'}
          </p>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Outstanding Card */}
            <div className="dashsales-panel p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 hover:shadow-lg transition-all duration-300">
              <div className="dashsales-label text-blue-700 font-semibold text-xs uppercase tracking-wide">📊 Outstanding</div>
              <div className="dashsales-value text-blue-900 mt-2">{formatCurrency(summary?.total_outstanding || 0)}</div>
              <div className="dashsales-meta text-blue-600 text-xs mt-1">{invoices.length} invoices</div>
            </div>

            {/* Overdue Amount Card */}
            <div className="dashsales-panel p-4 rounded-lg bg-gradient-to-br from-red-50 to-red-100/50 border border-red-200 hover:shadow-lg transition-all duration-300">
              <div className="dashsales-label text-red-700 font-semibold text-xs uppercase tracking-wide">🚨 Overdue Amount</div>
              <div className="dashsales-value text-red-900 mt-2">{formatCurrency(summary?.overdue_amount || 0)}</div>
              <div className="dashsales-meta text-red-600 text-xs mt-1">{summary?.overdue_count || 0} overdue</div>
            </div>

            {/* Overdue Count Card */}
            <div className="dashsales-panel p-4 rounded-lg bg-gradient-to-br from-orange-50 to-orange-100/50 border border-orange-200 hover:shadow-lg transition-all duration-300">
              <div className="dashsales-label text-orange-700 font-semibold text-xs uppercase tracking-wide">⏰ Immediate Action</div>
              <div className="dashsales-value text-orange-900 mt-2 text-3xl font-bold">{summary?.overdue_count || 0}</div>
              <div className="dashsales-meta text-orange-600 text-xs mt-1">items needing attention</div>
            </div>

            {/* Total Receivables Card */}
            <div className="dashsales-panel p-4 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 hover:shadow-lg transition-all duration-300">
              <div className="dashsales-label text-emerald-700 font-semibold text-xs uppercase tracking-wide">💰 Total Receivables</div>
              <div className="dashsales-value text-emerald-900 mt-2">{formatCurrency(
                (invoices || []).reduce((sum: number, inv: Invoice) => sum + inv.total_amount, 0)
              )}</div>
              <div className="dashsales-meta text-emerald-600 text-xs mt-1">All invoices</div>
            </div>
          </div>
        </div>

        <div className="w-48 h-48 bg-gradient-to-br from-blue-100 via-blue-50 to-white rounded-2xl flex items-center justify-center dashsales-avatar shadow-md border border-blue-200">
          <img src={avatarUrl} alt={displayName} className="w-40 h-40 rounded-full object-cover shadow-lg" />
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
        <Tab.List className="flex space-x-2 bg-gradient-to-r from-slate-50 to-slate-100 p-1.5 rounded-xl flex-wrap gap-1.5 border border-slate-200 shadow-sm">
          <Tab
            className={({ selected }) =>
              `py-2.5 px-5 font-semibold rounded-lg transition-all duration-300 flex items-center gap-2 whitespace-nowrap text-sm group ${
                selected 
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg scale-105 shadow-blue-500/30' 
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:shadow-md hover:scale-102 border border-transparent'
              }`
            }
          >
            <DocumentCurrencyDollarIcon className={`w-5 h-5 transition-transform ${selectedTab === 0 ? 'scale-110' : 'group-hover:scale-110'}`} />
            <span>Invoices</span>
          </Tab>
          <Tab
            className={({ selected }) =>
              `py-2.5 px-5 font-semibold rounded-lg transition-all duration-300 flex items-center gap-2 whitespace-nowrap text-sm group ${
                selected 
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg scale-105 shadow-emerald-500/30' 
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:shadow-md hover:scale-102 border border-transparent'
              }`
            }
          >
            <CalendarIcon className={`w-5 h-5 transition-transform ${selectedTab === 1 ? 'scale-110' : 'group-hover:scale-110'}`} />
            <span>Active Cicilan</span>
          </Tab>
          <Tab
            className={({ selected }) =>
              `py-2.5 px-5 font-semibold rounded-lg transition-all duration-300 flex items-center gap-2 whitespace-nowrap text-sm group ${
                selected 
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg scale-105 shadow-red-500/30' 
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:shadow-md hover:scale-102 border border-transparent'
              }`
            }
          >
            <ExclamationTriangleIcon className={`w-5 h-5 transition-transform ${selectedTab === 2 ? 'scale-110' : 'group-hover:scale-110'}`} />
            <span>Overdue Alert</span>
          </Tab>
          <Tab
            className={({ selected }) =>
              `py-2.5 px-5 font-semibold rounded-lg transition-all duration-300 flex items-center gap-2 whitespace-nowrap text-sm group ${
                selected 
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg scale-105 shadow-purple-500/30' 
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:shadow-md hover:scale-102 border border-transparent'
              }`
            }
          >
            <svg className={`w-5 h-5 transition-transform ${selectedTab === 3 ? 'scale-110' : 'group-hover:scale-110'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Report</span>
          </Tab>
        </Tab.List>

        {/* Tab Panels */}
        <Tab.Panels className="mt-6">
          {/* Invoices Tab */}
          <Tab.Panel>
            <div className="rounded-lg shadow bg-white p-6">
              {/* Main Grid: Aging Report (left 1/3) + Outstanding Invoices (right 2/3) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Aging Report - Left Side (1/3 width) */}
        {agingReport && (
          <div className="rounded-lg shadow p-6 dashsales-card dashsales-aging-card bg-white border border-slate-100">
            <h4 className="dashsales-title text-lg font-semibold mb-6">📊 Aging Report</h4>
            <div className="space-y-4">
              {/* Current */}
              <div className="group cursor-pointer transition-all duration-300 hover:bg-gradient-to-r hover:from-green-50 hover:to-transparent p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">Current</div>
                    <div className="text-xs text-slate-500 mt-1">Not yet due</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-green-600">{agingReport.current?.count || 0}</div>
                    <div className="text-xs text-slate-500">{formatCurrency(agingReport.current?.amount || 0)}</div>
                  </div>
                </div>
              </div>

              {/* 30-60 Days */}
              <div className="group cursor-pointer transition-all duration-300 hover:bg-gradient-to-r hover:from-yellow-50 hover:to-transparent p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">30-60 Days</div>
                    <div className="text-xs text-slate-500 mt-1">Past due</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-yellow-600">{agingReport.days_30_60?.count || 0}</div>
                    <div className="text-xs text-slate-500">{formatCurrency(agingReport.days_30_60?.amount || 0)}</div>
                  </div>
                </div>
              </div>

              {/* 60-90 Days */}
              <div className="group cursor-pointer transition-all duration-300 hover:bg-gradient-to-r hover:from-orange-50 hover:to-transparent p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">60-90 Days</div>
                    <div className="text-xs text-slate-500 mt-1">Very overdue</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-orange-600">{agingReport.days_60_90?.count || 0}</div>
                    <div className="text-xs text-slate-500">{formatCurrency(agingReport.days_60_90?.amount || 0)}</div>
                  </div>
                </div>
              </div>

              {/* 90+ Days */}
              <div className="group cursor-pointer transition-all duration-300 hover:bg-gradient-to-r hover:from-red-50 hover:to-transparent p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">90+ Days</div>
                    <div className="text-xs text-slate-500 mt-1">Critical</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-red-600">{agingReport.days_90_plus?.count || 0}</div>
                    <div className="text-xs text-slate-500">{formatCurrency(agingReport.days_90_plus?.amount || 0)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Outstanding Invoices - Right Side (2/3 width) */}
        <div className="lg:col-span-2 rounded-lg shadow p-6 dashsales-card bg-white border border-slate-100">
          <div className="mb-4 flex items-center justify-between gap-4 sticky top-0 bg-white z-10" style={{paddingTop: 0, paddingBottom: 0}}>
            <h4 className="dashsales-title text-lg font-semibold">📋 Outstanding Invoices</h4>
            <input
              type="text"
              placeholder="Search by client name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          <div
            className="relative hide-scrollbar"
            style={{
              maxHeight: '420px',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <style>{`
              .hide-scrollbar::-webkit-scrollbar { display: none; }
              .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
            <div className="space-y-3">
              {invoices
                .filter((inv) => inv.client_name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((inv) => (
                  <div key={inv.kd_invoice} className="rounded-lg p-4 dashsales-latest-deal-card hover:shadow-lg transition-shadow duration-300 border border-slate-100 bg-slate-50">
                    <div className="flex items-start justify-between gap-4">
                      {/* Invoice Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                              {inv.nomor_invoice}
                            </div>
                            <div className="text-sm font-semibold text-slate-900">{inv.client_name}</div>
                          </div>
                          <div className="flex-shrink-0">
                            {getStatusBadge(inv.status)}
                          </div>
                        </div>

                        {/* Amount Info */}
                        <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs text-slate-500">Total Amount</div>
                            <div className="text-sm font-bold text-slate-900">{formatCurrency(inv.total_amount)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">Remaining</div>
                            <div className="text-sm font-bold text-red-600">{formatCurrency(inv.remaining)}</div>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className="text-slate-500">
                            📅 Due: {new Date(inv.tanggal_jatuh_tempo).toLocaleDateString('id-ID', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                          <span className={`font-medium ${
                            new Date(inv.tanggal_jatuh_tempo) < new Date()
                              ? 'text-red-600'
                              : 'text-green-600'
                          }`}>
                            {new Date(inv.tanggal_jatuh_tempo) < new Date() ? '⚠️ Overdue' : '✓ On Track'}
                          </span>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="flex-shrink-0">
                        <button
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setShowPaymentModal(true);
                          }}
                          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                          disabled={inv.status === 'paid'}
                        >
                          Record Payment
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
            </div>
          </Tab.Panel>

          {/* Active Cicilan Tab */}
          <Tab.Panel>
            <div className="rounded-lg shadow bg-white p-6 border border-slate-100">
              <div className="mb-4">
                <h4 className="dashsales-title text-lg font-semibold">Active Cicilan</h4>
                <p className="dashsales-subtitle mt-1">List of active installment plans and quick actions</p>
              </div>
              <div className="card-list">
                <ActiveCicilanDashboard limit={50} />
              </div>
            </div>
          </Tab.Panel>

          {/* Overdue Alert Tab */}
          <Tab.Panel>
            <div className="rounded-lg shadow bg-white p-6 border border-slate-100">
              <div className="mb-4">
                <h4 className="dashsales-title text-lg font-semibold">Overdue Alerts</h4>
                <p className="dashsales-subtitle mt-1">Critical overdue invoices that need attention</p>
              </div>
              <div className="card-list">
                <OverdueAlertDashboard limit={50} />
              </div>
            </div>
          </Tab.Panel>

          {/* Report Tab */}
          <Tab.Panel>
            <div className="rounded-lg shadow bg-white p-6 border border-slate-100">
              <div className="mb-4">
                <h4 className="dashsales-title text-lg font-semibold">Reports</h4>
                <p className="dashsales-subtitle mt-1">Downloadable and visual reports for cicilan</p>
              </div>
              <div className="card-list">
                <CicilanReportDashboard />
              </div>
            </div>
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>

      {/* Payment Modal */}
      {selectedInvoice && (
        <PaymentRecordModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedInvoice(null);
          }}
          invoice={selectedInvoice}
          onSaved={() => {
            loadAllData();
            setShowPaymentModal(false);
            setSelectedInvoice(null);
          }}
        />
      )}
    </div>
  );
}
