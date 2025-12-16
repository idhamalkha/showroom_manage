import React, { useState } from "react";
import axios from "../../api/axios";
import LoadingSpinner from "../LoadingSpinner";

interface MutasiRow {
  tanggal: string;
  deskripsi: string;
  debit: number;
  kredit: number;
  saldo: number;
  reference: string;
}

interface ReconcileResult {
  mutasi: MutasiRow;
  payment: number | null;
}

export default function BankRekonsiliasi() {
  const [mutasi, setMutasi] = useState<MutasiRow[]>([]);
  const [results, setResults] = useState<ReconcileResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", e.target.files[0]);
      const res = await axios.post("/finance/mutasi/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMutasi(res.data.mutasi || []);
      setStep("review");
    } catch (e: any) {
      setError(e?.message || "Gagal upload file mutasi");
    } finally {
      setLoading(false);
    }
  }

  async function handleReconcile() {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post("/finance/mutasi/reconcile", mutasi);
      setResults(res.data.results || []);
    } catch (e: any) {
      setError(e?.message || "Gagal rekonsiliasi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow dashsales-card">
      <h2 className="text-xl font-semibold mb-4">Rekonsiliasi Mutasi Bank</h2>
      {loading && <LoadingSpinner />}
      {error && <div className="text-red-600 mb-2">{error}</div>}
      {step === "upload" && (
        <div className="space-y-4">
          <input type="file" accept=".csv" onChange={handleUpload} className="block" />
          <div className="text-slate-500 text-sm">Upload file mutasi bank (format CSV, header: Tanggal,Deskripsi,Debit,Kredit,Saldo,Reference)</div>
        </div>
      )}
      {step === "review" && (
        <>
          <div className="mb-4">
            <button
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              onClick={handleReconcile}
              disabled={loading}
            >
              Cocokkan Otomatis
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-2 py-1 border">Tanggal</th>
                  <th className="px-2 py-1 border">Deskripsi</th>
                  <th className="px-2 py-1 border">Debit</th>
                  <th className="px-2 py-1 border">Kredit</th>
                  <th className="px-2 py-1 border">Saldo</th>
                  <th className="px-2 py-1 border">Reference</th>
                </tr>
              </thead>
              <tbody>
                {mutasi.map((m, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-2 py-1 border">{m.tanggal}</td>
                    <td className="px-2 py-1 border">{m.deskripsi}</td>
                    <td className="px-2 py-1 border text-right">{m.debit.toLocaleString("id-ID")}</td>
                    <td className="px-2 py-1 border text-right">{m.kredit.toLocaleString("id-ID")}</td>
                    <td className="px-2 py-1 border text-right">{m.saldo.toLocaleString("id-ID")}</td>
                    <td className="px-2 py-1 border">{m.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {results.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold mb-2">Hasil Rekonsiliasi</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-2 py-1 border">Tanggal</th>
                      <th className="px-2 py-1 border">Deskripsi</th>
                      <th className="px-2 py-1 border">Kredit</th>
                      <th className="px-2 py-1 border">Reference</th>
                      <th className="px-2 py-1 border">Cocok Payment?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-2 py-1 border">{r.mutasi.tanggal}</td>
                        <td className="px-2 py-1 border">{r.mutasi.deskripsi}</td>
                        <td className="px-2 py-1 border text-right">{r.mutasi.kredit.toLocaleString("id-ID")}</td>
                        <td className="px-2 py-1 border">{r.mutasi.reference}</td>
                        <td className="px-2 py-1 border">
                          {r.payment ? (
                            <span className="text-green-600 font-semibold">Cocok (#{r.payment})</span>
                          ) : (
                            <span className="text-slate-400">Tidak ada</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
