import React, { useState, useEffect } from 'react';
import { FiCheck, FiX, FiAlertCircle } from 'react-icons/fi';
import './ApprovalCutiModal.css';

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

interface ApprovalCutiModalProps {
  cuti: CutiRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (kd_cuti: number, notes: string) => Promise<void>;
  onReject: (kd_cuti: number, notes: string) => Promise<void>;
}

export default function ApprovalCutiModal({
  cuti,
  isOpen,
  onClose,
  onApprove,
  onReject,
}: ApprovalCutiModalProps) {
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setRejectionNotes('');
      setApprovalNotes('');
      setActionType(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  const handleApprove = async () => {
    if (cuti) {
      setActionType('approve');
      setLoading(true);
      try {
        await onApprove(cuti.kd_cuti, approvalNotes);
        setApprovalNotes('');
        onClose();
      } catch (error) {
        console.error('Error approving cuti:', error);
      } finally {
        setActionType(null);
        setLoading(false);
      }
    }
  };

  const handleReject = async () => {
    if (!rejectionNotes.trim()) {
      alert('Alasan penolakan harus diisi');
      return;
    }
    if (cuti) {
      setActionType('reject');
      setLoading(true);
      try {
        await onReject(cuti.kd_cuti, rejectionNotes);
        setRejectionNotes('');
        onClose();
      } catch (error) {
        console.error('Error rejecting cuti:', error);
      } finally {
        setActionType(null);
        setLoading(false);
      }
    }
  };

  if (!isOpen || !cuti) return null;

  const startDate = new Date(cuti.tgl_mulai);
  const endDate = new Date(cuti.tgl_selesai);

  return (
    <div className="approval-cuti-modal-overlay" onClick={onClose}>
      <div className="approval-cuti-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Persetujuan Pengajuan Cuti</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal-body">
          {/* Karyawan Info */}
          <div className="info-section">
            <div className="info-card">
              <h3>{cuti.nama_karyawan}</h3>
              <p className="jabatan">{cuti.jabatan}</p>
              <p className="submitted">Diajukan: {new Date(cuti.created_at).toLocaleString('id-ID')}</p>
            </div>
          </div>

          {/* Cuti Details */}
          <div className="details-section">
            <div className="detail-row">
              <label>Tanggal Mulai:</label>
              <span>{startDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <div className="detail-row">
              <label>Tanggal Selesai:</label>
              <span>{endDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <div className="detail-row">
              <label>Durasi:</label>
              <span className="durasi-badge">{cuti.durasi_hari} hari</span>
            </div>
          </div>

          {/* Alasan */}
          <div className="alasan-section">
            <label>Alasan Cuti:</label>
            <div className="alasan-text">{cuti.alasan}</div>
          </div>

          {/* Approval Actions */}
          <div className="actions-section">
            {/* Approve Section */}
            <div className="action-box approve-box">
              <div className="action-header">
                <FiCheck size={20} />
                <h4>Setujui Cuti</h4>
              </div>
              <textarea
                placeholder="Catatan persetujuan (opsional)"
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                disabled={loading}
                className="approval-notes"
              />
              <button
                className="action-btn approve-btn"
                onClick={handleApprove}
                disabled={loading}
              >
                {loading && actionType === 'approve' ? 'Memproses...' : 'Setujui'}
              </button>
            </div>

            {/* Reject Section */}
            <div className="action-box reject-box">
              <div className="action-header">
                <FiX size={20} />
                <h4>Tolak Cuti</h4>
              </div>
              <textarea
                placeholder="Alasan penolakan (wajib diisi)"
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                disabled={loading}
                className="rejection-notes"
              />
              <button
                className="action-btn reject-btn"
                onClick={handleReject}
                disabled={loading || !rejectionNotes.trim()}
              >
                {loading && actionType === 'reject' ? 'Memproses...' : 'Tolak'}
              </button>
            </div>
          </div>

          {/* Warning */}
          <div className="warning-box">
            <FiAlertCircle size={16} />
            <span>Keputusan ini akan dikirimkan sebagai notifikasi kepada karyawan.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
