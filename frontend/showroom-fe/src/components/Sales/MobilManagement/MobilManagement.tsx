import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { API_BASE } from "../../../api/host";
import "./MobilManagement.css";
import SelectableCheckbox from "../../Efek/Checkbox";
import ModalViewMobil from "./ModalViewMobil";
import AddVehicleModal from "./AddVehicleModal";
import EditVehicleModal from "./EditVehicleModal";

export interface Merek {
  kd_merek?: number;
  nama_merek: string;
  deskripsi?: string | null;
  logo_url?: string | null;
}

export interface Mobil {
  kd_mobil?: number;
  nama_mobil: string;
  kelas_mobil?: string;
  harga_mobil?: number;
  foto_url?: string | null;
  video_url?: string | null;
  kd_merek?: number;
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
}

export default function MobilManagement() {
  // --- primary states (single declaration block) ---
  const [list, setList] = useState<Merek[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<Merek | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState("");
  // kind of confirm: 'brand' or 'vehicle' (helps determine which deletion to run)
  const [confirmKind, setConfirmKind] = useState<'brand' | 'vehicle' | null>(null);
  // confirmRef now supports single or bulk deletion
  const confirmRef = useRef<{ kd?: number; kds?: number[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [toasts, setToasts] = useState<{ id: string; type?: "ok" | "err"; text: string }[]>([]);
  const toastId = useRef(0);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const PAGE_SIZE = 8;
  const [page, setPage] = useState(0);

  const [kelasOptions, setKelasOptions] = useState<{ kd_kelas: number; kode?: string; nama: string; deskripsi?: string }[]>([]);

  // VEHICLE modal state must be declared before effects that use it
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [vehicleEdit, setVehicleEdit] = useState<Mobil | null>(null);

  // NEW: view brand modal + vehicles list
  const [viewBrand, setViewBrand] = useState<Merek | null>(null);
  const [vehicles, setVehicles] = useState<Mobil[]>([]);

  // Edit vehicle modal state
  const [editingVehicle, setEditingVehicle] = useState<Mobil | null>(null);

  // Close top-most simple modals (create/edit/confirm) on Escape. Ensure we are the top-most overlay
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      // If a child overlay like the ColorPickerModal is open, let it handle Escape
      if ((window as any).__colorPickerModalOpen) return;
      try {
        const nodes = Array.from(document.querySelectorAll('.mobil-overlay, .mobil-modal')) as HTMLElement[];
        let topEl: HTMLElement | null = null;
        let topZ = -Infinity;
        for (const n of nodes) {
          if (!n) continue;
          const style = window.getComputedStyle(n);
          if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0) continue;
          const rect = n.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          const zVal = style.zIndex;
          const z = (!zVal || zVal === 'auto') ? 0 : (Number.isFinite(parseInt(zVal as string, 10)) ? parseInt(zVal as string, 10) : 0);
          if (z > topZ) { topZ = z; topEl = n; }
        }
        // if top-most overlay isn't one of ours (or there is none) bail out
        if (!topEl) return;
        // Now only close if one of our simple modals is actually open and is the top-most
        if (topEl.closest('.mobil-modal') || topEl.classList.contains('mobil-overlay')) {
          // Close priority: confirm > edit > create
          if (confirmOpen) { setConfirmOpen(false); confirmRef.current = null; try { (document.activeElement as HTMLElement | null)?.blur(); } catch {} e.preventDefault(); e.stopPropagation(); return; }
          if (edit) { setEdit(null); try { (document.activeElement as HTMLElement | null)?.blur(); } catch {} e.preventDefault(); e.stopPropagation(); return; }
          if (editingVehicle) { setEditingVehicle(null); try { (document.activeElement as HTMLElement | null)?.blur(); } catch {} e.preventDefault(); e.stopPropagation(); return; }
          if (createOpen) { setCreateOpen(false); try { (document.activeElement as HTMLElement | null)?.blur(); } catch {} e.preventDefault(); e.stopPropagation(); return; }
        }
      } catch {}
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [confirmOpen, edit, editingVehicle, createOpen]);


  // fetch kelas_mobil master once
  useEffect(() => {
    let mounted = true;
    axios
      .get(`${API_BASE}/sales/kelas_mobil`)
      .then((res) => {
        if (!mounted) return;
        const data = res.data ?? [];
        if (Array.isArray(data)) {
          setKelasOptions(data as { kd_kelas: number; nama: string; kode?: string; deskripsi?: string }[]);
        }
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      mounted = false;
    };
  }, []);

  // fetch vehicles when viewBrand changes
  useEffect(() => {
    let mounted = true;
    async function fetchVehiclesForBrand(kd?: number) {
      // only fetch when we have a valid brand id
      if (!kd && kd !== 0) {
        if (mounted) setVehicles([]);
        return;
      }
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/sales/mobil`, { params: { kd_merek: Number(kd) } });
        if (!mounted) return;
        const data = res.data ?? [];
        setVehicles(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("fetch vehicles failed", err);
        if (mounted) setVehicles([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    const kd = viewBrand?.kd_merek ?? null;
    if (kd) fetchVehiclesForBrand(kd);
    else setVehicles([]); // clear list when no brand selected

    return () => {
      mounted = false;
    };
  }, [viewBrand?.kd_merek]);

  // --- carousel / drag helpers (single copy) ---
  function chunk<T>(arr: T[], size: number) {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const startX = useRef(0);
  const deltaX = useRef(0);
  const dragging = useRef(false);
  const startTime = useRef(0);
  const baseTranslate = useRef(0);

  const pages = React.useMemo(() => {
    const filtered = Array.isArray(list) ? list : [];
    return chunk(filtered, PAGE_SIZE);
  }, [list]);

  function animateToPage(targetPage: number, duration = 360) {
    const vp = viewportRef.current;
    const tr = trackRef.current;
    if (!vp || !tr) return;
    const vw = vp.clientWidth || 1;
    const toPx = -targetPage * vw;
    tr.style.transition = `transform ${duration}ms cubic-bezier(.22,.9,.28,1)`;
    tr.style.transform = `translateX(${toPx}px)`;
    setPage(targetPage);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const vp = viewportRef.current;
    const tr = trackRef.current;
    if (!vp || !tr) return;
    const tgt = e.currentTarget as Element;
    if (!tgt.classList.contains("mobil-carousel-rail")) return;
    document.body.style.userSelect = "none";
    (document.body as any).style.webkitUserSelect = "none";
    dragging.current = true;
    startX.current = e.clientX;
    deltaX.current = 0;
    startTime.current = performance.now();

    const matrix = window.getComputedStyle(tr).transform;
    if (matrix && matrix !== "none") {
      const values = matrix.match(/matrix.*\((.+)\)/);
      if (values && values[1]) {
        const parts = values[1].split(",").map((s) => parseFloat(s.trim()));
        baseTranslate.current = parts[4] || -page * vp.clientWidth;
      } else {
        baseTranslate.current = -page * vp.clientWidth;
      }
    } else {
      baseTranslate.current = -page * vp.clientWidth;
    }

    try {
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    } catch {}
    tr.style.transition = "none";
    tr.classList.add("is-dragging");
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current || !viewportRef.current || !trackRef.current) return;
    deltaX.current = e.clientX - startX.current;
    const current = baseTranslate.current + deltaX.current;
    trackRef.current.style.transform = `translateX(${current}px)`;
  }

  function finishDrag() {
    const vp = viewportRef.current;
    const tr = trackRef.current;
    if (!vp || !tr) return;
    const vw = vp.clientWidth || 1;
    const dx = deltaX.current;
    const dt = Math.max(1, performance.now() - startTime.current);
    const velocity = dx / dt;
    const thresholdDistance = Math.min(80, vw * 0.12);
    const velThreshold = 0.35;

    if (dx <= -thresholdDistance || velocity <= -velThreshold) {
      animateToPage(Math.min(page + 1, Math.max(0, pages.length - 1)));
    } else if (dx >= thresholdDistance || velocity >= velThreshold) {
      animateToPage(Math.max(page - 1, 0));
    } else {
      animateToPage(page);
    }

    deltaX.current = 0;
    dragging.current = false;
    tr.classList.remove("is-dragging");
    document.body.style.userSelect = "";
    (document.body as any).style.webkitUserSelect = "";
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    try {
      (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    } catch {}
    if (!dragging.current) return;
    finishDrag();
  }

  function onPointerCancel() {
    if (!dragging.current) return;
    finishDrag();
  }

  useEffect(() => {
    const tr = trackRef.current;
    const vp = viewportRef.current;
    if (!tr || !vp) return;
    tr.style.transition = "none";
    const to = -page * vp.clientWidth;
    tr.style.transform = `translateX(${to}px)`;
  }, [pages.length]);

  // Restart entrance animations for cards when the active page changes.
  useEffect(() => {
    const tr = trackRef.current;
    if (!tr) return;
    try {
      const selector = `.mobil-carousel-page[data-page="${page}"] .animate-entrance`;
      const nodes = Array.from(tr.querySelectorAll(selector));
      nodes.forEach((el) => {
        // cast to HTMLElement so we can access offsetWidth for reflow
        const node = el as HTMLElement;
        node.classList.remove("animate-entrance");
        // force reflow to restart CSS animation
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        node.offsetWidth;
        node.classList.add("animate-entrance");
      });
    } catch (err) {
      // swallow errors - non-critical
    }
  }, [page]);

  // ------- helpers & API interactions (single copy) -------
  async function doUpload(file: File | null): Promise<string | null> {
    if (!file) return null;
    try {
      const fd = new FormData();
      fd.append("file", file);
      // Do not set Content-Type manually; browser/axios will add the correct
      // multipart boundary. Manually setting it can break uploads on some servers.
      const res = await axios.post(`${API_BASE}/api/upload`, fd);
      const data = res.data ?? {};
      // common response shapes: { url }, { path }, { github_url }, { data: { url } }, { data: { github_url } }
      const candidates = [
        data?.github_url,
        data?.url,
        data?.path,
        data?.file?.url,
        data?.data?.github_url,
        data?.data?.url,
        data?.data?.path,
      ];
      for (const c of candidates) {
        if (c && typeof c === 'string' && c.trim()) return c as string;
      }
      return null;
    } catch (err) {
      console.error("upload failed", err);
      pushToast("Gagal mengunggah file", "err");
      return null;
    }
  }

  // minimal pushToast implementation to avoid undefined references
  function pushToast(text: string, type?: "ok" | "err") {
    const id = `t${++toastId.current}`;
    setToasts((s) => [...s, { id, text, type }]);
    // auto-remove after timeout
    setTimeout(() => setToasts((s) => s.filter((t) => t.id !== id)), 3500);
  }

  // Handle edit vehicle
  function handleEditVehicle(vehicle: Mobil) {
    setEditingVehicle(vehicle);
  }

  // Handle save vehicle (after edit)
  function handleSaveVehicle(updatedVehicle: Mobil) {
    setVehicles(prev => 
      prev.map(v => v.kd_mobil === updatedVehicle.kd_mobil ? updatedVehicle : v)
    );
    setEditingVehicle(null);
    pushToast("Mobil berhasil diperbarui", "ok");
  }

  // Handle delete vehicle
  function handleDeleteVehicle(deletedVehicle: Mobil) {
    setVehicles(prev => prev.filter(v => v.kd_mobil !== deletedVehicle.kd_mobil));
    setEditingVehicle(null);
    pushToast("Mobil berhasil dihapus", "ok");
  }

  // minimal fetchBrands used by handlers
  async function fetchBrands() {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/merek`);
      const data = res.data ?? [];
      if (Array.isArray(data)) setList(data as Merek[]);
    } catch (err) {
      console.error("fetch brands failed", err);
      setError("Gagal memuat merek");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setCreateOpen(true);
    setPreview(null);
    setUploadFile(null);
  }
  function closeCreate() {
    setCreateOpen(false);
    setPreview(null);
    setUploadFile(null);
  }
  function closeEdit() {
    setEdit(null);
    setUploadFile(null);
    setPreview(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const nama = (form.elements.namedItem("nama_merek") as HTMLInputElement)?.value?.trim() ?? "";
    if (!nama) {
      pushToast("Nama merek wajib diisi", "err");
      return;
    }
    setLoading(true);
    try {
      const logoUrl = await doUpload(uploadFile);
      const payload = { nama_merek: nama, deskripsi: null, logo_url: logoUrl };
      await axios.post(`${API_BASE}/api/merek`, payload);
      pushToast("Merek dibuat", "ok");
      await fetchBrands();
      closeCreate();
    } catch (err) {
      console.error("create merek failed", err);
      pushToast("Gagal membuat merek", "err");
    } finally {
      setLoading(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    if (!edit) return;
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const nama = (form.elements.namedItem("nama_merek") as HTMLInputElement)?.value?.trim() ?? edit.nama_merek;
    const deskripsi = (form.elements.namedItem("deskripsi") as HTMLTextAreaElement)?.value ?? edit.deskripsi ?? null;
    setLoading(true);
    try {
      const logoUrl = uploadFile ? await doUpload(uploadFile) : edit.logo_url ?? null;
      const payload = { nama_merek: nama, deskripsi, logo_url: logoUrl };
      if (edit.kd_merek) {
        await axios.put(`${API_BASE}/api/merek/${edit.kd_merek}`, payload);
        pushToast("Merek diperbarui", "ok");
      }
      await fetchBrands();
      closeEdit();
    } catch (err) {
      console.error("edit merek failed", err);
      pushToast("Gagal memperbarui merek", "err");
    } finally {
      setLoading(false);
    }
  }

  // doDeleteBrand now supports single kd or array kds
  async function doDeleteBrand(kdOrKds?: number | number[]) {
    const kds = Array.isArray(kdOrKds) ? kdOrKds : kdOrKds ? [kdOrKds] : confirmRef.current?.kds ?? [];
    if (!kds || kds.length === 0) return;
    setLoading(true);
    try {
      // attempt bulk delete if API supports; otherwise send individual deletes
      // try bulk endpoint first
      try {
        await axios.request({
          url: `${API_BASE}/api/merek`,
          method: "delete",
          data: { kds },
          headers: { "Content-Type": "application/json" },
        });
      } catch (bulkErr) {
        // fallback: send individual deletes
        await Promise.all(kds.map((kd) => axios.delete(`${API_BASE}/api/merek/${kd}`)));
      }
      pushToast(kds.length > 1 ? "Merek dihapus" : "Merek dihapus", "ok");
      await fetchBrands();
      setSelected(new Set());
      // close view if it was one of deleted brands
      if (viewBrand && kds.includes(viewBrand.kd_merek ?? -1)) setViewBrand(null);
    } catch (err) {
      console.error("delete failed", err);
      pushToast("Gagal menghapus merek", "err");
    } finally {
      setLoading(false);
      setConfirmOpen(false);
      confirmRef.current = null;
    }
  }

  function openEdit(m: Merek) {
    setEdit(m);
    setUploadFile(null);
    setPreview(m.logo_url ?? null);
  }

  function openConfirmDelete(m: Merek) {
    setConfirmMsg(`Hapus merek "${m.nama_merek}"?`);
    confirmRef.current = { kds: m.kd_merek ? [m.kd_merek] : [] };
    setConfirmKind('brand');
    setConfirmOpen(true);
  }

  function handleBulkDeleteClick() {
    const arr = Array.from(selected);
    if (arr.length === 0) {
      pushToast("Pilih merek terlebih dahulu", "err");
      return;
    }
    // collect brand names
    const names = (Array.isArray(list) ? list : []).filter(b => arr.includes(b.kd_merek ?? -1)).map(b => b.nama_merek);
    const snippet = names.length <= 3 ? names.join(', ') : `${names.slice(0,3).join(', ')} dan ${names.length-3} lagi`;
    setConfirmMsg(`Hapus ${arr.length} merek terpilih? (${snippet})`);
    confirmRef.current = { kds: arr };
    setConfirmKind('brand');
    setConfirmOpen(true);
  }

  function openConfirmDeleteVehicles(kds: number[], names?: string[]) {
    if (!kds || kds.length === 0) return;
    const snippet = (names && names.length > 0) ? (names.length <= 5 ? names.join(', ') : `${names.slice(0,5).join(', ')} dan ${names.length-5} lagi`) : '';
    setConfirmMsg(snippet ? `Hapus ${kds.length} mobil terpilih? (${snippet})` : `Hapus ${kds.length} mobil terpilih?`);
    confirmRef.current = { kds };
    setConfirmKind('vehicle');
    setConfirmOpen(true);
  }

  async function doDeleteVehicles(kds?: number[] | number) {
    const ids = Array.isArray(kds) ? kds : kds ? [kds] : confirmRef.current?.kds ?? [];
    if (!ids || ids.length === 0) return;
    setLoading(true);
    try {
      // backend currently supports DELETE /sales/mobil/{kd_mobil} per-item
      // attempt parallel deletes
      await Promise.all(ids.map((id) => axios.delete(`${API_BASE}/sales/mobil/${id}`)));
      // remove from local vehicles state if any are present
      setVehicles((prev) => (Array.isArray(prev) ? prev.filter((v) => !ids.includes(v.kd_mobil ?? -1)) : prev));
      pushToast(ids.length > 1 ? "Mobil dihapus" : "Mobil dihapus", "ok");
    } catch (err) {
      console.error("delete vehicles failed", err);
      pushToast("Gagal menghapus mobil", "err");
    } finally {
      setLoading(false);
      setConfirmOpen(false);
      confirmRef.current = null;
      setConfirmKind(null);
    }
  }

  // initial load
  useEffect(() => {
    fetchBrands();
  }, []);

  // file input change for logo upload
  function onLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setUploadFile(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }

  // revoke preview when unmounted or file changed
  useEffect(() => {
    return () => {
      if (preview && preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // ---- minimal UI (matched to CSS) ----
  return (
    <div className="mobil-section">
      <div className="mobil-header">
        <div className="mobil-header-left">
          {/* page navigation buttons (prev/next) placed at header left as requested */}
          <div className="mobil-header-nav">
            <button
              className="mobil-nav-btn"
              aria-label="Previous page"
              onClick={() => animateToPage(Math.max(0, page - 1))}
              disabled={page === 0}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <button
              className="mobil-nav-btn"
              aria-label="Next page"
              onClick={() => animateToPage(Math.min(page + 1, Math.max(0, pages.length - 1)))}
              disabled={page >= Math.max(0, pages.length - 1)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mobil-header-right">
          <button className="btn primary" onClick={() => openCreate()}>
            Tambah Merek
          </button>

          <button className="btn danger" onClick={() => handleBulkDeleteClick()}>
            Hapus Merek
          </button>
        </div>
      </div>

      {error ? <div className="mobil-error">{error}</div> : null}

      {/* --- carousel (pastikan tetap ada) --- */}
      <div className="mobil-carousel-viewport" ref={viewportRef}>
        <div className="mobil-carousel-track" ref={trackRef}>
          {pages.length === 0 ? (
            <div style={{ padding: 18 }} className="mobil-empty">
              {loading ? "Memuat..." : "Pilih merek untuk mengedit atau menghapus"}
            </div>
          ) : (
            pages.map((pg, pi) => (
              <div className={`mobil-carousel-page${pi === page ? ' active' : ''}`} key={pi} aria-hidden={pi !== page} data-page={pi}>
                <div className="mobil-page-grid">
                  {pg.map((m, i) => (
                    <div
                      key={m.kd_merek}
                      className={`mobil-card${pi === page ? ' animate-entrance' : ''}${selected.has(m.kd_merek ?? -1) ? ' selected' : ''}`}
                      style={{ animationDelay: `${i * 60}ms` }}
                      data-brand-name={m.nama_merek}
                      data-filterable-card
                    >
                      <div className="mobil-select">
                        <SelectableCheckbox
                          checked={selected.has(m.kd_merek ?? -1)}
                          onChange={(checked) => {
                            const s = new Set(selected);
                            if (checked && m.kd_merek) s.add(m.kd_merek);
                            else if (m.kd_merek) s.delete(m.kd_merek);
                            setSelected(s);
                          }}
                          ariaLabel={`select-${m.kd_merek ?? m.nama_merek}`}
                        />
                      </div>

                      {/* clickable logo opens brand view modal */}
                      <div
                        className="mobil-logo-wrap"
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          setViewBrand(m);
                        }}
                      >
                        {m.logo_url ? (
                          <img src={m.logo_url} alt={m.nama_merek} className="mobil-logo" />
                        ) : (
                          <div className="mobil-logo-placeholder">{(m.nama_merek || "").charAt(0).toUpperCase()}</div>
                        )}
                      </div>

                      <div style={{ width: "100%", textAlign: "center" }}>
                        <div style={{ fontSize: 13, marginTop: 6, color: "var(--muted)" }}>
                          {m.deskripsi ?? ""}
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div
        className="mobil-carousel-rail"
        ref={railRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      />

      {/* toasts */}
      <div className="mobil-toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`mobil-toast ${t.type ?? ""}`}>
            {t.text}
          </div>
        ))}
      </div>

      {/* ---- modal view moved to separate component ---- */}
      {viewBrand ? (
        <ModalViewMobil
          brand={viewBrand}
          vehicles={vehicles}
          loading={loading}
          kelasOptions={kelasOptions}
          onClose={() => {
            setViewBrand(null);
            setVehicles([]);
          }}
          onEditBrand={(b) => {
            openEdit(b);
          }}
          onDeleteBrand={(b) => {
            openConfirmDelete(b);
          }}
          onAddVehicle={() => {
            // preset kd_merek so new vehicle will be associated with this brand
            setVehicleEdit({ kd_merek: viewBrand?.kd_merek, nama_mobil: "" } as any);
            setVehicleModalOpen(true);
          }}
          onDeleteVehicles={(kds: number[], names?: string[]) => {
            if (!kds || kds.length === 0) {
              pushToast("Pilih mobil terlebih dahulu", "err");
              return;
            }
            openConfirmDeleteVehicles(kds, names);
          }}
          onEditVehicle={handleEditVehicle}
        />
      ) : null}

      {/* CREATE modal: hilangkan judul, tampilkan hanya tombol pilih foto (primary) dan sembunyikan nama file */}
      {createOpen ? (
        <div className="mobil-overlay">
          <div className="mobil-modal">
            <div className="mobil-modal-avatar">
              {preview ? <img src={preview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ fontWeight: 700 }}>{(Math.random() + "").slice(2, 4)}</div>}
            </div>

            {/* removed explicit close X: use Batal button or Escape to close */}

            <form onSubmit={handleCreate}>
              <label className="mobil-label">Nama Merek</label>
              <input name="nama_merek" className="mobil-input" />

              <label className="mobil-label">Logo</label>
              <div className="mobil-file-row">
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Pilih Logo
                </button>

                {/* HAPUS tampilan nama file: tidak ditampilkan sesuai permintaan */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={onLogoFileChange}
                />
              </div>

              <div className="mobil-modal-actions">
                <button type="button" className="btn neutral" onClick={() => closeCreate()}>
                  Batal
                </button>
                <button type="submit" className="btn primary" disabled={loading}>
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* edit modal */}
      {edit ? (
        <div className="mobil-overlay">
          <div className="mobil-modal">
            <div className="mobil-modal-avatar">
              {preview ? <img src={preview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ fontWeight: 700 }}>{(edit.nama_merek || "").charAt(0).toUpperCase()}</div>}
            </div>

            {/* removed explicit close X: use Batal button or Escape to close */}

            {/* Judul dihapus — disamakan dengan modal tambah merek */}
            <form onSubmit={handleEditSubmit}>
              <label className="mobil-label">Nama Merek</label>
              <input name="nama_merek" className="mobil-input" defaultValue={edit.nama_merek} />

              {/* Hapus field Deskripsi sesuai permintaan */}

              <label className="mobil-label">Logo</label>
              <div className="mobil-file-row">
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Ubah Logo
                </button>

                {/* Nama file disembunyikan (CSS .mobil-file-name sudah diatur) - tidak renderkan teks */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={onLogoFileChange}
                />
              </div>

              <div className="mobil-modal-actions">
                <button type="button" className="btn neutral" onClick={() => closeEdit()}>
                  Batal
                </button>
                <button type="submit" className="btn primary" disabled={loading}>
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* confirm modal */}
      {confirmOpen ? (
        <div className="mobil-overlay">
          <div className="mobil-modal mobil-confirm">
            <h3>Konfirmasi</h3>
            <p>{confirmMsg}</p>
            <div className="mobil-modal-actions">
              <button
                className="btn neutral"
                onClick={() => {
                  setConfirmOpen(false);
                  confirmRef.current = null;
                }}
              >
                Batal
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  const ref = confirmRef.current;
                  if (!ref) return;
                  if (confirmKind === 'vehicle') {
                    doDeleteVehicles(ref.kds ?? ref.kd);
                  } else {
                    doDeleteBrand(ref.kds ?? ref.kd);
                  }
                }}
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* simple vehicle modal (placeholder, follows CSS) */}
      <AddVehicleModal
        open={vehicleModalOpen}
        brandId={vehicleEdit?.kd_merek ?? viewBrand?.kd_merek ?? null}
        kelasOptions={kelasOptions}
        initial={vehicleEdit ? { ...vehicleEdit } : undefined}
        loading={loading}
        onClose={() => setVehicleModalOpen(false)}
        onSave={async (vehicle, photo, video) => {
          try {
            setLoading(true);
            const uploads: { foto_url?: string | null; video_url?: string | null } = {};

            if (photo) {
              uploads.foto_url = await doUpload(photo);
            }
            if (video) {
              uploads.video_url = await doUpload(video);
            }

            // Resolve kelas_mobil name from kd_kelas if provided
            const kelasName =
              (vehicle.kd_kelas ? (kelasOptions.find(k => k.kd_kelas === vehicle.kd_kelas)?.nama) : undefined)
              ?? vehicle.kelas_mobil
              ?? undefined;

            // Ensure harga_mobil present (backend required). Prefer vehicle.harga_mobil else 0 or prompt user
            const hargaMobil = typeof vehicle.harga_mobil === "number" ? vehicle.harga_mobil : (vehicle.harga_mobil ? Number(vehicle.harga_mobil) : 0);

            const payload = {
              ...vehicle,
              ...uploads,
              kd_merek: vehicle.kd_merek ?? (viewBrand?.kd_merek ?? undefined),
              kd_kelas: vehicle.kd_kelas ?? undefined,
              kelas_mobil: kelasName,
              harga_mobil: hargaMobil,
            };

            // send create request and use returned object to update local list immediately
      const resp = await axios.post(`${API_BASE}/sales/mobil`, payload);
      const created = resp.data;
      // prepend the new vehicle so it appears immediately in the opened brand modal
      setVehicles((prev) => [created, ...(Array.isArray(prev) ? prev : [])]);
      // return created object so caller can perform follow-up actions (e.g., create color rows)
      return created;
            pushToast("Mobil ditambahkan", "ok");
            // keep modal open so user can add more; if you want to auto-close, call setVehicleModalOpen(false)
          } catch (err) {
            console.error(err);
            pushToast("Gagal menambahkan mobil", "err");
          } finally {
            setLoading(false);
          }
        }}
      />

      {/* Edit Vehicle Modal */}
      <EditVehicleModal
        vehicle={editingVehicle}
        kelasOptions={kelasOptions}
        loading={loading}
        onClose={() => {
          setEditingVehicle(null);
        }}
        onSave={handleSaveVehicle}
        onDelete={handleDeleteVehicle}
      />
    </div>
  );
}