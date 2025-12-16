import { useState, useEffect } from 'react';
import { API_BASE } from '../../api/host';
import { useAuth } from '../../providers/AuthProvider';
import LoadingSpinner from '../LoadingSpinner';
import { CheckIcon, ClockIcon, CurrencyDollarIcon, ArrowTrendingUpIcon, UsersIcon } from '@heroicons/react/24/outline';
import AnimatedNumber from '../ui/AnimatedNumber';
import '../../styles/ActiveCicilanDashboard.css';

interface ActiveCicilan {
  kd_cicilan: number;
  kd_transaksi: number;
  kd_client: number;
  nama_client: string;
  total_cicilan: number;
  total_amount: number;
  paid_count: number;
  pending_count: number;
  progress_percentage: number;
  tgl_transaksi: string;
}

interface ActiveCicilanDashboardProps {
  limit?: number;
}

export default function ActiveCicilanDashboard({ limit = 50 }: ActiveCicilanDashboardProps) {
  const { accessToken } = useAuth();
  const [activeCicilan, setActiveCicilan] = useState<ActiveCicilan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'progress' | 'amount' | 'customer'>('progress');

  useEffect(() => {
    loadActiveCicilan();
  }, [accessToken]);

  async function loadActiveCicilan() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE}/finance/cicilan/active?limit=${limit}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
      });

      if (!res.ok) {
        throw new Error('Gagal mengambil data cicilan aktif');
      }

      const data = await res.json();
      setActiveCicilan(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Gagal mengambil data cicilan aktif');
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount || 0);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });

  const getSortedData = () => {
    const sorted = [...activeCicilan];
    if (sortBy === 'progress') {
      return sorted.sort((a, b) => a.progress_percentage - b.progress_percentage);
    }
    if (sortBy === 'amount') {
      return sorted.sort((a, b) => b.total_amount - a.total_amount);
    }
    if (sortBy === 'customer') {
      return sorted.sort((a, b) => a.nama_client.localeCompare(b.nama_client));
    }
    return sorted;
  };

  const getProgressColor = (percentage: number) => {
    // Return semantic progress class names (mapped in CSS)
    if (percentage === 0) return 'progress-red';
    if (percentage < 33) return 'progress-orange';
    if (percentage < 66) return 'progress-yellow';
    return 'progress-green';
  };

  const sortedData = getSortedData();
  const totalAmount = activeCicilan.reduce((sum, c) => sum + c.total_amount, 0);
  const totalPaid = activeCicilan.reduce((sum, c) => sum + (c.paid_count * (c.total_amount / c.total_cicilan)), 0);

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-600 p-4">{error}</div>;
  if (activeCicilan.length === 0)
    return (
      <div className="active-cicilan-empty">
        <ClockIcon className="active-cicilan-empty-icon" />
        <div className="active-cicilan-empty-title">Tidak Ada Cicilan Aktif</div>
        <div className="active-cicilan-empty-description">Semua cicilan sudah selesai atau belum ada</div>
      </div>
    );

  return (
    <div className="active-cicilan-container">
      {/* Summary Cards */}
      <div className="active-cicilan-summary">
        <div className="active-cicilan-stat-card">
          <div className="active-cicilan-stat-card-header-row">
            <div className="active-cicilan-stat-label">Total Cicilan Aktif</div>
            <UsersIcon className="active-cicilan-stat-icon" />
          </div>
          <div className="active-cicilan-stat-value"><AnimatedNumber value={activeCicilan.length} duration={700} /></div>
          <div className="active-cicilan-stat-meta">aktif</div>
        </div>

        <div className="active-cicilan-stat-card">
          <div className="active-cicilan-stat-card-header-row">
            <div className="active-cicilan-stat-label">Total Outstanding</div>
            <CurrencyDollarIcon className="active-cicilan-stat-icon" />
          </div>
          <div className="active-cicilan-stat-value-currency"><AnimatedNumber value={Math.round(totalAmount)} duration={900} format={(v)=> new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v)} /></div>
          <div className="active-cicilan-stat-meta">Jumlah terhutang</div>
        </div>

        <div className="active-cicilan-stat-card">
          <div className="active-cicilan-stat-card-header-row">
            <div className="active-cicilan-stat-label">Total Terbayar</div>
            <CheckIcon className="active-cicilan-stat-icon" />
          </div>
          <div className="active-cicilan-stat-value-currency"><AnimatedNumber value={Math.round(totalPaid)} duration={900} format={(v)=> new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v)} /></div>
          <div className="active-cicilan-stat-meta">Sudah dibayar</div>
        </div>

        <div className="active-cicilan-stat-card">
          <div className="active-cicilan-stat-card-header-row">
            <div className="active-cicilan-stat-label">Rata-rata Progress</div>
            <ArrowTrendingUpIcon className="active-cicilan-stat-icon" />
          </div>
          <div className="active-cicilan-stat-value"><AnimatedNumber value={activeCicilan.length > 0 ? Math.round(activeCicilan.reduce((sum, c) => sum + c.progress_percentage, 0) / activeCicilan.length) : 0} duration={700} />%</div>
          <div className="active-cicilan-stat-meta">rata-rata penyelesaian</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="active-cicilan-toolbar">
        <div className="active-cicilan-sort-label">Urutkan:</div>
        <div className="active-cicilan-sort-buttons">
          <button
            onClick={() => setSortBy('progress')}
            className={`active-cicilan-sort-btn ${sortBy === 'progress' ? 'active' : ''}`}
          >
            Progress
          </button>
          <button
            onClick={() => setSortBy('amount')}
            className={`active-cicilan-sort-btn ${sortBy === 'amount' ? 'active' : ''}`}
          >
            Jumlah
          </button>
          <button
            onClick={() => setSortBy('customer')}
            className={`active-cicilan-sort-btn ${sortBy === 'customer' ? 'active' : ''}`}
          >
            Customer
          </button>
        </div>
      </div>

      {/* Card Grid */}
      <div className="active-cicilan-cards-grid">
        {sortedData.map(cicilan => (
          <div key={cicilan.kd_cicilan} className="active-cicilan-card">
            {/* Header */}
            <div className="active-cicilan-card-header">
              <div className="active-cicilan-card-header-top">
                <div>
                  <div className="active-cicilan-card-number">Cicilan #{cicilan.kd_cicilan}</div>
                  <div className="active-cicilan-card-name">{cicilan.nama_client}</div>
                </div>
                <div className="active-cicilan-card-progress">
                  <div className="active-cicilan-card-progress-value">{cicilan.progress_percentage}%</div>
                  <div className="active-cicilan-card-progress-label">selesai</div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="active-cicilan-card-content">
              {/* Progress Bar */}
              <div className="active-cicilan-progress-section">
                <div className="active-cicilan-progress-header">
                  <span className="active-cicilan-progress-label">Progress Pembayaran</span>
                  <span className="active-cicilan-progress-counter">
                    {cicilan.paid_count} / {cicilan.total_cicilan}
                  </span>
                </div>
                <div className="active-cicilan-progress-bar">
                  <div
                    className={`active-cicilan-progress-fill ${getProgressColor(cicilan.progress_percentage).replace('bg-', 'progress-')}`}
                    style={{ width: `${cicilan.progress_percentage}%` }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="active-cicilan-stats-grid">
                <div className="active-cicilan-stat-item">
                  <div className="active-cicilan-stat-item-label">Total Cicilan</div>
                  <div className="active-cicilan-stat-item-value">{formatCurrency(cicilan.total_amount)}</div>
                </div>
                <div className="active-cicilan-stat-item">
                  <div className="active-cicilan-stat-item-label">Tanggal Transaksi</div>
                  <div className="active-cicilan-stat-item-value">{formatDate(cicilan.tgl_transaksi)}</div>
                </div>
              </div>

              {/* Status */}
              <div className={`active-cicilan-status ${cicilan.progress_percentage === 100 ? 'status-completed' : 'status-pending'}`}>
                {cicilan.progress_percentage === 100 ? (
                  <>
                    <CheckIcon className="active-cicilan-status-icon" />
                    <span>Selesai</span>
                  </>
                ) : (
                  <>
                    <ClockIcon className="active-cicilan-status-icon" />
                    <span>{cicilan.pending_count} cicilan belum dibayar</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
