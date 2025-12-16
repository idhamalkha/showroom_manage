import { useState, useEffect } from 'react';
import { API_BASE } from '../../api/host';
import { useAuth } from '../../providers/AuthProvider';
import LoadingSpinner from '../LoadingSpinner';
import { CheckCircleIcon, ExclamationTriangleIcon, ClockIcon } from '@heroicons/react/24/outline';

interface PaymentRecord {
  kd_schedule: number;
  nomor_cicilan: number;
  jumlah: number;
  tgl_jatuh_tempo: string;
  tgl_pembayaran: string | null;
  status: 'pending' | 'paid' | 'overdue';
  days_late: number;
  kd_transaksi: number;
}

interface CustomerPaymentHistoryProps {
  kd_client: number;
  limit?: number;
}

export default function CustomerPaymentHistory({ kd_client, limit = 50 }: CustomerPaymentHistoryProps) {
  const { accessToken } = useAuth();
  const [history, setHistory] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPaymentHistory();
  }, [kd_client, accessToken]);

  async function loadPaymentHistory() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE}/finance/customer-credit/payment-history/${kd_client}?limit=${limit}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
      });

      if (!res.ok) {
        throw new Error('Gagal mengambil riwayat pembayaran');
      }

      const data = await res.json();
      setHistory(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Gagal mengambil riwayat pembayaran');
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount || 0);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string, days_late: number) => {
    if (status === 'paid') {
      if (days_late === 0) {
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
            <CheckCircleIcon className="w-4 h-4" /> Tepat Waktu
          </span>
        );
      } else {
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
            <ExclamationTriangleIcon className="w-4 h-4" /> Telat {days_late} hari
          </span>
        );
      }
    }
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
        <ClockIcon className="w-4 h-4" /> Pending
      </span>
    );
  };

  // Calculate stats
  const totalRecords = history.length;
  const paidOnTime = history.filter(h => h.status === 'paid' && h.days_late === 0).length;
  const paidLate = history.filter(h => h.status === 'paid' && h.days_late > 0).length;
  const stillPending = history.filter(h => h.status === 'pending').length;
  const ontimePercentage = totalRecords > 0 ? ((paidOnTime / totalRecords) * 100).toFixed(1) : '0';

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-600 p-4">{error}</div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="text-sm font-medium text-gray-500">Total Riwayat</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{totalRecords}</div>
          <div className="text-xs text-gray-500 mt-1">Cicilan</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="text-sm font-medium text-gray-500">Tepat Waktu</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{paidOnTime}</div>
          <div className="text-xs text-gray-500 mt-1">{ontimePercentage}%</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="text-sm font-medium text-gray-500">Telat</div>
          <div className="text-2xl font-bold text-orange-600 mt-1">{paidLate}</div>
          <div className="text-xs text-gray-500 mt-1">Pembayaran</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="text-sm font-medium text-gray-500">Pending</div>
          <div className="text-2xl font-bold text-yellow-600 mt-1">{stillPending}</div>
          <div className="text-xs text-gray-500 mt-1">Cicilan</div>
        </div>
      </div>

      {/* Payment History Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Cicilan</th>
                <th className="px-4 py-3 text-right font-semibold">Jumlah</th>
                <th className="px-4 py-3 text-left font-semibold">Jatuh Tempo</th>
                <th className="px-4 py-3 text-left font-semibold">Tgl Bayar</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    Belum ada riwayat pembayaran
                  </td>
                </tr>
              ) : (
                history.map((record) => (
                  <tr key={record.kd_schedule} className="border-b hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium">#{record.nomor_cicilan}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(record.jumlah)}</td>
                    <td className="px-4 py-3">{formatDate(record.tgl_jatuh_tempo)}</td>
                    <td className="px-4 py-3">
                      {record.tgl_pembayaran ? formatDate(record.tgl_pembayaran) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(record.status, record.days_late)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
