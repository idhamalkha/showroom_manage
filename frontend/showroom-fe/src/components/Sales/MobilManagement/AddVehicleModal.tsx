import React, { useEffect, useRef, useState } from "react";
import "./AddVehicleModal.css";
import axios from "axios";
import { API_BASE } from "../../../api/host";
import ColorPickerModal from "./ColorPickerModal";
import type { MobilWarna } from "./ColorPickerModal";
import LoadingOverlay from "./LoadingOverlay";

// Helpers: format numbers with dot as thousand separator for display
function formatNumberInput(val?: number | string | null) {
  if (val === undefined || val === null) return "";
  // Allow passing either number or numeric string
  const raw = typeof val === "number" ? String(Math.trunc(val)) : String(val);
  const digits = raw.replace(/[^0-9-]/g, "");
  if (digits === "") return "";
  // Insert dot as thousands separator
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseNumberInput(display: string) {
  if (!display) return undefined;
  const digits = String(display).replace(/\./g, "").replace(/[^0-9-]/g, "");
  if (digits === "") return undefined;
  const num = Number(digits);
  return Number.isNaN(num) ? undefined : num;
}

// Live-format handler: format value to dot-separated thousands as user types,
// remove non-digits, update numeric state, and preserve caret position.
function handleFormattedInputChange(
  e: React.ChangeEvent<HTMLInputElement>,
  setStr: (s: string) => void,
  setNum: (n?: number) => void
) {
  const input = e.target as HTMLInputElement;
  const raw = input.value;
  const sel = input.selectionStart ?? raw.length;

  // count digits before caret in the raw value
  const digitsBefore = raw.slice(0, sel).replace(/[^0-9]/g, '').length;

  // strip non-digits for numeric value
  const digits = raw.replace(/[^0-9]/g, '');
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  setStr(formatted);
  setNum(digits === '' ? undefined : Number(digits));

  // compute new caret position in formatted value
  let newPos = formatted.length;
  if (digitsBefore <= 0) {
    newPos = 0;
  } else {
    let seen = 0;
    newPos = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (/[0-9]/.test(formatted[i])) seen++;
      newPos++;
      if (seen >= digitsBefore) break;
    }
    if (seen < digitsBefore) newPos = formatted.length;
  }

  // restore caret asynchronously
  setTimeout(() => {
    try { input.setSelectionRange(newPos, newPos); } catch {}
  }, 0);
}

