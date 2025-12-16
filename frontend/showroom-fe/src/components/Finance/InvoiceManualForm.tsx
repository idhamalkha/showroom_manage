import { useState } from 'react';
import { DocumentPlusIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../providers/AuthProvider';
import { API_BASE } from '../../api/host';

export default function InvoiceManualForm() {
  const { accessToken } = useAuth();
  const [form, setForm] = useState({
    kd_client: '',
    tanggal: '',
    total_amount: '',
    due_days: 30,
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/finance/invoices/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          kd_client: form.kd_client,
          tanggal: form.tanggal,
          total_amount: parseFloat(form.total_amount),
          due_days: parseInt(form.due_days as any) || 30,
        }),
      });
      if (!res.ok) throw new Error('Gagal membuat invoice');
      setSuccess('Invoice berhasil dibuat!');
      setForm({ kd_client: '', tanggal: '', total_amount: '', due_days: 30 });
    } catch (e: any) {
      setError(e.message || 'Gagal membuat invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="max-w-md mx-auto bg-white p-8 rounded-xl shadow-lg border border-gray-100 animate-fade-in" onSubmit={handleSubmit}>
      <div className="flex items-center gap-2 mb-6">
        <DocumentPlusIcon className="w-7 h-7 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-800">Buat Invoice Manual</h2>
      </div>
      <div className="mb-4">
        <label className="block mb-1 font-medium text-gray-700">Kode Client</label>
        <input name="kd_client" value={form.kd_client} onChange={handleChange} required className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-300 transition" placeholder="Masukkan kode client" />
      </div>
      <div className="mb-4">
        <label className="block mb-1 font-medium text-gray-700">Tanggal Invoice</label>
        <input type="date" name="tanggal" value={form.tanggal} onChange={handleChange} required className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-300 transition" />
      </div>
      <div className="mb-4">
        <label className="block mb-1 font-medium text-gray-700">Total Amount (Rp)</label>
        <input type="number" name="total_amount" value={form.total_amount} onChange={handleChange} required className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-300 transition" min="0" placeholder="Contoh: 1000000" />
      </div>
      <div className="mb-6">
        <label className="block mb-1 font-medium text-gray-700">Jatuh Tempo (hari)</label>
        <input type="number" name="due_days" value={form.due_days} onChange={handleChange} className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-300 transition" min="1" />
      </div>
      <button type="submit" className="bg-gradient-to-r from-blue-500 to-blue-700 text-white px-5 py-2 rounded-lg font-semibold shadow hover:scale-105 transition-transform duration-150" disabled={loading}>
        {loading ? 'Menyimpan...' : 'Buat Invoice'}
      </button>
      {success && <div className="text-green-600 mt-4 animate-fade-in">{success}</div>}
      {error && <div className="text-red-600 mt-4 animate-fade-in">{error}</div>}
    </form>
  );
}
