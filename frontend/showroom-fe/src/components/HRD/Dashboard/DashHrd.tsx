import { useEffect, useState } from "react";
import { API_BASE } from "../../../api/host";
import LoadingSpinner from "../../LoadingSpinner";
import { useAuth } from "../../../providers/AuthProvider";
import '../../../styles/DashHrd.css';

interface HRDSummary {
  total_karyawan: number;
  today_present: number;
  total_lembur_month: number;
  contracts_expiring: number;
}

interface TopSale {
  kd_karyawan: number;
  nama_karyawan: string;
  foto: string | null;
  total_sales: number;
  total_revenue: number;
}

interface AttendanceTrends {
  [date: string]: {
    masuk: number;
    izin: number;
    sakit: number;
    cuti: number;
    alfa: number;
  };
}

interface OvertimeTrend {
  tanggal: string;
  count: number;
  total_hours: number;
}

interface ExpiringContract {
  kd_karyawan: number;
  nama_karyawan: string;
  masa_kontrak: string;
  tgl_mulai: string | null;
  tgl_habis: string | null;
  days_left: number;
}

export default function DashHrd() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<HRDSummary | null>(null);
  const [topSales, setTopSales] = useState<TopSale[]>([]);
  const [attendanceTrends, setAttendanceTrends] = useState<AttendanceTrends>({});
  const [overtimeTrends, setOvertimeTrends] = useState<OvertimeTrend[]>([]);
  const [expiringContracts, setExpiringContracts] = useState<ExpiringContract[]>([]);
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

  const displayName = (user && (user.nama || user.nama_karyawan || user.fullName || user.name)) || "HRD Team";

  useEffect(() => {
    loadAllData();
  }, []);

  // Listen for refresh signal
  useEffect(() => {
    function handleStorageChange() {
      const refreshNeeded = localStorage.getItem('dashHrdRefresh');
      if (refreshNeeded === 'true') {
        loadAllData();
        localStorage.removeItem('dashHrdRefresh');
      }
    }
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  async function loadAllData() {
    try {
      const token = localStorage.getItem("authToken");
      if (!token) throw new Error("No auth token");

      // Load all data in parallel
      const [summaryRes, topSalesRes, attendanceRes, overtimeRes, contractsRes] = await Promise.all([
        fetch(`${API_BASE}/hrd/dashboard/summary`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/hrd/dashboard/top-sales?limit=5`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/hrd/dashboard/attendance-trends?days=30`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/hrd/dashboard/overtime-trends?days=30`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/hrd/dashboard/expiring-contracts?days=30&limit=5`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      // Process summary
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        if (data.success) {
          setSummary({
            total_karyawan: data.total_karyawan,
            today_present: data.today_present,
            total_lembur_month: Number(data.total_lembur_month || 0),
            contracts_expiring: data.contracts_expiring
          });
        }
      }

      // Process top sales
      if (topSalesRes.ok) {
        const data = await topSalesRes.json();
        if (data.success) {
          setTopSales(data.sales || []);
        }
      }

      // Process attendance trends
      if (attendanceRes.ok) {
        const data = await attendanceRes.json();
        if (data.success) {
          setAttendanceTrends(data.trends || {});
        }
      }

      // Process overtime trends
      if (overtimeRes.ok) {
        const data = await overtimeRes.json();
        if (data.success) {
          setOvertimeTrends(data.trends || []);
        }
      }

      // Process expiring contracts
      if (contractsRes.ok) {
        const data = await contractsRes.json();
        if (data.success) {
          setExpiringContracts(data.contracts || []);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error("Failed to load HRD dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(amount || 0);

  // Calculate attendance stats for visualization
  const totalAttendanceByStatus = Object.values(attendanceTrends).reduce(
    (acc, day) => {
      acc.masuk += day.masuk;
      acc.izin += day.izin;
      acc.sakit += day.sakit;
      acc.cuti += day.cuti;
      acc.alfa += day.alfa;
      return acc;
    },
    { masuk: 0, izin: 0, sakit: 0, cuti: 0, alfa: 0 }
  );

  const totalOvertimeHours = overtimeTrends.reduce((sum, t) => sum + t.total_hours, 0);

  return (
    <div className={`dashhrd-container dashboard-container p-0 space-y-6${ready ? " dashhrd-ready" : ""}`}>
      {/* Top: Welcome Card - full width */}
      <div className="rounded-xl shadow-md p-8 flex items-center gap-8 dashhrd-top-card dashhrd-card w-full bg-gradient-to-br from-white via-blue-50/30 to-white border border-slate-200">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">👋</span>
            <h3 className="dashhrd-title text-2xl">
              HRD Dashboard, {displayName}
            </h3>
          </div>
          <p className="dashhrd-subtitle mt-2 text-slate-600">
            📊 Human Resource Management & Employee Performance Analytics
          </p>
          
          {/* Stat Cards Grid */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Employees Card */}
            <div className="dashhrd-panel p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 hover:shadow-lg transition-all duration-300">
              <div className="dashhrd-label text-blue-700 font-semibold text-xs uppercase tracking-wide">👥 Total Karyawan</div>
              <div className="dashhrd-value text-blue-900 mt-2 text-3xl font-bold">{summary?.total_karyawan || 0}</div>
              <div className="dashhrd-meta text-blue-600 text-xs mt-1">Aktif</div>
            </div>

            {/* Today's Attendance Card */}
            <div className="dashhrd-panel p-4 rounded-lg bg-gradient-to-br from-green-50 to-green-100/50 border border-green-200 hover:shadow-lg transition-all duration-300">
              <div className="dashhrd-label text-green-700 font-semibold text-xs uppercase tracking-wide">✅ Kehadiran Hari Ini</div>
              <div className="dashhrd-value text-green-900 mt-2 text-3xl font-bold">{summary?.today_present || 0}</div>
              <div className="dashhrd-meta text-green-600 text-xs mt-1">Sudah masuk</div>
            </div>

            {/* Total Overtime Hours Card */}
            <div className="dashhrd-panel p-4 rounded-lg bg-gradient-to-br from-orange-50 to-orange-100/50 border border-orange-200 hover:shadow-lg transition-all duration-300">
              <div className="dashhrd-label text-orange-700 font-semibold text-xs uppercase tracking-wide">⏰ Jam Lembur</div>
              <div className="dashhrd-value text-orange-900 mt-2 text-3xl font-bold">{summary?.total_lembur_month.toFixed(1)}</div>
              <div className="dashhrd-meta text-orange-600 text-xs mt-1">Bulan ini (jam)</div>
            </div>

            {/* Expiring Contracts Card */}
            <div className="dashhrd-panel p-4 rounded-lg bg-gradient-to-br from-red-50 to-red-100/50 border border-red-200 hover:shadow-lg transition-all duration-300">
              <div className="dashhrd-label text-red-700 font-semibold text-xs uppercase tracking-wide">📋 Kontrak Habis</div>
              <div className="dashhrd-value text-red-900 mt-2 text-3xl font-bold">{summary?.contracts_expiring || 0}</div>
              <div className="dashhrd-meta text-red-600 text-xs mt-1">30 hari ke depan</div>
            </div>
          </div>
        </div>

        <div className="w-48 h-48 bg-gradient-to-br from-blue-100 via-blue-50 to-white rounded-2xl flex items-center justify-center dashhrd-avatar shadow-md border border-blue-200">
          <img src={avatarUrl} alt={displayName} className="w-40 h-40 rounded-full object-cover shadow-lg" />
        </div>
      </div>

      {/* Main Grid: Top Sales (left) + Attendance & Overtime (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Sales - Left Side (1/3 width) */}
        <div className="rounded-lg shadow p-6 dashhrd-card dashhrd-top-sales-card">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xl">🏆</span>
            <h4 className="dashhrd-title text-lg font-semibold">Top Sales</h4>
          </div>
          <div className="space-y-4">
            {topSales.slice(0, 5).map((sale, i) => {
              const saleAvatarUrl = sale.foto
                ? (sale.foto.startsWith("http") ? sale.foto : `${API_BASE}${sale.foto}`)
                : "/avatar.png";
              return (
              <div key={i} className="group cursor-pointer transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent p-3 rounded-lg">
                <div className="flex gap-3 items-center justify-between">
                  {/* Avatar */}
                  <img 
                    src={saleAvatarUrl} 
                    alt={sale.nama_karyawan}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                  
                  {/* Sales Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">{sale.nama_karyawan}</div>
                    <div className="text-xs text-slate-500 mt-1 flex gap-2">
                      <span className="font-medium text-slate-600">{sale.total_sales}x</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-blue-600 font-medium">{formatCurrency(sale.total_revenue)}</span>
                    </div>
                  </div>
                  
                  {/* Badge */}
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white text-xs font-bold">#{i + 1}</span>
                  </div>
                </div>
              </div>
              );
            })}
            {topSales.length === 0 && (
              <div className="text-center py-6 text-slate-500 text-sm">Belum ada data penjualan</div>
            )}
          </div>
        </div>

        {/* Right Side (2/3 width) - Attendance & Overtime */}
        <div className="lg:col-span-2 space-y-6">
          {/* Attendance Dashboard */}
          <div className="rounded-lg shadow p-6 dashhrd-card dashhrd-attendance-card">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">📊</span>
              <h4 className="dashhrd-title text-lg font-semibold">Dasbor Kehadiran (30 Hari)</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {/* Masuk */}
              <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-green-100 border border-green-200">
                <div className="text-2xl font-bold text-green-700">{totalAttendanceByStatus.masuk}</div>
                <div className="text-xs text-green-600 mt-1">Masuk</div>
              </div>

              {/* Izin */}
              <div className="p-4 rounded-lg bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200">
                <div className="text-2xl font-bold text-yellow-700">{totalAttendanceByStatus.izin}</div>
                <div className="text-xs text-yellow-600 mt-1">Izin</div>
              </div>

              {/* Sakit */}
              <div className="p-4 rounded-lg bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200">
                <div className="text-2xl font-bold text-orange-700">{totalAttendanceByStatus.sakit}</div>
                <div className="text-xs text-orange-600 mt-1">Sakit</div>
              </div>

              {/* Cuti */}
              <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200">
                <div className="text-2xl font-bold text-purple-700">{totalAttendanceByStatus.cuti}</div>
                <div className="text-xs text-purple-600 mt-1">Cuti</div>
              </div>

              {/* Alfa */}
              <div className="p-4 rounded-lg bg-gradient-to-br from-red-50 to-red-100 border border-red-200">
                <div className="text-2xl font-bold text-red-700">{totalAttendanceByStatus.alfa}</div>
                <div className="text-xs text-red-600 mt-1">Absen</div>
              </div>
            </div>

            {/* Recent Attendance Dates */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="text-xs text-slate-500 mb-2">Riwayat 7 hari terakhir:</div>
              <div className="grid grid-cols-7 gap-2">
                {Object.entries(attendanceTrends)
                  .slice(-7)
                  .map(([date, stats]) => {
                    const dateObj = new Date(date);
                    const day = dateObj.toLocaleDateString('id-ID', { weekday: 'short' });
                    return (
                      <div key={date} className="text-center p-2 rounded-lg bg-slate-50 border border-slate-200 hover:shadow-md transition-shadow">
                        <div className="text-xs font-semibold text-slate-700">{day}</div>
                        <div className="text-sm font-bold text-green-600 mt-1">{stats.masuk}</div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Overtime Dashboard */}
          <div className="rounded-lg shadow p-6 dashhrd-card dashhrd-overtime-card">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">⏰</span>
              <h4 className="dashhrd-title text-lg font-semibold">Tren Jam Lembur (30 Hari)</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="p-4 rounded-lg bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200">
                <div className="text-xs text-orange-600 font-semibold mb-1">Total Pengajuan</div>
                <div className="text-2xl font-bold text-orange-700">{overtimeTrends.length}</div>
                <div className="text-xs text-orange-600 mt-1">hari dengan lembur</div>
              </div>
              <div className="p-4 rounded-lg bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200">
                <div className="text-xs text-indigo-600 font-semibold mb-1">Total Jam Lembur</div>
                <div className="text-2xl font-bold text-indigo-700">{totalOvertimeHours.toFixed(1)}</div>
                <div className="text-xs text-indigo-600 mt-1">jam</div>
              </div>
            </div>

            {/* Overtime trends list */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {overtimeTrends.length > 0 ? (
                overtimeTrends.map((trend, i) => {
                  const dateObj = new Date(trend.tanggal);
                  const dateStr = dateObj.toLocaleDateString('id-ID', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  });
                  return (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 border border-slate-100">
                      <span className="text-sm text-slate-700">{dateStr}</span>
                      <div className="flex gap-3 text-sm">
                        <span className="text-orange-600 font-semibold">{trend.count}x</span>
                        <span className="text-indigo-600 font-semibold">{trend.total_hours.toFixed(1)}j</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-4 text-slate-500 text-sm">Belum ada data lembur</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expiring Contracts Section - Full Width */}
      <div className="rounded-lg shadow p-6 dashhrd-card dashhrd-contracts-card">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xl">📋</span>
          <h4 className="dashhrd-title text-lg font-semibold">Kontrak Karyawan Habis (30 Hari)</h4>
        </div>
        <div className="space-y-3">
          {expiringContracts.length > 0 ? (
            expiringContracts.map((contract, i) => {
              const daysLeft = contract.days_left;
              let statusColor = 'bg-green-50 border-green-200';
              let statusTextColor = 'text-green-700';
              let statusBg = 'bg-green-100';
              
              if (daysLeft <= 7) {
                statusColor = 'bg-red-50 border-red-200';
                statusTextColor = 'text-red-700';
                statusBg = 'bg-red-100';
              } else if (daysLeft <= 14) {
                statusColor = 'bg-yellow-50 border-yellow-200';
                statusTextColor = 'text-yellow-700';
                statusBg = 'bg-yellow-100';
              }
              
              return (
                <div key={i} className={`rounded-lg p-4 border ${statusColor} transition-shadow duration-200`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-900">{contract.nama_karyawan}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        📅 {contract.tgl_mulai ? new Date(contract.tgl_mulai).toLocaleDateString('id-ID') : 'N/A'} - {contract.tgl_habis ? new Date(contract.tgl_habis).toLocaleDateString('id-ID') : 'N/A'}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        Jenis: <span className="font-medium">{contract.masa_kontrak}</span>
                      </div>
                    </div>

                    {/* Days Left Badge */}
                    <div className={`flex-shrink-0 px-3 py-2 rounded-lg ${statusBg} flex flex-col items-center`}>
                      <div className={`text-lg font-bold ${statusTextColor}`}>{daysLeft}</div>
                      <div className={`text-xs ${statusTextColor}`}>hari</div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-slate-500">
              <div className="text-sm">✅ Tidak ada kontrak yang akan habis dalam 30 hari ke depan</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
