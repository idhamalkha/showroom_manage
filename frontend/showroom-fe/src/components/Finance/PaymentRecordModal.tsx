import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { API_BASE } from '../../api/host';
import { useAuth } from '../../providers/AuthProvider';

interface Invoice {
  kd_invoice: number;
  kd_transaksi: number;
  nomor_invoice: string;
  status: 'outstanding' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  total_amount: number;
  paid_amount: number;
  remaining: number;
  tanggal_jatuh_tempo: string;
  client_name: string;
  created_at: string;
}

interface PaymentRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  onSaved: () => void;
}

export default function PaymentRecordModal({ isOpen, onClose, invoice, onSaved }: PaymentRecordModalProps) {
  const { accessToken } = useAuth();
  const [formData, setFormData] = useState({
    jumlah: invoice.remaining.toString(),
    jenis: 'transfer',
    tanggal: new Date().toISOString().split('T')[0],
    reference: '',
    note: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showMethodDropdown, setShowMethodDropdown] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const dateButtonRef = useRef<HTMLButtonElement>(null);
  const methodDropdownRef = useRef<HTMLDivElement>(null);
  const methodButtonRef = useRef<HTMLButtonElement>(null);

  // Handle ESC key - prioritize closing dropdowns/calendar first
  useEffect(() => {
    if (!isOpen) return;

    function handleEscKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showDatePicker) {
          setShowDatePicker(false);
          return;
        }
        if (showMethodDropdown) {
          setShowMethodDropdown(false);
          return;
        }
        onClose();
      }
    }

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [isOpen, showDatePicker, showMethodDropdown, onClose]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Close date picker when clicking outside
  useEffect(() => {
    function handleClickOutside(e: PointerEvent) {
      if (!showDatePicker) return;
      const target = e.target as Node;
      if (datePickerRef.current?.contains(target)) return;
      if (dateButtonRef.current?.contains(target)) return;
      setShowDatePicker(false);
    }
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [showDatePicker]);

  // Close method dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: PointerEvent) {
      if (!showMethodDropdown) return;
      const target = e.target as Node;
      if (methodDropdownRef.current?.contains(target)) return;
      if (methodButtonRef.current?.contains(target)) return;
      setShowMethodDropdown(false);
    }
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [showMethodDropdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const jumlah = parseFloat(formData.jumlah);
      
      if (isNaN(jumlah) || jumlah <= 0) {
        throw new Error('Jumlah must be greater than 0');
      }
      
      if (jumlah > invoice.remaining) {
        throw new Error(`Jumlah cannot exceed remaining balance (Rp ${invoice.remaining.toLocaleString('id-ID')})`);
      }

      const res = await fetch(`${API_BASE}/finance/invoices/${invoice.kd_invoice}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          jumlah,
          jenis: formData.jenis,
          tanggal: formData.tanggal,
          reference: formData.reference || null,
          note: formData.note || null,
          status: 'completed'
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to record payment (${res.status})`);
      }

      await res.json();
      
      setFormData({
        jumlah: invoice.remaining.toString(),
        jenis: 'transfer',
        tanggal: new Date().toISOString().split('T')[0],
        reference: '',
        note: ''
      });

      onClose();
      onSaved();
    } catch (err: any) {
      console.error('Payment recording failed:', err);
      setError(err?.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount || 0);

  const paymentMethods = [
    { value: 'transfer', label: 'Bank Transfer' },
    { value: 'cash', label: 'Cash' },
    { value: 'cicilan', label: 'Cicilan' },
    { value: 'check', label: 'Check' },
    { value: 'other', label: 'Other' }
  ];

  const selectedMethodLabel = paymentMethods.find(m => m.value === formData.jenis)?.label || 'Select Method';

  const modalContent = (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(2px)', zIndex: 9999 }}>
      <div 
        className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        } as any}
      >
        <style>{`
          div:has(> .payment-modal-content)::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        <div className="payment-modal-content">
          <h3 className="text-xl font-bold text-slate-900 mb-6">Record Payment</h3>

          <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Invoice</div>
            <div className="text-sm font-bold text-slate-900 mt-1">{invoice.nomor_invoice}</div>
            <div className="text-xs text-slate-600 mt-2">{invoice.client_name}</div>
            
            <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500">Total</div>
                <div className="text-sm font-bold text-slate-900">{formatCurrency(invoice.total_amount)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Remaining</div>
                <div className="text-sm font-bold text-red-600">{formatCurrency(invoice.remaining)}</div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Amount to Pay <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="jumlah"
                value={formData.jumlah}
                onChange={handleChange}
                step="1"
                min="0"
                max={invoice.remaining}
                placeholder="0"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent [&::-webkit-outer-spin-button]:hidden [&::-webkit-inner-spin-button]:hidden text-base"
              />
              <div className="mt-1 text-xs text-slate-500">
                Max: {formatCurrency(invoice.remaining)}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Payment Method <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <button
                  ref={methodButtonRef}
                  type="button"
                  onClick={() => setShowMethodDropdown(!showMethodDropdown)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left text-slate-900 hover:bg-slate-50 transition-colors flex justify-between items-center bg-white"
                >
                  <span>{selectedMethodLabel}</span>
                  <span className="text-slate-400">▾</span>
                </button>

                {showMethodDropdown && (
                  <div
                    ref={methodDropdownRef}
                    className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-300 rounded-lg shadow-lg z-50 overflow-hidden"
                  >
                    {paymentMethods.map(method => (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, jenis: method.value }));
                          setShowMethodDropdown(false);
                        }}
                        className={`w-full px-3 py-2.5 text-left text-sm transition-colors ${
                          formData.jenis === method.value 
                            ? 'bg-blue-600 text-white font-medium' 
                            : 'text-slate-900 hover:bg-blue-50'
                        }`}
                      >
                        {method.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <button
                  ref={dateButtonRef}
                  type="button"
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left text-slate-900 hover:bg-slate-50 transition-colors bg-white flex justify-between items-center"
                >
                  <span>{formatDateDisplay(formData.tanggal)}</span>
                  <span className="text-slate-400">▾</span>
                </button>
                
                {showDatePicker && (
                  <DatePickerPayment
                    ref={datePickerRef}
                    value={formData.tanggal}
                    onChange={(date) => {
                      setFormData(prev => ({ ...prev, tanggal: date }));
                      setShowDatePicker(false);
                    }}
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Reference (e.g., Bank Transfer ID)
              </label>
              <input
                type="text"
                name="reference"
                value={formData.reference}
                onChange={handleChange}
                placeholder="e.g., TRF-20240115-12345"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Note
              </label>
              <textarea
                name="note"
                value={formData.note}
                onChange={handleChange}
                placeholder="Optional notes about this payment..."
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

function formatDateDisplay(iso: string): string {
  if (!iso) return 'Select date';
  try {
    const d = new Date(iso + 'T00:00:00');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const day = d.getDate();
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return iso;
  }
}

interface DatePickerPaymentProps {
  value: string;
  onChange: (date: string) => void;
}

const DatePickerPayment = React.forwardRef<HTMLDivElement, DatePickerPaymentProps>(
  ({ value, onChange }, ref) => {
    const [viewYear, setViewYear] = useState(() => {
      try {
        return new Date(value + 'T00:00:00').getFullYear();
      } catch {
        return new Date().getFullYear();
      }
    });
    const [viewMonth, setViewMonth] = useState(() => {
      try {
        return new Date(value + 'T00:00:00').getMonth();
      } catch {
        return new Date().getMonth();
      }
    });
    const [showMonthDropdown, setShowMonthDropdown] = useState(false);
    const [showYearDropdown, setShowYearDropdown] = useState(false);
    const monthDropdownRef = useRef<HTMLDivElement>(null);
    const yearDropdownRef = useRef<HTMLDivElement>(null);

    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const years = Array.from({ length: 50 }, (_, i) => new Date().getFullYear() - i);

    useEffect(() => {
      function handleClickOutside(e: PointerEvent) {
        if (!showMonthDropdown) return;
        const target = e.target as Node;
        if (monthDropdownRef.current?.contains(target)) return;
        setShowMonthDropdown(false);
      }
      document.addEventListener('pointerdown', handleClickOutside);
      return () => document.removeEventListener('pointerdown', handleClickOutside);
    }, [showMonthDropdown]);

    useEffect(() => {
      function handleClickOutside(e: PointerEvent) {
        if (!showYearDropdown) return;
        const target = e.target as Node;
        if (yearDropdownRef.current?.contains(target)) return;
        setShowYearDropdown(false);
      }
      document.addEventListener('pointerdown', handleClickOutside);
      return () => document.removeEventListener('pointerdown', handleClickOutside);
    }, [showYearDropdown]);

    function daysInMonth(y: number, m: number) {
      return new Date(y, m + 1, 0).getDate();
    }

    function firstDayIndex(y: number, m: number) {
      return new Date(y, m, 1).getDay();
    }

    const days = daysInMonth(viewYear, viewMonth);
    const firstIdx = firstDayIndex(viewYear, viewMonth);
    const weeks: (number | null)[] = [];

    for (let i = 0; i < firstIdx; i++) weeks.push(null);
    for (let d = 1; d <= days; d++) weeks.push(d);
    while (weeks.length % 7 !== 0) weeks.push(null);

    function selectDay(day: number | null) {
      if (day == null) return;
      const year = String(viewYear).padStart(4, '0');
      const month = String(viewMonth + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      onChange(`${year}-${month}-${dayStr}`);
    }

    return (
      <div
        ref={ref}
        className="absolute top-full left-0 mt-2 bg-white border border-slate-300 rounded-lg shadow-lg p-2 z-50 w-64 dp-popover"
      >
        <div className="dp-card">
          <div className="dp-header flex gap-1.5 mb-2">
            <div className="flex-1 relative">
              <button
                type="button"
                onClick={() => setShowMonthDropdown(!showMonthDropdown)}
                className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs bg-white hover:bg-slate-50 transition-colors text-slate-700 font-medium flex justify-between items-center"
              >
                <span>{months[viewMonth].substring(0, 3)}</span>
                <span className="text-slate-400 text-xs">▾</span>
              </button>
              {showMonthDropdown && (
                <div
                  ref={monthDropdownRef}
                  className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded shadow-lg z-50 max-h-40 overflow-y-auto"
                >
                  {months.map((m, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setViewMonth(i);
                        setShowMonthDropdown(false);
                      }}
                      className={`w-full px-1.5 py-1.5 text-left text-xs transition-colors ${
                        viewMonth === i
                          ? 'bg-blue-600 text-white font-medium'
                          : 'text-slate-900 hover:bg-blue-50'
                      }`}
                    >
                      {m.substring(0, 3)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 relative">
              <button
                type="button"
                onClick={() => setShowYearDropdown(!showYearDropdown)}
                className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs bg-white hover:bg-slate-50 transition-colors text-slate-700 font-medium flex justify-between items-center"
              >
                <span>{viewYear}</span>
                <span className="text-slate-400 text-xs">▾</span>
              </button>
              {showYearDropdown && (
                <div
                  ref={yearDropdownRef}
                  className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded shadow-lg z-50 max-h-40 overflow-y-auto"
                >
                  {years.map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => {
                        setViewYear(y);
                        setShowYearDropdown(false);
                      }}
                      className={`w-full px-1.5 py-1.5 text-left text-xs transition-colors ${
                        viewYear === y
                          ? 'bg-blue-600 text-white font-medium'
                          : 'text-slate-900 hover:bg-blue-50'
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="dp-calendar">
            <div className="dp-weeklabels grid grid-cols-7 gap-0.5 mb-1.5">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <div key={day} className="text-xs font-bold text-center text-slate-400 py-0.5">
                  {day}
                </div>
              ))}
            </div>
            <div className="dp-days grid grid-cols-7 gap-0.5">
              {weeks.map((d, idx) => {
                const iso =
                  d !== null
                    ? `${String(viewYear).padStart(4, '0')}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                    : null;
                const isSelected = iso === value;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectDay(d)}
                    className={`dp-day px-0.5 py-1 text-xs rounded font-medium transition-colors ${
                      d === null
                        ? 'text-slate-300 cursor-default'
                        : isSelected
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'text-slate-700 hover:bg-blue-100'
                    }`}
                    disabled={d === null}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

DatePickerPayment.displayName = 'DatePickerPayment';
