import React, { useState } from 'react';
import { API_BASE } from '../../api/host';
import { useAuth } from '../../providers/AuthProvider';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export default function PaymentModal({ isOpen, onClose, onSaved }: Props) {
  const { accessToken } = useAuth();
  const [kdTransaksi, setKdTransaksi] = useState<number | ''>('');
  const [jumlah, setJumlah] = useState<number | ''>('');
  const [jenis, setJenis] = useState<string>('cash');
  const [tanggal, setTanggal] = useState<string>(new Date().toISOString().slice(0,10));
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload: any = {
        kd_transaksi: kdTransaksi || undefined,
        jumlah: Number(jumlah) || 0,
        jenis,
        tanggal: tanggal || undefined,
        reference: reference || undefined,
        note: note || undefined,
      };

      const res = await fetch(`${API_BASE}/finance/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`Request failed ${res.status}`);
      const data = await res.json();
      setLoading(false);
      onSaved && onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => !loading && onClose()} />
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6 z-10">
        <h3 className="text-lg font-semibold mb-4">Add Payment</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-slate-600">Transaction ID (optional)</label>
            <input type="number" value={kdTransaksi} onChange={e => setKdTransaksi(e.target.value ? Number(e.target.value) : '')} className="mt-1 w-full p-2 border rounded" />
          </div>

          <div>
            <label className="block text-sm text-slate-600">Amount</label>
            <input type="number" step="0.01" value={jumlah} onChange={e => setJumlah(e.target.value ? Number(e.target.value) : '')} className="mt-1 w-full p-2 border rounded" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-600">Type</label>
              <select value={jenis} onChange={e => setJenis(e.target.value)} className="mt-1 w-full p-2 border rounded">
                <option value="cash">Cash</option>
                <option value="transfer">Transfer</option>
                <option value="cicilan">Cicilan</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600">Date</label>
              <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="mt-1 w-full p-2 border rounded" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-600">Reference</label>
            <input value={reference} onChange={e => setReference(e.target.value)} className="mt-1 w-full p-2 border rounded" />
          </div>

          <div>
            <label className="block text-sm text-slate-600">Note</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} className="mt-1 w-full p-2 border rounded" />
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => !loading && onClose()} className="px-4 py-2 rounded border">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded bg-blue-600 text-white">{loading ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
