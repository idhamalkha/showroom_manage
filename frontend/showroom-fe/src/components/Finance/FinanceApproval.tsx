import React, { useEffect, useState } from "react";
import axios from "../../api/axios";
import LoadingSpinner from "../LoadingSpinner";

interface Payment {
  kd_payment: number;
  jumlah: number;
  jenis: string;
  tanggal: string;
  status: string;
  reference: string;
  note: string;
  approval_status: string;
  created_at: string;
  kd_invoice: number;
  kd_transaksi: number;
}

export default function FinanceApproval() {
  const [payments, setPayments] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments() {
    setLoading(true);
    setError(null);
    try {
      // Ambil pembayaran yang sudah di-approve
      const res = await axios.get("/finance/payments?status=approved");
      setPayments(res.data.payments || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(kd_payment: number) {
    setActionLoading(kd_payment);
    try {
      await axios.post(`/finance/payment/${kd_payment}/approve`);
      setPayments(payments.filter((p) => p.kd_payment !== kd_payment));
    } catch (e) {
      alert("Gagal approve payment");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(kd_payment: number) {
    setActionLoading(kd_payment);
    try {
      await axios.post(`/finance/payment/${kd_payment}/reject`);
      setPayments(payments.filter((p) => p.kd_payment !== kd_payment));
    } catch (e) {
      alert("Gagal reject payment");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="w-full px-8 py-6 bg-white rounded-xl shadow-lg border border-slate-200">
      <div className="flex items-center gap-2 mb-4">
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364l-1.414 1.414M6.05 17.95l-1.414 1.414M17.95 17.95l-1.414-1.414M6.05 6.05L4.636 7.464" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <h2 className="text-2xl font-bold text-slate-800">Log Pembayaran Disetujui</h2>
      </div>
      {payments.length === 0 ? (
        <div className="text-slate-500">Belum ada pembayaran yang di-approve.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm rounded-lg overflow-hidden border border-slate-200">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="px-4 py-2 border text-left w-32">Tanggal</th>
                <th className="px-4 py-2 border text-center w-32">Client</th>
                <th className="px-4 py-2 border text-center w-28">Jenis</th>
                <th className="px-4 py-2 border text-right w-40">Jumlah (Rp)</th>
                <th className="px-4 py-2 border text-left w-40">Reference</th>
                <th className="px-4 py-2 border text-center w-28">Status</th>
                <th className="px-4 py-2 border text-center w-24">Detail</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.kd_payment} className="border-b hover:bg-blue-50 transition">
                  <td className="px-4 py-2 border text-left">{new Date(p.tanggal).toLocaleDateString("id-ID")}</td>
                  <td className="px-4 py-2 border text-center">{p.client_name || '-'}</td>
                  <td className="px-4 py-2 border text-center">
                    {p.jenis === 'dp' ? (
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-orange-100 text-orange-700">DP</span>
                    ) : p.jenis === 'cicilan' ? (
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-purple-100 text-purple-700">Cicilan</span>
                    ) : p.jenis === 'cash' ? (
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-700">Cash</span>
                    ) : p.jenis === 'transfer' ? (
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">Transfer</span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-700">{p.jenis}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 border text-right font-bold text-blue-700">Rp {p.jumlah?.toLocaleString("id-ID")}</td>
                  <td className="px-4 py-2 border text-left">
                    <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded text-xs font-mono text-slate-700">{p.reference || '-'}</span>
                  </td>
                  <td className="px-4 py-2 border text-center">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${p.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-2 border text-center">
                    <button className="px-3 py-1 rounded bg-blue-600 text-white text-xs font-semibold shadow hover:bg-blue-700 transition" onClick={() => setSelected(p)}>Detail</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal detail pembayaran - desain card, z-index tinggi, info lengkap */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center" style={{zIndex: 1000}}>
          <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-lg relative border border-slate-200">
            <button className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-2xl font-bold" onClick={() => setSelected(null)}>&times;</button>
            <div className="flex items-center gap-3 mb-4">
              <span className="inline-block bg-blue-100 text-blue-700 rounded-full p-2">
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364l-1.414 1.414M6.05 17.95l-1.414 1.414M17.95 17.95l-1.414-1.414M6.05 6.05L4.636 7.464" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
              <h3 className="text-xl font-bold">Detail Pembayaran</h3>
            </div>
            <div className="mb-3 flex flex-col gap-2">
              <div><span className="font-semibold">Client:</span> <span className="text-slate-700">{selected.client_name || '-'}</span></div>
              <div><span className="font-semibold">Jenis:</span> <span className="text-slate-700">{selected.jenis}</span></div>
              <div><span className="font-semibold">Jumlah:</span> <span className="text-blue-700 font-bold">Rp {selected.jumlah?.toLocaleString("id-ID")}</span></div>
              <div><span className="font-semibold">Tanggal:</span> <span className="text-slate-700">{new Date(selected.tanggal).toLocaleDateString("id-ID")}</span></div>
              <div><span className="font-semibold">Reference:</span> <span className="font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">{selected.reference || '-'}</span></div>
              <div><span className="font-semibold">Kode Invoice:</span> <span className="font-mono bg-blue-100 px-2 py-1 rounded text-blue-700">{selected.invoice_code || '-'}</span></div>
              <div><span className="font-semibold">Status:</span> <span className="text-green-700 font-bold">{selected.status}</span></div>
              <div><span className="font-semibold">Note:</span> <span className="text-slate-700">{selected.note || '-'}</span></div>
              <div><span className="font-semibold">Kode Transaksi:</span> <span className="text-slate-700">{selected.kd_transaksi || '-'}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
