import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../api/host';
import { useAuth } from '../../providers/AuthProvider';
import { CheckCircleIcon, ExclamationTriangleIcon, ClockIcon, FireIcon, BanknotesIcon, ChartBarIcon, UserCircleIcon, UsersIcon } from '@heroicons/react/24/outline';
import { Popover, Transition } from '@headlessui/react';
import { Fragment, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFloating, shift, flip, offset, autoUpdate } from '@floating-ui/react';

const tabs = [
  { key: 'aging', label: 'Aging' },
  { key: 'cashflow', label: 'Cashflow' },
  { key: 'penjualan', label: 'Penjualan' },
];

export default function LaporanKeuangan() {
  const [activeTab, setActiveTab] = useState('aging');
  const [tabAnim, setTabAnim] = useState<'fade-in' | 'fade-out'>('fade-in');

  const handleTabClick = (key: string) => {
    setTabAnim('fade-out');
    setTimeout(() => {
      setActiveTab(key);
      setTabAnim('fade-in');
    }, 120);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Laporan Keuangan</h1>
      <div className="flex space-x-2 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`px-5 py-2 rounded-full font-semibold shadow transition-all duration-200 focus:outline-none 
              ${activeTab === tab.key
                ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white scale-105 shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700'}
            `}
            style={{ boxShadow: activeTab === tab.key ? '0 2px 8px rgba(59,130,246,0.15)' : undefined }}
            onClick={() => handleTabClick(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={`bg-white rounded shadow p-4 min-h-[300px] transition-all duration-200 ${tabAnim === 'fade-in' ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
        {activeTab === 'aging' && <AgingReport />}
        {activeTab === 'cashflow' && <CashflowReport />}
        {activeTab === 'penjualan' && <PenjualanReport />}
      </div>
    </div>
  );
}

function AgingReport() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAging() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/finance/invoices/aging`, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        if (!res.ok) throw new Error('Gagal mengambil data aging');
        const json = await res.json();
        setData(json);
      } catch (e: any) {
        setError(e.message || 'Gagal mengambil data aging');
      } finally {
        setLoading(false);
      }
    }
    fetchAging();
  }, [accessToken]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!data) return <div>Data tidak tersedia.</div>;

  const badge = (label: string, color: string, icon: React.ReactNode) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${color}`}>
      {icon}
      {label}
    </span>
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <ClockIcon className="w-6 h-6 text-blue-500" />
        <h2 className="text-xl font-bold">Aging Report</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[350px] w-full border text-sm rounded-lg overflow-hidden shadow-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 border">Kategori</th>
              <th className="px-3 py-2 border">Jumlah Invoice</th>
              <th className="px-3 py-2 border">Total (Rp)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-3 py-2 border">
                {badge('Current', 'bg-green-100 text-green-700', <CheckCircleIcon className="w-4 h-4" />)}
              </td>
              <td className="px-3 py-2 border text-center">{data.current?.count ?? 0}</td>
              <td className="px-3 py-2 border text-right">{data.current?.amount?.toLocaleString('id-ID')}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 border">
                {badge('30-60 Hari', 'bg-yellow-100 text-yellow-700', <ExclamationTriangleIcon className="w-4 h-4" />)}
              </td>
              <td className="px-3 py-2 border text-center">{data.days_30_60?.count ?? 0}</td>
              <td className="px-3 py-2 border text-right">{data.days_30_60?.amount?.toLocaleString('id-ID')}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 border">
                {badge('60-90 Hari', 'bg-orange-100 text-orange-700', <ExclamationTriangleIcon className="w-4 h-4" />)}
              </td>
              <td className="px-3 py-2 border text-center">{data.days_60_90?.count ?? 0}</td>
              <td className="px-3 py-2 border text-right">{data.days_60_90?.amount?.toLocaleString('id-ID')}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 border">
                {badge('90+ Hari', 'bg-red-100 text-red-700', <FireIcon className="w-4 h-4" />)}
              </td>
              <td className="px-3 py-2 border text-center">{data.days_90_plus?.count ?? 0}</td>
              <td className="px-3 py-2 border text-right">{data.days_90_plus?.amount?.toLocaleString('id-ID')}</td>
            </tr>
            <tr className="font-bold bg-blue-50">
              <td className="px-3 py-2 border text-blue-900">Total</td>
              <td className="px-3 py-2 border text-center text-blue-900">{data.total?.count ?? 0}</td>
              <td className="px-3 py-2 border text-right text-blue-900">{data.total?.amount?.toLocaleString('id-ID')}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-xs text-gray-500">
        <span className="inline-block mr-2">* <CheckCircleIcon className="w-3 h-3 inline" /> Current: Belum jatuh tempo</span>
        <span className="inline-block mr-2">* <ExclamationTriangleIcon className="w-3 h-3 inline" /> 30-90 hari: Overdue</span>
        <span className="inline-block mr-2">* <FireIcon className="w-3 h-3 inline" /> 90+ hari: Overdue kritis</span>
      </div>
    </div>
  );
}