function AvmSelectPopover<T extends string | number>({
  options,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  options: { value: T; label: string }[];
  value?: T | null;
  onChange: (v: T) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [upwards, setUpwards] = useState(false);
  const [listStyle, setListStyle] = useState<React.CSSProperties | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: PointerEvent) {
      const t = e.target as Node;
      if (!rootRef.current) return;
      if (rootRef.current.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const margin = 12;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const preferred = 300;
    const fitsBelow = spaceBelow > 160;
    const fitsAbove = spaceAbove > 160;

    if (!fitsBelow && fitsAbove && spaceAbove > spaceBelow) {
      const maxH = Math.max(120, Math.min(preferred, spaceAbove - margin));
      setUpwards(true);
      const top = Math.max(8, rect.top - maxH - 8);
      setListStyle({
        position: "fixed",
        left: `${rect.left}px`,
        top: `${top}px`,
        maxHeight: `${maxH}px`,
        width: `${Math.max(220, rect.width)}px`,
        zIndex: 3000,
      });
    } else {
      const maxH = Math.max(120, Math.min(preferred, spaceBelow - margin));
      setUpwards(false);
      setListStyle({
        position: "fixed",
        left: `${rect.left}px`,
        top: `${rect.bottom + 8}px`,
        maxHeight: `${maxH}px`,
        width: `${Math.max(220, rect.width)}px`,
        zIndex: 3000,
      });
    }
  }, [open]);

  const label = options.find((o) => String(o.value) === String(value))?.label ?? (placeholder ?? "Pilih");
  const isPlaceholder = value === null || value === undefined || value === "";

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={btnRef}
        type="button"
        className="avm-select-btn"
        onClick={(e) => {
          e.preventDefault();
          if (disabled) return;
          setOpen((s) => !s);
        }}
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled}
      >
        <span className={`avm-select-label ${isPlaceholder ? "placeholder" : ""}`}>{label}</span>
        <span className="avm-select-caret">▾</span>
      </button>

      {open && (
        <div
          className={`avm-select-list ${upwards ? "upwards" : "downwards"}`}
          role="menu"
          onMouseDown={(e) => e.stopPropagation()}
          style={listStyle}
        >
          {options.map((o) => (
            <button
              key={String(o.value)}
              type="button"
              className="avm-select-item"
              onClick={(e) => {
                e.preventDefault();
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type MobilLite = {
  kd_mobil?: number;
  nama_mobil: string;
  kelas_mobil?: string;
  harga_mobil?: number | null;
  foto_url?: string | null;
  video_url?: string | null;
  kd_merek?: number | null;
  kd_kelas?: number | null;
  engine_cc?: number | null;
  power_ps?: number | null;
  tahun_keluaran?: number | null;
  harga_off_road?: number | null;
  harga_on_road?: number | null;
  transmisi?: string | null;
  seats?: number | null;
  drivetrain?: "FWD" | "RWD" | "4WD" | "AWD" | null;
  warna_tersedia?: string[] | null;
  status?: string | null;
  jenis_bahan_bakar?: 'Gasoline' | 'Diesel' | 'Electrified' | null;
};

type KelasOption = { kd_kelas: number; nama: string; kode?: string; deskripsi?: string };

type Props = {
  open: boolean;
  initial?: Partial<MobilLite>;
  kelasOptions?: KelasOption[];
  brandId?: number | null;
  loading?: boolean;
  onClose: () => void;
  onSave: (vehicle: Partial<MobilLite>, photo?: File | null, video?: File | null) => Promise<void> | void;
};

export default function AddVehicleModal({ open, initial, kelasOptions = [], brandId = null, loading = false, onClose, onSave }: Props): JSX.Element | null {
  const [nama, setNama] = useState(initial?.nama_mobil ?? "");
  const [kdKelas, setKdKelas] = useState<number | null>(initial?.kd_kelas ?? null);
  const [harga, setHarga] = useState<number | undefined>(initial?.harga_mobil ?? undefined);
  const [hargaOffRoad, setHargaOffRoad] = useState<number | undefined>(initial?.harga_off_road ?? undefined);
  const [hargaOnRoad, setHargaOnRoad] = useState<number | undefined>(initial?.harga_on_road ?? undefined);
  const [hargaStr, setHargaStr] = useState<string>(formatNumberInput(initial?.harga_mobil ?? undefined));
  const [hargaOffRoadStr, setHargaOffRoadStr] = useState<string>(formatNumberInput(initial?.harga_off_road ?? undefined));
  const [hargaOnRoadStr, setHargaOnRoadStr] = useState<string>(formatNumberInput(initial?.harga_on_road ?? undefined));
  const [engineCc, setEngineCc] = useState<number | undefined>(initial?.engine_cc ?? undefined);
  const [powerPs, setPowerPs] = useState<number | undefined>(initial?.power_ps ?? undefined);
  const [tahun, setTahun] = useState<number | undefined>(initial?.tahun_keluaran ?? undefined);
  const [transmisi, setTransmisi] = useState<string | null>(initial?.transmisi ?? null);
  const [drivetrain, setDrivetrain] = useState<MobilLite["drivetrain"]>(initial?.drivetrain ?? null);
  const [seats, setSeats] = useState<number | undefined>(initial?.seats ?? undefined);
  const [status, setStatus] = useState<string | null>(initial?.status ?? null);
  const [jenisBahanBakar, setJenisBahanBakar] = useState<'Gasoline' | 'Diesel' | 'Electrified'>('Gasoline');

  // New color state
  const [colors, setColors] = useState<MobilWarna[]>([]);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      // reset when closed
      setNama(initial?.nama_mobil ?? "");
      setKdKelas(initial?.kd_kelas ?? null);
      setHarga(initial?.harga_mobil ?? undefined);
      setHargaOffRoad(initial?.harga_off_road ?? undefined);
      setHargaOnRoad(initial?.harga_on_road ?? undefined);
      setHargaStr(formatNumberInput(initial?.harga_mobil ?? undefined));
      setHargaOffRoadStr(formatNumberInput(initial?.harga_off_road ?? undefined));
      setHargaOnRoadStr(formatNumberInput(initial?.harga_on_road ?? undefined));
      setEngineCc(initial?.engine_cc ?? undefined);
      setPowerPs(initial?.power_ps ?? undefined);
      setTahun(initial?.tahun_keluaran ?? undefined);
      setTransmisi(initial?.transmisi ?? null);
      setDrivetrain(initial?.drivetrain ?? null);
      setSeats(initial?.seats ?? undefined);
      setColors([]);
    }
  }, [open, initial]);

  // close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        // if the color picker overlay is open, let it handle Escape
        if ((window as any).__colorPickerModalOpen) return;
        try { if (document.activeElement instanceof HTMLElement) (document.activeElement as HTMLElement).blur(); } catch {}
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      // Clean up any blob URLs from color previews
      colors.forEach(color => {
        if (color.foto_url?.startsWith('blob:')) {
          URL.revokeObjectURL(color.foto_url);
        }
      });
    };
  }, [colors]);

  // Handle color modal
  function handleColorSave(updatedColors: MobilWarna[]) {
    setColors(updatedColors);
    setColorPickerOpen(false);
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    // Get primary color's photo as the main photo
    const primaryColor = colors.find(c => c.is_primary);
    const primaryPhoto = primaryColor?.file;

    const payload: Partial<MobilLite> = {
      nama_mobil: nama,
      kd_kelas: kdKelas ?? undefined,
      harga_mobil: parseNumberInput(hargaStr) ?? harga ?? undefined,
      harga_off_road: parseNumberInput(hargaOffRoadStr) ?? hargaOffRoad ?? undefined,
      harga_on_road: parseNumberInput(hargaOnRoadStr) ?? hargaOnRoad ?? undefined,
      engine_cc: engineCc ?? undefined,
      power_ps: powerPs ?? undefined,
      tahun_keluaran: tahun ?? undefined,
      transmisi: transmisi ?? undefined,
      drivetrain: drivetrain ?? undefined,
      seats: seats ?? undefined,
      warna_tersedia: colors.map(c => c.nama_warna),
      kd_merek: brandId ?? undefined,
      status: status ?? undefined,
      jenis_bahan_bakar: jenisBahanBakar,
    };

    try {
      setSaving(true);
      // Save the vehicle first to get kd_mobil (caller now returns created vehicle)
      const created: any = await onSave(payload, primaryPhoto, null);

      // If the backend returned a created vehicle with kd_mobil, sync colors like Edit flow
      if (created && created.kd_mobil && colors && colors.length > 0) {
        const kd = created.kd_mobil;

        async function ensureColorUrl(c: any) {
          if (c.file) {
            try {
              const fd = new FormData();
              fd.append('file', c.file);
              const r = await axios.post(`${API_BASE}/api/upload`, fd, { headers: { "Content-Type": "multipart/form-data" } });
              return r.data?.github_url ?? r.data?.url ?? r.data?.path ?? null;
            } catch (err) {
              console.error('upload color file failed', err);
              return null;
            }
          }
          if (typeof c.foto_url === 'string' && c.foto_url.startsWith('http')) return c.foto_url;
          if (typeof c.foto_url === 'string' && c.foto_url.startsWith('data:')) {
            try {
              const blob = await (await fetch(c.foto_url)).blob();
              const fd = new FormData();
              fd.append('file', blob, 'color.jpg');
              const r = await axios.post(`${API_BASE}/api/upload`, fd, { headers: { "Content-Type": "multipart/form-data" } });
              return r.data?.github_url ?? r.data?.url ?? r.data?.path ?? null;
            } catch (err) {
              console.error('failed to upload data url for color', err);
            }
          }
          return c.foto_url ?? null;
        }

        for (const c of colors) {
          try {
            const url = await ensureColorUrl(c);
            const payloadColor: any = {
              nama_warna: c.nama_warna,
              kode_hex: c.kode_hex ?? null,
              foto_url: url,
              is_primary: !!c.is_primary,
            };
            await axios.post(`${API_BASE}/api/mobil/${kd}/warna`, payloadColor);
          } catch (err) {
            console.error('create color failed', err);
          }
        }
      }

      onClose();
    } catch (err) {
      console.error("AddVehicleModal: save failed", err);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;
  return (
    <div className="avm-overlay">
      {(saving || loading) && <LoadingOverlay message={loading ? 'Menyimpan...' : 'Menyimpan...'} />}
      <form className="avm-modal avm-wide-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <button type="button" className="avm-modal-close" onClick={onClose} aria-label="Close">×</button>
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Tambah Mobil</div>
        </div>
        <div style={{ marginBottom: 0 }}>
          <label className="avm-form-label">Jenis Bahan Bakar</label>
          <AvmSelectPopover
            options={[
              { value: 'Gasoline', label: 'Gasoline' },
              { value: 'Diesel', label: 'Diesel' }, 
              { value: 'Electrified', label: 'Electrified' }
            ]}
            value={jenisBahanBakar}
            onChange={(v) => {
              setJenisBahanBakar(v as 'Gasoline' | 'Diesel' | 'Electrified');
              // Clear engine_cc if Electrified is selected
              if (v === 'Electrified') {
                setEngineCc(undefined);
              }
            }}
            placeholder="Pilih Jenis Bahan Bakar"
          />
        </div>
        <label className="avm-form-label">Nama Mobil
          <input className="avm-input" value={nama} onChange={(e) => setNama(e.target.value)} required />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <label className="avm-form-label">Kelas</label>
            <AvmSelectPopover
              options={kelasOptions.map(k => ({ value: k.kd_kelas, label: k.nama }))}
              value={kdKelas ?? null}
              onChange={(v) => setKdKelas(Number(v))}
              placeholder="Pilih Kelas"
            />
          </div>

          <div style={{ minWidth: 0 }}>
            <label className="avm-form-label">Drivetrain</label>
            <AvmSelectPopover
              options={[
                { value: "FWD", label: "FWD" },
                { value: "RWD", label: "RWD" },
                { value: "4WD", label: "4WD" },
                { value: "AWD", label: "AWD" },
              ]}
              value={drivetrain ?? null}
              onChange={(v) => setDrivetrain(String(v) as any)}
              placeholder="Pilih Penggerak"
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, minWidth: 0 }}>
          <label className="avm-form-label" style={{ minWidth: 0 }}>Transmisi
            <AvmSelectPopover
              options={[
                { value: "Manual", label: "Manual" },
                { value: "Automatic", label: "Automatic" },
                { value: "CVT", label: "CVT" },
                { value: "DCT", label: "Dual-clutch" },
              ]}
              value={transmisi ?? null}
              onChange={(v) => setTransmisi(String(v))}
              placeholder="Pilih Transmisi"
            />
          </label>

          <label className="avm-form-label" style={{ minWidth: 0 }}>Tahun Keluaran
            <input className="avm-input" inputMode="numeric" type="text" value={tahun ?? ""} onChange={(e) => setTahun(e.target.value ? Number(e.target.value.replace(/[^0-9-]/g, '')) : undefined)} />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, minWidth: 0 }}>
            <label className="avm-form-label" style={{ minWidth: 0 }}>Engine (cc)
            <input 
              className="avm-input" 
              inputMode="numeric" 
              type="text" 
              value={engineCc ?? ""} 
              onChange={(e) => setEngineCc(e.target.value ? Number(e.target.value.replace(/[^0-9-]/g, '')) : undefined)}
              disabled={jenisBahanBakar === 'Electrified'}
              placeholder={jenisBahanBakar === 'Electrified' ? 'N/A for Electric' : ''}
            />
          </label>

          <label className="avm-form-label" style={{ minWidth: 0 }}>Power (PS)
            <input className="avm-input" inputMode="numeric" type="text" value={powerPs ?? ""} onChange={(e) => setPowerPs(e.target.value ? Number(e.target.value.replace(/[^0-9-]/g, '')) : undefined)} />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 6, minWidth: 0 }}>
          <label className="avm-form-label" style={{ minWidth: 0 }}>Harga Off-road
            <input className="avm-input" inputMode="numeric" type="text" value={hargaOffRoadStr} onChange={(e) => handleFormattedInputChange(e, setHargaOffRoadStr, setHargaOffRoad)} placeholder="Rp" />
          </label>

          <label className="avm-form-label" style={{ minWidth: 0 }}>Harga On-road
            <input className="avm-input" inputMode="numeric" type="text" value={hargaOnRoadStr} onChange={(e) => handleFormattedInputChange(e, setHargaOnRoadStr, setHargaOnRoad)} placeholder="Rp" />
          </label>
        </div>

          <label className="avm-form-label">Seats
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
            <input className="avm-input" inputMode="numeric" type="text" value={seats ?? ""} onChange={(e) => setSeats(e.target.value ? Number(e.target.value.replace(/[^0-9-]/g, '')) : undefined)} placeholder="Seats" />
          </div>
        </label>

        <div style={{ marginTop: -5 }}>
          <label className="avm-form-label">Status</label>
          <AvmSelectPopover
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "coming_soon", label: "Coming Soon" },
            ]}
            value={status ?? null}
            onChange={(v) => setStatus(String(v))}
            placeholder="Pilih Status"
          />
        </div>
        
        <div className="avm-form-section">
          <label className="avm-form-label">Warna</label>
          <div className="avm-color-preview">
            {colors.length > 0 ? (
              <div className="avm-color-chips">
                {colors.map((color, i) => (
                  <div key={i} className={`avm-color-chip${color.is_primary ? ' primary' : ''}`}>
                    {color.nama_warna}
                    {color.is_primary && <span className="avm-color-primary-badge">Primary</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="avm-color-empty">Belum ada warna yang ditambahkan</div>
            )}
            <button type="button" className="btn primary" onClick={() => setColorPickerOpen(true)}>
              {colors.length > 0 ? 'Atur Warna' : 'Tambah Warna'}
            </button>
          </div>
        </div>

        {colorPickerOpen && (
          <ColorPickerModal
            colors={colors}
            onClose={() => setColorPickerOpen(false)}
            onSave={handleColorSave}
          />
        )}

        <div className="avm-modal-actions">
          <button type="button" className="btn neutral" onClick={() => { try { (document.activeElement as HTMLElement)?.blur(); } catch {} ; onClose(); }}>Batal</button>
          <button type="submit" className="btn primary" disabled={loading}>{loading ? "Menyimpan..." : "Simpan"}</button>
        </div>
      </form>
    </div>
  );
}