import { useState, useEffect } from 'react';
import { API_BASE } from '../../api/host';
import { useAuth } from '../../providers/AuthProvider';
import LoadingSpinner from '../LoadingSpinner';
import { CheckCircleIcon, ExclamationTriangleIcon, ShieldExclamationIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface CreditProfile {
  kd_client: number;
  nama_client: string;
  credit_limit: number;
  total_outstanding: number;
  available_credit: number;
  payment_score: number;
  total_transaksi: number;
  total_bayar_tepat: number;
  total_telat: number;
  is_blacklist: boolean;
  alasan_blacklist: string | null;
  ontime_percentage: number;
}

interface CustomerCreditProfileProps {
  kd_client: number;
}

export default function CustomerCreditProfile({ kd_client }: CustomerCreditProfileProps) {
  const { accessToken } = useAuth();
  const [profile, setProfile] = useState<CreditProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCreditProfile();
  }, [kd_client, accessToken]);

  async function loadCreditProfile() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE}/finance/customer-credit/profile/${kd_client}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
      });

      if (!res.ok) {
        throw new Error('Gagal mengambil profil kredit');
      }

      const data = await res.json();
      setProfile(data.data || null);
    } catch (err: any) {
      setError(err.message || 'Gagal mengambil profil kredit');
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount || 0);

  const getScoreBadge = (score: number) => {
    if (score >= 90) {
      return (
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-3xl font-bold text-green-600">{score.toFixed(1)}</div>
            <div className="text-xs text-gray-500">Excellent</div>
          </div>
          <CheckCircleIcon className="w-12 h-12 text-green-500" />
        </div>
      );
    }
    if (score >= 70) {
      return (
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600">{score.toFixed(1)}</div>
            <div className="text-xs text-gray-500">Good</div>
          </div>
          <CheckCircleIcon className="w-12 h-12 text-blue-500" />
        </div>
      );
    }
    if (score >= 50) {
      return (
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-3xl font-bold text-yellow-600">{score.toFixed(1)}</div>
            <div className="text-xs text-gray-500">Fair</div>
          </div>
          <ExclamationTriangleIcon className="w-12 h-12 text-yellow-500" />
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="text-3xl font-bold text-red-600">{score.toFixed(1)}</div>
          <div className="text-xs text-gray-500">Poor</div>
        </div>
        <ShieldExclamationIcon className="w-12 h-12 text-red-500" />
      </div>
    );
  };

  const getCreditUtilization = () => {
    if (!profile) return 0;
    return (profile.total_outstanding / profile.credit_limit) * 100;
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-600 p-4">{error}</div>;
  if (!profile) return <div className="text-gray-500 p-4">Profil kredit tidak ditemukan</div>;

  const creditUtilization = getCreditUtilization();
  const creditUtilizationColor = creditUtilization > 80 ? 'text-red-600' : creditUtilization > 60 ? 'text-yellow-600' : 'text-green-600';

  return (
    <div className="space-y-6">
      {/* Blacklist Warning */}
      {profile.is_blacklist && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <ShieldExclamationIcon className="w-6 h-6 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-bold text-red-800">⚠️ Customer Blacklist</div>
              <div className="text-sm text-red-700 mt-1">{profile.alasan_blacklist || 'Alasan tidak tersedia'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Profile Card */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 border border-blue-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Payment Score */}
          <div className="flex items-center justify-center p-4 bg-white rounded-lg shadow">
            {getScoreBadge(profile.payment_score)}
          </div>

          {/* Credit Info */}
          <div className="space-y-4 bg-white rounded-lg shadow p-4">
            <div>
              <div className="text-sm font-medium text-gray-500">Credit Limit</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(profile.credit_limit)}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Outstanding</div>
              <div className="text-2xl font-bold text-orange-600 mt-1">{formatCurrency(profile.total_outstanding)}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Available Credit</div>
              <div className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(profile.available_credit)}</div>
            </div>
          </div>

          {/* Payment Stats */}
          <div className="space-y-4 bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">On-Time Rate</span>
              <span className="text-2xl font-bold text-green-600">{profile.ontime_percentage.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Total Transaksi</span>
              <span className="text-2xl font-bold text-blue-600">{profile.total_transaksi}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Tepat Waktu</span>
              <span className="text-2xl font-bold text-green-600">{profile.total_bayar_tepat}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Telat</span>
              <span className="text-2xl font-bold text-red-600">{profile.total_telat}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Credit Utilization Bar */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-gray-900">Credit Utilization</div>
          <div className={`text-lg font-bold ${creditUtilizationColor}`}>
            {creditUtilization.toFixed(1)}%
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full transition-all ${
              creditUtilization > 80
                ? 'bg-red-500'
                : creditUtilization > 60
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(creditUtilization, 100)}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 mt-2">
          {formatCurrency(profile.total_outstanding)} dari {formatCurrency(profile.credit_limit)} limit
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="w-8 h-8 text-green-600" />
            <div>
              <div className="text-sm font-medium text-gray-600">Payment Status</div>
              <div className="text-lg font-bold text-green-700 mt-1">
                {profile.total_telat === 0 ? 'Excellent ✓' : 'Need Attention'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center gap-3">
            <SparklesIcon className="w-8 h-8 text-blue-600" />
            <div>
              <div className="text-sm font-medium text-gray-600">Credit Score</div>
              <div className="text-lg font-bold text-blue-700 mt-1">{profile.payment_score.toFixed(0)}/100</div>
            </div>
          </div>
        </div>

        <div className={`rounded-lg shadow p-4 border-l-4 ${profile.is_blacklist ? 'bg-red-50 border-red-500' : 'bg-green-50 border-green-500'}`}>
          <div className="flex items-center gap-3">
            {profile.is_blacklist ? (
              <ShieldExclamationIcon className="w-8 h-8 text-red-600" />
            ) : (
              <CheckCircleIcon className="w-8 h-8 text-green-600" />
            )}
            <div>
              <div className="text-sm font-medium text-gray-600">Status</div>
              <div className={`text-lg font-bold mt-1 ${profile.is_blacklist ? 'text-red-700' : 'text-green-700'}`}>
                {profile.is_blacklist ? 'Blacklisted' : 'Active ✓'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
