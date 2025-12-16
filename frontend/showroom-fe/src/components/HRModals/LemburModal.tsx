import React, { useState } from "react";
import { createPortal } from "react-dom";
import { FiX, FiTrendingUp } from "react-icons/fi";
import { API_BASE } from "../../api/host";
import HRDatePicker from "./HRDatePicker";
import HRDropdown from "./HRDropdown";
import "./HRModals.css";

interface LemburModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: any) => void;
}

export default function LemburModal({ isOpen, onClose, onSubmit }: LemburModalProps) {
  const [date, setDate] = useState("");
  const [hours, setHours] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hoursOptions = [
    { value: '0.5', label: '30 Menit' },
    { value: '1', label: '1 Jam' },
    { value: '1.5', label: '1.5 Jam' },
    { value: '2', label: '2 Jam' },
    { value: '2.5', label: '2.5 Jam' },
    { value: '3', label: '3 Jam' },
    { value: '4', label: '4 Jam' },
    { value: '5', label: '5 Jam' },
    { value: '6', label: '6 Jam' },
    { value: '8', label: '8 Jam (1 Hari Full)' },
  ];

  // Handle ESC key - close modal if no inner elements are open
  React.useEffect(() => {
    if (!isOpen) return;

    function handleEscKey(e: KeyboardEvent) {
      // Check if calendar/dropdown is open
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const token = localStorage.getItem("authToken") ?? "";
      const hoursFloat = parseFloat(hours);

      if (hoursFloat <= 0) {
        throw new Error("Jam lembur harus lebih dari 0");
      }

      const response = await fetch(`${API_BASE}/lembur`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          tgl_lembur: date,
          jam_lembur: hoursFloat,
          alasan: reason,
        }),
      });

      if (!response.ok) {
        throw new Error("Gagal mengajukan lembur");
      }

      const data = await response.json();
      onSubmit?.(data);

      // Reset form
      setDate("");
      setHours("");
      setReason("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const hoursValue = parseFloat(hours) || 0;
  const estimatedCompensation = hoursValue * 150000; // Adjust rate as needed

  return createPortal(
    <div className="hr-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="hr-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="hr-modal-header gradient-lembur">
          <div className="hr-modal-title">
            <FiTrendingUp size={28} />
            <div>
              <h2>Ajukan Lembur</h2>
              <p>Minta persetujuan jam kerja tambahan</p>
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
            <label>Tanggal Lembur</label>
            <HRDatePicker
              value={date}
              onChange={(newDate) => setDate(newDate)}
              placeholder="Pilih tanggal lembur"
            />
          </div>

          <div className="hr-form-group">
            <label>Jam Lembur</label>
            <HRDropdown
              value={hours}
              onChange={(val) => setHours(String(val))}
              options={hoursOptions}
              placeholder="Pilih durasi lembur"
            />
          </div>

          {hours && (
            <div className="hr-info-box compensation">
              <span className="info-label">Estimasi Kompensasi:</span>
              <span className="info-value">
                Rp {(parseFloat(hours) * 150000).toLocaleString('id-ID')}
              </span>
            </div>
          )}

          <div className="hr-form-group">
            <label>Alasan</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Jelaskan alasan pengajuan lembur..."
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
              className="hr-btn hr-btn-primary-lembur"
              disabled={loading || !date || !hours || !reason}
            >
              {loading ? "Sedang mengirim..." : "Ajukan Lembur"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
