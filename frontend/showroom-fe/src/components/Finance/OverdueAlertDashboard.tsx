import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../api/host';
import { useAuth } from '../../providers/AuthProvider';
import LoadingSpinner from '../LoadingSpinner';
import { CheckIcon, PhoneIcon, EllipsisVerticalIcon, ExclamationTriangleIcon, CurrencyDollarIcon, ClockIcon, PaperAirplaneIcon, ChevronDownIcon, BellAlertIcon, CalendarIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import AnimatedNumber from '../ui/AnimatedNumber';
import '../../styles/OverdueAlertDashboard.css';

interface OverdueItem {
  kd_schedule: number;
  kd_cicilan: number;
  nomor_cicilan: number;
  jumlah: number;
  tgl_jatuh_tempo: string;
  days_overdue: number;
  nama_client: string;
  no_telepon: string;
  kd_client: number;
  status: string;
  username_client?: string;
}

interface OverdueAlertDashboardProps {
  limit?: number;
}

export default function OverdueAlertDashboard({ limit = 50 }: OverdueAlertDashboardProps) {
  const { accessToken } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const emailTypeDropdownRef = useRef<HTMLDivElement>(null);
  const [overdue, setOverdue] = useState<OverdueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'days' | 'amount' | 'customer'>('days');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [actionDropdown, setActionDropdown] = useState<number | null>(null);
  const [noteModal, setNoteModal] = useState<{ visible: boolean; kd_schedule: number | null; note: string }>({ visible: false, kd_schedule: null, note: '' });
  const [emailModal, setEmailModal] = useState<{ visible: boolean; kd_schedule: number | null; email_type: string; toEmail: string }>({ visible: false, kd_schedule: null, email_type: 'overdue_reminder', toEmail: '' });
  const [emailTypeDropdownOpen, setEmailTypeDropdownOpen] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    loadOverdueData();
  }, [accessToken]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActionDropdown(null);
      }
      if (emailTypeDropdownRef.current && !emailTypeDropdownRef.current.contains(event.target as Node)) {
        setEmailTypeDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  async function loadOverdueData() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE}/finance/cicilan/overdue?limit=${limit}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
      });

      if (!res.ok) {
        throw new Error('Gagal mengambil data cicilan overdue');
      }

      const data = await res.json();
      setOverdue(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Gagal mengambil data cicilan overdue');
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount || 0);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });

  const getSortedData = () => {
    const sorted = [...overdue];
    if (sortBy === 'days') {
      return sorted.sort((a, b) => b.days_overdue - a.days_overdue);
    }
    if (sortBy === 'amount') {
      return sorted.sort((a, b) => b.jumlah - a.jumlah);
    }
    if (sortBy === 'customer') {
      return sorted.sort((a, b) => a.nama_client.localeCompare(b.nama_client));
    }
    return sorted;
  };

  const getUrgencyLevel = (daysOverdue: number) => {
    if (daysOverdue > 90) return { label: 'Critical', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300' };
    if (daysOverdue > 30) return { label: 'High', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300' };
    if (daysOverdue > 7) return { label: 'Medium', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-300' };
    return { label: 'Low', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-300' };
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === overdue.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(overdue.map(o => o.kd_schedule)));
    }
  };

  const toggleSelect = (kd_schedule: number) => {
    const updated = new Set(selectedItems);
    if (updated.has(kd_schedule)) {
      updated.delete(kd_schedule);
    } else {
      updated.add(kd_schedule);
    }
    setSelectedItems(updated);
  };

  const handleMarkAsPaid = async (kd_schedule: number) => {
    try {
      setProcessingId(kd_schedule);
      const res = await fetch(`${API_BASE}/finance/cicilan/schedule/${kd_schedule}/mark-paid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!res.ok) throw new Error('Gagal menandai sebagai sudah dibayar');

      // Reload data
      await loadOverdueData();
      setActionDropdown(null);
    } catch (err: any) {
      alert(err.message || 'Gagal menandai sebagai sudah dibayar');
    } finally {
      setProcessingId(null);
    }
  };

  const handleAddNote = async () => {
    if (!noteModal.kd_schedule || !noteModal.note.trim()) return;

    try {
      setProcessingId(noteModal.kd_schedule);
      const res = await fetch(`${API_BASE}/finance/cicilan/schedule/${noteModal.kd_schedule}/note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ note: noteModal.note })
      });

      if (!res.ok) throw new Error('Gagal menambahkan catatan');

      // Reload data
      await loadOverdueData();
      setNoteModal({ visible: false, kd_schedule: null, note: '' });
      setActionDropdown(null);
    } catch (err: any) {
      alert(err.message || 'Gagal menambahkan catatan');
    } finally {
      setProcessingId(null);
    }
  };

  const handleSendEmail = async () => {
    if (!emailModal.kd_schedule || !emailModal.email_type) return;

    try {
      setProcessingId(emailModal.kd_schedule);
      const res = await fetch(`${API_BASE}/finance/cicilan/schedule/${emailModal.kd_schedule}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          email_type: emailModal.email_type,
          to_email: emailModal.toEmail || undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Gagal mengirim email');
      }

      const data = await res.json();
      alert(`✅ Email berhasil dikirim ke ${emailModal.toEmail}`);
      setEmailModal({ visible: false, kd_schedule: null, email_type: 'overdue_reminder', toEmail: '' });
      setActionDropdown(null);
    } catch (err: any) {
      alert(err.message || 'Gagal mengirim email');
    } finally {
      setProcessingId(null);
    }
  };

  const totalOverdueAmount = overdue.reduce((sum, item) => sum + item.jumlah, 0);
  const sortedData = getSortedData();

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-600 p-4">{error}</div>;
  if (overdue.length === 0)
    return (
      <div className="overdue-alert-empty">
        <CheckIcon className="overdue-alert-empty-icon" />
        <div className="overdue-alert-empty-title">Tidak Ada Cicilan Overdue</div>
        <div className="overdue-alert-empty-description">Semua cicilan dalam status tertib</div>
      </div>
    );

  return (
    <div className="overdue-alert-container">
      {/* Summary Cards */}
      <div className="overdue-alert-summary">
        <div className="overdue-alert-stat-card">
          <div className="overdue-alert-stat-card-header-row">
            <div className="overdue-alert-stat-label">Total Overdue</div>
            <ExclamationTriangleIcon className="overdue-alert-stat-icon" />
          </div>
          <div className="overdue-alert-stat-value"><AnimatedNumber value={overdue.length} duration={700} /></div>
          <div className="overdue-alert-stat-meta">cicilan</div>
        </div>

        <div className="overdue-alert-stat-card">
          <div className="overdue-alert-stat-card-header-row">
            <div className="overdue-alert-stat-label">Total Amount</div>
            <CurrencyDollarIcon className="overdue-alert-stat-icon" />
          </div>
          <div className="overdue-alert-stat-value-currency"><AnimatedNumber value={Math.round(totalOverdueAmount)} duration={900} format={(v)=> new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v)} /></div>
          <div className="overdue-alert-stat-meta">total terhutang</div>
        </div>

        <div className="overdue-alert-stat-card">
          <div className="overdue-alert-stat-card-header-row">
            <div className="overdue-alert-stat-label">Critical ({'>'} 90 hari)</div>
            <ClockIcon className="overdue-alert-stat-icon" />
          </div>
          <div className="overdue-alert-stat-value"><AnimatedNumber value={overdue.filter(o => o.days_overdue > 90).length} duration={700} /></div>
          <div className="overdue-alert-stat-meta">sangat mendesak</div>
        </div>

        <div className="overdue-alert-stat-card">
          <div className="overdue-alert-stat-card-header-row">
            <div className="overdue-alert-stat-label">High (30-90 hari)</div>
            <ClockIcon className="overdue-alert-stat-icon" />
          </div>
          <div className="overdue-alert-stat-value"><AnimatedNumber value={overdue.filter(o => o.days_overdue > 30 && o.days_overdue <= 90).length} duration={700} /></div>
          <div className="overdue-alert-stat-meta">mendesak</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="overdue-alert-toolbar">
        <div className="overdue-alert-checkbox-group">
          <input
            type="checkbox"
            className="overdue-alert-checkbox"
            checked={selectedItems.size === overdue.length && overdue.length > 0}
            onChange={toggleSelectAll}
          />
          <label className="overdue-alert-checkbox-label">
            {selectedItems.size > 0 ? `${selectedItems.size} dipilih` : 'Pilih semua'}
          </label>
        </div>

        <div className="overdue-alert-sort-section">
          <span className="overdue-alert-sort-label">Urutkan:</span>
          <div className="overdue-alert-sort-buttons">
            <button
              onClick={() => setSortBy('days')}
              className={`overdue-alert-sort-btn ${sortBy === 'days' ? 'active' : ''}`}
            >
              Hari Overdue
            </button>
            <button
              onClick={() => setSortBy('amount')}
              className={`overdue-alert-sort-btn ${sortBy === 'amount' ? 'active' : ''}`}
            >
              Jumlah
            </button>
            <button
              onClick={() => setSortBy('customer')}
              className={`overdue-alert-sort-btn ${sortBy === 'customer' ? 'active' : ''}`}
            >
              Nama Customer
            </button>
          </div>
        </div>

        {selectedItems.size > 0 && (
          <div className="overdue-alert-action-buttons">
            <button className="overdue-alert-action-btn btn-primary">
              Tandai Bayar ({selectedItems.size})
            </button>
            <button className="overdue-alert-action-btn btn-secondary">
              <PhoneIcon className="w-4 h-4" /> Hubungi
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overdue-alert-table-wrapper">
        <div style={{ overflowX: 'auto' }}>
          <table className="overdue-alert-table">
            <thead>
              <tr>
                <th className="th-checkbox">
                  <input
                    type="checkbox"
                    className="overdue-alert-checkbox"
                    checked={selectedItems.size === overdue.length && overdue.length > 0}
                    onChange={toggleSelectAll}
                    title="Pilih semua"
                  />
                </th>
                <th className="th-customer">Customer</th>
                <th className="th-cicilan">No. Cicilan</th>
                <th className="th-amount">Jumlah</th>
                <th className="th-due-date">Jatuh Tempo</th>
                <th className="th-overdue">Overdue</th>
                <th className="th-urgency">Urgency</th>
                <th className="th-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map(item => {
                const urgency = getUrgencyLevel(item.days_overdue);
                const urgencyClass = item.days_overdue > 90 ? 'urgency-critical' : item.days_overdue > 30 ? 'urgency-high' : item.days_overdue > 7 ? 'urgency-medium' : 'urgency-low';
                return (
                  <tr key={item.kd_schedule} className={`overdue-alert-table ${urgencyClass}`}>
                    <td className="td-checkbox">
                      <input
                        type="checkbox"
                        className="overdue-alert-checkbox"
                        checked={selectedItems.has(item.kd_schedule)}
                        onChange={() => toggleSelect(item.kd_schedule)}
                      />
                    </td>
                    <td className="td-customer">
                      <div className="overdue-alert-customer-name">{item.nama_client}</div>
                      {item.no_telepon && <div className="overdue-alert-customer-phone">{item.no_telepon}</div>}
                    </td>
                    <td className="td-cicilan">
                      <span className="overdue-alert-cicilan-number">C{item.kd_cicilan}-{item.nomor_cicilan}</span>
                    </td>
                    <td className="td-amount">
                      <span className="overdue-alert-amount">{formatCurrency(item.jumlah)}</span>
                    </td>
                    <td className="td-due-date">
                      <span className="overdue-alert-date">{formatDate(item.tgl_jatuh_tempo)}</span>
                    </td>
                    <td className="td-overdue">
                      <span className="overdue-alert-days-overdue">{item.days_overdue} hari</span>
                    </td>
                    <td className="td-urgency">
                      <span className={`overdue-alert-urgency-badge ${urgency.label.toLowerCase()}`}>
                        {urgency.label}
                      </span>
                    </td>
                    <td className="td-action">
                      <div className="overdue-alert-action-menu" ref={actionDropdown === item.kd_schedule ? dropdownRef : null}>
                        <button
                          onClick={() => setActionDropdown(actionDropdown === item.kd_schedule ? null : item.kd_schedule)}
                          className="overdue-alert-action-trigger"
                          disabled={processingId !== null}
                          title="Buka menu aksi"
                        >
                          <EllipsisVerticalIcon className="w-5 h-5" />
                        </button>
                        {actionDropdown === item.kd_schedule && (
                          <div className="overdue-alert-dropdown" style={{ display: 'block' }}>
                            <button
                              className="overdue-alert-dropdown-item"
                              onClick={() => handleMarkAsPaid(item.kd_schedule)}
                              disabled={processingId === item.kd_schedule}
                            >
                              ✓ Tandai Sudah Bayar
                            </button>
                            <button
                              className="overdue-alert-dropdown-item"
                              onClick={() => {
                                setNoteModal({ visible: true, kd_schedule: item.kd_schedule, note: '' });
                                setActionDropdown(null);
                              }}
                              disabled={processingId === item.kd_schedule}
                            >
                              📝 Buat Catatan
                            </button>
                            <button
                              className="overdue-alert-dropdown-item"
                              onClick={() => {
                                const client = overdue.find(o => o.kd_schedule === item.kd_schedule);
                                setEmailModal({
                                  visible: true,
                                  kd_schedule: item.kd_schedule,
                                  email_type: 'overdue_reminder',
                                  toEmail: client?.username_client || ''
                                });
                                setActionDropdown(null);
                              }}
                              disabled={processingId === item.kd_schedule}
                            >
                              ✉️ Kirim Email
                            </button>
                            <button className="overdue-alert-dropdown-item danger">
                              🚨 Eskalasi Kasus
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Note Modal */}
      {noteModal.visible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] pointer-events-auto">
          <div className="bg-white rounded-lg p-6 w-96 shadow-2xl">
            <h3 className="text-lg font-semibold mb-4">Tambah Catatan</h3>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
              placeholder="Masukkan catatan tentang cicilan ini..."
              value={noteModal.note}
              onChange={(e) => setNoteModal({ ...noteModal, note: e.target.value })}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setNoteModal({ visible: false, kd_schedule: null, note: '' })}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={processingId !== null}
              >
                Batal
              </button>
              <button
                onClick={handleAddNote}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={processingId !== null || !noteModal.note.trim()}
              >
                {processingId === noteModal.kd_schedule ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {emailModal.visible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] pointer-events-auto">
          <div className="bg-white rounded-lg p-6 w-96 shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <PaperAirplaneIcon className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold">Kirim Email</h3>
            </div>

            <div className="space-y-4">
              {/* Email Type Selection - Custom Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Jenis Email</label>
                <div ref={emailTypeDropdownRef} className="relative">
                  <button
                    onClick={() => setEmailTypeDropdownOpen(!emailTypeDropdownOpen)}
                    disabled={processingId !== null}
                    className="w-full border border-gray-300 rounded-lg p-3 flex items-center justify-between hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  >
                    <span className="text-left flex items-center gap-2">
                      {emailModal.email_type === 'overdue_reminder' && (
                        <>
                          <BellAlertIcon className="w-4 h-4 text-red-600" />
                          <span>📢 Reminder Pembayaran (Terlambat)</span>
                        </>
                      )}
                      {emailModal.email_type === 'early_notice' && (
                        <>
                          <CalendarIcon className="w-4 h-4 text-yellow-600" />
                          <span>📅 Notifikasi Jatuh Tempo (7 hari lagi)</span>
                        </>
                      )}
                      {emailModal.email_type === 'payment_confirmation' && (
                        <>
                          <CheckCircleIcon className="w-4 h-4 text-green-600" />
                          <span>✅ Konfirmasi Pembayaran Diterima</span>
                        </>
                      )}
                      {emailModal.email_type === 'final_notice' && (
                        <>
                          <XCircleIcon className="w-4 h-4 text-orange-600" />
                          <span>🚨 Pemberitahuan Final (Sebelum Eskalasi)</span>
                        </>
                      )}
                    </span>
                    <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform ${emailTypeDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {emailTypeDropdownOpen && (
                    <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                      {/* Overdue Reminder */}
                      <button
                        onClick={() => {
                          setEmailModal({ ...emailModal, email_type: 'overdue_reminder' });
                          setEmailTypeDropdownOpen(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-red-50 border-b border-gray-100 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <BellAlertIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">📢 Reminder Pembayaran</div>
                            <div className="text-xs text-gray-600 mt-0.5">Mengirim reminder pembayaran yang sudah terlambat</div>
                          </div>
                        </div>
                      </button>

                      {/* Early Notice */}
                      <button
                        onClick={() => {
                          setEmailModal({ ...emailModal, email_type: 'early_notice' });
                          setEmailTypeDropdownOpen(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-yellow-50 border-b border-gray-100 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <CalendarIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">📅 Notifikasi Jatuh Tempo</div>
                            <div className="text-xs text-gray-600 mt-0.5">Mengirim notifikasi pembayaran akan jatuh tempo dalam 7 hari</div>
                          </div>
                        </div>
                      </button>

                      {/* Payment Confirmation */}
                      <button
                        onClick={() => {
                          setEmailModal({ ...emailModal, email_type: 'payment_confirmation' });
                          setEmailTypeDropdownOpen(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-green-50 border-b border-gray-100 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">✅ Konfirmasi Pembayaran</div>
                            <div className="text-xs text-gray-600 mt-0.5">Mengirim konfirmasi pembayaran sudah diterima dan diproses</div>
                          </div>
                        </div>
                      </button>

                      {/* Final Notice */}
                      <button
                        onClick={() => {
                          setEmailModal({ ...emailModal, email_type: 'final_notice' });
                          setEmailTypeDropdownOpen(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-orange-50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <XCircleIcon className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">🚨 Pemberitahuan Final</div>
                            <div className="text-xs text-gray-600 mt-0.5">Pemberitahuan final sebelum tindakan hukum atau eskalasi kasus</div>
                          </div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Email Preview */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-2">Preview jenis email:</p>
                <div className="text-sm text-gray-700">
                  {emailModal.email_type === 'overdue_reminder' && (
                    <p>💌 Mengirimkan reminder pembayaran yang sudah terlambat</p>
                  )}
                  {emailModal.email_type === 'early_notice' && (
                    <p>💌 Mengirimkan notifikasi pembayaran akan jatuh tempo</p>
                  )}
                  {emailModal.email_type === 'payment_confirmation' && (
                    <p>💌 Mengirimkan konfirmasi pembayaran sudah diterima</p>
                  )}
                  {emailModal.email_type === 'final_notice' && (
                    <p>💌 Mengirimkan pemberitahuan final sebelum tindakan hukum</p>
                  )}
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Alamat Email</label>
                <input
                  type="email"
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="contoh@email.com"
                  value={emailModal.toEmail}
                  onChange={(e) => setEmailModal({ ...emailModal, toEmail: e.target.value })}
                  disabled={processingId !== null}
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">Jika kosong, akan menggunakan email customer dari database</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setEmailModal({ visible: false, kd_schedule: null, email_type: 'overdue_reminder', toEmail: '' })}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={processingId !== null}
              >
                Batal
              </button>
              <button
                onClick={handleSendEmail}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                disabled={processingId !== null}
              >
                <PaperAirplaneIcon className="w-4 h-4" />
                {processingId === emailModal.kd_schedule ? 'Mengirim...' : 'Kirim Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="overdue-alert-legend">
        <div className="overdue-alert-legend-title">Tingkat Urgensi Koleksi</div>
        <div className="overdue-alert-legend-grid">
          <div className="overdue-alert-legend-item">
            <span className="overdue-alert-urgency-badge critical overdue-alert-legend-badge">Critical</span>
            <div>
              <div className="overdue-alert-legend-text">Critical</div>
              <div className="overdue-alert-legend-text-range">{'>'} 90 hari</div>
            </div>
          </div>
          <div className="overdue-alert-legend-item">
            <span className="overdue-alert-urgency-badge high overdue-alert-legend-badge">High</span>
            <div>
              <div className="overdue-alert-legend-text">High</div>
              <div className="overdue-alert-legend-text-range">30-90 hari</div>
            </div>
          </div>
          <div className="overdue-alert-legend-item">
            <span className="overdue-alert-urgency-badge medium overdue-alert-legend-badge">Medium</span>
            <div>
              <div className="overdue-alert-legend-text">Medium</div>
              <div className="overdue-alert-legend-text-range">7-30 hari</div>
            </div>
          </div>
          <div className="overdue-alert-legend-item">
            <span className="overdue-alert-urgency-badge low overdue-alert-legend-badge">Low</span>
            <div>
              <div className="overdue-alert-legend-text">Low</div>
              <div className="overdue-alert-legend-text-range">{'<'} 7 hari</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
