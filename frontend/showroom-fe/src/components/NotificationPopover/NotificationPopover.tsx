import React, { useEffect, useRef, useMemo, useState } from 'react';
import { FiBell, FiCheck, FiTrash2, FiFilter } from 'react-icons/fi';
import { useNotifications, Notification } from '../../hooks/useNotifications';
import NotificationDetailModal from '../NotificationDetailModal/NotificationDetailModal';
import './NotificationPopover.css';

interface NotificationPopoverProps {
  kd_karyawan: number | null;
  isOpen: boolean;
  onClose: () => void;
  buttonRef: React.RefObject<HTMLButtonElement>;
}

type NotificationCategory = 'all' | 'pending' | 'approved' | 'rejected';

interface CategorizedNotifications {
  pending: typeof notifications;
  approved: typeof notifications;
  rejected: typeof notifications;
}

export default function NotificationPopover({
  kd_karyawan,
  isOpen,
  onClose,
  buttonRef,
}: NotificationPopoverProps) {
  const {
    unreadCount,
    notifications,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications(kd_karyawan);

  const [activeFilter, setActiveFilter] = useState<NotificationCategory>('all');
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        onClose();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen, onClose, buttonRef]);

  // Categorize notifications
  const categorized = useMemo(() => {
    const result = {
      pending: [],
      approved: [],
      rejected: [],
    } as CategorizedNotifications;

    notifications.forEach((notif) => {
      if (notif.tipe_notifikasi.includes('pending')) {
        result.pending.push(notif);
      } else if (notif.tipe_notifikasi.includes('approved')) {
        result.approved.push(notif);
      } else if (notif.tipe_notifikasi.includes('rejected')) {
        result.rejected.push(notif);
      }
    });

    return result;
  }, [notifications]);

  // Get filtered notifications
  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return notifications;
    return categorized[activeFilter] || [];
  }, [notifications, activeFilter, categorized]);

  if (!isOpen) return null;

  // Calculate position
  let style: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
  };

  if (buttonRef.current) {
    const rect = buttonRef.current.getBoundingClientRect();
    style = {
      position: 'fixed',
      top: `${rect.bottom + 8}px`,
      right: `${window.innerWidth - rect.right}px`,
      zIndex: 9999,
    };
  }

  const getNotificationIcon = (tipe: string) => {
    switch (tipe) {
      case 'cuti_pending':
        return '📋';
      case 'cuti_approved':
        return '✅';
      case 'cuti_rejected':
        return '❌';
      case 'lembur_pending':
        return '⏱️';
      case 'lembur_approved':
        return '✅';
      case 'lembur_rejected':
        return '❌';
      case 'absensi':
        return '📍';
      default:
        return '📬';
    }
  };

  const getCategoryLabel = (category: NotificationCategory) => {
    switch (category) {
      case 'pending':
        return `Menunggu (${categorized.pending.length})`;
      case 'approved':
        return `Disetujui (${categorized.approved.length})`;
      case 'rejected':
        return `Ditolak (${categorized.rejected.length})`;
      default:
        return `Semua (${notifications.length})`;
    }
  };

  return (
    <div ref={popoverRef} className="notif-popover" style={style}>
      <div className="notif-header">
        <h3>Notifikasi</h3>
        {unreadCount > 0 && (
          <button
            className="notif-mark-all-btn"
            onClick={markAllAsRead}
            title="Mark all as read"
          >
            Tandai semua
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      {!loading && notifications.length > 0 && (
        <div className="notif-filters">
          {(['all', 'pending', 'approved', 'rejected'] as NotificationCategory[]).map((filter) => (
            <button
              key={filter}
              className={`notif-filter-btn ${activeFilter === filter ? 'active' : ''}`}
              onClick={() => setActiveFilter(filter)}
            >
              <span className="filter-label">{getCategoryLabel(filter)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="notif-content">
        {loading ? (
          <div className="notif-loading">
            <div className="spinner" />
            <p>Memuat notifikasi...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="notif-empty">
            <FiBell size={32} />
            <p>
              {activeFilter === 'all'
                ? 'Tidak ada notifikasi'
                : `Tidak ada notifikasi ${getCategoryLabel(activeFilter).toLowerCase()}`}
            </p>
          </div>
        ) : (
          <ul className="notif-list">
            {filteredNotifications.map((notif) => (
              <li
                key={notif.kd_notifikasi}
                className={`notif-item ${notif.is_read ? 'read' : 'unread'}`}
                onClick={() => {
                  setSelectedNotification(notif);
                  setIsModalOpen(true);
                  if (!notif.is_read) {
                    markAsRead(notif.kd_notifikasi);
                  }
                }}
              >
                <div className="notif-icon">
                  {getNotificationIcon(notif.tipe_notifikasi)}
                </div>
                <div className="notif-body">
                  <div className="notif-title">{notif.judul}</div>
                  <div className="notif-message">{notif.pesan}</div>
                  <div className="notif-time">
                    {new Date(notif.created_at).toLocaleString('id-ID', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <div className="notif-actions">
                  {!notif.is_read && (
                    <button
                      className="notif-action-btn read-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notif.kd_notifikasi);
                      }}
                      title="Mark as read"
                    >
                      <FiCheck size={16} />
                    </button>
                  )}
                  <button
                    className="notif-action-btn delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notif.kd_notifikasi);
                    }}
                    title="Delete"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {filteredNotifications.length > 0 && (
        <div className="notif-footer">
          <small>Menampilkan {filteredNotifications.length} notifikasi</small>
        </div>
      )}
    </div>

    <NotificationDetailModal
      notification={selectedNotification}
      isOpen={isModalOpen}
      onClose={() => {
        setIsModalOpen(false);
        setSelectedNotification(null);
      }}
    />
  );
}
