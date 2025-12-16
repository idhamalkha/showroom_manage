import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Loader2 } from "lucide-react";
import TransaksiMerekCard, { type Brand } from "./TransaksiMerekCard";
import "./TransaksiCarousel.css";
import "./TrxSuccessModal.css";
import "./TransaksiSpinnerOverlay.css";
import "./CicilanDetail.css";
import { API_BASE } from "../../../api/host";
import TransaksiModal from "./TransaksiModal";

const PAGE_SIZE = 8;

function chunk<T>(arr: T[], size: number) {
	const out: T[][] = [];
	for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
	return out;
}

export default function Transaksi({ onTransactionSuccess }: { onTransactionSuccess?: () => void } = {}) {
	const [brands, setBrands] = useState<Brand[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(0);
	const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
	const [isProcessingTrx, setIsProcessingTrx] = useState(false);

	useEffect(() => {
		let mounted = true;
		setLoading(true);
		axios
			.get(`${API_BASE}/api/merek`)
			.then((res) => {
				if (!mounted) return;
				const data = res.data ?? [];
				if (Array.isArray(data)) {
					const mapped = data.map((m: any) => ({ id: String(m.kd_merek ?? m.id ?? m.nama_merek), name: m.nama_merek ?? m.name ?? "", logo: m.logo_url ?? m.logo ?? undefined })) as Brand[];
					setBrands(mapped);
				} else setBrands([]);
			})
			.catch((err) => {
				console.error("fetch brands failed", err);
				if (mounted) setError("Gagal memuat merek");
			})
			.finally(() => {
				if (mounted) setLoading(false);
			});
		return () => { mounted = false; };
	}, []);

	const pages = useMemo(() => chunk(brands, PAGE_SIZE), [brands]);

  const [successTrx, setSuccessTrx] = useState<{ 
    kd_transaksi?: number;
    invoice_id?: string;
    total?: number;
    buyerName?: string | null;
    buyerEmail?: string | null;
    sellerName?: string | null;
    mobil?: any;
    details?: any[];
    metode_pembayaran?: string;
    dp?: number;
    tenor?: number;
    jumlah_cicilan?: number;
    harga?: number;
    estimasi_per_bulan?: number;
  } | null>(null);

	return (
		<div className="transaksi-carousel-root">
      <div className="transaksi-carousel-header">
        <div className="transaksi-carousel-controls">
          <button className="transaksi-carousel-btn" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>‹</button>
          <button className="transaksi-carousel-btn" onClick={() => setPage((p) => Math.min(p + 1, Math.max(0, pages.length - 1)))} disabled={page >= pages.length - 1}>›</button>
        </div>
        <div />
      </div>

			<div className="transaksi-carousel-viewport">
				<div className="transaksi-carousel-track" style={{ "--page": page } as any}>
					{pages.length === 0 ? (
						<div style={{ padding: 18 }} className="transaksi-carousel-empty">{loading ? "Memuat..." : (error ?? "Tidak ada merek untuk ditampilkan")}</div>
					) : (
						pages.map((items, idx) => (
							<div key={idx} className={`transaksi-carousel-page${idx === page ? ' active' : ''}`} aria-hidden={idx !== page}>
								<div className="transaksi-page-grid">
									{Array.from({ length: PAGE_SIZE }).map((_, i) => {
										const b = items[i] as Brand | undefined;
										if (b) return <TransaksiMerekCard key={b.id} brand={b} animate={idx === page} delay={i * 60} onClick={(br) => setSelectedBrand(br)} />;
										return <div key={`ph-${i}`} className="transaksi-merek-card placeholder" aria-hidden />;
									})}
								</div>
							</div>
						))
					)}
				</div>
			</div>

                  {selectedBrand && (
                    <>
                      <TransaksiModal
                        brand={selectedBrand}
                        isProcessing={isProcessingTrx}
                        onClose={() => !isProcessingTrx && setSelectedBrand(null)}
                        onSelect={async (sel) => {
											try {
												setIsProcessingTrx(true);
												console.log('Transaksi selection:', sel);														// Get logged in user data
														const loggedInUser = JSON.parse(localStorage.getItem('user') || '{}');
														if (!loggedInUser.id) {
															alert('Anda harus login terlebih dahulu');
															setSelectedBrand(null);
															return;
														}

														// 1) find or create client by email
														const email = sel?.buyer_email ?? '';
														let kd_client: number | null = null;
														if (email) {
															const resp = await axios.post(`${API_BASE}/client/find-or-create`, { email, nama: sel?.nama_pembeli ?? '' });
															kd_client = resp.data?.kd_client ?? null;
														}

														if (!kd_client) {
															console.warn('No kd_client resolved; aborting transaksi creation');
															setSelectedBrand(null);
															return;
														}

														// 2) build transaksi payload - use logged in user's ID as kd_sales
														const tanggal = new Date().toISOString().slice(0,10);
														const harga = sel.harga ?? 0;
														const details = [{ 
															kd_mobil: sel.kd_mobil, 
															kd_warna: sel.kd_warna ?? null,
															harga: harga, 
															jumlah: 1, 
															subtotal: harga 
														}];
            // compute cicilan-related values and include them in payload
            const dpVal = (sel as any).dp ?? 0;
            const tenorVal = (sel as any).tenor ?? 0;
            const jumlah_cicilan = sel.metode_pembayaran === 'cicilan' ? Math.max(0, (harga ?? 0) - (dpVal ?? 0)) : 0;
            const estimasi_per_bulan = (tenorVal && tenorVal > 0) ? (jumlah_cicilan / tenorVal) : 0;
            const trxPayload = { 
              kd_client, 
              kd_sales: loggedInUser.id,
              tanggal,
              metode_pembayaran: sel.metode_pembayaran ?? 'cash',
              details,
              // send cicilan metadata so backend can echo it immediately
              dp: dpVal,
              jumlah_cicilan: jumlah_cicilan,
              tenor: tenorVal,
              estimasi_per_bulan: estimasi_per_bulan,
              harga: harga
            };														// Log payload for debugging
														console.log('Sending transaksi payload:', trxPayload);

														const createResp = await axios.post(`${API_BASE}/sales/transaksi`, trxPayload);
														console.log('create transaksi response', createResp.data);
														// Make sure we get the transaction ID from the correct response field
														const kd_transaksi = createResp.data?.kd_transaksi || createResp.data?.id;

														// 3) optionally create cicilan
														if (sel.metode_pembayaran === 'cicilan' && kd_transaksi) {
															try {
																const dp = (sel as any).dp ?? 0;
																const tenor = (sel as any).tenor ?? 12;
																const jumlah_cicilan = Math.max(0, (harga ?? 0) - dp);
																await axios.post(`${API_BASE}/sales/transaksi/${kd_transaksi}/cicilan`, { jumlah_cicilan, tenor });
															} catch (err) {
																console.warn('failed to create cicilan', err);
															}
														}

																																										// fetch mobil details for invoice, but fallback to local data if request fails
																																										let mobilDetails: any = null;
																																																								try {
																																																									const mres = await axios.get(`${API_BASE}/sales/mobil/${sel.kd_mobil}`);
																																																									mobilDetails = mres.data;
																																																								} catch (err) {
																																																									console.warn('failed to fetch mobil details for invoice', err);
																																																									mobilDetails = null;
																																																								}


                          // Prefer create response directly (backend now returns kd_transaksi and invoice_id)
                          const resp = createResp.data || {};
                          const serverDetails = resp.details ?? createResp.data?.details ?? null;
                          const sellerName = (loggedInUser && (loggedInUser.nama || loggedInUser.name || loggedInUser.username)) || `Sales #${loggedInUser.id}`;

                          // Resolve values directly from create response
                          let resolvedKd: number | undefined = resp.kd_transaksi || resp.id || resp.kd || undefined;
                          if (!resolvedKd && resp.invoice_id && typeof resp.invoice_id === 'string') {
                            const m = resp.invoice_id.match(/(\d+)/);
                            if (m) resolvedKd = Number(m[1]);
                          }

                          const invoiceId = resp.invoice_id || (resolvedKd ? `INV-${resolvedKd}` : undefined);
                          const detailsFinal = resp.details || serverDetails || [];

                          console.debug('Transaksi created (using createResp):', { resp, resolvedKd, invoiceId, detailsFinal });

                          setSuccessTrx({
                            kd_transaksi: resolvedKd,
                            invoice_id: invoiceId,
                            total: harga,
                            buyerName: sel.nama_pembeli ?? null,
                            buyerEmail: sel.buyer_email ?? null,
                            sellerName: sellerName ?? null,
                            mobil: mobilDetails ? { ...mobilDetails, foto_url: sel.warna_foto_url ?? mobilDetails?.foto_url } : null,
                            details: detailsFinal,
                            metode_pembayaran: resp.metode_pembayaran ?? (sel.metode_pembayaran ?? null),
                            harga: resp.harga !== undefined ? resp.harga : harga,
                            dp: resp.dp !== undefined ? resp.dp : (sel as any).dp ?? null,
                            jumlah_cicilan: resp.jumlah_cicilan !== undefined ? resp.jumlah_cicilan : (sel as any).jumlah_cicilan ?? null,
                            tenor: resp.tenor !== undefined ? resp.tenor : (sel as any).tenor ?? null,
                            estimasi_per_bulan: resp.estimasi_per_bulan !== undefined ? resp.estimasi_per_bulan : (sel as any).estimasi_per_bulan ?? null
                          });
                          // close the transaksi modal now that success data is set - parent controls modal visibility
                          try {
                            setSelectedBrand(null);
                          } catch (err) {
                            console.warn('failed to close transaksi modal after success', err);
                          }
                          
                          // Signal dashboard to refresh
                          localStorage.setItem('dashSalesRefresh', 'true');
                          
                          // Trigger dashboard refresh for same-window updates
                          if (onTransactionSuccess) {
                            onTransactionSuccess();
                          }
													} catch (err: any) {
														console.error('Failed creating transaksi', err);
														// show simple alert on error and close modal
											alert('Gagal membuat transaksi');
                      } finally {
                          setIsProcessingTrx(false);
                        }
                      }}
                    />
              </>
            )}

						{/* Global overlay when processing but modal is NOT open (prevents double overlay) */}
						{isProcessingTrx && !selectedBrand && (
							<div className="tx-spinner-overlay">
								<div className="tx-spinner-container">
									<Loader2 size={52} className="text-emerald-500 animate-spin" strokeWidth={2.5} />
									<div className="tx-spinner-text">Memproses transaksi...</div>
								</div>
							</div>
						)}
                  {successTrx && (
                    <div className="trx-success-overlay">
                      <div className="trx-success-modal">
                        <h3>Transaksi Berhasil</h3>
                        <div className="invoice-root" id="invoice-root">
                          <div className="invoice-header">
                            <div className="left">
                              <h4>INVOICE {successTrx.invoice_id ?? '-'}</h4>
                              <div>{new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</div>
                            </div>
                            <div className="right">
                              <div className="invoice-total">
                                <div className="amount">Rp{Number(successTrx.total ?? 0).toLocaleString('id-ID')}</div>
                                <div className="label">Total Amount</div>
                              </div>
                            </div>
                          </div>

                          <div className="invoice-info">
                            <div className="invoice-info-group">
                              <h5>Pembeli</h5>
                              <p>{successTrx.buyerName}</p>
                              <p style={{ fontSize: '13px', color: '#64748b' }}>{successTrx.buyerEmail}</p>
                            </div>
                            <div className="invoice-info-group">
                              <h5>Sales</h5>
                              <p>{successTrx.sellerName}</p>
                            </div>
                            <div className="invoice-info-group">
                              <h5>Transaction ID</h5>
                              <p>{successTrx.kd_transaksi ? `TRX-${successTrx.kd_transaksi}` : '-'}</p>
                            </div>
                          </div>

                          {successTrx.details && successTrx.details.length > 0 ? (
                            <div className="invoice-items">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Item</th>
                                    <th style={{ textAlign: 'center' }}>Qty</th>
                                    <th style={{ textAlign: 'right' }}>Harga</th>
                                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {successTrx.details.map((d: any, i: number) => (
                                    <tr key={i}>
                                      <td>{d.nama_mobil ?? `Mobil #${d.kd_mobil}`}</td>
                                      <td style={{ textAlign: 'center' }}>{d.jumlah ?? 1}</td>
                                      <td style={{ textAlign: 'right' }}>Rp{Number(d.harga ?? 0).toLocaleString('id-ID')}</td>
                                      <td style={{ textAlign: 'right' }}>Rp{Number((d.subtotal || (d.harga * (d.jumlah ?? 1)) || 0)).toLocaleString('id-ID')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {/* Penjelasan cicilan di bawah tabel faktur */}
                              {(successTrx?.metode_pembayaran === 'cicilan' && successTrx?.jumlah_cicilan && successTrx?.tenor) && (
                                <div className="cicilan-detail-container">
                                  <div className="cicilan-detail-header">
                                    <div className="cicilan-detail-icon">💳</div>
                                    <h4 className="cicilan-detail-title">Detail Cicilan</h4>
                                  </div>
                                  <div className="cicilan-grid">
                                    <div className="cicilan-item">
                                      <span className="cicilan-item-label">Harga Kendaraan</span>
                                      <div className="cicilan-item-value">Rp{Number(successTrx.harga ?? 0).toLocaleString('id-ID')}</div>
                                    </div>
                                    <div className="cicilan-item">
                                      <span className="cicilan-item-label">Uang Muka (DP)</span>
                                      <div className="cicilan-item-value accent">Rp{Number(successTrx.dp ?? 0).toLocaleString('id-ID')}</div>
                                    </div>
                                    <div className="cicilan-item">
                                      <span className="cicilan-item-label">Sisa Cicilan</span>
                                      <div className="cicilan-item-value success">Rp{Number(successTrx.jumlah_cicilan ?? 0).toLocaleString('id-ID')}</div>
                                    </div>
                                    <div className="cicilan-item">
                                      <span className="cicilan-item-label">Tenor</span>
                                      <div className="cicilan-item-value">{successTrx.tenor} bulan</div>
                                    </div>
                                    <div className="cicilan-item">
                                      <span className="cicilan-item-label">Cicilan per Bulan</span>
                                      <div className="cicilan-item-value accent">Rp{Number(successTrx.estimasi_per_bulan ?? 0).toLocaleString('id-ID')}</div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : null}

                          {successTrx.mobil ? (
                            <div className="car-specs">
                              <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
                                <div style={{ width: 200, flexShrink: 0 }}>
                                  {successTrx.mobil.foto_url ? (
                                    <img 
                                      src={successTrx.mobil.foto_url} 
                                      style={{ width: '100%', height: 'auto', borderRadius: 8 }} 
                                      alt={successTrx.mobil.nama_mobil} 
                                    />
                                  ) : null}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <h4 style={{ margin: '0 0 8px', color: '#0f172a' }}>{successTrx.mobil.nama_mobil}</h4>
                                  <div style={{ color: '#64748b', fontSize: 14 }}>
                                    {successTrx.mobil.kelas_mobil} • {successTrx.mobil.tahun_keluaran}
                                  </div>
                                </div>
                              </div>
                              <div className="car-specs-grid">
                                <div className="car-spec-item">
                                  <div className="car-spec-label">Engine</div>
                                  <div className="car-spec-value">{successTrx.mobil.engine_cc} cc</div>
                                </div>
                                <div className="car-spec-item">
                                  <div className="car-spec-label">Power</div>
                                  <div className="car-spec-value">{successTrx.mobil.power_ps} PS</div>
                                </div>
                                <div className="car-spec-item">
                                  <div className="car-spec-label">Transmisi</div>
                                  <div className="car-spec-value">{successTrx.mobil.transmisi || '-'}</div>
                                </div>
                                <div className="car-spec-item">
                                  <div className="car-spec-label">Drivetrain</div>
                                  <div className="car-spec-value">{successTrx.mobil.drivetrain || '-'}</div>
                                </div>
                                <div className="car-spec-item">
                                  <div className="car-spec-label">Fuel Type</div>
                                  <div className="car-spec-value">{successTrx.mobil.jenis_bahan_bakar || '-'}</div>
                                </div>
                                <div className="car-spec-item">
                                  <div className="car-spec-label">Seats</div>
                                  <div className="car-spec-value">{successTrx.mobil.seats || '-'}</div>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="invoice-actions">
                          <button onClick={() => setSuccessTrx(null)}>
                            Tutup
                          </button>
                          <button onClick={() => {
                            // open printable window
                            const node = document.getElementById('invoice-root');
                            if (!node) return;
                            const w = window.open('', '_blank');
                            if (!w) return;
                            w.document.write('<html><head><title>Invoice</title>');
                            w.document.write('<style>');
                            w.document.write(`
                              body { font-family: -apple-system, system-ui, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                              .invoice-root { background: #fff; }
                              .invoice-header { display: flex; justify-content: space-between; margin-bottom: 24px; }
                              .invoice-header h4 { margin: 0 0 4px; color: #0d9488; }
                              .invoice-info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 24px; padding: 16px; background: #f8fafc; border-radius: 8px; }
                              .invoice-info h5 { margin: 0 0 8px; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
                              .invoice-info p { margin: 0; color: #1e293b; font-weight: 500; }
                              table { width: 100%; border-collapse: collapse; margin: 16px 0; }
                              th, td { padding: 12px; text-align: left; border-bottom: 1px solid #f1f5f9; }
                              th { background: #f8fafc; font-weight: 600; color: #475569; }
                              .car-specs { background: #f8fafc; padding: 16px; border-radius: 8px; margin-top: 16px; }
                              .car-specs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
                              .car-spec-item { margin-bottom: 8px; }
                              .car-spec-label { font-size: 13px; color: #64748b; margin-bottom: 4px; }
                              .car-spec-value { color: #1e293b; font-weight: 500; }
                              .invoice-total { text-align: right; }
                              .invoice-total .amount { font-size: 24px; font-weight: 600; color: #0d9488; }
                              .invoice-total .label { color: #64748b; font-size: 14px; }
                              .cicilan-detail-container { margin-top: 32px; padding: 24px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; border-left: 4px solid #7c3aed; }
                              .cicilan-detail-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
                              .cicilan-detail-icon { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: #7c3aed; color: white; border-radius: 8px; font-weight: 600; font-size: 14px; }
                              .cicilan-detail-title { font-size: 16px; font-weight: 700; color: #1f2937; margin: 0; }
                              .cicilan-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
                              .cicilan-item { padding: 12px; background: white; border-radius: 8px; border: 1px solid #e5e7eb; }
                              .cicilan-item-label { font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; display: block; }
                              .cicilan-item-value { font-size: 18px; font-weight: 700; color: #1f2937; }
                              .cicilan-item-value.accent { color: #7c3aed; }
                              .cicilan-item-value.success { color: #059669; }
                              @media print {
                                body { padding: 0; }
                                .invoice-actions { display: none; }
                              }
                            `);
                            w.document.write('</style></head><body>');
                            w.document.write(node.innerHTML);
                            w.document.write('</body></html>');
                            w.document.close();
                            w.focus();
                            setTimeout(() => { try { w.print(); } catch {} }, 500);
                          }}>
                            Print
                          </button>
                          <button 
                            className="primary" 
                            onClick={async () => {
                              try {
                                const to = successTrx.buyerEmail;
                                if (!to) { alert('No buyer email available'); return; }
                                const resp = await axios.post(
                                  `${API_BASE}/sales/transaksi/${successTrx.kd_transaksi}/send-invoice`, 
                                  { to_email: to, attach_pdf: true }
                                );
                                if (resp.data?.sent) {
                                  alert(
                                    resp.data?.pdf_attached
                                      ? 'Invoice dikirim ke email pembeli dengan lampiran PDF'
                                      : 'Invoice dikirim ke email pembeli'
                                  );
                                }
                              } catch (err) {
                                console.error('failed to send invoice', err);
                                alert('Gagal mengirim invoice');
                              }
                            }}
                          >
                            Kirim ke email pembeli
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
		</div>
	);
}
