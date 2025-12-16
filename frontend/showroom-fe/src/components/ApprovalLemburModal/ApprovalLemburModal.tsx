import React, { useState, useEffect } from 'react';
import { FiCheck, FiX, FiAlertCircle } from 'react-icons/fi';
import './ApprovalLemburModal.css';

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

interface ApprovalLemburModalProps {
  lembur: LemburRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (kd_lembur: number, notes: string) => Promise<void>;
  onReject: (kd_lembur: number, notes: string) => Promise<void>;
}

export default function ApprovalLemburModal({
  lembur,
  isOpen,
  onClose,
  onApprove,
  onReject,
}: ApprovalLemburModalProps) {
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
    if (lembur) {
      setActionType('approve');
      setLoading(true);
      try {
        await onApprove(lembur.kd_lembur, approvalNotes);
        setApprovalNotes('');
        onClose();
      } catch (error) {
        console.error('Error approving lembur:', error);
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
    if (lembur) {
      setActionType('reject');
      setLoading(true);
      try {
        await onReject(lembur.kd_lembur, rejectionNotes);
        setRejectionNotes('');
        onClose();
      } catch (error) {
        console.error('Error rejecting lembur:', error);
      } finally {
        setActionType(null);
        setLoading(false);
      }
    }
  };

  if (!isOpen || !lembur) return null;

  const lemburDate = new Date(lembur.tgl_lembur);

  return (
    <div className="approval-lembur-modal-overlay" onClick={onClose}>
      <div className="approval-lembur-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Persetujuan Pengajuan Lembur</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal-body">
          {/* Karyawan Info */}
          <div className="info-section">
            <div className="info-card">
              <h3>{lembur.nama_karyawan}</h3>
              <p className="jabatan">{lembur.jabatan}</p>
              <p className="submitted">Diajukan: {new Date(lembur.created_at).toLocaleString('id-ID')}</p>
            </div>
          </div>

          {/* Lembur Details */}
          <div className="details-section">
            <div className="detail-row">
              <label>Tanggal Lembur:</label>
              <span>{lemburDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <div className="detail-row">
              <label>Durasi Lembur:</label>
              <span className="durasi-badge">{lembur.jam_lembur} jam</span>
            </div>
          </div>

          {/* Alasan */}
          <div className="alasan-section">
            <label>Alasan Lembur:</label>
            <div className="alasan-text">{lembur.alasan || '-'}</div>
          </div>

          {/* Approval Actions */}
          <div className="actions-section">
            {/* Approve Section */}
            <div className="action-box approve-box">
              <div className="action-header">
                <FiCheck size={20} />
                <h4>Setujui Lembur</h4>
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
                <h4>Tolak Lembur</h4>
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
