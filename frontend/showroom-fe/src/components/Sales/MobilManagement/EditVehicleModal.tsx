import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API_BASE } from "../../../api/host";
import "./AddVehicleModal.css";
import ColorPickerModal from "./ColorPickerModal";
import type { MobilWarna } from "./ColorPickerModal";

// Helpers for formatting numbers with dot thousands separator
function formatNumberInput(val?: number | string | null) {
  if (val === undefined || val === null) return "";
  const raw = typeof val === "number" ? String(Math.trunc(val)) : String(val);
  const digits = raw.replace(/[^0-9-]/g, "");
  if (digits === "") return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function EvmSelectPopover<T extends string | number>({
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
      // use fixed positioning so the popover is not clipped by ancestor overflow
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
  tahun_keluaran?: number | null;
  foto_url?: string | null;
  video_url?: string | null;
  kd_merek?: number;
  kd_kelas?: number | null;
  engine_cc?: number | null;
  power_ps?: number | null;
  harga_mobil?: number;
  harga_off_road?: number | null;
  harga_on_road?: number | null;
  transmisi?: string | null;
  seats?: number | null;
  drivetrain?: "FWD" | "RWD" | "4WD" | "AWD" | null;
  warna_tersedia?: string[] | null;
  jenis_bahan_bakar?: 'Gasoline' | 'Diesel' | 'Electrified' | null;
};

type KelasOption = {
  kd_kelas: number;
  kode?: string;
  nama: string;
  deskripsi?: string;
};

type Props = {
  vehicle: MobilLite | null;
  kelasOptions: KelasOption[];
  loading: boolean;
  onClose: () => void;
  onSave: (vehicle: MobilLite) => void;
  onDelete: (vehicle: MobilLite) => void;
};

import "./EditVehicleModal.css";
import PreviewCard from "./PreviewCard";
import LoadingOverlay from "./LoadingOverlay";

export default function EditVehicleModal({
  vehicle,
  kelasOptions,
  loading,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [formData, setFormData] = useState<Partial<MobilLite>>({});
  const [hargaOffRoadStr, setHargaOffRoadStr] = useState<string>("");
  const [hargaOnRoadStr, setHargaOnRoadStr] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [colors, setColors] = useState<(MobilWarna & { enabled: boolean })[]>([]);
  const originalColorsRef = useRef<(MobilWarna & { enabled: boolean })[]>([]);
  const [saving, setSaving] = useState(false);
  
  // Get photo URL from primary color or fallback to vehicle's photo
  const displayPhotoUrl = React.useMemo(() => {
    const primaryColor = colors.find(c => c.is_primary && c.enabled);
    return primaryColor?.foto_url ?? vehicle?.foto_url ?? null;
  }, [colors, vehicle?.foto_url]);

  // Handle color updates
  function handleColorSave(updatedColors: MobilWarna[]) {
    const validColors = updatedColors.filter(color => color.nama_warna && color.foto_url);
    setColors(validColors.map(color => {
      // Sync enabled to is_active coming from ColorPickerModal so toggles there
      // immediately reflect here. If is_active is undefined, default to true.
      const isActive = color.is_active !== false;
      return {
        ...color,
        enabled: isActive,
        is_active: isActive,
      };
    }));
    setColorPickerOpen(false);
  }

  function toggleColorEnabled(colorName: string) {
    setColors(prev => prev.map(color => 
      color.nama_warna === colorName 
        ? { ...color, enabled: !color.enabled, is_active: !color.enabled }
        : color
    ));
  }

  // Load vehicle colors
  useEffect(() => {
    if (vehicle?.kd_mobil) {
      axios.get(`${API_BASE}/api/mobil/${vehicle.kd_mobil}/warna`)
        .then(res => {
          const mapped = res.data.map((color: MobilWarna) => ({
            ...color,
            // initialize enabled from is_active coming from server
            enabled: color.is_active !== false
          }));
          setColors(mapped);
          originalColorsRef.current = mapped;
        })
        .catch(console.error);
    } else {
      setColors([]);
    }
  }, [vehicle?.kd_mobil]);

  // Initialize form data when vehicle changes
  useEffect(() => {
    if (vehicle) {
      setFormData({
        nama_mobil: vehicle.nama_mobil || "",
        kelas_mobil: vehicle.kelas_mobil || "",
        tahun_keluaran: vehicle.tahun_keluaran || null,
        engine_cc: vehicle.engine_cc || null,
        power_ps: vehicle.power_ps || null,
        harga_off_road: vehicle.harga_off_road || null,
        harga_on_road: vehicle.harga_on_road || null,
        transmisi: vehicle.transmisi || "",
        seats: vehicle.seats || null,
        drivetrain: vehicle.drivetrain || null,
        kd_kelas: vehicle.kd_kelas || null,
        jenis_bahan_bakar: (vehicle as any).jenis_bahan_bakar ?? null,
        // include status into the shared formData so right-column fields stay in-sync
        ...(vehicle as any).status ? { status: (vehicle as any).status } : {},
      });
      setHargaOffRoadStr(formatNumberInput(vehicle.harga_off_road ?? undefined));
      setHargaOnRoadStr(formatNumberInput(vehicle.harga_on_road ?? undefined));
    } else {
      setFormData({});
    }
    setShowDeleteConfirm(false);
  }, [vehicle]);

  // close on Escape (also blur active element to avoid lingering focus)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // If color picker is open, let it handle ESC key (global flag)
      if ((window as any).__colorPickerModalOpen) return;
      // If the delete confirmation is visible, close that first instead of closing the whole edit modal.
      if (showDeleteConfirm) {
        setShowDeleteConfirm(false);
        return;
      }
      try { if (document.activeElement instanceof HTMLElement) (document.activeElement as HTMLElement).blur(); } catch {}
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, showDeleteConfirm]);

  // When the delete-confirm dialog is open we want it to be the top-most
  // handler for Escape. Attach a capture-phase listener that closes the
  // confirm and stops propagation so parent/global handlers don't also run.
  useEffect(() => {
    if (!showDeleteConfirm) return;
    function onKeyCapture(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      try { e.preventDefault(); } catch {}
      try { e.stopImmediatePropagation(); } catch {}
      try { e.stopPropagation(); } catch {}
      setShowDeleteConfirm(false);
    }
    document.addEventListener("keydown", onKeyCapture, true);
    return () => document.removeEventListener("keydown", onKeyCapture, true);
  }, [showDeleteConfirm]);

  const handleInputChange = (field: keyof MobilLite, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Live-format handler for edit modal: similar to AddVehicleModal
  function handleFormattedInputChange(
    e: React.ChangeEvent<HTMLInputElement>,
    setStr: (s: string) => void,
    field: keyof MobilLite
  ) {
    const input = e.target as HTMLInputElement;
    const raw = input.value;
    const sel = input.selectionStart ?? raw.length;

    const digitsBefore = raw.slice(0, sel).replace(/[^0-9]/g, '').length;
    const digits = raw.replace(/[^0-9]/g, '');
    const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    setStr(formatted);
    handleInputChange(field, digits === '' ? null : Number(digits));

    let newPos = formatted.length;
    if (digitsBefore <= 0) {
      newPos = 0;
    } else {
      let seen = 0; newPos = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (/[0-9]/.test(formatted[i])) seen++;
        newPos++;
        if (seen >= digitsBefore) break;
      }
      if (seen < digitsBefore) newPos = formatted.length;
    }
    setTimeout(() => { try { input.setSelectionRange(newPos, newPos); } catch {} }, 0);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicle) return;
    setSaving(true);
    try {
      const uploads: { foto_url?: string | null; video_url?: string | null } = {};

      // Upload primary color photo if available
      const primaryColor = colors.find(c => c.enabled && c.is_primary);
      if (primaryColor?.file) {
        const fd = new FormData();
        fd.append("file", primaryColor.file);
        const res = await axios.post(`${API_BASE}/api/upload`, fd, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        uploads.foto_url = res.data?.github_url ?? res.data?.url ?? res.data?.path ?? null;
      } else {
        uploads.foto_url = vehicle.foto_url;
      }

      // Resolve kelas_mobil name from kd_kelas
      const kelasName = formData.kd_kelas 
        ? kelasOptions.find(k => k.kd_kelas === formData.kd_kelas)?.nama
        : formData.kelas_mobil;

      // ensure status is always present and coerced to string (not HttpUrl/object)
      const statusValue = (formData as any).status ?? (vehicle as any).status ?? null;

      const updatedVehicle: MobilLite & { status?: string | null } = {
        ...vehicle,
        ...formData,
        ...uploads,
        kelas_mobil: kelasName,
        kd_merek: vehicle.kd_merek,
        status: statusValue !== null ? String(statusValue) : null,
      };

      // debug: inspect payload sent to server
      // (remove console.log after verification)
      // eslint-disable-next-line no-console
      console.log("PUT /sales/mobil payload:", updatedVehicle);

      // Update vehicle via API
      await axios.put(`${API_BASE}/sales/mobil/${vehicle.kd_mobil}`, updatedVehicle);

      // Sync colors (create / update / delete) with backend
      try {
        const orig = originalColorsRef.current || [];
        const toCreate = colors.filter(c => !c.kd_warna);
        const toUpdate = colors.filter(c => c.kd_warna);
        const toDelete = orig.filter(o => !colors.some(c => c.kd_warna === o.kd_warna));

        // helper to upload a file if present and return a URL
        async function ensureColorUrl(c: any) {
          if (c.file) {
            const fd = new FormData();
            fd.append("file", c.file);
            const r = await axios.post(`${API_BASE}/api/upload`, fd, { headers: { "Content-Type": "multipart/form-data" } });
            return r.data?.github_url ?? r.data?.url ?? r.data?.path ?? null;
          }
          // if foto_url is already an http url, keep it
          if (typeof c.foto_url === 'string' && c.foto_url.startsWith('http')) return c.foto_url;
          // try to convert data URL to blob and upload
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

        // create new colors (include is_active so backend persists availability)
        for (const c of toCreate) {
          const url = await ensureColorUrl(c);
          const payload: any = {
            nama_warna: c.nama_warna,
            kode_hex: c.kode_hex ?? null,
            foto_url: url,
            is_primary: !!c.is_primary,
            // Use enabled property from state, which is synced with is_active
            // Default to true if enabled is undefined
            is_active: (c as any).enabled !== false,
          };
          // debug: log payload sent for creation
          // eslint-disable-next-line no-console
          console.debug('create color payload:', payload);
          try { await axios.post(`${API_BASE}/api/mobil/${vehicle.kd_mobil}/warna`, payload); } catch (err) { console.error('create color failed', err); }
        }

        // update existing colors (include is_active so toggles persist)
        for (const c of toUpdate) {
          const url = await ensureColorUrl(c);
          const payload: any = {
            nama_warna: c.nama_warna,
            kode_hex: c.kode_hex ?? null,
            foto_url: url,
            is_primary: !!c.is_primary,
            // ensure boolean is sent; default to true if undefined
            is_active: (typeof c.is_active === 'boolean') ? c.is_active : true,
          };
          // debug: log payload sent for update
          // eslint-disable-next-line no-console
          console.debug(`update color payload kd_warna=${c.kd_warna}:`, payload);
          try { await axios.put(`${API_BASE}/api/mobil/${vehicle.kd_mobil}/warna/${c.kd_warna}`, payload); } catch (err) { console.error('update color failed', err); }
        }

        // delete removed colors
        for (const c of toDelete) {
          try { await axios.delete(`${API_BASE}/api/mobil/${vehicle.kd_mobil}/warna/${c.kd_warna}`); } catch (err) { console.error('delete color failed', err); }
        }

        // refresh colors from server
        try {
          const res = await axios.get(`${API_BASE}/api/mobil/${vehicle.kd_mobil}/warna`);
          // debug: log server response to inspect is_active values
          // eslint-disable-next-line no-console
          console.debug('refresh colors response:', res.data);
          const mapped = res.data.map((color: MobilWarna) => ({ ...color, enabled: color.is_active !== false }));
          // debug: log mapped colors with enabled
          // eslint-disable-next-line no-console
          console.debug('refresh mapped colors (with enabled):', mapped);
          setColors(mapped);
          originalColorsRef.current = mapped;
        } catch (err) { console.error('refresh colors failed', err); }
      } catch (err) {
        console.error('color sync failed', err);
      }

      onSave(updatedVehicle);
    } catch (error) {
      console.error("Failed to update vehicle:", error);
    }
    finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!vehicle) return;
    
    try {
      await axios.delete(`${API_BASE}/sales/mobil/${vehicle.kd_mobil}`);
      onDelete(vehicle);
    } catch (error) {
      console.error("Failed to delete vehicle:", error);
    }
  };

  if (!vehicle) return null;

  return (
    <div className="avm-overlay" /* click outside no longer closes modal */>
      {(saving || loading) && <LoadingOverlay message={(saving || loading) ? 'Menyimpan...' : undefined} />}
      <form className="avm-modal avm-wide-modal avm-edit-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
  <button type="button" className="avm-modal-close" onClick={() => { try { (document.activeElement as HTMLElement)?.blur(); } catch {} ; onClose(); }} aria-label="Close">×</button>

        <div className="avm-edit-header">
          <div className="avm-title">Edit Mobil</div>
        </div>

        <div className="avm-edit-body">
          <div className="avm-form-col">
            <label className="avm-form-label">Nama Mobil
              <input 
                className="avm-input" 
                value={formData.nama_mobil || ""} 
                onChange={(e) => handleInputChange("nama_mobil", e.target.value)} 
                required 
              />
            </label>

            <div style={{ marginBottom: 0 }}>
              <label className="avm-form-label">Jenis Bahan Bakar</label>
              <EvmSelectPopover
                options={[
                  { value: 'Gasoline', label: 'Gasoline' },
                  { value: 'Diesel', label: 'Diesel' }, 
                  { value: 'Electrified', label: 'Electrified' }
                ]}
                value={(formData as any).jenis_bahan_bakar ?? null}
                onChange={(v) => {
                  handleInputChange("jenis_bahan_bakar" as any, v);
                  // Clear engine_cc if Electrified is selected
                  if (v === 'Electrified') {
                    handleInputChange("engine_cc", null);
                  }
                }}
                placeholder="Pilih Jenis Bahan Bakar"
              />
            </div>

            <div className="avm-grid-2">
              <div>
                <label className="avm-form-label">Kelas</label>
                <EvmSelectPopover
                  options={kelasOptions.map(k => ({ value: k.kd_kelas, label: k.nama }))}
                  value={formData.kd_kelas ?? null}
                  onChange={(v) => handleInputChange("kd_kelas", Number(v))}
                  placeholder="Pilih Kelas"
                />
              </div>

              <div>
                <label className="avm-form-label">Drivetrain</label>
                <EvmSelectPopover
                  options={[
                    { value: "FWD", label: "FWD" },
                    { value: "RWD", label: "RWD" },
                    { value: "4WD", label: "4WD" },
                    { value: "AWD", label: "AWD" },
                  ]}
                  value={formData.drivetrain ?? null}
                  onChange={(v) => handleInputChange("drivetrain", String(v) as any)}
                  placeholder="Pilih Penggerak"
                />
              </div>
            </div>

            <div className="avm-grid-2">
              <div>
                <label className="avm-form-label">Transmisi</label>
                <EvmSelectPopover
                  options={[
                    { value: "Manual", label: "Manual" },
                    { value: "Automatic", label: "Automatic" },
                    { value: "CVT", label: "CVT" },
                    { value: "DCT", label: "Dual-clutch" },
                  ]}
                  value={formData.transmisi ?? null}
                  onChange={(v) => handleInputChange("transmisi", String(v))}
                  placeholder="Pilih Transmisi"
                />
              </div>

              <div>
                <label className="avm-form-label">Tahun Keluaran</label>
                <input 
                  className="avm-input" 
                  inputMode="numeric"
                  type="text" 
                  value={formData.tahun_keluaran ?? ""} 
                  onChange={(e) => handleInputChange("tahun_keluaran", e.target.value ? Number(e.target.value.replace(/[^0-9-]/g, '')) : null)} 
                />
              </div>
            </div>

            <div className="avm-grid-2">
              <label className="avm-form-label">Engine (cc)
                <input 
                  className="avm-input" 
                  inputMode="numeric"
                  type="text" 
                  value={formData.engine_cc ?? ""} 
                  onChange={(e) => handleInputChange("engine_cc", e.target.value ? Number(e.target.value.replace(/[^0-9-]/g, '')) : null)}
                  disabled={(formData as any).jenis_bahan_bakar === 'Electrified'}
                  placeholder={(formData as any).jenis_bahan_bakar === 'Electrified' ? 'N/A for Electric' : ''}
                />
              </label>

              <label className="avm-form-label">Power (PS)
                <input 
                  className="avm-input" 
                  inputMode="numeric"
                  type="text" 
                  value={formData.power_ps ?? ""} 
                  onChange={(e) => handleInputChange("power_ps", e.target.value ? Number(e.target.value.replace(/[^0-9-]/g, '')) : null)} 
                />
              </label>
            </div>

            <div className="avm-grid-2" style={{ marginTop: 6 }}>
              <label className="avm-form-label">Harga Off-road
                  <input 
                    className="avm-input" 
                    inputMode="numeric"
                    type="text" 
                    value={hargaOffRoadStr} 
                    onChange={(e) => handleFormattedInputChange(e, setHargaOffRoadStr, "harga_off_road")} 
                    placeholder="Rp" 
                  />
                </label>

              <label className="avm-form-label">Harga On-road
                <input 
                  className="avm-input" 
                  inputMode="numeric"
                  type="text" 
                  value={hargaOnRoadStr ?? ""} 
                  onChange={(e) => handleFormattedInputChange(e, setHargaOnRoadStr, "harga_on_road")} 
                  placeholder="Rp" 
                />
              </label>
            </div>

            <div className="avm-grid-2">
              <div>
                <label className="avm-form-label">Seats
                  <input 
                    className="avm-input" 
                    inputMode="numeric"
                    type="text" 
                    value={formData.seats ?? ""} 
                    onChange={(e) => handleInputChange("seats", e.target.value ? Number(e.target.value.replace(/[^0-9-]/g, '')) : null)} 
                    placeholder="Jumlah Kursi" 
                  />
                </label>
              </div>

              <div>
                <label className="avm-form-label">Status</label>
                <EvmSelectPopover
                  options={[
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                    { value: "coming_soon", label: "Coming Soon" },
                  ]}
                  value={(formData as any).status ?? (vehicle as any).status ?? null}
                  onChange={(v) => handleInputChange("status" as any, String(v))}
                  placeholder="Pilih Status"
                />
              </div>
            </div>

            <div className="avm-form-section">
              <label className="avm-form-label">Warna</label>
              <div className="avm-color-preview">
                {colors.length > 0 ? (
                  <div className="avm-color-chips">
                    {colors.map((color, i) => (
                      <div key={i} className={`avm-color-chip${color.is_primary ? ' primary' : ''} ${!color.enabled ? ' disabled' : ''}`}>
                        {color.nama_warna}
                        {color.is_primary && <span className="avm-color-primary-badge">Primary</span>}
                        <label className="color-enabled-toggle">
                          <input 
                            type="checkbox" 
                            checked={color.enabled} 
                            onChange={() => toggleColorEnabled(color.nama_warna)} 
                          />
                          {color.enabled ? 'Aktif' : 'Nonaktif'}
                        </label>
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
                colors={colors.map(({ enabled, ...color }) => color)}
                onClose={() => setColorPickerOpen(false)}
                onSave={handleColorSave}
              />
            )}
          </div>

          {/* preview column (right side) */}
          <aside className="avm-preview-column" aria-hidden>
            <PreviewCard
              title={formData.nama_mobil ?? vehicle.nama_mobil}
              subtitle={`${(formData.kd_kelas && kelasOptions.find(k=>k.kd_kelas===formData.kd_kelas)?.nama) ?? formData.kelas_mobil ?? vehicle.kelas_mobil} • ${formData.tahun_keluaran ?? vehicle.tahun_keluaran ?? "-"}`}
              imageUrl={displayPhotoUrl}
              tags={[ (formData as any).jenis_bahan_bakar ?? (vehicle as any).jenis_bahan_bakar ?? "", (formData as any).status ?? (vehicle as any).status ?? "", formData.drivetrain ?? vehicle.drivetrain ?? "", formData.transmisi ?? vehicle.transmisi ?? "" ].filter(Boolean) as string[]}
            />

            {/* right column: keep only the preview card and action buttons */}
            <div style={{ height: 8 }} />
            <div className="actions-row">
              <button type="button" className="btn danger" onClick={() => setShowDeleteConfirm(true)}>Hapus Mobil</button>
              <button type="button" className="btn neutral" onClick={onClose}>Batal</button>
              <button type="submit" className="btn primary" disabled={loading || saving}>{(loading || saving) ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </aside>
        </div>
      </form>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="avm-overlay" style={{ zIndex: 1000 }}>
            <div className="avm-modal" style={{ maxWidth: "400px" }}>
              <h3 style={{ marginBottom: "16px", textAlign: "center" }}>Konfirmasi Hapus</h3>
              <p style={{ textAlign: "center", marginBottom: "20px" }}>
                Apakah Anda yakin ingin menghapus mobil "{vehicle.nama_mobil}"?
              </p>
              <div className="avm-modal-actions">
                <button
                  className="btn neutral"
                  onClick={() => { try { (document.activeElement as HTMLElement)?.blur(); } catch {} ; setShowDeleteConfirm(false); }}
                >
                  Batal
                </button>
                <button
                  className="btn danger"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  {loading ? "Menghapus..." : "Hapus"}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
