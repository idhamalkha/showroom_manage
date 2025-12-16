import { useState, useEffect } from 'react';
import { API_BASE } from '../api/host';

export interface Notification {
  kd_notifikasi: number;
  tipe_notifikasi: string;
  judul: string;
  pesan: string;
  referensi_id: number | null;
  referensi_tipe: string | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export interface UseNotificationsReturn {
  unreadCount: number;
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  refetch: () => Promise<void>;
}

export const useNotifications = (kd_karyawan: number | null): UseNotificationsReturn => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = () => {
    try {
      return localStorage.getItem('authToken') ?? '';
    } catch {
      return '';
    }
  };

  const fetchUnreadCount = async () => {
    if (!kd_karyawan) return;
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/notifikasi/unread-count?kd_karyawan=${kd_karyawan}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unread_count);
      }
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  };

  const fetchNotifications = async () => {
    if (!kd_karyawan) return;
    setLoading(true);
    try {
      const token = getToken();
      const response = await fetch(
        `${API_BASE}/notifikasi/all?kd_karyawan=${kd_karyawan}&limit=20&offset=0`,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications);
        setError(null);
      } else {
        setError('Gagal memuat notifikasi');
      }
    } catch (err) {
      setError('Terjadi kesalahan saat memuat notifikasi');
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (kd_notifikasi: number) => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/notifikasi/${kd_notifikasi}/read`, {
        method: 'PUT',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.kd_notifikasi === kd_notifikasi ? { ...n, is_read: true } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!kd_karyawan) return;
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/notifikasi/read-all?kd_karyawan=${kd_karyawan}`, {
        method: 'PUT',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const deleteNotification = async (kd_notifikasi: number) => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/notifikasi/${kd_notifikasi}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (response.ok) {
        setNotifications((prev) =>
          prev.filter((n) => n.kd_notifikasi !== kd_notifikasi)
        );
        // Decrement unread count if the deleted notification was unread
        const notification = notifications.find((n) => n.kd_notifikasi === kd_notifikasi);
        if (notification && !notification.is_read) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const refetch = async () => {
    await Promise.all([fetchUnreadCount(), fetchNotifications()]);
  };

  // Initial fetch and polling
  useEffect(() => {
    if (!kd_karyawan) return;

    // Fetch immediately
    fetchUnreadCount();
    fetchNotifications();

    // Poll every 10 seconds for new notifications
    const interval = setInterval(() => {
      fetchUnreadCount();
      fetchNotifications();
    }, 10000);

    return () => clearInterval(interval);
  }, [kd_karyawan]);

  return {
    unreadCount,
    notifications,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch,
  };
};
