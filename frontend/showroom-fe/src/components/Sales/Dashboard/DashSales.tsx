import { useEffect, useState } from "react";
import { API_BASE } from "../../../api/host";
import LoadingSpinner from "../../LoadingSpinner";
import { useAuth } from "../../../providers/AuthProvider";
import '../../../styles/DashSales.css';

interface TransactionSummary {
  total_cash: number;
  total_credit: number;
  total_customers: number;
  total_orders: number;
  latest_transaction?: {
    kd_transaksi: number;
    tanggal: string;
    total_harga: number;
    metode_pembayaran: string;
    client?: {
      nama_client: string;
    };
  };
  top_sales?: {
    nama_karyawan: string;
    total_sales: number;
  };
}

interface RecentTransaction {
  kd_transaksi: number;
  tanggal: string;
  total_harga: number;
  metode_pembayaran: string;
  client: {
    nama_client: string;
    email: string | null;
  };
  vehicle: {
    nama_mobil: string;
    foto_url: string | null;
  } | null;
  warna_foto_url?: string | null;
}

interface TopVehicle {
  nama_mobil: string;
  foto_url: string | null;
  sales_count: number;
  total_revenue: number;
}

export default function DashSales() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [topVehicles, setTopVehicles] = useState<TopVehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  const rawAvatar = user?.avatar_url || user?.avatar || user?.foto || null;
  const avatarUrl = rawAvatar
    ? rawAvatar.startsWith("http")
      ? rawAvatar
      : `${API_BASE}${rawAvatar}`
    : "/avatar.png";

  const displayName = (user && (user.nama || user.nama_karyawan || user.fullName || user.name)) || summary?.top_sales?.nama_karyawan || "Team Sales";

  useEffect(() => {
    loadAllData();
  }, []);

  // Listen for refresh signal from other components
  useEffect(() => {
    function handleStorageChange() {
      const refreshNeeded = localStorage.getItem('dashSalesRefresh');
      if (refreshNeeded === 'true') {
        loadAllData();
        localStorage.removeItem('dashSalesRefresh');
      }
    }
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  async function loadAllData() {
    try {
      const token = localStorage.getItem("authToken");
      if (!token) throw new Error("No auth token");

      // Get current month date range (first day to last day of month)
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const startDate = firstDay.toISOString().split('T')[0];
      const endDate = lastDay.toISOString().split('T')[0];

      // Load all data in parallel
      const [summaryRes, txRes, vehiclesRes] = await Promise.all([
        fetch(`${API_BASE}/sales/dashboard/summary?start=${startDate}&end=${endDate}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/sales/dashboard/recent-transactions?limit=3`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/sales/dashboard/top-vehicles?limit=5`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      // Process summary
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        if (data) {
          data.total_cash = Number(data.total_cash || 0);
          data.total_credit = Number(data.total_credit || 0);
          data.total_customers = Number(data.total_customers || 0);
          data.total_orders = Number(data.total_orders || 0);
          if (data.top_sales) data.top_sales.total_sales = Number(data.top_sales.total_sales || 0);
          if (data.latest_transaction) data.latest_transaction.total_harga = Number(data.latest_transaction.total_harga || 0);
        }
        setSummary(data);
      }

      // Process recent transactions
      if (txRes.ok) {
        const data = await txRes.json();
        setRecentTransactions((data.transactions || []).reverse());
      }

      // Process top vehicles
      if (vehiclesRes.ok) {
        const data = await vehiclesRes.json();
        setTopVehicles(data.vehicles || []);
      }

      // payment methods endpoint is not used on this layout (replaced by Top Cars)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!summary) return null;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(amount || 0);

  return (
    <div className={`dashsales-container dashboard-container p-0 space-y-6${ready ? " dashsales-ready" : ""}`}>
      {/* Top: Congratulations - full width */}
      <div className="rounded-xl shadow-md p-8 flex items-center gap-8 dashsales-top-card dashsales-card w-full bg-gradient-to-br from-white via-emerald-50/30 to-white border border-slate-200">
        <div className="flex-1">
          <h3 className="dashsales-title text-2xl">
            🎉 Sales Overview, {displayName}
          </h3>
          <p className="dashsales-subtitle mt-2 text-slate-600">
            {summary?.top_sales?.nama_karyawan
              ? `🌟 Top performer — ${summary.top_sales.nama_karyawan} with ${formatCurrency(summary.top_sales.total_sales)} this month`
              : "📊 No sales recorded this month. Keep pushing! 💪"}
          </p>
          
          {/* Stat Cards Grid */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Revenue Card */}
            <div className="dashsales-panel p-4 rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 hover:shadow-lg transition-all duration-300">
              <div className="dashsales-label text-emerald-700 font-semibold text-xs uppercase tracking-wide">💰 Total Revenue</div>
              <div className="dashsales-value text-emerald-900 mt-2">{formatCurrency(summary.total_cash + summary.total_credit)}</div>
              <div className="dashsales-meta text-emerald-600 text-xs mt-1">Cash + Credit</div>
            </div>

            {/* Total Orders Card */}
            <div className="dashsales-panel p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 hover:shadow-lg transition-all duration-300">
              <div className="dashsales-label text-blue-700 font-semibold text-xs uppercase tracking-wide">📦 Total Orders</div>
              <div className="dashsales-value text-blue-900 mt-2 text-3xl font-bold">{summary.total_orders}</div>
              <div className="dashsales-meta text-blue-600 text-xs mt-1">All time</div>
            </div>

            {/* Total Customers Card */}
            <div className="dashsales-panel p-4 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-200 hover:shadow-lg transition-all duration-300">
              <div className="dashsales-label text-purple-700 font-semibold text-xs uppercase tracking-wide">👥 Total Customers</div>
              <div className="dashsales-value text-purple-900 mt-2 text-3xl font-bold">{summary.total_customers}</div>
              <div className="dashsales-meta text-purple-600 text-xs mt-1">Unique buyers</div>
            </div>

            {/* Top Sales Card */}
            <div className="dashsales-panel p-4 rounded-lg bg-gradient-to-br from-orange-50 to-orange-100/50 border border-orange-200 hover:shadow-lg transition-all duration-300">
              <div className="dashsales-label text-orange-700 font-semibold text-xs uppercase tracking-wide">🏆 Top Performer</div>
              <div className="dashsales-value text-orange-900 mt-2">{formatCurrency(summary.top_sales?.total_sales || 0)}</div>
              <div className="dashsales-meta text-orange-600 text-xs mt-1 truncate">{summary.top_sales?.nama_karyawan || "N/A"}</div>
            </div>
          </div>
        </div>

        <div className="w-48 h-48 bg-gradient-to-br from-emerald-100 via-emerald-50 to-white rounded-2xl flex items-center justify-center dashsales-avatar shadow-md border border-emerald-200">
          <img src={avatarUrl} alt={displayName} className="w-40 h-40 rounded-full object-cover shadow-lg" />
        </div>
      </div>

      {/* Main Grid: Top Cars (left, smaller) + Latest Deals (right, larger) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Cars - Left Side (1/3 width) */}
        <div className="rounded-lg shadow p-6 dashsales-card dashsales-top-cars-card">
          <h4 className="dashsales-title text-lg font-semibold mb-6">🏆 Top Cars</h4>
          <div className="space-y-4">
            {topVehicles.slice(0, 5).map((v, i) => (
              <div key={i} className="group cursor-pointer transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent p-3 rounded-lg">
                <div className="flex gap-3 items-start">
                  {/* Car Image */}
                  <div className="w-20 h-14 rounded-lg overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
                    {v.foto_url ? (
                      <img src={v.foto_url} alt={v.nama_mobil} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">No Image</div>
                    )}
                  </div>
                  
                  {/* Car Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">{v.nama_mobil}</div>
                    <div className="text-xs text-slate-500 mt-1 flex gap-2">
                      <span className="font-medium text-slate-600">{v.sales_count}x</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-blue-600 font-medium">{formatCurrency(v.total_revenue)}</span>
                    </div>
                  </div>
                  
                  {/* Badge */}
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white text-xs font-bold">#{i + 1}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Latest Deals - Right Side (2/3 width) */}
        {recentTransactions.length > 0 && (
          <div className="lg:col-span-2 rounded-lg shadow p-6 dashsales-card">
            <h4 className="dashsales-title text-lg font-semibold mb-4">✨ Latest Deals</h4>
            <div className="space-y-3">
              {recentTransactions.map((tx) => (
                <div key={tx.kd_transaksi} className="rounded-lg p-4 dashsales-latest-deal-card hover:shadow-lg transition-shadow duration-300 border border-slate-100 bg-slate-50">
                  <div className="flex gap-4">
                    {/* Vehicle Image */}
                    {(tx.warna_foto_url || tx.vehicle?.foto_url) && (
                      <div className="w-28 h-20 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                        <img
                          src={(tx.warna_foto_url ?? tx.vehicle?.foto_url) || ''}
                          alt={tx.vehicle?.nama_mobil}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}

                    {/* Deal Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          {tx.vehicle && (
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{tx.vehicle.nama_mobil}</div>
                          )}
                          <div className="text-sm font-semibold text-slate-900 mb-2">{tx.client.nama_client}</div>
                          <div className="text-xs text-slate-500 truncate">{tx.client.email || "No email"}</div>
                        </div>
                        
                        {/* Amount Badge */}
                        <div className="flex-shrink-0 text-right">
                          <div className="inline-flex flex-col items-end">
                            <span className="text-sm font-bold text-slate-900">{formatCurrency(tx.total_harga)}</span>
                            <span className={`text-xs font-medium uppercase tracking-wide mt-1 px-2 py-1 rounded-full ${
                              tx.metode_pembayaran === 'cash' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {tx.metode_pembayaran}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Footer */}
                      <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                        <div className="text-xs text-slate-500">
                          📅 {new Date(tx.tanggal).toLocaleDateString('id-ID', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </div>
                        <div className="flex gap-1">
                          <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                          <span className="text-xs text-slate-500">Completed</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>




    </div>
  );
}
