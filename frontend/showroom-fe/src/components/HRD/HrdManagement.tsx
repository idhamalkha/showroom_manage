import { useEffect, useState, useRef, useMemo } from "react";
import "../../styles/hrd.css";
import "./HrdModal.css";
import "../../styles/hrd-carousel.css";
import {
  fetchEmployees,
  deleteEmployee,
  updateEmployee,
  createEmployee,
  fetchJabatan,
  fetchGaji,
  fetchKontrak
} from "../../services/hrdService";
import axios from "axios";
import { API_BASE } from "../../api/host";
import SelectableCheckbox from "../../components/Efek/Checkbox";

export interface Employee {
  id: string | number;
  fullName: string;
  position?: string;
  avatar?: string | null;
  salary?: number;
  contract?: string | null;
  kd_jabatan?: number;
  kd_gaji?: number;
  kd_kontrak?: number;
  jabatan?: {
    kd_jabatan?: number;
    nama_jabatan?: string;
  };
}

export interface Jabatan {
  kd_jabatan: number;
  nama_jabatan: string;
}
export interface Gaji {
  kd_gaji: number;
  jumlah_gaji: number;
}
export interface Kontrak {
  kd_kontrak: number;
  masa_kontrak: string;
}

export default function HrdManagement() {
  // helper: compute fixed-position style for a dropdown/popover.
  // If there's not enough space below, place it above using `bottom`.
  const computeFixedPosition = (btn: HTMLElement | null, preferHeight = 260): React.CSSProperties | undefined => {
    if (!btn) return undefined;
    const rect = btn.getBoundingClientRect();
    const vh = window.innerHeight;
    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    // find left candidate, prefer aligning right edge if near edge
    const rightCandidate = rect.right - 8;
    const nearRightEdge = rightCandidate < 220;
    const left = nearRightEdge ? rect.left : rightCandidate;

    if (spaceBelow >= preferHeight || spaceBelow >= spaceAbove) {
      return {
        position: "fixed",
        top: `${rect.bottom + 8}px`,
        left: `${left}px`,
        zIndex: 1400,
        transform: nearRightEdge ? "translateX(0)" : "translateX(-100%)",
      };
    } else {
      // open upwards: use bottom coordinate relative to viewport
      return {
        position: "fixed",
        bottom: `${vh - rect.top + 8}px`,
        left: `${left}px`,
        zIndex: 1400,
        transform: nearRightEdge ? "translateX(0)" : "translateX(-100%)",
      };
    }
  };

  const [list, setList] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<Employee | null>(null);
  const [edit, setEdit] = useState<Employee | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  // confirmation modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState<string>("");
  const confirmActionRef = useRef<(() => Promise<void>) | null>(null);
  const [jabatanList, setJabatanList] = useState<Jabatan[]>([]);
  const [gajiList, setGajiList] = useState<Gaji[]>([]);
  const [kontrakList, setKontrakList] = useState<Kontrak[]>([]);
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [createPhoto, setCreatePhoto] = useState<File | null>(null);
  const [createPreview, setCreatePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createFileRef = useRef<HTMLInputElement>(null);
  // single dropdown value: either sort mode or "kontrak:<kd_kontrak>"
  const [filterValue, setFilterValue] = useState<string>("default");

  // track original kd_jabatan when opening edit to protect Owner role
  const editOriginalKdRef = useRef<number | undefined>(undefined);

  // compute owner kd_jabatan (if exists) from jabatanList
  const ownerKd = useMemo(() => {
    const o = jabatanList.find((j) => (j.nama_jabatan || "").toLowerCase() === "owner");
    return o?.kd_jabatan;
  }, [jabatanList]);

  // --- new: popover state + refs (unique names to avoid CSS collision) ---
  const [filterOpen, setFilterOpen] = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement | null>(null);
  const [filterStyle, setFilterStyle] = useState<React.CSSProperties | undefined>(undefined);
  
  // Carousel state
  const [currentRole, setCurrentRole] = useState(0);
  const [isChanging, setIsChanging] = useState(false);
  
  const changeRole = (newRole: number) => {
    setIsChanging(true);
    setTimeout(() => {
      setCurrentRole(newRole);
      setTimeout(() => setIsChanging(false), 50);
    }, 150);
  };
  const roles = useMemo(() => {
    // build array of role objects { kd_jabatan, nama_jabatan }
    const arr = (jabatanList || [])
      .filter(j => (j.nama_jabatan || "").toLowerCase() !== "owner")
      .map(j => ({ kd_jabatan: j.kd_jabatan, nama_jabatan: j.nama_jabatan || "" }));
    const order = ["hrd", "finance", "sales"];
    return arr.sort((a, b) => {
      const aName = (a.nama_jabatan || "").toLowerCase();
      const bName = (b.nama_jabatan || "").toLowerCase();
      const ai = order.indexOf(aName);
      const bi = order.indexOf(bName);
      const finalAi = ai === -1 ? order.length : ai;
      const finalBi = bi === -1 ? order.length : bi;
      return finalAi - finalBi;
    });
  }, [jabatanList]);

  const computeAndSet = (btn: HTMLButtonElement | null, setStyle: (s: React.CSSProperties | undefined) => void) => {
    const s = computeFixedPosition(btn, 320);
    setStyle(s);
  };

  useEffect(() => {
    if (filterOpen) computeAndSet(filterBtnRef.current, setFilterStyle);
    else setFilterStyle(undefined);
  }, [filterOpen, kontrakList]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (filterOpen && filterBtnRef.current && !filterBtnRef.current.contains(target)) {
        const pop = document.querySelector(".hrd-popover");
        if (pop && !pop.contains(target)) setFilterOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // If any popover is visible, close popovers first (dropdowns inside modals)
      const pop = document.querySelector('.hrd-popover');
      if (pop) {
        // dispatch global event so all popovers listening will close themselves
        document.dispatchEvent(new Event('hrd:close-popovers'));
        return;
      }
      // If any modal overlay is visible, close the top-most one by simulating an overlay click
      const overlays = Array.from(document.querySelectorAll('.hrd-overlay')) as HTMLElement[];
      if (overlays.length > 0) {
        const top = overlays[overlays.length - 1];
        try { top.click(); } catch { /* ignore */ }
        return;
      }
      // Fallback: close the filter if still open
      if (filterOpen) setFilterOpen(false);
    }
    document.addEventListener("click", onDoc);
    window.addEventListener("keydown", onKey);
    // close on global close request
    const onGlobalClose = () => setFilterOpen(false);
    document.addEventListener("hrd:close-popovers" as any, onGlobalClose as EventListener);
    return () => {
      document.removeEventListener("click", onDoc);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("hrd:close-popovers" as any, onGlobalClose as EventListener);
    };
  }, [filterOpen]);

  const getFilterLabel = () => {
    if (filterValue.startsWith("kontrak:")) {
      const id = filterValue.split(":")[1];
      const k = kontrakList.find((x) => String(x.kd_kontrak) === id);
      return k ? `Kontrak: ${k.masa_kontrak}` : "Kontrak";
    }
    switch (filterValue) {
      case "name-asc": return "Nama A-Z";
      case "name-desc": return "Nama Z-A";
      case "salary-desc": return "Gaji: High → Low";
      case "salary-asc": return "Gaji: Low → High";
      case "default": return "Default";
      default: return "Filter";
    }
  };
  // --- end new code ---

  // Fetch master data (jabatan/gaji/kontrak) from backend. Employees will be fetched per-role below.
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchJabatan(), fetchGaji(), fetchKontrak()])
      .then(([jab, gaji, kontrak]) => {
        setJabatanList(jab || []);
        setGajiList(gaji || []);
        setKontrakList(kontrak || []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch employees for the currently selected role (kd_jabatan)
  useEffect(() => {
    let mounted = true;
    const kd = roles[currentRole]?.kd_jabatan;
    // if roles not loaded yet, skip
    if (typeof kd === "undefined") return;
    setLoading(true);
    fetchEmployees(kd)
      .then((emp) => {
        if (!mounted) return;
        setList(emp || []);
      })
      .catch((err) => {
        console.error("fetch employees by role failed", err);
        if (mounted) setList([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [roles, currentRole]);

  // derived list with single filterValue controlling both sort and kontrak filter
  const displayedList = useMemo(() => {
    // Filter out owner lebih ketat - check kd_jabatan dan nama_jabatan
    const withoutOwner = (list || []).filter(emp => {
      // cek kd_jabatan
      if (emp.kd_jabatan === ownerKd) return false;
      if (emp.jabatan?.kd_jabatan === ownerKd) return false;
      
      // double check nama_jabatan untuk amannya
      const jabatan = (emp.jabatan?.nama_jabatan || "").toString().toLowerCase().trim();
      if (jabatan === "owner") return false;

      return true;
    });

    // Continue with existing sort logic but use withoutOwner instead of arr
    let kontrakSel: string | "all" = "all";
    let sortModeInternal: "default" | "name-asc" | "name-desc" | "salary-desc" | "salary-asc" = "name-asc";

    if (filterValue.startsWith("kontrak:")) {
      kontrakSel = filterValue.split(":")[1] || "all";
    } else if (["default", "name-asc", "name-desc", "salary-desc", "salary-asc"].includes(filterValue)) {
      sortModeInternal = filterValue as any;
    }

    const filtered = kontrakSel === "all" ? withoutOwner : withoutOwner.filter((e) => String(e.kd_kontrak) === String(kontrakSel));

    if (sortModeInternal === "default") {
      const order = ["hrd", "finance", "sales"]; // removed owner from order
      return filtered.sort((a, b) => {
        const aName = (a.jabatan?.nama_jabatan || "").toString().toLowerCase();
        const bName = (b.jabatan?.nama_jabatan || "").toString().toLowerCase();
        
        const ai = order.indexOf(aName);
        const bi = order.indexOf(bName);
        const finalAi = ai === -1 ? order.length : ai;
        const finalBi = bi === -1 ? order.length : bi;

        if (finalAi !== finalBi) return finalAi - finalBi;
        return (a.fullName || "").localeCompare(b.fullName || "");
      });
    }

    switch (sortModeInternal) {
      case "name-asc":
        return filtered.sort((a, b) => (a.fullName ?? "").localeCompare(b.fullName ?? ""));
      case "name-desc":
        return filtered.sort((a, b) => (b.fullName ?? "").localeCompare(a.fullName ?? ""));
      case "salary-desc":
        return filtered.sort((a, b) => Number(b.salary ?? 0) - Number(a.salary ?? 0));
      case "salary-asc":
        return filtered.sort((a, b) => Number(a.salary ?? 0) - Number(b.salary ?? 0));
      default:
        return filtered;
    }
  }, [list, filterValue, kontrakList, ownerKd]);

  function toggleSelect(id: string | number) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    // open confirmation modal and defer actual deletion
    setConfirmMsg(`Hapus ${selected.size} karyawan terpilih?`);
    confirmActionRef.current = async () => {
      setLoading(true);
      for (const id of selected) {
        await deleteEmployee(String(id));
      }
      setSelected(new Set());
      
      // Refresh only the current role's employees
      const kd = roles[currentRole]?.kd_jabatan;
      if (typeof kd !== "undefined") {
        const data = await fetchEmployees(kd);
        setList(data);
      }
      
      setLoading(false);
      setConfirmOpen(false);
    };
    setConfirmOpen(true);
  }

  async function handleDeletePersonal(id: string | number) {
    // open confirmation modal and defer actual deletion
    setConfirmMsg(`Hapus karyawan ini?`);
    confirmActionRef.current = async () => {
      setLoading(true);
      await deleteEmployee(String(id));
      setDetail(null);
      
      // Refresh only the current role's employees
      const kd = roles[currentRole]?.kd_jabatan;
      if (typeof kd !== "undefined") {
        const data = await fetchEmployees(kd);
        setList(data);
      }
      
      setLoading(false);
      setConfirmOpen(false);
    };
    setConfirmOpen(true);
  }

  // Edit pop up logic
  function openEdit(emp: Employee) {
    setEdit({
      ...emp,
      kd_jabatan:
        typeof emp.kd_jabatan === "number"
          ? emp.kd_jabatan
          : emp.jabatan?.kd_jabatan ?? undefined,
      position:
        emp.jabatan?.nama_jabatan ??
        jabatanList.find((j) => j.kd_jabatan === emp.kd_jabatan)?.nama_jabatan ??
        emp.position ??
        "",
      kd_gaji:
        typeof emp.kd_gaji === "number" ? emp.kd_gaji : emp.kd_gaji ? Number(emp.kd_gaji) : undefined,
      kd_kontrak:
        typeof emp.kd_kontrak === "number"
          ? emp.kd_kontrak
          : emp.kd_kontrak
          ? Number(emp.kd_kontrak)
          : undefined,
      contract:
        emp.contract ??
        kontrakList.find((k) => k.kd_kontrak === emp.kd_kontrak)?.masa_kontrak ??
        ""
    });
    setEditPhoto(null);
    setEditPreview(emp.avatar || null);
    // remember original jabatan to prevent changing Owner role
    editOriginalKdRef.current = typeof emp.kd_jabatan === "number" ? emp.kd_jabatan : emp.jabatan?.kd_jabatan;
  }

  function closeEdit() {
    setEdit(null);
    setEditPhoto(null);
    setEditPreview(null);
    // dispatch click ke document supaya popovers yang masih terbuka (fixed-position) tertutup
    document.dispatchEvent(new MouseEvent("click"));
    blurActive();
  }
  
  // Create pop up logic
  function openCreate() {
    setCreateOpen(true);
    setCreatePhoto(null);
    setCreatePreview(null);
  }
  function closeCreate() {
    setCreateOpen(false);
    setCreatePhoto(null);
    setCreatePreview(null);
    // reset controlled draft (hindari nilai tersisa)
    setCreateDraft({});
    // trigger global click untuk menutup popovers fixed yang mungkin masih terlihat
    document.dispatchEvent(new MouseEvent("click"));
    // reset file input value (if any)
    try { if (createFileRef.current) createFileRef.current.value = ""; } catch {}
    blurActive();
  }

  // Tambahkan state untuk button loading
  const [submitLoading, setSubmitLoading] = useState(false);

  // Update handleEditSubmit
  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    
    try {
      setSubmitLoading(true); // Start loading
      setLoading(true);

      let avatarUrl = edit.avatar;
      if (editPhoto) {
        const formData = new FormData();
        formData.append("file", editPhoto);
        const res = await axios.post(`${API_BASE}/api/upload`, formData);
        avatarUrl = res.data.github_url;
      }

      // ensure Owner role cannot be removed/changed even if manipulated
      const finalKdJabatan =
        editOriginalKdRef.current !== undefined && editOriginalKdRef.current === ownerKd
          ? ownerKd
          : edit.kd_jabatan;

      const payload = {
        nama_karyawan: edit.fullName,
        kd_jabatan: finalKdJabatan,
        kd_gaji: edit.kd_gaji,
        kd_kontrak: edit.kd_kontrak,
        jumlah_gaji: edit.salary ?? undefined,
        masa_kontrak: edit.contract ?? undefined,
        foto: avatarUrl ?? null
      };

      await updateEmployee(String(edit.id), payload);
      setDetail(null);
      closeEdit();
      
      // Refresh only the current role's employees
      const kd = roles[currentRole]?.kd_jabatan;
      if (typeof kd !== "undefined") {
        const data = await fetchEmployees(kd);
        setList(data);
      }
    } catch (err) {
      console.error("Failed to update:", err);
    } finally {
      setSubmitLoading(false); // Stop loading
      setLoading(false);
    }
    blurActive();
  }

  // Update handleCreateSubmit
  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    try {
      setSubmitLoading(true); // Start loading
      setLoading(true);

      let avatarUrl: string | null = null;
      if (createPhoto) {
        const fd = new FormData();
        fd.append("file", createPhoto);
        const res = await axios.post(`${API_BASE}/api/upload`, fd);
        avatarUrl = res.data.github_url ?? null;
      }

      const form = e.target as HTMLFormElement;
      const fd = new FormData(form);

      // derive selected values (createDraft takes precedence)
      const useKdJabatan = createDraft.kd_jabatan ?? (fd.get("kd_jabatan") ? Number(fd.get("kd_jabatan")) : undefined);
      const useKdGaji = createDraft.kd_gaji ?? (fd.get("kd_gaji") ? Number(fd.get("kd_gaji")) : undefined);
      const useKdKontrak = createDraft.kd_kontrak ?? (fd.get("kd_kontrak") ? Number(fd.get("kd_kontrak")) : undefined);

      // safety: prevent creating Owner via form
      const safeKdJabatan = useKdJabatan === ownerKd ? undefined : useKdJabatan;

      // resolve masa_kontrak string from kontrakList when kd_kontrak provided
      const selectedMasaKontrak = useKdKontrak
        ? kontrakList.find((k) => k.kd_kontrak === useKdKontrak)?.masa_kontrak ?? undefined
        : undefined;

      // cari jumlah_gaji dari createDraft terlebih dahulu, fallback dari gajiList bila perlu
      const jumlahGaji =
        createDraft.salary ??
        (useKdGaji ? gajiList.find((g) => g.kd_gaji === useKdGaji)?.jumlah_gaji : undefined);

      // tanggal lahir: prefer controlled createDraft, else read form value (format YYYY-MM-DD)
      const useTglLahir = createDraft.tgl_lahir ?? (fd.get("tgl_lahir") ? String(fd.get("tgl_lahir")) : undefined);

      const payload = {
        nama_karyawan: (fd.get("fullName") as string) ?? "",
        kd_jabatan: safeKdJabatan,
        kd_gaji: useKdGaji,
        kd_kontrak: useKdKontrak,
        masa_kontrak: selectedMasaKontrak,
        jumlah_gaji: jumlahGaji ?? undefined,
        foto: avatarUrl,
        ...(useTglLahir ? { tgl_lahir: useTglLahir } : {}),
      };

      await createEmployee(payload);
      closeCreate();
      
      // Refresh only the current role's employees
      const kd = roles[currentRole]?.kd_jabatan;
      if (typeof kd !== "undefined") {
        const data = await fetchEmployees(kd);
        setList(data);
      }
    } catch (err) {
      console.error("Failed to create:", err);
    } finally {
      setSubmitLoading(false); // Stop loading
      setLoading(false);
    }
    blurActive();
  }

  // helper: blur currently focused element (prevent lingering :focus/:hover visual)
  const blurActive = () => {
    try {
      const el = document.activeElement as HTMLElement | null;
      if (el && typeof el.blur === "function") el.blur();
    } catch {
      /* ignore in SSR */
    }
  };

  // --- HrdSelectPopover: small popover select (scoped to HRD) ---
  function HrdSelectPopover<T extends string | number>({
    options,
    value,
    onChange,
    placeholder,
    disabled,
    className = '' // Add className prop with default empty string
  }: {
    options: { value: T; label: string }[];
    value?: T | null;
    onChange: (v: T) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: 'emp' | ''; // Allow either 'emp' for employee modal or empty for default
  }) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement | null>(null);
    const listRef = useRef<HTMLDivElement | null>(null);
    const [popStyle, setPopStyle] = useState<React.CSSProperties | undefined>(undefined);

    useEffect(() => {
      function onDoc(e: MouseEvent) {
        const t = e.target as Node;
        if (!open) return;
        if (btnRef.current?.contains(t)) return;
        if (listRef.current?.contains(t)) return;
        setOpen(false);
      }
      function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") setOpen(false);
      }
      // global close handler that ignores requests originating from inside this popover
      const onGlobalClose = (ev: Event) => {
        const ce = ev as CustomEvent<any>;
        const origin = ce?.detail?.origin as Node | undefined;
        if (!open) return;
        if (origin && (btnRef.current?.contains(origin) || listRef.current?.contains(origin))) return;
        setOpen(false);
      };
      document.addEventListener("click", onDoc);
      window.addEventListener("keydown", onKey);
      document.addEventListener("hrd:close-popovers" as any, onGlobalClose as EventListener);
      return () => {
        document.removeEventListener("click", onDoc);
        window.removeEventListener("keydown", onKey);
        document.removeEventListener("hrd:close-popovers" as any, onGlobalClose as EventListener);
      };
    }, [open]);

    useEffect(() => {
      if (open) {
        const s = computeFixedPosition(btnRef.current, 300);
        setPopStyle(s);
      } else {
        setPopStyle(undefined);
      }
    }, [open]);

    const label = options.find((o) => String(o.value) === String(value))?.label ?? placeholder ?? "Pilih";

    // ensure popover closes when parent updates the selected value (fixes modal cases)
    useEffect(() => {
      if (value != null) {
        setOpen(false);
      }
    }, [value]);

    return (
      <div style={{ position: "relative", display: "block" }}>
        <button
          type="button"
          ref={btnRef}
          className={`${className ? `${className}-select-btn` : 'hrd-select-btn'}${value != null && value !== "" ? " selected" : ""}`}
          onMouseDown={(e) => {
            // close other popovers first, then open this one
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) {
              if (!open) document.dispatchEvent(new CustomEvent("hrd:close-popovers", { detail: { origin: btnRef.current } }));
              setOpen((s) => !s);
            }
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen((s) => !s);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          aria-haspopup="true"
          aria-expanded={open}
          disabled={disabled}
        >
          <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
          <span className="hrd-select-caret">▾</span>
        </button>

        {open && (
          <div className={`${className ? `${className}-select-list` : 'hrd-select-list'} popover--fixed`} ref={listRef} role="menu" style={popStyle}>
            {options.map((o) => (
              <button
                key={String(o.value)}
                type="button"
                className={`${className ? `${className}-select-item` : 'hrd-select-item'}${String(o.value) === String(value) ? " selected" : ""}`}
                aria-current={String(o.value) === String(value) ? "true" : undefined}
                onMouseDown={(e) => {
                  // choose on mousedown to avoid focus/re/open issues; preventDefault to stop browser focus
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(o.value);
                  setOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onChange(o.value);
                    setOpen(false);
                  }
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
  // --- end HrdSelectPopover ---

  // create-form controlled values (used when replacing native selects)
  // tambahkan `salary` supaya nilai jumlah_gaji dikirim seperti di Edit
  // include tgl_lahir for create form (YYYY-MM-DD)
  const [createDraft, setCreateDraft] = useState<{ kd_jabatan?: number; kd_gaji?: number; kd_kontrak?: number; salary?: number; tgl_lahir?: string }>({});

  // custom DatePickerPopup (calendar UI with month/year selectors + confirm)
  function DatePickerPopup({ value, onChange }: { value?: string | null; onChange: (v?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<string | "">(value ?? "");
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const justClosedRef = useRef(false); // prevent immediate re-open after cancel
  const [pos, setPos] = useState<React.CSSProperties | undefined>(undefined);

  useEffect(() => setTemp(value ?? ""), [value]);

  useEffect(() => {
    if (!open || !btnRef.current) return setPos(undefined);
    const s = computeFixedPosition(btnRef.current, 420);
    setPos(s);
  }, [open]);

  // use pointerdown for robust outside click (works before focus/blur)
  useEffect(() => {
    function onDoc(e: PointerEvent) {
      const t = e.target as Node;
      if (!open) return;
      if (btnRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    // close on global broadcast, but ignore if origin is inside this popover
    const onGlobalClose = (ev: Event) => {
      const ce = ev as CustomEvent<any>;
      const origin = ce?.detail?.origin as Node | undefined;
      if (origin && (btnRef.current?.contains(origin) || popRef.current?.contains(origin))) return;
      setOpen(false);
    };
    document.addEventListener("hrd:close-popovers" as any, onGlobalClose as EventListener);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("hrd:close-popovers" as any, onGlobalClose as EventListener);
    };
  }, [open]);

  const initDate = temp ? new Date(temp + "T00:00:00") : new Date();
  const [viewYear, setViewYear] = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());
  useEffect(() => { const d = temp ? new Date(temp + "T00:00:00") : new Date(); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }, [open, temp]);

  function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
  function firstDayIndex(y: number, m: number) { return new Date(y, m, 1).getDay(); }

  const days = daysInMonth(viewYear, viewMonth);
  const firstIdx = firstDayIndex(viewYear, viewMonth);
  const weeks: (number | null)[] = [];
  const prevDays = daysInMonth(viewYear, viewMonth - 1);
  for (let i = 0; i < firstIdx; i++) weeks.push(prevDays - firstIdx + 1 + i);
  for (let d = 1; d <= days; d++) weeks.push(d);
  while (weeks.length % 7 !== 0) weeks.push(null);

  // years list: start from current year and go down to a reasonable human lifespan (now - 120)
  const years = (function() {
    const now = new Date().getFullYear();
    const minYear = Math.max(1900, now - 120); // lower bound (sensible minimum)
    const out: number[] = [];
    for (let y = now; y >= minYear; y--) out.push(y);
    return out;
  })();

  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const selectedIso = temp || "";

  function selectDay(day: number | null) {
    if (day == null) return;
    // Gunakan helper untuk membuat string YYYY-MM-DD yang stabil
    const year = String(viewYear).padStart(4, '0');
    const month = String(viewMonth + 1).padStart(2, '0'); 
    const dayStr = String(day).padStart(2, '0');
    const iso = `${year}-${month}-${dayStr}`;
    setTemp(iso);
  }

  // simple dropdown reuse (styled like other HRD selects)
  function SimpleDropdown<T extends string|number>({
    value,
    options,
    render,
    onSelect,
    forceDown
  }: {
    value: T;
    options: { key: T; label: string }[];
    render?: (v: T) => string;
    onSelect: (v: T) => void;
    forceDown?: boolean; // when true, render list as relative/inline dropdown (always down)
  }) {
     const [openLocal, setOpenLocal] = useState(false);
     const ref = useRef<HTMLDivElement | null>(null);
     const [listStyle, setListStyle] = useState<React.CSSProperties | undefined>(undefined);
     const btnLocalRef = useRef<HTMLButtonElement | null>(null);
     useEffect(() => {
       function onDoc(e: PointerEvent) {
         if (!openLocal) return;
         const t = e.target as Node;
         if (ref.current?.contains(t)) return;
         setOpenLocal(false);
       }
       document.addEventListener("pointerdown", onDoc);
       return () => document.removeEventListener("pointerdown", onDoc);
     }, [openLocal]);
     // close on global broadcast
     useEffect(() => {
       const onGlobalClose = () => setOpenLocal(false);
       document.addEventListener("hrd:close-popovers" as any, onGlobalClose as EventListener);
       return () => document.removeEventListener("hrd:close-popovers" as any, onGlobalClose as EventListener);
     }, []);
     useEffect(() => {
       if (openLocal && btnLocalRef.current) {
         if (forceDown) {
           // use relative positioning inside container -> no fixed style
           setListStyle(undefined);
         } else {
           setListStyle(computeFixedPosition(btnLocalRef.current, 240));
         }
       } else {
         setListStyle(undefined);
       }
     }, [openLocal]);
     return (
       <div ref={ref} style={{ position: "relative", minWidth: 140 }}>
         <button
           type="button"
           ref={btnLocalRef}
           className="hrd-select-btn"
           onMouseDown={(e) => {
             e.preventDefault();
             e.stopPropagation();
             if (!openLocal) document.dispatchEvent(new CustomEvent("hrd:close-popovers", { detail: { origin: btnLocalRef.current } }));
             setOpenLocal(s => !s);
           }}
           aria-haspopup="true"
           aria-expanded={openLocal}
         >
           <span style={{ textAlign: "left", flex: 1 }}>{render ? render(value as T) : options.find(o => o.key === value)?.label}</span>
           <span className="hrd-select-caret">▾</span>
         </button>

         {openLocal && (
           // when forceDown: render inline list (still scrollable), otherwise use fixed popover
           <>
            {forceDown ? (
              <div className="hrd-select-list hrd-select-list-scrollable" role="menu" onMouseDown={(e) => e.stopPropagation()}>
                {options.map(opt => (
                  <button
                    key={String(opt.key)}
                    type="button"
                    className="hrd-select-item"
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(opt.key); setOpenLocal(false); }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="hrd-select-list hrd-select-list-scrollable popover--fixed" role="menu" onMouseDown={(e) => e.stopPropagation()} style={listStyle}>
                {options.map(opt => (
                  <button
                    key={String(opt.key)}
                    type="button"
                    className="hrd-select-item"
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(opt.key); setOpenLocal(false); }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
           </>
         )}
       </div>
     );
   }

  function fmt(iso?: string) {
    if (!iso) return "Select date";
    try {
      const d = new Date(iso + "T00:00:00");
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch { return iso; }
  }

  return (
    <>
      <button type="button" ref={btnRef} className="date-picker-btn" onClick={(e) => { e.preventDefault(); if (justClosedRef.current) return; if (!open) document.dispatchEvent(new CustomEvent("hrd:close-popovers", { detail: { origin: btnRef.current } })); setOpen(s => !s); }}>
        <span>{fmt(selectedIso)}</span>
        <span className="date-picker-caret">▾</span>
      </button>

      {open && (
        <div className="dp-popover" style={pos} role="dialog" aria-modal="false" ref={popRef}>
          <div className="dp-card">
            <div className="dp-header" style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <SimpleDropdown
                value={viewMonth}
                options={months.map((m, i) => ({ key: i, label: m }))}
                render={(v) => months[Number(v)]}
                onSelect={(v: number) => setViewMonth(Number(v))}
                forceDown={true}
              />
              <SimpleDropdown
                value={viewYear}
                options={years.map((y) => ({ key: y, label: String(y) }))}
                onSelect={(v: number) => setViewYear(Number(v))}
                forceDown={true}
              />
            </div>

            <div className="dp-calendar">
              <div className="dp-weeklabels">
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(w => <div key={w} className="dp-weeklabel">{w}</div>)}
              </div>
              <div className="dp-days">
                {weeks.map((d, idx) => {
                  const inMonth = idx >= firstIdx && d !== null && d <= days;
                  // Gunakan format yang sama untuk konsistensi
                  const iso = inMonth && d ? (
                    `${String(viewYear).padStart(4, '0')}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                  ) : null;
                  const isSelected = iso === selectedIso;
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`dp-day ${inMonth ? "" : "dp-other"} ${isSelected ? "dp-selected" : ""}`}
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (inMonth) selectDay(d); 
                      }}
                    >
                      {inMonth && d ? d : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="dp-actions">
              <button
                type="button"
                className="btn neutral"
                onClick={(e) => {
                  e.stopPropagation();
                  // close and mark as just closed to avoid immediate re-open
                  setTemp(value ?? "");
                  setOpen(false);
                  justClosedRef.current = true;
                  setTimeout(() => { justClosedRef.current = false; }, 150);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // prefer temp (user-picked), fallback to incoming prop value
                  const chosen = (temp && temp.length > 0) ? temp : (value ?? undefined);
                  onChange(chosen || undefined);
                  // close and prevent immediate re-open race
                  setOpen(false);
                  justClosedRef.current = true;
                  setTimeout(() => { justClosedRef.current = false; }, 150);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

  return (
    <section className="hrd-section">
      <div className="hrd-header">
        {/* LEFT: carousel controls and filter button */}
        <div className="hrd-header-left">
          <div className="hrd-carousel-controls">
            <button
              className="hrd-carousel-btn"
              onClick={() => changeRole(currentRole > 0 ? currentRole - 1 : roles.length - 1)}
              aria-label="Previous role"
            >
              ←
            </button>
            <div className="hrd-carousel-indicator">
              <span className="hrd-role-name">{roles[currentRole]?.nama_jabatan ?? ""}</span>
              <div className="hrd-carousel-dots">
                {roles.map((_, idx) => (
                  <button
                    key={idx}
                    className={`hrd-carousel-dot${idx === currentRole ? ' active' : ''}`}
                    onClick={() => setCurrentRole(idx)}
                    aria-label={`Go to ${roles[idx]} section`}
                  />
                ))}
              </div>
            </div>
            <button
              className="hrd-carousel-btn"
              onClick={() => changeRole(currentRole < roles.length - 1 ? currentRole + 1 : 0)}
              aria-label="Next role"
            >
              →
            </button>
          </div>

          <button
            ref={filterBtnRef}
            type="button"
            className="hrd-filter-btn"
            onClick={() => setFilterOpen((s) => !s)}
            aria-haspopup="true"
            aria-expanded={filterOpen}
            title="Filter"
          >
            {getFilterLabel()}
          </button>

          {filterOpen && filterStyle && (
            <div className="hrd-popover popover--fixed" style={filterStyle}>
               <div className="hrd-popover-arrow" />
               <button className="hrd-menu-item" onClick={() => { setFilterValue("default"); setFilterOpen(false); }}>Default</button>
               <div className="hrd-popover-divider" />
               <button className="hrd-menu-item" onClick={() => { setFilterValue("name-asc"); setFilterOpen(false); }}>Nama A-Z</button>
               <button className="hrd-menu-item" onClick={() => { setFilterValue("name-desc"); setFilterOpen(false); }}>Nama Z-A</button>
               <div className="hrd-popover-divider" />
               <button className="hrd-menu-item" onClick={() => { setFilterValue("salary-desc"); setFilterOpen(false); }}>Gaji: High → Low</button>
               <button className="hrd-menu-item" onClick={() => { setFilterValue("salary-asc"); setFilterOpen(false); }}>Gaji: Low → High</button>
               <div className="hrd-popover-divider" />
               {kontrakList.map((k) => (
                 <button key={k.kd_kontrak} className="hrd-menu-item" onClick={() => { setFilterValue(`kontrak:${k.kd_kontrak}`); setFilterOpen(false); }}>
                   Kontrak: {k.masa_kontrak}
                 </button>
               ))}
             </div>
           )}
        </div>
        
        {/* RIGHT: actions */}
        <div className="hrd-header-right">
          <button className="btn primary" onClick={openCreate}>Tambah Karyawan</button>
          <button className="btn danger" disabled={selected.size === 0} onClick={handleBulkDelete}>Hapus Karyawan</button>
        </div>
      </div>

      <div className={`hrd-card-grid${isChanging ? " changing" : ""}`}>
        {displayedList.map((e) => (
          <div
            key={e.id}
            className={`hrd-card-employee animate-entrance${selected.has(e.id) ? " selected" : ""}`}
          >
            {/* replace native checkbox with SelectableCheckbox */}
            <SelectableCheckbox
              checked={selected.has(e.id)}
              onChange={() => { toggleSelect(e.id); }}
              ariaLabel={`Pilih ${e.fullName}`}
              className="hrd-select-checkbox"
            />

            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                overflow: "hidden",
                margin: "0 auto 16px auto",
                background: "#f3f4f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              {e.avatar ? (
                <img src={e.avatar} alt={e.fullName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "#d1d5db" }} />
              )}
            </div>

            <div style={{ textAlign: "center", marginBottom: 8, fontWeight: 600, fontSize: 18 }}>{e.fullName}</div>

            <div style={{ textAlign: "center", color: "#6b7280", fontSize: 15, marginBottom: 16 }}>
              {e.jabatan?.nama_jabatan || jabatanList.find((j) => j.kd_jabatan === e.kd_jabatan)?.nama_jabatan || "-"}
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
              <button
                className="btn neutral"
                style={{ padding: "6px 18px" }}
                onClick={(ev) => {
                  ev.stopPropagation();
                  setDetail(e);
                }}
              >
                Details
              </button>
            </div>

            <div
              style={{
                height: 16,
                background: "rgba(0,0,0,0.03)",
                marginTop: 16,
                borderRadius: 8
              }}
            />
          </div>
        ))}
      </div>

      {loading && <div className="hrd-loading">Loading…</div>}

      {/* Pop up detail karyawan */}
      {detail && (
        <div className="hrd-overlay" onClick={() => { setDetail(null); blurActive(); }}>
          <div className="hrd-modal" onClick={(e) => e.stopPropagation()}>
            <button className="hrd-modal-close" onClick={() => { setDetail(null); blurActive(); }} aria-label="Close">×</button>
            
            <div className="hrd-modal-avatar">
              {detail.avatar ? <img src={detail.avatar} alt={detail.fullName} className="hrd-avatar-img" /> : <div className="hrd-avatar-placeholder" />}
            </div>
            
            <div className="hrd-modal-name">{detail.fullName}</div>
            <div className="hrd-modal-position">{detail.jabatan?.nama_jabatan || jabatanList.find((j) => j.kd_jabatan === detail.kd_jabatan)?.nama_jabatan || "-"}</div>
            
            <div className="hrd-modal-row"><strong>Gaji:</strong> {detail.salary ? `Rp${Number(detail.salary).toLocaleString()}` : "-"}</div>
            <div className="hrd-modal-row"><strong>Masa Kontrak:</strong> {(() => { const kontrak = kontrakList.find((k) => k.kd_kontrak === detail.kd_kontrak); return kontrak ? kontrak.masa_kontrak : "-"; })()}</div>
            
            {/* paragraph gap */}
            <div style={{ height: 12 }} />
            
            {/* credential display: username from common fields, password only if backend provided (shown at creation) */}
            <div className="hrd-modal-row"><strong>Username:</strong> {(detail as any)?.username_karyawan ?? (detail as any)?.raw?.username_karyawan ?? "-"}</div>
            <div className="hrd-modal-row"><strong>Password:</strong> <span style={{ fontFamily: "monospace" }}>{(detail as any)?.generated_password ?? (detail as any)?.raw?.generated_password ?? "—"}</span></div>
            <div className="hrd-muted" style={{ marginTop: 6 }}>Password hanya tersedia jika dikembalikan oleh API saat pembuatan; jika kosong, lakukan reset password.</div>
            
            <div className="hrd-modal-actions">
              <button className="btn primary" onClick={() => openEdit(detail)}>Edit</button>
              <button className="btn danger" onClick={() => handleDeletePersonal(detail.id)}>Hapus</button>
            </div>
          </div>
        </div>
      )}

      {/* Pop up edit karyawan (tidak berubah) */}
      {edit && (
        <div className="hrd-overlay" onClick={closeEdit}>
          <form className="hrd-modal form-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleEditSubmit}>
            <button type="button" className="hrd-modal-close" onClick={closeEdit} aria-label="Close">×</button>
            
            <div className="hrd-modal-avatar">
              {editPreview ? <img src={editPreview} alt="Preview" className="hrd-avatar-img" /> : <div className="hrd-avatar-placeholder" />}
            </div>
            
            <label className="hrd-form-label">Foto:
              <button type="button" className="btn primary upload-btn" onClick={() => fileInputRef.current?.click()}>Pilih Foto</button>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(ev) => {
                const file = ev.target.files?.[0] || null;
                setEditPhoto(file);
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (e) => setEditPreview(e.target?.result as string);
                  reader.readAsDataURL(file);
                } else {
                  setEditPreview(edit?.avatar || null);
                }
              }} />
            </label>
            
            <label className="hrd-form-label">Nama:
              <input className="hrd-input" type="text" value={edit.fullName} onChange={(ev) => setEdit({ ...edit, fullName: ev.target.value })} required />
            </label>
            
            <label className="hrd-form-label">Jabatan:
              <HrdSelectPopover
                className="emp"
                options={jabatanList
                  .filter((j) => !(j.kd_jabatan === ownerKd && edit.kd_jabatan !== ownerKd))
                  .map((j) => ({ value: j.kd_jabatan!, label: j.nama_jabatan! }))}
                value={edit.kd_jabatan ?? null}
                onChange={(v) => {
                  // Jika sedang edit Owner, abaikan perubahan
                  if (edit.kd_jabatan === ownerKd) return;
                  if (Number(v) === ownerKd && edit.kd_jabatan !== ownerKd) return;
                  setEdit({ ...edit, kd_jabatan: Number(v) });
                }}
                placeholder="Pilih Jabatan"
                disabled={edit.kd_jabatan === ownerKd}
              />
              {edit.kd_jabatan === ownerKd && (
                <div className="hrd-muted" style={{ marginTop: 8 }}>
                  Owner role terkunci — tidak bisa diubah
                </div>
              )}
            </label>
            
            <label className="hrd-form-label">Gaji:
              <HrdSelectPopover
                className="emp"
                options={gajiList.map((g) => ({ value: g.kd_gaji!, label: `Rp${Number(g.jumlah_gaji).toLocaleString()}` }))}
                value={edit.kd_gaji ?? null}
                onChange={(v) => {
                  const kd = Number(v);
                  const g = gajiList.find(x => x.kd_gaji === kd);
                  setEdit({ ...edit, kd_gaji: kd, salary: g ? Number(g.jumlah_gaji) : edit.salary });
                }}
                placeholder="Pilih Golongan Gaji"
              />
            </label>
            
            <label className="hrd-form-label">Masa Kontrak:
              <HrdSelectPopover
                className="emp"
                options={kontrakList.map((k) => ({ value: k.kd_kontrak!, label: k.masa_kontrak! }))}
                value={edit.kd_kontrak ?? null}
                onChange={(v) => setEdit({ ...edit, kd_kontrak: Number(v), contract: kontrakList.find((k) => k.kd_kontrak === Number(v))?.masa_kontrak ?? "" })}
                placeholder="Pilih Masa Kontrak"
              />
            </label>
            
            <div className="hrd-modal-actions">
              <button 
                className="btn primary" 
                type="submit"
                disabled={submitLoading}
              >
                {submitLoading ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Employee modal (sama seperti edit) */}
      {createOpen && (
        <div className="hrd-overlay" onClick={closeCreate}>
          <form className="hrd-modal form-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleCreateSubmit}>
            <button type="button" className="hrd-modal-close" onClick={closeCreate} aria-label="Close">×</button>
            
            <div className="hrd-modal-avatar">
              {createPreview ? <img src={createPreview} alt="Preview" className="hrd-avatar-img" /> : <div className="hrd-avatar-placeholder" />}
            </div>
            
            <label className="hrd-form-label">Foto:
              <button type="button" className="btn primary upload-btn" onClick={() => createFileRef.current?.click()}>Pilih Foto</button>
              <input ref={createFileRef} name="file" type="file" accept="image/*" style={{ display: "none" }} onChange={(ev) => {
                const file = ev.target.files?.[0] || null;
                setCreatePhoto(file);
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (e) => setCreatePreview(e.target?.result as string);
                  reader.readAsDataURL(file);
                } else {
                  setCreatePreview(null);
                }
              }} />
            </label>
            
            <label className="hrd-form-label">Nama:
              <input name="fullName" className="hrd-input" type="text" required />
            </label>

            <label className="hrd-form-label">Tanggal Lahir:
              <input type="hidden" name="tgl_lahir" value={createDraft.tgl_lahir ?? ""} />
              <DatePickerPopup value={createDraft.tgl_lahir ?? ""} onChange={(v) => setCreateDraft((s) => ({ ...s, tgl_lahir: v ?? undefined }))} />
               <div className="hrd-muted" style={{ marginTop: 6 }}>Password default akan dibuat dari Tgl Lahir (DDMMYY)</div>
            </label>
            
            <label className="hrd-form-label">Jabatan:
              {/* Create form: use popover when creating */}
              <HrdSelectPopover
                className="emp"
                options={jabatanList.filter((j) => j.kd_jabatan !== ownerKd).map((j) => ({ value: j.kd_jabatan!, label: j.nama_jabatan! }))}
                value={createDraft.kd_jabatan ?? null}
                onChange={(v) => setCreateDraft((s) => ({ ...s, kd_jabatan: Number(v) }))}
                placeholder="Pilih Jabatan"
              />
             </label>
 
             <label className="hrd-form-label">Gaji:
              <HrdSelectPopover
                className="emp"
                options={gajiList.map((g) => ({ value: g.kd_gaji!, label: `Rp${Number(g.jumlah_gaji).toLocaleString()}` }))}
                value={createDraft.kd_gaji ?? null}
                onChange={(v) => {
                  const kd = Number(v);
                  const g = gajiList.find(x => x.kd_gaji === kd);
                  setCreateDraft((s) => ({ ...s, kd_gaji: kd, salary: g ? Number(g.jumlah_gaji) : undefined }));
                }}
                placeholder="Pilih Golongan Gaji"
              />
             </label>
 
             <label className="hrd-form-label">Masa Kontrak:
              <HrdSelectPopover
                className="emp"
                options={kontrakList.map((k) => ({ value: k.kd_kontrak!, label: k.masa_kontrak! }))}
                value={createDraft.kd_kontrak ?? null}
                onChange={(v) => setCreateDraft((s) => ({ ...s, kd_kontrak: Number(v) }))}
                placeholder="Pilih Masa Kontrak"
              />
             </label>
            
            <div className="hrd-modal-actions">
              <button 
                className="btn primary" 
                type="submit"
                disabled={submitLoading}
              >
                {submitLoading ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmation modal (elegant) */}
      {confirmOpen && (
        <div className="hrd-overlay" onClick={() => setConfirmOpen(false)}>
          <div className="hrd-modal" onClick={(e) => e.stopPropagation()} aria-modal="true" role="dialog">
            <button type="button" className="hrd-modal-close" onClick={() => setConfirmOpen(false)} aria-label="Close">×</button>
            <div style={{ textAlign: "center", padding: "8px 12px 0" }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Konfirmasi</div>
              <div style={{ color: "var(--muted-text)", marginBottom: 18 }}>{confirmMsg}</div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button className="btn neutral" onClick={() => setConfirmOpen(false)}>Batal</button>
                <button
                  className="btn danger"
                  onClick={async () => {
                    try {
                      if (confirmActionRef.current) {
                        await confirmActionRef.current();
                      }
                    } catch (err) {
                      // swallow — UI already shows loading state if needed
                      setConfirmOpen(false);
                    }
                  }}
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
   );
 }