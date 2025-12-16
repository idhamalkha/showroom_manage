/*
  Simple, presentational modal extracted from MobilManagement.
  Props are intentionally narrow to avoid circular imports.
*/
import React from "react";
import * as ReactDOM from 'react-dom';
import animateCloseTab from "../../ui/CloseTab";
import "./ModalViewMobil.controls.css";

type MerekLite = {
  kd_merek?: number;
  nama_merek: string;
  deskripsi?: string | null;
  logo_url?: string | null;
};

type MobilLite = {
  kd_mobil?: number;
  nama_mobil: string;
  kelas_mobil?: string;
  tahun_keluaran?: number | null;
  foto_url?: string | null;
  jenis_bahan_bakar?: string | null;
};

type Props = {
  brand: MerekLite;
  vehicles: MobilLite[];
  loading: boolean;
  kelasOptions?: { kd_kelas: number; nama: string; kode?: string; deskripsi?: string }[];
  onClose: () => void;
  onEditBrand: (b: MerekLite) => void;
  onDeleteBrand: (b: MerekLite) => void;
  onAddVehicle: () => void;
  onDeleteVehicles: (kds: number[], names?: string[]) => void;
  onEditVehicle: (v: MobilLite) => void;
};

export default function ModalViewMobil({
  brand,
  vehicles,
  loading,
  kelasOptions,
  onClose,
  onEditBrand,
  onDeleteBrand,
  onAddVehicle,
  onDeleteVehicles,
  onEditVehicle,
}: Props) {
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  // Search & Filter controls
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [filterType, setFilterType] = React.useState<"kelas" | "drivetrain" | "transmisi" | null>(null);
  // activeFilters: single selection per category (or null). key->value
  const [activeFilters, setActiveFilters] = React.useState<Record<string, string | null>>({ kelas: null, drivetrain: null, transmisi: null });
  const searchRef = React.useRef<HTMLDivElement | null>(null);
  const filterRef = React.useRef<HTMLDivElement | null>(null);
  const panelRootRef = React.useRef<HTMLDivElement | null>(null);
  const tabsRef = React.useRef<HTMLDivElement | null>(null);
  const dragState = React.useRef<{ down: boolean; startX: number; scrollLeft: number }>({ down: false, startX: 0, scrollLeft: 0 });
  const [filterPanelPos, setFilterPanelPos] = React.useState<{ top: number; left: number; width?: number; maxHeight?: number } | null>(null);
  const didAutoExpandRef = React.useRef(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const modalRef = React.useRef<HTMLDivElement | null>(null);
  const closingRef = React.useRef(false);
  const [closing, setClosing] = React.useState(false);

  // close modal on Escape
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // if a panel is open, close it first
        if (filterOpen) {
          setFilterOpen(false);
          setFilterType(null);
          try { const btn = filterRef.current?.querySelector('.mm-icon-btn') as HTMLElement | null; btn?.blur(); btn?.classList.remove('mm-open'); } catch {}
          e.stopPropagation();
          return;
        }
        if (searchOpen) {
          setSearchOpen(false);
          try { const btn = searchRef.current?.querySelector('.mm-icon-btn') as HTMLElement | null; btn?.blur(); btn?.classList.remove('mm-open'); } catch {}
          e.stopPropagation();
          return;
        }
      }
      if (e.key !== "Escape") return;
      // Determine top-most overlay by comparing computed z-index and visibility.
      // If another overlay has higher z-index and is visible, let that overlay handle Escape.
      try {
        const nodes = Array.from(document.querySelectorAll('.avm-overlay, .avm-modal, .mobil-overlay, .mobil-modal')) as HTMLElement[];
        let topEl: HTMLElement | null = null;
        let topZ = -Infinity;
        for (const n of nodes) {
          if (!n) continue;
          // skip our own root and its descendants from consideration
          if (rootRef.current && (rootRef.current === n || rootRef.current.contains(n))) continue;
          const style = window.getComputedStyle(n);
          if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0) continue;
          const rect = n.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          const z = (() => {
            const zVal = style.zIndex;
            if (!zVal || zVal === 'auto') return 0;
            const parsed = parseInt(zVal as string, 10);
            return Number.isFinite(parsed) ? parsed : 0;
          })();
          if (z > topZ) {
            topZ = z;
            topEl = n;
          }
        }
        // if there's a different top-most element (not us) then don't close here
        if (topEl) {
          return;
        }
      } catch (err) {
        // ignore DOM access errors and fallback to original behavior
      }

      // Prevent other global handlers from also reacting to this Escape
      try {
        e.preventDefault();
        e.stopPropagation();
        // stopImmediatePropagation may not exist on KeyboardEvent in TS defs
        try { (e as any).stopImmediatePropagation?.(); } catch {}
      } catch {}

      // simulate click on the close button so we reuse the exact same logic
      const closeBtn = modalRef.current?.querySelector('.mobil-modal-close') as HTMLButtonElement | null;
      if (closeBtn && !closeBtn.disabled) {
        // use DOM click so React's synthetic handler runs; this handler prevents propagation
        closeBtn.click();
      }
    }

    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose, filterOpen, searchOpen]);

  // close panels on outside click
  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const tgt = e.target as Node | null;
      if (searchRef.current && !searchRef.current.contains(tgt)) {
        setSearchOpen(false);
        try { const btn = searchRef.current.querySelector('.mm-icon-btn') as HTMLElement | null; btn?.blur(); } catch {}
      }
      // if the click is outside both the filter button container and the portal root (if present) close the panel
      if (filterRef.current && !filterRef.current.contains(tgt) && (!panelRootRef.current || !panelRootRef.current.contains(tgt))) {
        setFilterOpen(false);
        setFilterType(null);
        try { const btn = filterRef.current.querySelector('.mm-icon-btn') as HTMLElement | null; btn?.blur(); } catch {}
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // create a detached DOM node to host the portal for the filter panel (ensures fixed positioning isn't affected by transforms)
  React.useEffect(() => {
    const node = document.createElement('div');
    node.setAttribute('data-mm-filter-portal', '1');
    document.body.appendChild(node);
    panelRootRef.current = node;
    return () => {
      try { panelRootRef.current && panelRootRef.current.remove(); } catch {}
      panelRootRef.current = null;
    };
  }, []);

  function toggleSelect(kd?: number) {
    if (!kd && kd !== 0) return;
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(kd)) s.delete(kd);
      else s.add(kd);
      return s;
    });
  }

  // Helpers to set open/closed state and sync a CSS class on the toggle buttons
  function setSearchOpenState(val: boolean) {
    setSearchOpen(val);
    try {
      const btn = searchRef.current?.querySelector('.mm-icon-btn') as HTMLElement | null;
      if (!btn) return;
      if (val) btn.classList.add('mm-open');
      else { btn.classList.remove('mm-open'); btn.blur(); }
    } catch {}
  }

  function setFilterOpenState(val: boolean) {
    setFilterOpen(val);
    try {
      const btn = filterRef.current?.querySelector('.mm-icon-btn') as HTMLElement | null;
      if (!btn) return;
      if (val) btn.classList.add('mm-open');
      else { btn.classList.remove('mm-open'); btn.blur(); }
    } catch {}
  }

  // derive available filter items from vehicles
  const filterOptions = React.useMemo(() => {
    const kelasFromVehicles = new Set<string>();
    const drivetrain = new Set<string>();
    const transmisi = new Set<string>();
    for (const v of vehicles) {
      if (v.kelas_mobil) kelasFromVehicles.add(String(v.kelas_mobil));
      const d = (v as any).drivetrain;
      if (d) drivetrain.add(String(d));
      const t = (v as any).transmisi;
      if (t) transmisi.add(String(t));
    }
    // canonical options
    ['FWD','RWD','4WD','AWD'].forEach(x => drivetrain.add(x));
    ['Automatic','Manual','DCT','CVT'].forEach(x => transmisi.add(x));
    // kelas list prefers canonical kelasOptions if available (from DB)
    const kelas = (kelasOptions && kelasOptions.length > 0) ? kelasOptions.map(k => k.nama) : Array.from(kelasFromVehicles);
    return { kelas: Array.from(new Set(kelas)).sort(), drivetrain: Array.from(drivetrain).sort(), transmisi: Array.from(transmisi).sort() };
  }, [vehicles, kelasOptions]);

  // apply search and filters to vehicles
  const displayedVehicles = React.useMemo(() => {
    let list = Array.isArray(vehicles) ? vehicles.slice() : [];
    const q = (searchQuery || "").trim().toLowerCase();
    if (q) {
      list = list.filter((v) => (v.nama_mobil || "").toLowerCase().includes(q));
    }
    // apply activeFilters: each category (if set) must match (AND across categories)
    for (const key of Object.keys(activeFilters)) {
      const sel = activeFilters[key];
      if (!sel) continue;
      // special-case: 'kelas' maps to kelas_mobil property on vehicle
      if (key === 'kelas') {
        list = list.filter((v) => String(v.kelas_mobil ?? '') === sel);
      } else {
        list = list.filter((v) => {
          const val = String((v as any)[key] ?? "");
          return val === sel;
        });
      }
    }
    return list;
  }, [vehicles, searchQuery, activeFilters]);

  // mapping helpers for nicer labels
  function mapDrivetrainLabel(x?: string | null) {
    if (!x) return x ?? '';
    const m: Record<string, string> = { FWD: 'Front Wheel Drive', RWD: 'Rear Wheel Drive', '4WD': '4-Wheel Drive', AWD: 'All Wheel Drive' };
    return m[x] ?? x;
  }
  function mapTransmisiLabel(x?: string | null) {
    if (!x) return x ?? '';
    const m: Record<string, string> = { Automatic: 'Automatic', Manual: 'Manual', DCT: 'DCT', CVT: 'CVT' };
    return m[x] ?? x;
  }

  function capitalize(s?: string | null) {
    if (!s) return '';
    const st = String(s);
    return st.charAt(0).toUpperCase() + st.slice(1);
  }

  function toggleFilterPanel() {
    const willOpen = !filterOpen;
    if (!willOpen) {
      setFilterOpenState(false);
      setFilterType(null);
      didAutoExpandRef.current = false;
      setFilterPanelPos(null);
      return;
    }
    // compute position relative to the button (use helper below)
    computeAndSetFilterPanelPos();
    setFilterOpenState(true);
    didAutoExpandRef.current = false;
    // focus first item after open via small timeout
    setTimeout(() => {
      try { const container = document.querySelector('.mm-filter-panel-fixed .mm-filter-items'); const first = container?.querySelector('.mm-filter-item') as HTMLElement | null; first?.focus(); } catch {}
    }, 50);
  }

  // helper to compute panel position and set state
  function computeAndSetFilterPanelPos() {
    try {
      const btn = filterRef.current?.querySelector('.mm-icon-btn') as HTMLElement | null;
      const rect = btn?.getBoundingClientRect();
      if (rect) {
        let left = Math.max(8, rect.left);
        const top = rect.bottom + 8; // 8px gap
        const width = 240;
        const maxHeight = Math.max(120, window.innerHeight - top - 20);
        // ensure panel doesn't overflow right edge
        const viewportRight = window.innerWidth - 12;
        if (left + width > viewportRight) {
          left = Math.max(8, viewportRight - width);
        }
        setFilterPanelPos({ left, top, width, maxHeight });
      } else {
        setFilterPanelPos(null);
      }
    } catch {
      setFilterPanelPos(null);
    }
  }

  // when panel is open, keep it positioned relative to the button.
  React.useEffect(() => {
    if (!filterOpen) return;
    // compute immediately
    computeAndSetFilterPanelPos();
    // handlers
    const onWin = () => computeAndSetFilterPanelPos();
    window.addEventListener('resize', onWin);
    // use capture to catch scrolls anywhere
    window.addEventListener('scroll', onWin, true);
    // pointermove handler for drag-to-scroll on tabs
    function onPointerMove(e: PointerEvent) {
      try {
        const t = tabsRef.current;
        if (!t || !dragState.current.down) return;
        const dx = e.clientX - dragState.current.startX;
        t.scrollLeft = Math.max(0, dragState.current.scrollLeft - dx);
      } catch {}
    }
    // named pointerup handler so we can remove it correctly
    function onPointerUpGlobal() {
      try { dragState.current.down = false; if (tabsRef.current) tabsRef.current.classList.remove('is-dragging'); document.body.style.userSelect = ''; } catch {}
    }
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUpGlobal);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUpGlobal);
    };
  }, [filterOpen]);

  // also recompute when activeFilters changes (so panel follows button when selection changes)
  React.useEffect(() => {
    if (filterOpen) computeAndSetFilterPanelPos();
  }, [activeFilters]);

  // after panel renders or filterType changes, measure its content and expand width if necessary
  React.useEffect(() => {
    if (!filterOpen || !panelRootRef.current) return;
    // small timeout to let DOM render
    const id = window.setTimeout(() => {
      try {
        const panel = panelRootRef.current!.querySelector('.mm-filter-panel') as HTMLElement | null;
        if (!panel) return;
        const rect = panel.getBoundingClientRect();
        // measure content width
        const content = panel.querySelector('.mm-filter-types') as HTMLElement | null;
        const desired = Math.max(rect.width, content ? content.scrollWidth + 48 : rect.width);
        const maxAllowed = Math.max(240, Math.min(window.innerWidth - 24, 420));
        const final = Math.min(desired, maxAllowed);
        // Only auto-expand once while the panel is open to avoid width jumps when user
        // switches tabs rapidly. Use didAutoExpandRef to track whether we've already
        // expanded during this open session.
        if (!didAutoExpandRef.current && final > (filterPanelPos?.width ?? 0)) {
          didAutoExpandRef.current = true;
          setFilterPanelPos((p) => {
            if (!p) return p;
            // recompute left to ensure new width doesn't overflow
            const viewportRight = window.innerWidth - 12;
            let left = p.left ?? Math.max(8, rect.left || 8);
            if (left + final > viewportRight) left = Math.max(8, viewportRight - final);
            return { ...p, width: final, left };
          });
        }
        // ensure the active tab (e.g. Transmisi) is visible inside the horizontal scroller
        try {
          const active = panel.querySelector('.mm-filter-types .mm-filter-type.active') as HTMLElement | null;
          if (active) {
            // scroll the horizontal tab container so active tab is centered
            const tabs = panel.querySelector('.mm-filter-types') as HTMLElement | null;
            if (tabs && typeof active.scrollIntoView === 'function') {
              // use inline: 'center' if supported
              try { active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); } catch { active.scrollIntoView(false); }
            }
          }
        } catch {}
      } catch {}
    }, 40);
    return () => window.clearTimeout(id);
  }, [filterOpen, filterType, activeFilters]);

  function handleBulkDelete() {
    const arr = Array.from(selected.values());
    if (arr.length === 0) return;
    // collect names for selected ids so parent can show them in confirmation
    const names: string[] = (Array.isArray(vehicles) ? vehicles : [])
      .filter((v) => arr.includes(v.kd_mobil ?? -1))
      .map((v) => v.nama_mobil);
    onDeleteVehicles(arr, names);
  }
  function resolveImage(src?: string | null, fallback?: string | null) {
    if (!src) return fallback ?? undefined;
    const s = String(src).trim();
    // allow absolute http(s) urls and protocol-relative
    if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("//")) return s;
    // some uploads return github_url under a different key but we already map to foto_url;
    // if src is a data URI (placeholder svg) prefer fallback if available
    if (s.startsWith("data:image/")) return fallback ?? s;
    // otherwise return as-is (could be relative path)
    return s;
  }

  return (
    <div className="mobil-overlay" ref={rootRef}>
      <div className="mobil-view-modal" ref={modalRef}>
        <button
          className="mobil-modal-close"
          disabled={closing}
          onClick={async (evt) => {
            // prevent duplicate triggers
            if (closingRef.current) return;
            closingRef.current = true;
            setClosing(true);
            // stop propagation so global handlers don't also run
            try { evt.preventDefault(); (evt as React.MouseEvent).stopPropagation(); } catch {}
            try {
              if (modalRef.current) await animateCloseTab(modalRef.current, { beep: false });
            } catch {}
            onClose();
            closingRef.current = false;
            setClosing(false);
          }}
        >
          ✕
        </button>

        <div className="mobil-view-topbar">
          <div className="mobil-view-topbar-left">
            <div className="mobil-brand-mini">
              {brand.logo_url ? (
                <img src={brand.logo_url} alt={brand.nama_merek} className="mobil-view-logo" />
              ) : (
                <div className="mobil-logo-placeholder mini">{(brand.nama_merek || "").charAt(0).toUpperCase()}</div>
              )}
            </div>

            <div style={{ marginLeft: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontWeight: 700 }}>{brand.nama_merek}</div>

              <div className="mobil-top-left-actions">
                <button
                  className="icon-btn"
                  title="Edit merek"
                  onClick={() => onEditBrand(brand)}
                >
                  ✏️
                </button>
                <button
                  className="icon-btn"
                  title="Hapus merek"
                  onClick={() => onDeleteBrand(brand)}
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>

          <div className="mobil-view-topbar-right">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
              <div className="mm-controls">
                <div className="mm-search" ref={searchRef} onKeyDown={(e) => { if (e.key === 'Escape' && searchOpen) { e.stopPropagation(); e.preventDefault(); setSearchOpenState(false); } }}>
                  <button className="mm-icon-btn" title="Search" onClick={() => setSearchOpenState(!searchOpen)}>
                    <svg className="mm-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zM10 14a4 4 0 110-8 4 4 0 010 8z"/></svg>
                  </button>
                  {searchOpen && (
                    <div className="mm-search-input" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setSearchOpen(false); } }}>
                      <input
                        autoFocus
                        placeholder="Cari nama mobil..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      <button className="mm-icon-btn" onClick={(ev) => { ev.stopPropagation(); setSearchQuery(''); setSearchOpenState(false); }} title="Close search">✕</button>
                    </div>
                  )}
                </div>

                <div className="mm-filter" ref={filterRef}>
                  <button className="mm-icon-btn" title="Filter" onClick={() => { toggleFilterPanel(); const btn = filterRef.current?.querySelector('.mm-icon-btn') as HTMLElement | null; if (btn) { if (!filterOpen) btn.classList.add('mm-open'); else btn.classList.remove('mm-open'); } }}>
                    <svg className="mm-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M10 18h4v-2h-4v2zm-7-9v2h18V9H3zm3-6v2h12V3H6z"/></svg>
                    {(() => {
                      const cnt = Object.values(activeFilters).filter(Boolean).length;
                      return cnt > 0 ? <span className="mm-filter-badge">{cnt}</span> : null;
                    })()}
                  </button>
                  {filterOpen && panelRootRef.current && ReactDOM.createPortal(
                    <div className={"mm-filter-panel mm-filter-panel-fixed"} tabIndex={-1} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); setFilterOpenState(false); } }} style={{ left: filterPanelPos ? `${filterPanelPos.left}px` : undefined, top: filterPanelPos ? `${filterPanelPos.top}px` : undefined, width: filterPanelPos?.width ? `${filterPanelPos.width}px` : undefined, maxHeight: filterPanelPos?.maxHeight ? `${filterPanelPos.maxHeight}px` : undefined }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="mm-filter-types" ref={tabsRef}
                          onPointerDown={(e) => {
                            try {
                              const el = tabsRef.current;
                              if (!el) return;
                              dragState.current.down = true;
                              dragState.current.startX = e.clientX;
                              dragState.current.scrollLeft = el.scrollLeft;
                              el.classList.add('is-dragging');
                              // prevent text selection while dragging
                              document.body.style.userSelect = 'none';
                            } catch {}
                          }}
                          onPointerUp={() => {
                            try { dragState.current.down = false; tabsRef.current?.classList.remove('is-dragging'); document.body.style.userSelect = ''; } catch {}
                          }}
                          onPointerCancel={() => {
                            try { dragState.current.down = false; tabsRef.current?.classList.remove('is-dragging'); document.body.style.userSelect = ''; } catch {}
                          }}
                        >
                          <div className={`mm-filter-type ${filterType === 'kelas' ? 'active' : ''}`} onClick={() => { setFilterType('kelas'); setFilterOpen(true); }}>
                            <span>Kelas</span>
                            {activeFilters.kelas ? <button className="mm-filter-type-val" onClick={(e) => { e.stopPropagation(); setFilterType('kelas'); setFilterOpen(true); }}>{activeFilters.kelas}</button> : null}
                          </div>
                          <div className={`mm-filter-type ${filterType === 'drivetrain' ? 'active' : ''}`} onClick={() => { setFilterType('drivetrain'); setFilterOpen(true); }}>
                            <span>Drivetrain</span>
                            {activeFilters.drivetrain ? <button className="mm-filter-type-val" onClick={(e) => { e.stopPropagation(); setFilterType('drivetrain'); setFilterOpen(true); }}>{mapDrivetrainLabel(activeFilters.drivetrain ?? undefined)}</button> : null}
                          </div>
                          <div className={`mm-filter-type ${filterType === 'transmisi' ? 'active' : ''}`} onClick={() => { setFilterType('transmisi'); setFilterOpen(true); }}>
                            <span>Transmisi</span>
                            {activeFilters.transmisi ? <button className="mm-filter-type-val" onClick={(e) => { e.stopPropagation(); setFilterType('transmisi'); setFilterOpen(true); }}>{mapTransmisiLabel(activeFilters.transmisi ?? undefined)}</button> : null}
                          </div>
                        </div>
                        <div style={{ width: 1 }} />
                      </div>
                      <div className="mm-filter-items" style={{ maxHeight: filterPanelPos?.maxHeight ? `${filterPanelPos.maxHeight}px` : undefined }}>
                        {filterType === 'kelas' && filterOptions.kelas.map((it) => (
                          <div key={it} className="mm-filter-item" tabIndex={0} onClick={() => setActiveFilters({...activeFilters, kelas: activeFilters.kelas === it ? null : it})} onKeyDown={(e) => { if (e.key === 'Enter') setActiveFilters({...activeFilters, kelas: activeFilters.kelas === it ? null : it}); if (e.key === 'ArrowDown') { const next = (e.currentTarget.nextElementSibling as HTMLElement | null); next?.focus(); } if (e.key === 'ArrowUp') { const prev = (e.currentTarget.previousElementSibling as HTMLElement | null); prev?.focus(); } } }>
                            <input type="radio" readOnly checked={activeFilters.kelas === it} />
                            <span>{it}</span>
                          </div>
                        ))}
                        {filterType === 'drivetrain' && filterOptions.drivetrain.map((it) => (
                          <div key={it} className="mm-filter-item" tabIndex={0} onClick={() => setActiveFilters({...activeFilters, drivetrain: activeFilters.drivetrain === it ? null : it})} onKeyDown={(e) => { if (e.key === 'Enter') setActiveFilters({...activeFilters, drivetrain: activeFilters.drivetrain === it ? null : it}); if (e.key === 'ArrowDown') { const next = (e.currentTarget.nextElementSibling as HTMLElement | null); next?.focus(); } if (e.key === 'ArrowUp') { const prev = (e.currentTarget.previousElementSibling as HTMLElement | null); prev?.focus(); } }}>
                            <input type="radio" readOnly checked={activeFilters.drivetrain === it} />
                            <span>{mapDrivetrainLabel(it)}</span>
                          </div>
                        ))}
                        {filterType === 'transmisi' && filterOptions.transmisi.map((it) => (
                          <div key={it} className="mm-filter-item" tabIndex={0} onClick={() => setActiveFilters({...activeFilters, transmisi: activeFilters.transmisi === it ? null : it})} onKeyDown={(e) => { if (e.key === 'Enter') setActiveFilters({...activeFilters, transmisi: activeFilters.transmisi === it ? null : it}); if (e.key === 'ArrowDown') { const next = (e.currentTarget.nextElementSibling as HTMLElement | null); next?.focus(); } if (e.key === 'ArrowUp') { const prev = (e.currentTarget.previousElementSibling as HTMLElement | null); prev?.focus(); } }}>
                            <input type="radio" readOnly checked={activeFilters.transmisi === it} />
                            <span>{mapTransmisiLabel(it)}</span>
                          </div>
                        ))}
                        {!filterType && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Pilih kategori filter di atas</div>}
                      </div>
                    </div>, panelRootRef.current
                  )}
                </div>
                <button className="mm-filter-clear" title="Clear filters" aria-label="Clear filters" onClick={() => { setActiveFilters({ kelas: null, drivetrain: null, transmisi: null }); setFilterOpenState(false); setFilterType(null); }}>
                  <svg className="mm-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M2 21c0 .6.4 1 1 1 .2 0 .3 0 .5-.1l6.6-2.2-6.6-6.6L2 21zm19-14c0-.6-.4-1-1-1-.2 0-.3 0-.5.1l-2.8.9 1.6 1.6 2.8-.9c.6-.2.8-.6.8-1.6zM7.1 8.9l8 8 2.8-2.8-8-8-2.8 2.8z"/></svg>
                </button>
              </div>
            </div>
            <button className="btn primary" onClick={onAddVehicle}>
              Tambah Mobil
            </button>

            <button className="btn danger" onClick={handleBulkDelete}>
              Hapus Mobil
            </button>
          </div>
        </div>

        {/* body: full width for vehicle list (large logo removed) */}
        <div className="mobil-view-body" style={{ paddingTop: 12 }}>
          <div className="mobil-view-right full">
            <h4 style={{ marginTop: 0 }}>Kendaraan</h4>

            {loading ? (
              <div style={{ color: "var(--muted)" }}>Memuat kendaraan...</div>
            ) : vehicles.length === 0 ? (
              <div style={{ color: "var(--muted)" }}>Belum ada kendaraan untuk merek ini.</div>
            ) : displayedVehicles.length === 0 ? (
              <div style={{ color: "var(--muted)" }}>Mobil tidak ditemukan.</div>
            ) : (
              <div className="mobil-view-cars">
                {displayedVehicles.map((v) => {
                  const isSelected = selected.has(v.kd_mobil ?? -1);
                  return (
                    <div
                      className={`car-card${isSelected ? " selected" : ""}`}
                      key={v.kd_mobil}
                      onClick={() => toggleSelect(v.kd_mobil)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          toggleSelect(v.kd_mobil);
                        }
                      }}
                      style={isSelected ? { border: "2px solid var(--accent)", boxShadow: "0 6px 18px rgba(2,6,23,0.06)" } : undefined}
                      data-brand-name={brand.nama_merek}
                      data-card-name={v.nama_mobil}
                      data-filterable-card
                    >
                      <div
                        className="car-thumb-wrap"
                        style={{ cursor: "pointer" }}
                        onClick={(e) => {
                          // clicking the image should open edit — prevent the parent toggle
                          e.stopPropagation();
                          onEditVehicle(v);
                        }}
                        title="Klik untuk edit mobil"
                      >
                        {resolveImage(v.foto_url, brand.logo_url) ? (
                          <img src={resolveImage(v.foto_url, brand.logo_url)} className="car-thumb" alt={v.nama_mobil} />
                        ) : (
                          <div style={{ padding: 8, color: "var(--muted)" }}>No image</div>
                        )}
                      </div>

                      <div className="car-meta">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <div className="car-name">{v.nama_mobil}</div>
                        </div>

                        <div className="car-sub">{v.kelas_mobil ?? ""} • {v.tahun_keluaran ?? ""}</div>
                        {/* tags (mirror PreviewCard): status, drivetrain, transmisi, jenis bahan bakar */}
                        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {([
                                capitalize((v as any).jenis_bahan_bakar),
                                capitalize((v as any).status),
                                mapDrivetrainLabel((v as any).drivetrain),
                                mapTransmisiLabel((v as any).transmisi),
                              ] as Array<string | undefined>)
                              .filter(Boolean)
                              .map((t, i) => {
                                const text = String(t ?? '');
                                const lower = text.toLowerCase();
                                const isFuel = lower === 'gasoline' || lower === 'diesel' || lower === 'electrified';
                                return (
                                  <span key={i} className={`car-select-tag${isSelected ? ' active' : ''}${isFuel ? ' fuel' : ''}`} style={{ fontSize: 12 }}>
                                    {text}
                                  </span>
                                );
                              })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* bottom action removed: modal can be closed via top-right button */}
      </div>
    </div>
  );
}