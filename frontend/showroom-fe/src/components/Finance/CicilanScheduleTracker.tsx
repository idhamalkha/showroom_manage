import { useState, useEffect } from 'react';
import { API_BASE } from '../../api/host';
import { useAuth } from '../../providers/AuthProvider';
import LoadingSpinner from '../LoadingSpinner';
import { CheckCircleIcon, ExclamationTriangleIcon, ClockIcon } from '@heroicons/react/24/outline';

interface CicilanSchedule {
  kd_schedule: number;
  nomor_cicilan: number;
  jumlah: number;
  tgl_jatuh_tempo: string;
  status: 'pending' | 'paid' | 'overdue' | 'skipped';
  tgl_pembayaran: string | null;
  is_overdue: boolean;
}

interface CicilanScheduleTrackerProps {
  kd_cicilan: number;
  nomor_cicilan?: number;
}

export default function CicilanScheduleTracker({ kd_cicilan }: CicilanScheduleTrackerProps) {
  const { accessToken } = useAuth();
  const [schedules, setSchedules] = useState<CicilanSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSchedules();
  }, [kd_cicilan, accessToken]);

  async function loadSchedules() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE}/finance/cicilan/schedule/${kd_cicilan}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
      });

      if (!res.ok) {
        throw new Error('Gagal mengambil jadwal cicilan');
      }

      const data = await res.json();
      setSchedules(data.schedules || []);
    } catch (err: any) {
      setError(err.message || 'Gagal mengambil jadwal cicilan');
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

  const getStatusBadge = (status: string, is_overdue: boolean) => {
    if (status === 'paid') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
          <CheckCircleIcon className="w-4 h-4" /> Sudah Bayar
        </span>
      );
    }
    if (is_overdue) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
          <ExclamationTriangleIcon className="w-4 h-4" /> Overdue
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
        <ClockIcon className="w-4 h-4" /> Pending
      </span>
    );
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-600 p-4">{error}</div>;

  const totalSchedules = schedules.length;
  const paidCount = schedules.filter(s => s.status === 'paid').length;
  const overdueCount = schedules.filter(s => s.is_overdue).length;
  const totalAmount = schedules.reduce((sum, s) => sum + (s.jumlah || 0), 0);
  const paidAmount = schedules.filter(s => s.status === 'paid').reduce((sum, s) => sum + (s.jumlah || 0), 0);
  const remainingAmount = totalAmount - paidAmount;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Cicilan */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="text-sm font-medium text-gray-500">Total Cicilan</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{totalSchedules}</div>
          <div className="text-xs text-gray-500 mt-1">{formatCurrency(totalAmount)}</div>
        </div>

        {/* Sudah Bayar */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="text-sm font-medium text-gray-500">Sudah Bayar</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{paidCount}</div>
          <div className="text-xs text-gray-500 mt-1">{formatCurrency(paidAmount)}</div>
        </div>

        {/* Sisa Cicilan */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="text-sm font-medium text-gray-500">Sisa Cicilan</div>
          <div className="text-2xl font-bold text-yellow-600 mt-1">{totalSchedules - paidCount}</div>
          <div className="text-xs text-gray-500 mt-1">{formatCurrency(remainingAmount)}</div>
        </div>

        {/* Overdue */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="text-sm font-medium text-gray-500">Overdue</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{overdueCount}</div>
          <div className="text-xs text-gray-500 mt-1">Butuh Follow-up</div>
        </div>
      </div>

      {/* Schedules Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Cicilan Ke</th>
                <th className="px-4 py-3 text-right font-semibold">Jumlah</th>
                <th className="px-4 py-3 text-left font-semibold">Jatuh Tempo</th>
                <th className="px-4 py-3 text-left font-semibold">Tgl Pembayaran</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {schedules.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    Belum ada jadwal cicilan
                  </td>
                </tr>
              ) : (
                schedules.map((schedule) => (
                  <tr key={schedule.kd_schedule} className="border-b hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium">#{schedule.nomor_cicilan}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(schedule.jumlah)}</td>
                    <td className="px-4 py-3">
                      <span className={schedule.is_overdue ? 'text-red-600 font-medium' : ''}>
                        {formatDate(schedule.tgl_jatuh_tempo)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {schedule.tgl_pembayaran ? formatDate(schedule.tgl_pembayaran) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(schedule.status, schedule.is_overdue)}
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
