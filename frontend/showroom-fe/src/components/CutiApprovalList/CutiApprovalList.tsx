import React, { useEffect, useState } from 'react';
import { FiCheck, FiX, FiClock, FiAlertCircle } from 'react-icons/fi';
import './CutiApprovalList.css';

interface CutiRequest {
  kd_cuti: number;
  kd_karyawan: number;
  nama_karyawan: string;
  jabatan: string;
  tgl_mulai: string;
  tgl_selesai: string;
  durasi_hari: number;
  alasan: string;
  status: string;
  created_at: string;
}

interface CutiApprovalListProps {
  onSelectCuti: (cuti: CutiRequest) => void;
  token: string | null;
}

export default function CutiApprovalList({ onSelectCuti, token }: CutiApprovalListProps) {
  const [cutiList, setCutiList] = useState<CutiRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPendingCuti();
    const interval = setInterval(fetchPendingCuti, 15000); // Refresh every 15 seconds
    return () => clearInterval(interval);
  }, [token]);

  const fetchPendingCuti = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/hrd/cuti/pending', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Gagal mengambil data cuti');

      const data = await response.json();
      setCutiList(data.data || []);
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
      <div className="cuti-approval-list">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Memuat permintaan cuti...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cuti-approval-list">
        <div className="error-state">
          <FiAlertCircle size={32} />
          <p>{error}</p>
          <button onClick={fetchPendingCuti} className="retry-btn">Coba Lagi</button>
        </div>
      </div>
    );
  }

  if (cutiList.length === 0) {
    return (
      <div className="cuti-approval-list">
        <div className="empty-state">
          <FiCheck size={48} />
          <h3>Tidak Ada Permintaan Menunggu</h3>
          <p>Semua permintaan cuti telah diproses</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cuti-approval-list">
      <div className="list-header">
        <h3>Permintaan Cuti Menunggu Persetujuan</h3>
        <span className="count-badge">{cutiList.length}</span>
      </div>

      <div className="cuti-items">
        {cutiList.map((cuti) => (
          <div key={cuti.kd_cuti} className="cuti-card">
            <div className="card-left">
              <div className="card-status">
                <FiClock size={20} />
              </div>
            </div>

            <div className="card-middle">
              <h4 className="employee-name">{cuti.nama_karyawan}</h4>
              <p className="employee-jabatan">{cuti.jabatan}</p>

              <div className="cuti-details">
                <span className="detail">
                  <strong>{formatDate(cuti.tgl_mulai)}</strong> - <strong>{formatDate(cuti.tgl_selesai)}</strong>
                </span>
                <span className="duration-badge">{cuti.durasi_hari} hari</span>
              </div>

              <p className="reason-title">Alasan:</p>
              <p className="reason-text">{cuti.alasan}</p>

              <p className="submitted-time">
                Diajukan: {new Date(cuti.created_at).toLocaleString('id-ID')}
              </p>
            </div>

            <div className="card-right">
              <button
                className="action-btn approve-btn"
                onClick={() => onSelectCuti(cuti)}
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
