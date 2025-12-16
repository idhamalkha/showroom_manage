import { useState, useEffect } from 'react';
import { API_BASE } from '../../api/host';
import { useAuth } from '../../providers/AuthProvider';
import LoadingSpinner from '../LoadingSpinner';
import { ArrowTrendingUpIcon, ChartBarIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import AnimatedNumber from '../ui/AnimatedNumber';
import '../../styles/CicilanReportDashboard.css';

interface CicilanStats {
  totalCicilan: number;
  totalOutstanding: number;
  totalPaid: number;
  overdueCicilan: number;
  collectionRate: number;
  averageProgressPercentage: number;
}

export default function CicilanReportDashboard() {
  const { accessToken } = useAuth();
  const [stats, setStats] = useState<CicilanStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agingBreakdown, setAgingBreakdown] = useState<any>(null);

  useEffect(() => {
    loadReportData();
  }, [accessToken]);

  async function loadReportData() {
    try {
      setLoading(true);
      setError(null);

      const headers: HeadersInit = accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : {};

      // Load active and overdue data
      const [activeRes, overdueRes] = await Promise.all([
        fetch(`${API_BASE}/finance/cicilan/active?limit=1000`, { headers }),
        fetch(`${API_BASE}/finance/cicilan/overdue?limit=1000`, { headers })
      ]);

      if (!activeRes.ok || !overdueRes.ok) {
        throw new Error('Gagal mengambil data laporan');
      }

      const activeData = await activeRes.json();
      const overdueData = await overdueRes.json();

      const activeCicilan = activeData.data || [];
      const overdueCicilan = overdueData.data || [];

      // Calculate stats
      const totalOutstanding = activeCicilan.reduce((sum: number, c: any) => sum + c.total_amount, 0);
      const totalPaid = activeCicilan.reduce((sum: number, c: any) => {
        return sum + (c.paid_count * (c.total_amount / c.total_cicilan));
      }, 0);
      const averageProgress = activeCicilan.length > 0 
        ? Math.round(activeCicilan.reduce((sum: number, c: any) => sum + c.progress_percentage, 0) / activeCicilan.length)
        : 0;

      setStats({
        totalCicilan: activeCicilan.length,
        totalOutstanding,
        totalPaid,
        overdueCicilan: overdueCicilan.length,
        collectionRate: totalOutstanding > 0 ? Math.round((totalPaid / (totalPaid + totalOutstanding)) * 100) : 0,
        averageProgressPercentage: averageProgress
      });

      // Build aging breakdown
      const agingBuckets = {
        upTo30: overdueCicilan.filter((o: any) => o.days_overdue <= 30).length,
        '30to60': overdueCicilan.filter((o: any) => o.days_overdue > 30 && o.days_overdue <= 60).length,
        '60to90': overdueCicilan.filter((o: any) => o.days_overdue > 60 && o.days_overdue <= 90).length,
        above90: overdueCicilan.filter((o: any) => o.days_overdue > 90).length
      };
      setAgingBreakdown(agingBuckets);
    } catch (err: any) {
      setError(err.message || 'Gagal mengambil data laporan');
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount || 0);

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-600 p-4">{error}</div>;

  return (
    <div className="cicilan-report-container">
      {/* Main KPIs */}
      <div className="cicilan-report-kpi-grid">
        <div className="cicilan-report-kpi-card">
          <div className="cicilan-report-kpi-header-row">
            <div className="cicilan-report-kpi-label">Total Cicilan Aktif</div>
            <ChartBarIcon className="cicilan-report-kpi-icon-sm" />
          </div>
          <div className="cicilan-report-kpi-value"><AnimatedNumber value={stats?.totalCicilan || 0} duration={700} /></div>
          <div className="cicilan-report-kpi-meta">cicilan berjalan</div>
        </div>

        <div className="cicilan-report-kpi-card">
          <div className="cicilan-report-kpi-header-row">
            <div className="cicilan-report-kpi-label">Total Outstanding</div>
            <ArrowTrendingUpIcon className="cicilan-report-kpi-icon-sm" />
          </div>
          <div className="cicilan-report-kpi-value-currency"><AnimatedNumber value={Math.round(stats?.totalOutstanding || 0)} duration={900} format={(v)=> new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v)} /></div>
          <div className="cicilan-report-kpi-meta">total terhutang</div>
        </div>

        <div className="cicilan-report-kpi-card">
          <div className="cicilan-report-kpi-header-row">
            <div className="cicilan-report-kpi-label">Collection Rate</div>
            <CheckCircleIcon className="cicilan-report-kpi-icon-sm" />
          </div>
          <div className="cicilan-report-kpi-value"><AnimatedNumber value={stats?.collectionRate || 0} duration={700} />%</div>
          <div className="cicilan-report-kpi-meta">tingkat koleksi</div>
        </div>

        <div className="cicilan-report-kpi-card">
          <div className="cicilan-report-kpi-header-row">
            <div className="cicilan-report-kpi-label">Cicilan Overdue</div>
            <ExclamationTriangleIcon className="cicilan-report-kpi-icon-sm" />
          </div>
          <div className="cicilan-report-kpi-value"><AnimatedNumber value={stats?.overdueCicilan || 0} duration={700} /></div>
          <div className="cicilan-report-kpi-meta">yang tertunggak</div>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="cicilan-report-stats-grid">
        {/* Payment Summary */}
        <div className="cicilan-report-panel">
          <h3 className="cicilan-report-panel-title">💳 Ringkasan Pembayaran</h3>
          <div>
            <div className="cicilan-report-stat-row">
              <span className="cicilan-report-stat-label">Total Outstanding</span>
              <span className="cicilan-report-stat-value">{formatCurrency(stats?.totalOutstanding || 0)}</span>
            </div>
            <div className="cicilan-report-stat-row">
              <span className="cicilan-report-stat-label">Total Terbayar</span>
              <span className="cicilan-report-stat-value color-green">{formatCurrency(stats?.totalPaid || 0)}</span>
            </div>
            <div className="cicilan-report-stat-row">
              <span className="cicilan-report-stat-label">Rata-rata Progress</span>
              <span className="cicilan-report-stat-value color-blue">{stats?.averageProgressPercentage}%</span>
            </div>
          </div>
        </div>

        {/* Aging Breakdown */}
        <div className="cicilan-report-panel">
          <h3 className="cicilan-report-panel-title">📊 Breakdown Overdue</h3>
          <div className="cicilan-report-aging-grid">
            <div className="cicilan-report-aging-item">
              <div className="cicilan-report-aging-info">
                <div className="cicilan-report-aging-indicator yellow"></div>
                <span className="cicilan-report-aging-label">Sampai 30 hari</span>
              </div>
              <span className="cicilan-report-aging-count">{agingBreakdown?.upTo30}</span>
            </div>
            <div className="cicilan-report-aging-item">
              <div className="cicilan-report-aging-info">
                <div className="cicilan-report-aging-indicator orange"></div>
                <span className="cicilan-report-aging-label">30-60 hari</span>
              </div>
              <span className="cicilan-report-aging-count">{agingBreakdown?.['30to60']}</span>
            </div>
            <div className="cicilan-report-aging-item">
              <div className="cicilan-report-aging-info">
                <div className="cicilan-report-aging-indicator red"></div>
                <span className="cicilan-report-aging-label">60-90 hari</span>
              </div>
              <span className="cicilan-report-aging-count">{agingBreakdown?.['60to90']}</span>
            </div>
            <div className="cicilan-report-aging-item">
              <div className="cicilan-report-aging-info">
                <div className="cicilan-report-aging-indicator dark-red"></div>
                <span className="cicilan-report-aging-label">Lebih dari 90 hari</span>
              </div>
              <span className="cicilan-report-aging-count">{agingBreakdown?.above90}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="cicilan-report-insights">
        <h3 className="cicilan-report-insights-title">📊 Insights</h3>
        <ul className="cicilan-report-insights-list">
          <li className="cicilan-report-insights-item">Tingkat koleksi saat ini: <strong>{stats?.collectionRate}%</strong></li>
          <li className="cicilan-report-insights-item">Ada <strong>{stats?.overdueCicilan}</strong> cicilan yang belum dibayar sesuai jadwal</li>
          <li className="cicilan-report-insights-item">Rata-rata cicilan sudah terbayar: <strong>{stats?.averageProgressPercentage}%</strong></li>
          {stats && stats.overdueCicilan > 5 && (
            <li className="cicilan-report-insights-item">⚠️ Perlu perhatian khusus untuk menagih <strong>{stats.overdueCicilan}</strong> cicilan overdue</li>
          )}
        </ul>
      </div>
    </div>
  );
}
