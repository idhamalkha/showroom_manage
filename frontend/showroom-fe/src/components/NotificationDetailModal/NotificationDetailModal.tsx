import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import type { Notification } from '../../hooks/useNotifications';
import './NotificationDetailModal.css';

interface NotificationDetailModalProps {
  notification: Notification | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationDetailModal({
  notification,
  isOpen,
  onClose,
}: NotificationDetailModalProps) {
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

  if (!isOpen || !notification) return null;

  const getIcon = (tipe: string) => {
    switch (tipe) {
      case 'cuti_pending':
        return '⏳';
      case 'cuti_approved':
        return '✅';
      case 'cuti_rejected':
        return '❌';
      case 'absensi':
        return '📍';
      default:
        return '📬';
    }
  };

  const getTypeLabel = (tipe: string) => {
    switch (tipe) {
      case 'cuti_pending':
        return 'Pengajuan Cuti';
      case 'cuti_approved':
        return 'Cuti Disetujui';
      case 'cuti_rejected':
        return 'Cuti Ditolak';
      case 'absensi':
        return 'Kehadiran';
      default:
        return 'Notifikasi';
    }
  };

  const createdDate = new Date(notification.created_at);
  const formattedDate = createdDate.toLocaleString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const modalContent = (
    <div 
      className="notif-detail-modal-overlay" 
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      <div 
        className="notif-detail-modal" 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className="notif-detail-header">
          <div className="notif-detail-icon">{getIcon(notification.tipe_notifikasi)}</div>
          <button className="notif-detail-close" onClick={onClose}>
            <FiX size={24} />
          </button>
        </div>

        <div className="notif-detail-body">
          <h2 className="notif-detail-title">{notification.judul}</h2>

          <div className="notif-detail-type">
            {getTypeLabel(notification.tipe_notifikasi)}
          </div>

          <p className="notif-detail-message">{notification.pesan}</p>

          <div className="notif-detail-footer">
            <span className="notif-detail-time">{formattedDate}</span>
            {notification.is_read && (
              <span className="notif-detail-status">Sudah dibaca</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const modalRoot = document.getElementById('modal-root');
  return modalRoot ? createPortal(modalContent, modalRoot) : null;
}
