import React, { useState } from "react";
import { createPortal } from "react-dom";
import { FiX, FiClock, FiCheck } from "react-icons/fi";
import { API_BASE } from "../../api/host";
import "./HRModals.css";

interface HadirModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: any) => void;
}

export default function HadirModal({ isOpen, onClose, onSubmit }: HadirModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [alreadyRecorded, setAlreadyRecorded] = useState(false);

  // Handle ESC key to close modal
  React.useEffect(() => {
    if (!isOpen) return;

    function handleEscKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [isOpen, onClose]);

  const handleHadir = async () => {
    setError("");
    setSuccess(false);
    setAlreadyRecorded(false);
    setLoading(true);

    try {
      const token = localStorage.getItem("authToken") ?? "";
      const today = new Date().toISOString().split("T")[0];
      const now = new Date();
      const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const response = await fetch(`${API_BASE}/absensi`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          tgl_absensi: today,
          status: "hadir",
          keterangan: `Hadir pukul ${timeString}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData?.detail || "Gagal mencatat kehadiran";
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Check if already recorded
      if (data.already_recorded) {
        setAlreadyRecorded(true);
        setTimeout(() => {
          onClose();
          setAlreadyRecorded(false);
        }, 2000);
      } else {
        setSuccess(true);
        onSubmit?.(data);
        
        // Close after short delay to show success
        setTimeout(() => {
          onClose();
          setSuccess(false);
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="hr-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="hr-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="hr-modal-header gradient-hadir">
          <div className="hr-modal-title">
            <FiClock size={28} />
            <div>
              <h2>Catat Kehadiran</h2>
              <p>Registrasi kedatangan Anda hari ini</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="hr-modal-close"
            aria-label="Close modal"
          >
            <FiX size={24} />
          </button>
        </div>

        <div className="hr-modal-form">
          {error && (
            <div className="hr-modal-error">
              <span>⚠️ {error}</span>
            </div>
          )}

          {success && (
            <div className="hr-modal-success">
              <span>✓ Kehadiran tercatat dengan sukses!</span>
            </div>
          )}

          {alreadyRecorded && (
            <div className="hr-modal-info" style={{ backgroundColor: '#e3f2fd', borderLeft: '4px solid #2196F3' }}>
              <span>ℹ️ Anda sudah tercatat hadir hari ini</span>
            </div>
          )}

          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <p style={{ color: '#5a6c7d', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              Klik tombol di bawah untuk mencatat kehadiran Anda hari ini dengan otomatis.
            </p>
          </div>

          <div className="hr-modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="hr-btn hr-btn-secondary"
              disabled={loading}
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleHadir}
              className="hr-btn hr-btn-primary-hadir"
              disabled={loading || success || alreadyRecorded}
            >
              {loading ? "Sedang memproses..." : success ? "✓ Sudah Hadir" : alreadyRecorded ? "✓ Sudah Tercatat" : "Hadir"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
