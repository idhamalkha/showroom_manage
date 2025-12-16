import React, { useRef, useState } from "react";
import "./ColorPickerModal.css";

export interface MobilWarna {
  kd_warna?: number;
  nama_warna: string;
  kode_hex?: string;
  foto_url?: string;
  is_primary: boolean;
  file?: File;
  is_active?: boolean;
};

interface Props {
  colors: MobilWarna[];
  onClose: () => void;
  onSave: (colors: MobilWarna[]) => void;
}

export default function ColorPickerModal({ colors: initialColors, onClose, onSave }: Props) {
  React.useEffect(() => {
    // mark global flag so parent overlays can detect a child overlay is open
    (window as any).__colorPickerModalOpen = true;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        try { e.stopImmediatePropagation(); e.preventDefault(); } catch {}
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
      (window as any).__colorPickerModalOpen = false;
    };
  }, [onClose]);
  const [colors, setColors] = useState<MobilWarna[]>(initialColors);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function addColor() {
    setColors(prev => {
      const next = [...prev, {
        nama_warna: "",
        is_primary: prev.length === 0, // first color is primary by default
        is_active: true, // new color is active by default
      }];
      setActiveIndex(next.length - 1); // select new color
      return next;
    });
  }

  function removeColor(index: number) {
    setColors(prev => {
      const next = prev.filter((_, i) => i !== index);
      // if we removed the primary color, make the first remaining color primary
      if (prev[index].is_primary && next.length > 0) {
        next[0].is_primary = true;
      }
      return next;
    });
    if (activeIndex === index) {
      setActiveIndex(null);
      setPreview(null);
    }
  }

  function updateColor(index: number, patch: Partial<MobilWarna>) {
    setColors(prev => prev.map((c, i) => {
      if (i === index) return { ...c, ...patch };
      // if setting this as primary, unset others
      if (patch.is_primary) return { ...c, is_primary: false };
      return c;
    }));
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || activeIndex === null) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      // store the dataUrl as foto_url so parent can validate presence
      updateColor(activeIndex, { file, foto_url: dataUrl });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="color-picker-overlay">
      <div className="color-picker-modal">
        <div className="color-picker-header">
          <h3>Warna Mobil</h3>
          <button type="button" className="color-picker-close" onClick={onClose}>×</button>
        </div>

        <div className="color-picker-content">
          <div className="color-picker-left">
            <div className="color-list">
              {colors.map((color, index) => (
                <div
                  key={index}
                  className={`color-item${index === activeIndex ? ' active' : ''}`}
                  onClick={() => {
                    setActiveIndex(index);
                    setPreview(color.foto_url || null);
                  }}
                >
                  <input
                    type="text"
                    value={color.nama_warna}
                    onChange={(e) => updateColor(index, { nama_warna: e.target.value })}
                    placeholder="Nama warna..."
                    className="color-name-input"
                  />
                  <div className="color-item-actions">
                    <div className="color-item-controls">
                      <label className="color-primary-label">
                        <input
                          type="radio"
                          name="primary"
                          checked={color.is_primary}
                          onChange={(e) => {
                            if (e.target.checked) updateColor(index, { is_primary: true });
                          }}
                        />
                        Primary
                      </label>
                      <label className="color-active-label">
                        <input
                          type="checkbox"
                          checked={color.is_active !== false}
                          onChange={(e) => updateColor(index, { is_active: e.target.checked })}
                        />
                        Active
                      </label>
                    </div>
                    <div className="color-hex-input">
                      <input
                        type="text"
                        value={color.kode_hex ?? ''}
                        onChange={(e) => {
                          const hex = e.target.value;
                          if (hex === '' || /^#[0-9A-Fa-f]{0,6}$/.test(hex)) {
                            updateColor(index, { kode_hex: hex });
                          }
                        }}
                        onBlur={(e) => {
                          const hex = e.target.value;
                          if (hex && !hex.startsWith('#')) {
                            updateColor(index, { kode_hex: `#${hex}` });
                          }
                        }}
                        placeholder="#000000"
                        maxLength={7}
                      />
                      <div 
                        className="color-hex-preview"
                        style={{ backgroundColor: color.kode_hex || '#ffffff' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeColor(index);
                      }}
                      className="color-remove-btn"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" className="color-add-btn" onClick={addColor}>
                + Tambah Warna
              </button>
            </div>
          </div>

          <div className="color-picker-right">
            {activeIndex !== null && (
              <div className="color-preview">
                <div className="color-preview-wrap">
                  {preview ? (
                    <img src={preview} alt="Preview" />
                  ) : (
                    <div className="color-preview-placeholder">
                      Pilih foto untuk warna ini
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Pilih Foto Warna
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  style={{ display: 'none' }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="color-picker-footer">
          <button type="button" className="btn neutral" onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              // debug: show colors payload before closing
              // eslint-disable-next-line no-console
              console.debug('ColorPickerModal onSave colors:', colors);
              onSave(colors);
            }}
            disabled={colors.length === 0 || colors.some(c => !c.nama_warna || !c.foto_url)}
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}