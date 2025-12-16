import { useEffect, useMemo, useState, useRef } from 'react';
import axios from 'axios';
import { API_BASE } from '../../../api/host';
import './TransaksiMerekCard.css';
import './TransaksiCarousel.css';
import './TransaksiModal.css';

type Mobil = {
  kd_mobil?: number;
  nama_mobil: string;
  kelas_mobil?: string | null;
  foto_url?: string | null;
  harga_mobil?: number | null;
  harga_off_road?: number | null;
  harga_on_road?: number | null;
  status?: string | null;
  transmisi?: string | null;
  drivetrain?: string | null;
  jenis_bahan_bakar?: string | null;
  tahun_keluaran?: number | null;
};

export default function TransaksiModal({ brand, onClose, onSelect, isProcessing = false }: { brand: { id: string; name: string; logo?: string }, onClose: () => void, onSelect?: (selection: { kd_mobil?: number; type: 'off'|'on'; harga?: number; kd_warna?: number | null; warna_foto_url?: string | null; metode_pembayaran?: 'cash'|'cicilan'; buyer_email?: string | null; nama_pembeli?: string; tenor?: number; dp?: number }) => void, isProcessing?: boolean }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [q, setQ] = useState('');
  const [vehicles, setVehicles] = useState<Mobil[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<Mobil | null>(null);
  const [modelColors, setModelColors] = useState<any[]>([]);
  const [selectedColorUrl, setSelectedColorUrl] = useState<string | null>(null);
  const [selectedKdWarna, setSelectedKdWarna] = useState<number | null>(null);
  const [selectedVariantOption, setSelectedVariantOption] = useState<{ kd_mobil?: number; type: 'off' | 'on' } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'cicilan'>('cash');
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [tenor, setTenor] = useState<number>(12);
  const [dp, setDp] = useState<number>(0);
  const [dpInput, setDpInput] = useState<string>('');
  const [step, setStep] = useState<'select' | 'variant' | 'transaction'>('select');

  useEffect(() => {
    let mounted = true;
    async function fetchVehicles() {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/sales/mobil`, { params: { kd_merek: brand.id } });
        if (!mounted) return;
        const data = res.data ?? [];
        if (Array.isArray(data)) {
          const mapped = data.map((v: any) => ({
            kd_mobil: v.kd_mobil ?? v.id,
            nama_mobil: v.nama_mobil ?? v.name ?? '',
            kelas_mobil: v.kelas_mobil ?? null,
            foto_url: v.foto_url ?? null,
            harga_mobil: v.harga_mobil ?? null,
            harga_off_road: v.harga_off_road ?? v.harga_off ?? null,
            harga_on_road: v.harga_on_road ?? v.harga_on ?? null,
            status: v.status ?? null,
            transmisi: v.transmisi ?? null,
              drivetrain: v.drivetrain ?? null,
              jenis_bahan_bakar: v.jenis_bahan_bakar ?? null,
            tahun_keluaran: v.tahun_keluaran ?? v.tahun ?? null,
          }));
          setVehicles(mapped);
        } else setVehicles([]);
      } catch (err) {
        console.error('fetch vehicles failed', err);
        setVehicles([]);
      } finally { if (mounted) setLoading(false); }
    }
    fetchVehicles();
    return () => { mounted = false; };
  }, [brand.id]);

  const classes = useMemo(() => {
    const set = new Set<string>();
    vehicles.forEach(v => { if (v.kelas_mobil) set.add(String(v.kelas_mobil)); });
    return Array.from(set);
  }, [vehicles]);

  useEffect(() => {
    // default active tab to first class if present
    if (classes.length > 0 && !activeTab) setActiveTab(classes[0]);
    if (classes.length === 0) setActiveTab(null);
  }, [classes]);

  // Close modal on Escape, but only if this modal is the top-most overlay
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      try {
        // collect candidate overlays/modals
        const nodes = Array.from(document.querySelectorAll('.avm-overlay, .avm-modal, .mobil-overlay, .mobil-modal, .transaksi-modal-overlay, .transaksi-modal')) as HTMLElement[];
        let topEl: HTMLElement | null = null;
        let topZ = -Infinity;
        for (const n of nodes) {
          if (!n) continue;
          // skip if not visible
          const style = window.getComputedStyle(n);
          if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0) continue;
          const rect = n.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          const zVal = style.zIndex;
          const z = (!zVal || zVal === 'auto') ? 0 : (Number.isFinite(parseInt(zVal as string, 10)) ? parseInt(zVal as string, 10) : 0);
          if (z > topZ) { topZ = z; topEl = n; }
        }

        // if top-most element exists and is not this modal (or inside it), do nothing
        if (topEl && rootRef.current && !rootRef.current.contains(topEl) && topEl !== rootRef.current) {
          return;
        }

        // otherwise close this modal
        try { e.preventDefault(); e.stopPropagation(); } catch {}
        onClose();
      } catch (err) {
        // fallback: close
        try { e.preventDefault(); e.stopPropagation(); } catch {}
        onClose();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  // handle selecting a car to show variants / colors
  async function handleCardClick(v: Mobil) {
    setSelectedModel(v);
    setSelectedVariantOption(null);
    setStep('variant');
    // load colors for this vehicle
    if (!v.kd_mobil) {
      setModelColors([]);
      setSelectedColorUrl(v.foto_url ?? null);
      return;
    }
    try {
      const res = await axios.get(`${API_BASE}/api/mobil/${v.kd_mobil}/warna`);
      const data = Array.isArray(res.data) ? res.data : [];
      const mapped = data.map((c: any) => ({ ...c }));
      setModelColors(mapped);
      // choose primary foto if present, else first foto, else variant foto
      const primary = mapped.find((c: any) => c.is_primary && c.foto_url);
      const first = mapped.find((c: any) => c.foto_url);
      const selected = primary || first;
      setSelectedColorUrl((primary && primary.foto_url) ?? (first && first.foto_url) ?? v.foto_url ?? null);
      setSelectedKdWarna((selected && selected.kd_warna) ?? null);
    } catch (err) {
      console.error('failed to load colors', err);
      setModelColors([]);
      setSelectedColorUrl(v.foto_url ?? null);
    }
  }


  // helper: try to guess hex color from a common color name (includes Indonesian tokens)
  function getColorFromName(name?: string | null) {
    if (!name) return null;
    const n = name.toLowerCase();
    const map: Record<string,string> = {
      'silver': '#c0c0c0', 'metallic': '#bfc5c9', 'hitam': '#111111', 'black': '#111111', 'putih': '#ffffff', 'white': '#ffffff',
      'abu': '#9ca3af', 'abu-abu': '#9ca3af', 'abu abu': '#9ca3af', 'gray': '#6b7280', 'grey': '#6b7280',
      'merah': '#c53030', 'red': '#c53030', 'biru': '#2563eb', 'blue': '#2563eb', 'hijau': '#059669', 'green': '#059669',
      'cokelat': '#7b341e', 'brown': '#7b341e', 'emas': '#d4af37', 'gold': '#d4af37', 'kuning': '#f59e0b', 'orange': '#f97316',
      'pink': '#ec4899', 'cream': '#f5f0e1', 'silver metallic': '#c0c0c0'
    };
    for (const token in map) if (n.includes(token)) return map[token];
    return null;
  }

  function selectVariantOption(variant: Mobil, type: 'off'|'on') {
    // If clicking the same variant that's already selected, do nothing
    if (selectedVariantOption?.kd_mobil === variant.kd_mobil && selectedVariantOption?.type === type) {
      return;
    }
    
    setSelectedVariantOption({ kd_mobil: variant.kd_mobil, type });
    // reset displayed color to model primary (don't persist temporary choice across variant switch)
    const primary = modelColors.find((c: any) => c.is_primary && c.foto_url);
    const first = modelColors.find((c: any) => c.foto_url);
    setSelectedColorUrl((primary && primary.foto_url) ?? (first && first.foto_url) ?? selectedModel?.foto_url ?? null);
  }

  function handleChooseCar() {
    if (!selectedVariantOption) return;
    if (step === 'variant') {
      setStep('transaction');
      return;
    }

    // Get the logged in user
    const loggedInUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (!loggedInUser.id) {
      alert('Anda harus login terlebih dahulu');
      return;
    }

    // determine price from vehicles list
    const variantObj = vehicles.find(v => v.kd_mobil === selectedVariantOption.kd_mobil);
    const rawPrice = variantObj ? (selectedVariantOption.type === 'off' ? variantObj.harga_off_road : variantObj.harga_on_road) : undefined;
    const harga = ((rawPrice ?? variantObj?.harga_mobil) ?? undefined) as number | undefined;

    // Build the selection object with all required fields
    const selection = {
      kd_mobil: selectedVariantOption.kd_mobil,
      type: selectedVariantOption.type,
      harga,
      kd_warna: selectedKdWarna ?? null,
      warna_foto_url: selectedColorUrl ?? null,
      metode_pembayaran: paymentMethod,
      buyer_email: buyerEmail,
      nama_pembeli: buyerName,
      tenor,
      dp,
      kd_sales: loggedInUser.id // Include the sales ID from logged in user
    };

    try {
      if (onSelect) onSelect(selection);
    } catch (err) {
      console.error('onSelect handler failed', err);
    }
    // Do NOT call onClose() here. Keep modal open so parent can show a processing overlay.
    // Parent will close the modal (setSelectedBrand(null)) after transaksi completes.
  }
  // only show vehicles whose status tag is "active"
  const filtered = vehicles.filter(v => {
    if (!v.status || String(v.status).toLowerCase() !== 'active') return false;
    const matchQ = q.trim() === '' || v.nama_mobil.toLowerCase().includes(q.trim().toLowerCase());
    const matchTab = !activeTab || (v.kelas_mobil ? String(v.kelas_mobil) === activeTab : false);
    return matchQ && matchTab;
  });

  return (
    <div className="transaksi-modal-overlay" ref={rootRef}>
      <div className="transaksi-modal">
        <div className="transaksi-modal-header">
          <div className="transaksi-modal-title">Choose Car</div>
          <button type="button" className="transaksi-modal-close" onClick={onClose} aria-label="Close" disabled={isProcessing}>×</button>
        </div>

        <div className="transaksi-modal-body">
          {step === 'select' && (
            <>
              <div className="transaksi-modal-search">
                <input placeholder="Search car ..." value={q} onChange={(e) => setQ(e.target.value)} />
                <button type="button" className="btn primary">Search</button>
              </div>

              <div className="transaksi-modal-tabs">
                <button type="button" className={`tab${activeTab === null ? ' active' : ''}`} onClick={() => setActiveTab(null)}>All</button>
                {classes.map(c => (
                  <button key={c} type="button" className={`tab${activeTab === c ? ' active' : ''}`} onClick={() => setActiveTab(c)}>{c}</button>
                ))}
              </div>
            </>
          )}

          {/* Add selection-grid class only in step select */}
          <div className={`transaksi-modal-grid${step === 'select' ? ' selection-grid' : ''}`}>
            {loading ? (
              <div className="transaksi-loading">Memuat...</div>
            ) : step === 'select' && filtered.length === 0 ? (
              <div className="transaksi-empty">No cars found</div>
            ) : step === 'select' ? (
              // Step 1: Car Selection Grid
              filtered.map((v) => (
                <div key={v.kd_mobil} className="transaksi-car-card" role="button" tabIndex={0} onClick={() => handleCardClick(v)} onKeyDown={(e) => { if (e.key === 'Enter') handleCardClick(v); }}>
                  <div className="car-card-info">
                    <div className="car-name">{v.nama_mobil}</div>
                    <div className="car-price">
                      {(v.harga_off_road ?? v.harga_mobil ?? v.harga_on_road) ? (
                        <div className="price-inline">
                          <span className="price-prefix">Mulai</span>
                          <span className="price-amount-inline">Rp{Number((v.harga_off_road ?? v.harga_mobil ?? v.harga_on_road) || 0).toLocaleString('id-ID')}</span>
                        </div>
                      ) : null}
                      <div className="car-tags">
                        {[v.jenis_bahan_bakar, v.transmisi, v.drivetrain].filter(Boolean).map((t, i) => {
                          const txt = String(t ?? '');
                          const low = txt.toLowerCase();
                          const isFuel = low === 'gasoline' || low === 'diesel' || low === 'electrified';
                          return <span key={i} className={`car-tag${isFuel ? ' fuel' : ''}`}>{txt}</span>;
                        })}
                      </div>
                    </div>
                    <div className="car-class">{v.kelas_mobil}</div>
                    {v.tahun_keluaran ? <div className="car-year">{v.tahun_keluaran}</div> : null}
                  </div>
                  <div className="car-card-img">
                    {v.foto_url ? <img src={v.foto_url} alt={v.nama_mobil} /> : <div className="img-placeholder">No image</div>}
                  </div>
                </div>
              ))
            ) : selectedModel && (step === 'variant' || step === 'transaction') ? (
              // Step 2 & 3: Selected Car Detail + Options
              (() => {
                const variants = vehicles.filter(x => x.nama_mobil === selectedModel.nama_mobil);
                const list = variants.length > 0 ? variants : [selectedModel];
                return (
                  <div className="transaksi-variants">
                    <div className="transaksi-selected-header">
                      <button type="button" className="back-btn" onClick={() => { 
                        if (step === 'transaction') {
                          setStep('variant');
                        } else {
                          setSelectedModel(null); 
                          setModelColors([]); 
                          setSelectedColorUrl(null); 
                          setSelectedVariantOption(null);
                          setStep('select');
                        }
                      }} aria-label="Back">←</button>
                      <div className="selected-title">{selectedModel.nama_mobil}</div>
                      <div className="selected-image">
                        {selectedColorUrl ? <img src={selectedColorUrl} alt={selectedModel.nama_mobil} /> : (selectedModel.foto_url ? <img src={selectedModel.foto_url} alt={selectedModel.nama_mobil} /> : <div className="img-placeholder">No image</div>)}
                      </div>
                    </div>
                    <hr className="transaksi-sep" />

                    {step === 'variant' ? (
                      // Step 2: Variant Selection
                      <div className="variant-grid full-width">
                        {(() => {
                          const optionCards: { variant: Mobil; type: 'off' | 'on' }[] = [];
                          list.forEach((variant) => {
                            optionCards.push({ variant, type: 'off' });
                            optionCards.push({ variant, type: 'on' });
                          });
                          return optionCards.map(({ variant, type }, idx) => {
                            const key = `${variant.kd_mobil}-${type}-${idx}`;
                            const isActive = selectedVariantOption?.kd_mobil === variant.kd_mobil && selectedVariantOption?.type === type;
                            const price = type === 'off' ? variant.harga_off_road : variant.harga_on_road;
                            const displayType = type === 'off' ? 'Off the Road' : 'On the Road';
                            return (
                              <div key={key} className={`variant-option-card ${type} ${isActive ? 'selected' : ''}`} onClick={() => selectVariantOption(variant, type)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') selectVariantOption(variant, type); }}>
                                <div className="variant-name">{displayType}</div>
                                <div className="variant-price">{price ? `Rp${Number(price).toLocaleString('id-ID')}` : '—'}</div>
                                {isActive && (
                                  <>
                                    <div className="pilihan-warna">Pilihan Warna</div>
                                    <div className="variant-colors">
                                      {modelColors.length === 0 ? null : modelColors.map((c: any, i: number) => {
                                        const swatch = c.kode_hex ?? getColorFromName(c.nama_warna) ?? null;
                                        return (
                                          <button key={i} type="button" className={`color-chip${(selectedColorUrl === (c.foto_url ?? null)) ? ' active' : ''}`} onClick={(ev) => { ev.stopPropagation(); setSelectedColorUrl(c.foto_url ?? null); setSelectedKdWarna(c.kd_warna ?? null); }} title={c.nama_warna}>
                                            {swatch ? <span style={{ background: swatch }} className="color-swatch" /> : <span className="color-swatch empty" />}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    ) : (
                      // Step 3: Transaction Details
                      <div className="transaction-details selection-grid">
                        {/* Left box - Payment method */}
                        <div className="trx-box">
                          <h4>Pilih Transaksi</h4>
                          {/* Update the radio button structure */}
                          <div className="trx-option">
                            <label>
                              <input
                                type="radio"
                                name="payment"
                                value="cash"
                                checked={paymentMethod === 'cash'}
                                onChange={() => setPaymentMethod('cash')}
                              />
                              <span>Cash</span>
                            </label>
                            <label>
                              <input
                                type="radio"
                                name="payment"
                                value="cicilan"
                                checked={paymentMethod === 'cicilan'}
                                onChange={() => setPaymentMethod('cicilan')}
                              />
                              <span>Cicilan</span>
                            </label>
                          </div>
                          {paymentMethod === 'cicilan' && (
                            <div>
                              <div className="cicilan-note">
                                (Pembayaran cicilan akan diproses setelah konfirmasi lebih lanjut)
                              </div>
                              <div className="cicilan-inputs">
                                <div className="buyer-form-group">
                                  <label>Tenor (bulan)</label>
                                  <input type="number" min={1} value={tenor} onChange={(e) => setTenor(Number(e.target.value || 0))} disabled={isProcessing} />
                                </div>
                                <div className="buyer-form-group">
                                  <label>Down Payment (DP)</label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="\d*"
                                    placeholder="0"
                                    value={dpInput}
                                    onChange={(e) => {
                                      const raw = String(e.target.value).replace(/\D/g, '');
                                      const num = raw === '' ? 0 : parseInt(raw, 10);
                                      setDp(num);
                                      setDpInput(raw === '' ? '' : num.toLocaleString('id-ID'));
                                    }}
                                    disabled={isProcessing}
                                  />
                                </div>

                                {/* Cicilan summary preview */}
                                {selectedVariantOption && (
                                  (() => {
                                    const variantObj = vehicles.find(v => v.kd_mobil === selectedVariantOption.kd_mobil);
                                    const basePrice = variantObj ? (selectedVariantOption.type === 'off' ? variantObj.harga_off_road : variantObj.harga_on_road) ?? variantObj.harga_mobil ?? 0 : 0;
                                    const totalCicilan = Math.max(0, (basePrice ?? 0) - (dp ?? 0));
                                    const perMonth = (tenor && tenor > 0) ? (totalCicilan / tenor) : totalCicilan;
                                    const fmt = (n: number) => `Rp${Number(n).toLocaleString('id-ID')}`;
                                    return (
                                      <div className="cicilan-summary">
                                        <div className="row"><span className="label">Harga</span><span className="value">{fmt(basePrice)}</span></div>
                                        <div className="row"><span className="label">DP</span><span className="value">{fmt(dp ?? 0)}</span></div>
                                        <div className="row"><span className="label">Jumlah Cicilan</span><span className="value">{fmt(totalCicilan)}</span></div>
                                        <div className="row"><span className="label">Estimasi / bulan</span><span className="value">{fmt(perMonth)}</span></div>
                                      </div>
                                    );
                                  })()
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Right box - Buyer details */}
                        <div className="trx-box">
                          <h4>Data Pembeli</h4>
                          <div className="buyer-form-group">
                            <label>Nama Pembeli</label>
                            <input
                              type="text"
                              placeholder="Nama lengkap"
                              value={buyerName}
                              onChange={(e) => setBuyerName(e.target.value)}
                              disabled={isProcessing}
                            />
                          </div>
                          <div className="buyer-form-group">
                            <label>Alamat Email</label>
                            <input
                              type="email"
                              placeholder="buyer@example.com"
                              value={buyerEmail}
                              onChange={(e) => setBuyerEmail(e.target.value)}
                              disabled={isProcessing}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : null}
          </div>
          </div>
          {step !== 'select' && (
            <div className="transaksi-modal-footer">
              <button 
                type="button" 
                className="choose-btn" 
                disabled={isProcessing || !selectedVariantOption || (step === 'transaction' && (!buyerEmail.trim() || (paymentMethod === 'cicilan' && (!tenor || tenor <= 0))))} 
                onClick={handleChooseCar}
              >
                {isProcessing ? 'Memproses...' : (step === 'variant' ? 'Choose Car' : 'Transaksi')}
              </button>
            </div>
          )}
      </div>
    </div>
  );
}
