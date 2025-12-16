import React, { useEffect, useState } from 'react';
import { FiCheck, FiX, FiClock, FiAlertCircle } from 'react-icons/fi';
import './LemburApprovalList.css';

interface LemburRequest {
  kd_lembur: number;
  kd_karyawan: number;
  nama_karyawan: string;
  jabatan: string;
  tgl_lembur: string;
  jam_lembur: number;
  alasan: string;
  status: string;
  created_at: string;
}

interface LemburApprovalListProps {
  onSelectLembur: (lembur: LemburRequest) => void;
  token: string | null;
}

export default function LemburApprovalList({ onSelectLembur, token }: LemburApprovalListProps) {
  const [lemburList, setLemburList] = useState<LemburRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPendingLembur();
    const interval = setInterval(fetchPendingLembur, 15000); // Refresh every 15 seconds
    return () => clearInterval(interval);
  }, [token]);

  const fetchPendingLembur = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/hrd/lembur/pending', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Gagal mengambil data lembur');

      const data = await response.json();
      setLemburList(data.data || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="lembur-approval-list">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Memuat permintaan lembur...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lembur-approval-list">
        <div className="error-state">
          <FiAlertCircle size={32} />
          <p>{error}</p>
          <button onClick={fetchPendingLembur} className="retry-btn">Coba Lagi</button>
        </div>
      </div>
    );
  }

  if (lemburList.length === 0) {
    return (
      <div className="lembur-approval-list">
        <div className="empty-state">
          <FiCheck size={48} />
          <h3>Tidak Ada Permintaan Menunggu</h3>
          <p>Semua permintaan lembur telah diproses</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lembur-approval-list">
      <div className="list-header">
        <h3>Permintaan Lembur Menunggu Persetujuan</h3>
        <span className="count-badge">{lemburList.length}</span>
      </div>

      <div className="lembur-items">
        {lemburList.map((lembur) => (
          <div key={lembur.kd_lembur} className="lembur-card">
            <div className="card-left">
              <div className="card-status">
                <FiClock size={20} />
              </div>
            </div>

            <div className="card-middle">
              <h4 className="employee-name">{lembur.nama_karyawan}</h4>
              <p className="employee-jabatan">{lembur.jabatan}</p>

              <div className="lembur-details">
                <span className="detail">
                  <strong>{formatDate(lembur.tgl_lembur)}</strong>
                </span>
                <span className="duration-badge">{lembur.jam_lembur} jam</span>
              </div>

              <p className="reason-title">Alasan:</p>
              <p className="reason-text">{lembur.alasan || '-'}</p>

              <p className="submitted-time">
                Diajukan: {new Date(lembur.created_at).toLocaleString('id-ID')}
              </p>
            </div>

            <div className="card-right">
              <button
                className="action-btn approve-btn"
                onClick={() => onSelectLembur(lembur)}
                title="Lihat detail dan setujui/tolak"
              >
                <FiCheck size={18} />
                Proses
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