function CashflowReport() {
  const { accessToken } = useAuth();
  const [cashflowTab, setCashflowTab] = useState<'pemasukan' | 'pengeluaran'>('pemasukan');
  const [start, setStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [end, setEnd] = useState(() => {
    // Set to last day of current month to include end-of-month payroll
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return d.toISOString().slice(0, 10);
  });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!start || !end) return;
    async function fetchCashflow() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/finance/report/cashflow?start=${start}&end=${end}`, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        if (!res.ok) {
          const errorText = await res.text();
          console.error('Cashflow API error:', errorText);
          throw new Error('Gagal mengambil data cashflow');
        }
        const json = await res.json();
        console.log('Cashflow response:', json);
        setData(json);
      } catch (e: any) {
        setError(e.message || 'Gagal mengambil data cashflow');
      } finally {
        setLoading(false);
      }
    }
    fetchCashflow();
  }, [accessToken, start, end]);

  const badgeJenis = (jenis: string) => {
    const map: any = {
      transfer: 'bg-blue-100 text-blue-700',
      cash: 'bg-green-100 text-green-700',
      cicilan: 'bg-yellow-100 text-yellow-700',
      check: 'bg-purple-100 text-purple-700',
      other: 'bg-gray-100 text-gray-700',
    };
    return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[jenis] || 'bg-gray-100 text-gray-700'}`}>{jenis}</span>;
  };

  // Filter data by tab
  const payments = data?.payments ?? data ?? [];
  const pemasukan = payments.filter((p: any) => (p.in ?? 0) > 0);
  const pengeluaran = payments.filter((p: any) => (p.out ?? 0) > 0);

  const totalPemasukan = pemasukan.reduce((sum: number, p: any) => sum + (p.in ?? 0), 0);
  const totalPengeluaran = pengeluaran.reduce((sum: number, p: any) => sum + (p.out ?? 0), 0);
  const displayData = cashflowTab === 'pemasukan' ? pemasukan : pengeluaran;
  const displayTotal = cashflowTab === 'pemasukan' ? totalPemasukan : totalPengeluaran;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <BanknotesIcon className="w-6 h-6 text-green-500" />
        <h2 className="text-xl font-bold">Cashflow</h2>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <label className="font-medium">Periode:</label>
        <input type="date" value={start} onChange={e => setStart(e.target.value)} className="border border-gray-300 rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        <span className="text-gray-500">sampai</span>
        <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="border border-gray-300 rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>

      {/* Tabs for Pemasukan/Pengeluaran */}
      <div className="flex gap-2 mb-3">
        <button
          className={`px-5 py-2.5 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 ${
            cashflowTab === 'pemasukan'
              ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg scale-105 shadow-green-500/30'
              : 'bg-white border border-gray-200 text-gray-700 hover:border-green-300 hover:text-green-700'
          }`}
          onClick={() => setCashflowTab('pemasukan')}
        >
          💰 Pemasukan
        </button>
        <button
          className={`px-5 py-2.5 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 ${
            cashflowTab === 'pengeluaran'
              ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg scale-105 shadow-red-500/30'
              : 'bg-white border border-gray-200 text-gray-700 hover:border-red-300 hover:text-red-700'
          }`}
          onClick={() => setCashflowTab('pengeluaran')}
        >
          💸 Pengeluaran
        </button>
      </div>

      {loading && <div className="text-center py-8 text-gray-500">⏳ Loading data...</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{error}</div>}
      {data && (
        <div>
          <div className={`mb-4 font-semibold rounded-lg px-4 py-3 inline-block ${
            cashflowTab === 'pemasukan'
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-900 border border-green-200'
              : 'bg-gradient-to-r from-red-50 to-pink-50 text-red-900 border border-red-200'
          }`}>
            Total {cashflowTab === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}: 
            <span className={`font-bold ml-2 ${cashflowTab === 'pemasukan' ? 'text-green-700' : 'text-red-700'}`}>
              Rp {displayTotal.toLocaleString('id-ID')}
            </span>
          </div>

          {/* Empty State */}
          {displayData.length === 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
              <div className="text-5xl mb-3">{cashflowTab === 'pemasukan' ? '💼' : '📦'}</div>
              <div className="text-blue-900 font-semibold">Tidak ada data {cashflowTab === 'pemasukan' ? 'pemasukan' : 'pengeluaran'}</div>
              <div className="text-blue-600 text-sm mt-1">
                {cashflowTab === 'pemasukan' 
                  ? 'Belum ada pembayaran dalam periode ini'
                  : 'Belum ada pengeluaran gaji atau biaya dalam periode ini'}
              </div>
            </div>
          )}

          {/* Scrollable Table with Sticky Header */}
          {displayData.length > 0 && (
            <div className="overflow-x-auto border rounded-lg shadow-sm">
              <div className="max-h-[400px] overflow-y-auto hide-scrollbar">
                <table className="min-w-[350px] w-full border-collapse text-sm">
                  <thead className="sticky top-[-1px] z-20 bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 border text-left bg-gray-100 font-semibold text-gray-700">Tanggal</th>
                      <th className="px-3 py-2 border text-right bg-gray-100 font-semibold text-gray-700">Jumlah (Rp)</th>
                      <th className="px-3 py-2 border text-left bg-gray-100 font-semibold text-gray-700">Jenis</th>
                      <th className="px-3 py-2 border text-left bg-gray-100 font-semibold text-gray-700">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayData.map((p: any) => (
                      <tr key={p.kd_payment ?? p.kd_payroll ?? p.reference ?? p.tanggal ?? p.date} className="hover:bg-gray-50 transition border-b">
                        <td className="px-3 py-2 border text-gray-700">{p.tanggal ?? p.date ?? '-'}</td>
                        <td className="px-3 py-2 border text-right font-semibold text-gray-900">
                          {(cashflowTab === 'pemasukan' ? (p.in ?? 0) : (p.out ?? 0))?.toLocaleString('id-ID')}
                        </td>
                        <td className="px-3 py-2 border">{badgeJenis(p.jenis ?? p.type ?? '')}</td>
                        <td className="px-3 py-2 border text-gray-600 font-mono text-xs">{p.reference ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PenjualanReport() {
    // Popover for client
    function ClientPopover({ transaksi }: { transaksi: any[] }) {
      const { refs, floatingStyles } = useFloating({
        placement: 'bottom',
        middleware: [offset(8), flip(), shift()],
        whileElementsMounted: autoUpdate,
      });
      return (
        <Popover className="relative inline-block">
          <Popover.Button ref={refs.setReference} className="focus:outline-none">
            <UsersIcon className="w-6 h-6 text-blue-600 hover:text-blue-800 transition" />
            <span className="ml-1 text-xs font-semibold text-blue-700">{getClientSummary(transaksi).length}</span>
          </Popover.Button>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
          >
            <Popover.Panel static>
              {createPortal(
                <div
                  ref={refs.setFloating}
                  style={floatingStyles}
                  className="z-[9999] w-56 bg-white border border-blue-200 rounded-lg shadow-lg p-4 animate-fade-in"
                >
                  <div className="font-bold text-blue-700 mb-2">Client ({getClientSummary(transaksi).length})</div>
                  <ul className="list-disc ml-4">
                    {getClientSummary(transaksi).map((c, i) => (
                      <li key={i} className="mb-1">{c.nama} <span className="text-xs text-gray-500">({c.count} transaksi)</span></li>
                    ))}
                  </ul>
                </div>,
                document.body
              )}
            </Popover.Panel>
          </Transition>
        </Popover>
      );
    }

    // Popover for sales
    function SalesPopover({ transaksi }: { transaksi: any[] }) {
      const { refs, floatingStyles } = useFloating({
        placement: 'bottom',
        middleware: [offset(8), flip(), shift()],
        whileElementsMounted: autoUpdate,
      });
      return (
        <Popover className="relative inline-block">
          <Popover.Button ref={refs.setReference} className="focus:outline-none">
            <UserCircleIcon className="w-6 h-6 text-purple-600 hover:text-purple-800 transition" />
            <span className="ml-1 text-xs font-semibold text-purple-700">{getSalesSummary(transaksi).length}</span>
          </Popover.Button>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
          >
            <Popover.Panel static>
              {createPortal(
                <div
                  ref={refs.setFloating}
                  style={floatingStyles}
                  className="z-[9999] w-56 bg-white border border-purple-200 rounded-lg shadow-lg p-4 animate-fade-in"
                >
                  <div className="font-bold text-purple-700 mb-2">Sales ({getSalesSummary(transaksi).length})</div>
                  <ul className="list-disc ml-4">
                    {getSalesSummary(transaksi).map((s, i) => (
                      <li key={i} className="mb-1">{s.nama} <span className="text-xs text-gray-500">({s.count} transaksi)</span></li>
                    ))}
                  </ul>
                </div>,
                document.body
              )}
            </Popover.Panel>
          </Transition>
        </Popover>
      );
    }
  const { accessToken } = useAuth();
  const [start, setStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [end, setEnd] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!start || !end) return;
    async function fetchSales() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/finance/report/sales?start=${start}&end=${end}`, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        if (!res.ok) {
          const errorText = await res.text();
          console.error('Penjualan API error:', errorText);
          throw new Error('Gagal mengambil data penjualan');
        }
        const json = await res.json();
        console.log('Penjualan response:', json);
        setData(json);
      } catch (e: any) {
        setError(e.message || 'Gagal mengambil data penjualan');
      } finally {
        setLoading(false);
      }
    }
    fetchSales();
  }, [accessToken, start, end]);

  // Calculate total sales from array
  const [expanded, setExpanded] = useState<{ [date: string]: 'client' | 'sales' | null }>({});
  const totalSales = Array.isArray(data)
    ? data.reduce((sum, item) => sum + (item.total_sales || 0), 0)
    : 0;

  // Helper to group and count clients/sales per day
  const getClientSummary = (trxList: any[]) => {
    const map: Record<string, { nama: string, count: number }> = {};
    trxList.forEach(t => {
      const key = t.nama_client || '-';
      if (!map[key]) map[key] = { nama: key, count: 0 };
      map[key].count++;
    });
    return Object.values(map);
  };
  const getSalesSummary = (trxList: any[]) => {
    const map: Record<string, { nama: string, count: number }> = {};
    trxList.forEach(t => {
      const key = t.nama_sales || '-';
      if (!map[key]) map[key] = { nama: key, count: 0 };
      map[key].count++;
    });
    return Object.values(map);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <ChartBarIcon className="w-6 h-6 text-indigo-500" />
        <h2 className="text-xl font-bold">Laporan Penjualan</h2>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <label>Periode:</label>
        <input type="date" value={start} onChange={e => setStart(e.target.value)} className="border rounded px-2 py-1" />
        <span>-</span>
        <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="border rounded px-2 py-1" />
      </div>
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-500">{error}</div>}
      {Array.isArray(data) && (
        <div>
          <div className="mb-2 font-semibold text-indigo-800 bg-indigo-50 rounded px-3 py-2 inline-block">
            Total Penjualan: <span className="text-indigo-700 font-bold">Rp {totalSales.toLocaleString('id-ID')}</span>
          </div>
          <div className="overflow-x-auto border rounded-lg shadow-sm">
            <div className="max-h-[400px] overflow-y-auto hide-scrollbar">
              <table className="min-w-[350px] w-full border-collapse text-sm">
                <thead className="sticky top-[-1px] z-20 bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 border text-left bg-gray-100">Tanggal</th>
                    <th className="px-3 py-2 border text-right bg-gray-100">Total Harga (Rp)</th>
                    <th className="px-3 py-2 border text-center bg-gray-100">Client</th>
                    <th className="px-3 py-2 border text-center bg-gray-100">Sales</th>
                    <th className="px-3 py-2 border text-center bg-gray-100">Transaksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-2">Tidak ada data</td></tr>
                  )}
                  {data.map((day: any) => (
                    <Fragment key={day.date}>
                      <tr>
                        <td className="px-3 py-2 border">{day.date}</td>
                        <td className="px-3 py-2 border text-right">{day.total_sales?.toLocaleString('id-ID')}</td>
                        <td className="px-3 py-2 border text-center">
                          <ClientPopover transaksi={day.transaksi} />
                        </td>
                        <td className="px-3 py-2 border text-center">
                          <SalesPopover transaksi={day.transaksi} />
                        </td>
                        <td className="px-3 py-2 border text-center">
                          {day.count} transaksi
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
