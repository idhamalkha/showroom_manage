import React, { useState } from "react";
import { createPortal } from "react-dom";
import { FiX, FiCalendar } from "react-icons/fi";
import { API_BASE } from "../../api/host";
import HRDatePicker from "./HRDatePicker";
import "./HRModals.css";

interface CutiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: any) => void;
}

export default function CutiModal({ isOpen, onClose, onSubmit }: CutiModalProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Handle ESC key - close modal if no inner elements are open
  React.useEffect(() => {
    if (!isOpen) return;

    function handleEscKey(e: KeyboardEvent) {
      const hasOpenPopover = document.querySelector('.hr-date-picker-popover:not([style*="display: none"])');
      const hasOpenDropdown = document.querySelector('.hr-dropdown-menu:not([style*="display: none"])');
      
      // If inner elements are open, let them handle ESC
      if (hasOpenPopover || hasOpenDropdown) {
        return;
      }
      
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [isOpen, onClose]);

  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const token = localStorage.getItem("authToken") ?? "";
      const days = calculateDays();

      if (days <= 0) {
        throw new Error("Tanggal selesai harus setelah tanggal mulai");
      }

      const response = await fetch(`${API_BASE}/cuti`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          tgl_mulai: startDate,
          tgl_selesai: endDate,
          alasan: reason,
        }),
      });

      if (!response.ok) {
        throw new Error("Gagal mengajukan cuti");
      }

      const data = await response.json();
      onSubmit?.(data);

      // Reset form
      setStartDate("");
      setEndDate("");
      setReason("");
      onClose();
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
        <div className="hr-modal-header gradient-cuti">
          <div className="hr-modal-title">
            <FiCalendar size={28} />
            <div>
              <h2>Ajukan Cuti</h2>
              <p>Minta persetujuan cuti dari HRD</p>
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

        <form onSubmit={handleSubmit} className="hr-modal-form">
          {error && (
            <div className="hr-modal-error">
              <span>⚠️ {error}</span>
            </div>
          )}

          <div className="hr-form-group">
            <label>Tanggal Mulai</label>
            <HRDatePicker
              value={startDate}
              onChange={(date) => setStartDate(date)}
              placeholder="Pilih tanggal mulai"
            />
          </div>

          <div className="hr-form-group">
            <label>Tanggal Selesai</label>
            <HRDatePicker
              value={endDate}
              onChange={(date) => setEndDate(date)}
              minDate={startDate}
              placeholder="Pilih tanggal selesai"
            />
          </div>

          {calculateDays() > 0 && (
            <div className="hr-info-box">
              <span className="info-label">Total Hari:</span>
              <span className="info-value">{calculateDays()} hari</span>
            </div>
          )}

          <div className="hr-form-group">
            <label>Alasan</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Jelaskan alasan pengajuan cuti..."
              required
              className="hr-form-textarea"
              rows={4}
            />
          </div>

          <div className="hr-modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="hr-btn hr-btn-secondary"
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              className="hr-btn hr-btn-primary-cuti"
              disabled={loading || !startDate || !endDate || !reason}
            >
              {loading ? "Sedang mengirim..." : "Ajukan Cuti"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
