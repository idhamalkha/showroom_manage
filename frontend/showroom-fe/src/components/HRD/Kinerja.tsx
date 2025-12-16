import { useEffect, useState, useMemo, useRef } from "react";
import { API_BASE } from "../../api/host";
import { fetchJabatan, fetchGaji, fetchKontrak } from "../../services/hrdService";
import "../../styles/kinerja.css";
import "../../styles/hrd-carousel.css";

// tambahkan tipe yang diperlukan
type EmployeeMinimal = {
  id: string | number;
  fullName: string;
  avatar?: string | null;
  sales_total?: number;
  bonus?: number;
  lembur_total?: number;
  cuti_days?: number;
  target_unit?: number;
  target_achieved?: number;
  transaksi_count?: number;
  jabatan?: any;
  role?: string;
  raw?: any;
};

export default function Kinerja({ compact = false }: { compact?: boolean }) {
  // carousel / role state
  const [roles, setRoles] = useState<{ kd_jabatan?: number; nama_jabatan?: string }[]>([]);
  const [currentRole, setCurrentRole] = useState(0);
  const [isChanging, setIsChanging] = useState(false);
  // filter state (default / lembur / cuti / transaksi)
  const [filterValue, setFilterValue] = useState<string>("default");
  // popover/filter state (reuse HRD popover behavior)
  const [filterOpen, setFilterOpen] = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement | null>(null);
  const [filterStyle, setFilterStyle] = useState<React.CSSProperties | undefined>(undefined);

  // compute fixed position for popover similar to HrdManagement
  const computeFixedPosition = (btn: HTMLElement | null, preferHeight = 260): React.CSSProperties | undefined => {
    if (!btn) return undefined;
    const rect = btn.getBoundingClientRect();
    const vh = window.innerHeight;
    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
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
      return {
        position: "fixed",
        bottom: `${vh - rect.top + 8}px`,
        left: `${left}px`,
        zIndex: 1400,
        transform: nearRightEdge ? "translateX(0)" : "translateX(-100%)",
      };
    }
  };

  const computeAndSet = (btn: HTMLButtonElement | null, setStyle: (s: React.CSSProperties | undefined) => void) => {
    const s = computeFixedPosition(btn, 320);
    setStyle(s);
  };

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
      case "lembur-desc": return "Lembur Terbanyak";
      case "cuti-desc": return "Cuti Terbanyak";
      case "transaksi-desc": return "Transaksi Bulan Ini";
      default: return "Default";
    }
  };
  
  // table state
  const [employees, setEmployees] = useState<EmployeeMinimal[]>([]);
  const [kontrakList, setKontrakList] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    async function loadMasters() {
      try {
        const [jab, , kontrak] = await Promise.all([
          fetchJabatan(),
          fetchGaji(),
          fetchKontrak(),
        ]);
        if (!mounted) return;
        // keep the same role ordering as HrdManagement: hrd -> finance -> sales
        const order = ["hrd", "finance", "sales"];
        const mapped = (jab || [])
          .filter((j:any)=> (j.nama_jabatan||"").toLowerCase()!="owner")
          .map((j:any)=>({kd_jabatan:j.kd_jabatan,nama_jabatan:j.nama_jabatan}));
        mapped.sort((a:any,b:any)=> {
          const an = (a.nama_jabatan||"").toString().toLowerCase();
          const bn = (b.nama_jabatan||"").toString().toLowerCase();
          const ai = order.indexOf(an);
          const bi = order.indexOf(bn);
          if (ai === -1 && bi === -1) return an.localeCompare(bn);
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        });
        setRoles(mapped);
        setKontrakList(kontrak || []);
      } catch (err) {
        console.error("Failed loading masters for kinerja", err);
      }
    }
    loadMasters();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (filterOpen) computeAndSet(filterBtnRef.current, setFilterStyle);
    else setFilterStyle(undefined);
  }, [filterOpen]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (filterOpen && filterBtnRef.current && !filterBtnRef.current.contains(target)) {
        const pop = document.querySelector('.hrd-popover');
        if (pop && !pop.contains(target)) setFilterOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setFilterOpen(false);
    }
    document.addEventListener('click', onDoc);
    window.addEventListener('keydown', onKey);
    const onGlobalClose = () => setFilterOpen(false);
    document.addEventListener('hrd:close-popovers' as any, onGlobalClose as EventListener);
    return () => {
      document.removeEventListener('click', onDoc);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('hrd:close-popovers' as any, onGlobalClose as EventListener);
    };
  }, [filterOpen]);

  // fetch employees for selected role
  useEffect(() => {
    let mounted = true;
    const kd = roles[currentRole]?.kd_jabatan;
    if (typeof kd === "undefined") return;
    // Use aggregated KPI endpoint which already computes bonus/lembur/cuti per employee
    fetch(`${API_BASE.replace(/\/$/, "")}/hrd/kinerja`)
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        const list = Array.isArray(data?.all) ? data.all : [];
        // filter by kd_jabatan returned by backend
        const filtered = list.filter((it: any) => {
          // backend uses kd_jabatan on each item
          return Number(it.kd_jabatan) === Number(kd);
        });
        const mapped = filtered.map(normalizeEmployee);
        // exclude owner just in case
        const nonOwner = mapped.filter((m: EmployeeMinimal) => {
          const name = ((m as any).jabatan?.nama_jabatan ?? (m as any).role ?? "").toString().toLowerCase();
          return name !== "owner";
        });
        setEmployees(nonOwner);
      })
      .catch((err) => {
        console.error("fetch kpi grid failed", err);
        if (mounted) setEmployees([]);
      });
    return () => { mounted = false; };
  }, [roles, currentRole]);
  
  // render all employees directly (no pagination)

  // resolve avatar: prefer full http(s) url, fallback to github_url / foto / avatar_url, make absolute if relative
  function resolveAvatar(src?: string | null) {
    if (!src) return "/avatar.png";
    const s = String(src);
    if (/^https?:\/\//.test(s)) return s;
    // backend may return relative path (e.g. /uploads/...), ensure absolute
    return `${API_BASE.replace(/\/$/, "")}/${s.replace(/^\//, "")}`;
  }

  // helper: get numeric value from several possible keys on row or raw payload
  function getNumericValue(row: any, keys: string[]) {
    if (!row) return 0;
    const probes = [row, row.raw, row.gaji ?? row.payroll ?? row.payroll_info ?? row];
    for (const probe of probes) {
      if (!probe) continue;
      for (const k of keys) {
        if (probe[k] !== undefined && probe[k] !== null && probe[k] !== "") {
          const raw = probe[k];
          // strip non-numeric except minus and dot/comma
          const s = String(raw).replace(/[^0-9,.-]/g, "").replace(/,/g, "");
          const n = Number(s);
          if (!isNaN(n)) return n;
        }
      }
    }
    return 0;
  }

  // format number using dot as thousand separator (e.g. 1.234.567)
  function formatMoney(v: number | string | null | undefined) {
    if (v === null || v === undefined || v === "") return "-";
    const n = Number(String(v).replace(/[^0-9.-]/g, ""));
    if (isNaN(n)) return "-";
    const sign = n < 0 ? "-" : "";
    const abs = Math.abs(Math.round(n));
    return sign + String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  // normalisasi item backend ke EmployeeMinimal (samakan dengan HrdManagement)
  function normalizeEmployee(e: any): EmployeeMinimal {
    // backend may return nama_jabatan either nested under `jabatan` or as top-level `nama_jabatan`
    const jabObj = e.jabatan ?? e.position ?? e.position_name ?? e.role ?? undefined;
    const topNama = e.nama_jabatan ?? e.nama_divisi ?? e.divisi ?? undefined;
    let namaJabatan: string | undefined;
    if (topNama) namaJabatan = String(topNama);
    else if (jabObj && typeof jabObj === "object") namaJabatan = (jabObj.nama_jabatan ?? jabObj.name ?? "").toString() || undefined;
    else if (typeof jabObj === "string") namaJabatan = jabObj;

    return {
      id: e.id ?? e.kd_karyawan ?? e.kd_karyawan,
      fullName: e.fullName ?? e.nama_karyawan ?? e.name ?? e.username ?? "—",
      avatar: e.avatar ?? e.foto ?? e.github_url ?? e.avatar_url ?? null,
      // salary and contract fields (normalize various backend shapes)
      salary: Number(e.jumlah_gaji ?? e.jumlahGaji ?? e.salary ?? (e.gaji && (e.gaji.jumlah_gaji ?? e.gaji.gaji_pokok)) ?? 0),
      contract: e.masa_kontrak ?? e.contract ?? undefined,
      sales_total: Number(e.sales_total ?? e.sales ?? 0),
      bonus: Number(e.bonus ?? e.jumlah_bonus ?? 0),
      lembur_total: Number(e.lembur_total ?? e.lembur ?? 0),
      cuti_days: Number(e.cuti_days ?? e.cuti ?? 0),
      target_unit: Number(e.target_unit ?? e.target ?? 0),
      target_achieved: Number(e.target_achieved ?? 0),
      // keep both shapes: nested `jabatan` and top-level `nama_jabatan` for robustness
      jabatan: namaJabatan ? { nama_jabatan: namaJabatan } : undefined,
      // also expose top-level so render can use r.nama_jabatan directly if present
      role: e.role ?? undefined,
      raw: e,
      // pass through top-level nama_jabatan if available
      ...(topNama ? { nama_jabatan: topNama } : {}),
    } as EmployeeMinimal;
  }

  // render
  const changeRole = (newRole: number) => {
    setIsChanging(true);
    setTimeout(() => {
      setCurrentRole(newRole);
      setTimeout(() => setIsChanging(false), 50);
    }, 150);
  };

  // derive displayed list from employees + filterValue
  const displayedEmployees = useMemo(() => {
    const arr = Array.isArray(employees) ? employees.slice() : [];
    // kontrak filter
    if (filterValue.startsWith("kontrak:")) {
      const id = filterValue.split(":")[1];
      return arr.filter((e: any) => String(e.raw?.kd_kontrak ?? e.kd_kontrak ?? e.raw?.kd_kontrak ?? "") === String(id));
    }

    switch (filterValue) {
      case "name-asc":
        return arr.sort((a: any, b: any) => (a.fullName ?? "").localeCompare(b.fullName ?? ""));
      case "name-desc":
        return arr.sort((a: any, b: any) => (b.fullName ?? "").localeCompare(a.fullName ?? ""));
      case "salary-desc":
        return arr.sort((a: any, b: any) => Number(b.salary ?? b.raw?.salary ?? 0) - Number(a.salary ?? a.raw?.salary ?? 0));
      case "salary-asc":
        return arr.sort((a: any, b: any) => Number(a.salary ?? a.raw?.salary ?? 0) - Number(b.salary ?? b.raw?.salary ?? 0));
      case "lembur-desc":
        return arr.sort((a: any, b: any) => Number(b.lembur_total ?? b.raw?.lembur_total ?? 0) - Number(a.lembur_total ?? a.raw?.lembur_total ?? 0));
      case "cuti-desc":
        return arr.sort((a: any, b: any) => Number(b.cuti_days ?? b.raw?.cuti_days ?? 0) - Number(a.cuti_days ?? a.raw?.cuti_days ?? 0));
      case "transaksi-desc":
        return arr.sort((a: any, b: any) => Number(b.transaksi_count ?? b.raw?.transaksi_count ?? 0) - Number(a.transaksi_count ?? a.raw?.transaksi_count ?? 0));
      default:
        return arr;
    }
  }, [employees, filterValue]);

  return (
    <section className={`kinerja-blabla kinerja-section ${compact ? "compact" : ""}`}>

      {/* Carousel controls + filter (filter sits to the right like HrdManagement) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div className="hrd-carousel-controls">
          <button className="hrd-carousel-btn" onClick={() => changeRole(currentRole > 0 ? currentRole - 1 : roles.length - 1)}>←</button>
          <div className="hrd-carousel-indicator">
            <div className="hrd-role-name">{roles[currentRole]?.nama_jabatan ?? "—"}</div>
            <div className="hrd-carousel-dots">
              {roles.map((_, i) => (
                <button key={i} className={`hrd-carousel-dot${i === currentRole ? ' active' : ''}`} onClick={() => changeRole(i)} aria-label={`Goto ${roles[i]?.nama_jabatan}`} />
              ))}
            </div>
          </div>
          <button className="hrd-carousel-btn" onClick={() => changeRole(currentRole < roles.length - 1 ? currentRole + 1 : 0)}>→</button>
        </div>

        {/* Filter button + popover (match HrdManagement) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
              <button className="hrd-menu-item" onClick={() => { setFilterValue("lembur-desc"); setFilterOpen(false); }}>Lembur Terbanyak</button>
              <button className="hrd-menu-item" onClick={() => { setFilterValue("cuti-desc"); setFilterOpen(false); }}>Cuti Terbanyak</button>
              <button className="hrd-menu-item" onClick={() => { setFilterValue("transaksi-desc"); setFilterOpen(false); }} disabled={!((roles[currentRole]?.nama_jabatan||"").toLowerCase().includes("sales"))}>Transaksi Bulan Ini</button>
              <div className="hrd-popover-divider" />
              {kontrakList.map((k) => (
                <button key={k.kd_kontrak} className="hrd-menu-item" onClick={() => { setFilterValue(`kontrak:${k.kd_kontrak}`); setFilterOpen(false); }}>
                  Kontrak: {k.masa_kontrak}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

    {/* Data table */}
  <div className={`kinerja-table-wrapper`}>
        <div className="kinerja-table-controls" style={{ padding: "0 6px" }}>
        </div>

  <div className={`kinerja-table ${((roles[currentRole]?.nama_jabatan||"").toLowerCase().includes("sales") ? 'has-bonus' : 'no-bonus')}${isChanging ? ' changing' : ''}`} role="table" aria-label="Kinerja table">
          <div className="kinerja-table-head">
            <div className="col col-name">Username / Name</div>
            <div className="col col-gaji" style={{ textAlign: 'right' }}>Gaji</div>
            {((roles[currentRole]?.nama_jabatan||"").toLowerCase().includes("sales")) ? (
              <>
                <div className="col col-bonus" style={{ textAlign: 'right' }}>Bonus</div>
                <div className="col col-transaksi" style={{ textAlign: 'center' }}>Transaksi Bulan Ini</div>
                <div className="col col-kontrak">Kontrak</div>
              </>
            ) : (
              <div className="col col-kontrak">Kontrak</div>
            )}
            <div className="col col-lembur" style={{ textAlign: 'right' }}>Lembur</div>
            <div className="col col-cuti" style={{ textAlign: 'center' }}>Cuti</div>
            <div className="col col-hadir" style={{ textAlign: 'center' }}>Hadir</div>
            <div className="col col-absen" style={{ textAlign: 'center' }}>Absen</div>
            <div className="col col-total" style={{ textAlign: 'right' }}>Total Gaji</div>
          </div>

          <div className="kinerja-table-body">
            {displayedEmployees.map((r, idx) => {
              const displayName = r.fullName || (r as any).raw?.nama_karyawan || (r as any).raw?.username || (r as any).raw?.name || "—";
              const salaryVal = getNumericValue(r, ['salary','jumlah_gaji','jumlahGaji','gaji','gaji_pokok']);
              const bonusVal = getNumericValue(r, ['bonus','jumlah_bonus','jumlahBonus','bonus_total','jumlah_bonus_total']);
              const lemburVal = getNumericValue(r, ['lembur_total','lembur','lembur_total_amount']);
              const cutiVal = getNumericValue(r, ['cuti_days','cuti','cuti_total']);
              const hadirCount = Number((r as any).hadir_count ?? (r as any).raw?.hadir_count ?? 0);
              const absenCount = Number((r as any).absen_count ?? (r as any).raw?.absen_count ?? 0);
              const potonganAbsen = getNumericValue(r, ['potongan_absen']);
              const kontrak = (r as any).contract ?? (r as any).raw?.masa_kontrak ?? "-";
              const transaksiCount = Number((r as any).transaksi_count ?? (r as any).raw?.transaksi_count ?? 0);
              const totalGajiVal = salaryVal + lemburVal + bonusVal - potonganAbsen;
              const formattedSalary = formatMoney(salaryVal);
              const formattedBonus = formatMoney(bonusVal);
              const formattedLembur = formatMoney(lemburVal);
              const formattedCuti = cutiVal ? String(cutiVal) : "-";
              const formattedTotal = formatMoney(totalGajiVal);

              return (
                <div key={idx} className="kinerja-table-row">
                  <div className="col col-name" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="row-avatar"><img src={resolveAvatar((r as any).github_url ?? r.avatar ?? (r as any).foto ?? (r as any).avatar_url)} alt={displayName} /></div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{displayName}</div>
                      <div style={{ fontSize: 12, color: "var(--muted-text)" }}>{(r as any)?.raw?.email ?? (r as any)?.raw?.username ?? ""}</div>
                    </div>
                  </div>
                  <div className="col col-gaji" style={{ textAlign: 'right' }}>{formattedSalary}</div>
                  {((roles[currentRole]?.nama_jabatan||"").toLowerCase().includes("sales")) ? (
                    <>
                      <div className="col col-bonus" style={{ textAlign: 'right' }}>{formattedBonus}</div>
                      <div className="col col-transaksi" style={{ textAlign: 'center' }}>{transaksiCount}</div>
                      <div className="col col-kontrak">{kontrak}</div>
                    </>
                  ) : (
                    <div className="col col-kontrak">{kontrak}</div>
                  )}
                  <div className="col col-lembur" style={{ textAlign: 'right' }}>{formattedLembur}</div>
                  <div className="col col-cuti" style={{ textAlign: 'center' }}>{formattedCuti}</div>
                  <div className="col col-hadir" style={{ textAlign: 'center' }}>{hadirCount}</div>
                  <div className="col col-absen" style={{ textAlign: 'center' }}>{absenCount}</div>
                  <div className="col col-total" style={{ textAlign: 'right', fontWeight: 700 }}>{formattedTotal}</div>
                </div>
              );
            })}
          </div>


        </div>
      </div>
    </section>
  );
}