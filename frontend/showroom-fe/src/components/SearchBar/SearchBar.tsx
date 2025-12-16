import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FiSearch, FiBell } from "react-icons/fi";
import { IoMdMenu } from "react-icons/io";
// theme icons removed — theme toggle is now a keyboard command (Ctrl/Cmd+Shift+T)
import { useAuth } from '../../providers/AuthProvider';
import { useContentSearch } from "../../hooks/useContentSearch";
import { useCardFilter, getVisibleCardCount } from "../../hooks/useCardFilter";
import { useNotifications } from "../../hooks/useNotifications";
import type { Notification } from "../../hooks/useNotifications";
import NotificationDetailModal from "../NotificationDetailModal/NotificationDetailModal";
import "./SearchBar.css";
import "../../styles/SearchResults.css";
import HrdDetailModal from "../HRD/HrdDetailModal";
import HadirModal from "../HRModals/HadiRModal";
import CutiModal from "../HRModals/CutiModal";
import LemburModal from "../HRModals/LemburModal";
import { API_BASE } from "../../api/host";
import type { Employee } from "../HRD/HrdManagement";
import type { SearchResult } from "../../hooks/useContentSearch";

type Pos = { top: number; left: number; alignRight: boolean };

export default function SearchBar({ 
  onProfileClick 
}: { 
  onProfileClick: (detail: any) => void 
}) {
  // include `user` (authUser) so upload can use canonical id and /auth/me data
  const { logout: authLogout, user: authUser } = useAuth();
  const { searchContent, scrollToResult } = useContentSearch();
  const { filterQuery, setFilterQuery, clearFilter } = useCardFilter();

  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [profileDetail, setProfileDetail] = useState<Employee | null>(null);
  const [q, setQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [hadirModalOpen, setHadirModalOpen] = useState(false);
  const [cutiModalOpen, setCutiModalOpen] = useState(false);
  const [lemburModalOpen, setLemburModalOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const searchResultsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // upload handler used by HrdDetailModal when user picks a photo
  const handleProfilePhotoSelect = async (file: File) => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: fd });
      const uploadJson = await uploadRes.json();
      const avatarUrl = uploadJson?.github_url ?? uploadJson?.url ?? null;
      if (!avatarUrl) return;

      // optimistic UI update
      const updated = { ...(profileDetail ?? {}), avatar: avatarUrl, avatar_url: avatarUrl } as Employee;
      setProfileDetail(updated);
      try { localStorage.setItem("user", JSON.stringify(updated)); } catch {}

      // persist on backend: PUT /hrd/karyawan/{id}
      const id = (authUser as any)?.id ?? (profileDetail as any)?.id ?? (profileDetail as any)?.kd_karyawan;
      if (id) {
        const token = localStorage.getItem("authToken") ?? "";
        await fetch(`${API_BASE}/hrd/karyawan/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ foto: avatarUrl }),
        });
      }

      // refresh canonical /auth/me and update localStorage + state
      try {
        const meRes = await fetch(`${API_BASE}/auth/me`, { headers: { ...(localStorage.getItem("authToken") ? { Authorization: `Bearer ${localStorage.getItem("authToken")}` } : {}) } });
        if (meRes.ok) {
          const me = await meRes.json();
          const normalized = { ...me, avatar: me.avatar_url ?? me.avatar };
          setProfileDetail(normalized as Employee);
          try { localStorage.setItem("user", JSON.stringify(normalized)); } catch {}
        }
      } catch (e) { /* ignore refresh errors */ }
    } catch {
      // ignore upload errors for now
    }
  };

  // Theme: moved here from Sidebar
  // Force light theme only
  const getInitialTheme = (): 'light' => 'light';

  const [theme, setTheme] = useState<'light'>(getInitialTheme);

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
      document.body.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);

      document.body.classList.add('theme-transition');
      const t = window.setTimeout(() => document.body.classList.remove('theme-transition'), 360);
      return () => clearTimeout(t);
    } catch {
      // ignore
    }
  }, [theme]);

  // Disable runtime theme toggle; app is light-only
  const handleThemeToggle = () => { /* no-op: dark mode disabled */ };

  // Logout (moved here)
  const handleLogout = () => {
    try {
      if (typeof authLogout === "function") authLogout();
    } catch {}
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  const openLogoutConfirm = () => setConfirmOpen(true);
  const closeLogoutConfirm = () => setConfirmOpen(false);

  // keyboard: close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirmOpen(false);
    }
    if (confirmOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmOpen]);

  // initialize profile from localStorage (fallback)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) setProfileDetail(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const notifBtnRef = useRef<HTMLButtonElement | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const [notifStyle, setNotifStyle] = useState<React.CSSProperties | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);

  // Use notifications hook with authUser's kd_karyawan
  const kd_karyawan = authUser?.kd_karyawan || authUser?.id;
  const { unreadCount, notifications: realNotifications, markAsRead, markAllAsRead, deleteNotification, loading: notifLoading } = useNotifications(kd_karyawan);

  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQ(value);
    setFilterQuery(value); // Also apply card filter
    setSelectedResultIndex(0);

    if (value.trim().length > 1) {
      const results = searchContent(value);
      setSearchResults(results);
      setShowSearchResults(results.length > 0);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  // Handle result selection
  const handleResultSelect = (result: SearchResult) => {
    scrollToResult(result.element);
    setShowSearchResults(false);
    setQ("");
  };

  // Handle keyboard navigation in search results
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSearchResults) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedResultIndex(prev => Math.min(prev + 1, searchResults.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedResultIndex(prev => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (searchResults[selectedResultIndex]) {
          handleResultSelect(searchResults[selectedResultIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowSearchResults(false);
        setQ("");
        clearFilter();
        break;
      default:
        break;
    }
  };

  // Compute search results popover position
  useEffect(() => {
    if (showSearchResults && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      // Position below search input
    }
  }, [showSearchResults]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (notifOpen && notifBtnRef.current && !notifBtnRef.current.contains(target)) {
        setNotifOpen(false);
      }
      if (menuOpen && menuBtnRef.current && !menuBtnRef.current.contains(target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [notifOpen, menuOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Theme toggle disabled: ignore Ctrl/Cmd+Shift+T
      if (e.key === "Escape") {
        setNotifOpen(false);
        setMenuOpen(false);
        setModalOpen(false);
        setShowSearchResults(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // compute and set popover style so it won't be clipped by overflow/containers
  const computeAndSet = (btn: HTMLButtonElement | null, setStyle: (s: React.CSSProperties | null) => void) => {
    if (!btn) return setStyle(null);
    const rect = btn.getBoundingClientRect();
    const top = rect.bottom + 8;
    // align right edge of popover to right edge of button by default
    const leftCandidate = rect.right - 8; // will use translateX(-100%)
    // if near left edge, fallback align left
    const nearLeft = leftCandidate < 220; // arbitrary threshold
    if (nearLeft) {
      setStyle({
        position: "fixed",
        top: `${top}px`,
        left: `${rect.left}px`,
        transform: "translateX(0)",
      });
    } else {
      setStyle({
        position: "fixed",
        top: `${top}px`,
        left: `${leftCandidate}px`,
        transform: "translateX(-100%)",
      });
    }
  };

  useEffect(() => {
    if (notifOpen) computeAndSet(notifBtnRef.current, setNotifStyle);
    else setNotifStyle(null);
  }, [notifOpen]);

  useEffect(() => {
    if (menuOpen) computeAndSet(menuBtnRef.current, setMenuStyle);
    else setMenuStyle(null);
  }, [menuOpen]);

  function submitLeaveRequest(values: { from: string; to: string; reason: string }) {
    console.log("Ajukan cuti", values);
    setModalOpen(false);
    setMenuOpen(false);
  }

  // fallback profile object used when localStorage/user belum tersedia
  const profileToShow = profileDetail ?? {
    id: "me",
    fullName: "Profil Saya",
    position: undefined,
    avatar: null,
  } as Employee;

  return (
    <div className="searchbar-wrapper" role="search" aria-label="Global search">
      <div className="searchbar-left">
        <FiSearch className="search-icon" />
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            ref={inputRef}
            value={q}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => q.trim().length > 1 && setShowSearchResults(true)}
            onBlur={() => {
              // Delay close to allow click on results
              setTimeout(() => setShowSearchResults(false), 200);
            }}
            placeholder="Search (Ctrl+/) atau Cari text di halaman..."
            aria-label="Search"
            className="search-input"
          />

          {/* Search Results Popover */}
          {showSearchResults && searchResults.length > 0 && (
            <div 
              ref={searchResultsRef}
              className="search-results-popover"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '0.5rem',
                zIndex: 1000,
              }}
            >
              <div className="search-results-header">
                Ditemukan {searchResults.length} hasil
                {filterQuery && (() => {
                  const visibleCount = getVisibleCardCount();
                  return visibleCount > 0 ? ` • ${visibleCount} card` : '';
                })()}
              </div>
              <ul className="search-results-list">
                {searchResults.slice(0, 8).map((result, idx) => {
                  const getTypeIcon = (type: string) => {
                    switch(type) {
                      case 'brand': return '🏷️';
                      case 'attribute': return '🔍';
                      default: return '📄';
                    }
                  };
                  
                  const getTypeLabel = (type: string) => {
                    switch(type) {
                      case 'brand': return 'Brand';
                      case 'attribute': return 'Data';
                      default: return 'Text';
                    }
                  };

                  return (
                    <li
                      key={result.id}
                      className={`search-result-item ${idx === selectedResultIndex ? 'bg-blue-50' : ''}`}
                      onClick={() => handleResultSelect(result)}
                      onMouseEnter={() => setSelectedResultIndex(idx)}
                      style={idx === selectedResultIndex ? { backgroundColor: '#f0f9ff' } : {}}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <div className="search-result-section">
                          {result.section}
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#9ca3af', marginLeft: '0.5rem' }}>
                          {getTypeIcon(result.type)} {getTypeLabel(result.type)}
                        </span>
                      </div>
                      <div className="search-result-text">
                        {result.text.substring(0, result.text.indexOf(q)) && (
                          <>
                            {result.text.substring(0, Math.max(0, result.text.length - result.text.substring(result.text.indexOf(q)).length))}
                          </>
                        )}
                        <span className="search-result-highlight">
                          {q}
                        </span>
                        {result.text.substring(result.text.indexOf(q) + q.length)}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {searchResults.length > 8 && (
                <div className="search-empty">
                  +{searchResults.length - 8} hasil lainnya...
                </div>
              )}
            </div>
          )}

          {showSearchResults && q.trim().length > 1 && searchResults.length === 0 && (
            <div 
              className="search-results-popover"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '0.5rem',
                zIndex: 1000,
              }}
            >
              <div className="search-empty">
                Tidak ada hasil untuk "<strong>{q}</strong>"
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="searchbar-right">
        {/* Theme toggle moved here */}
        {/* Theme toggle removed from UI; use Ctrl/Cmd+Shift+T to toggle theme */}

        {/* menu button (hamburger) */}
        <div className="menu-root">
          <button
            ref={menuBtnRef}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((s) => !s)}
            className="icon-btn menu-btn"
            title="Menu"
            type="button"
          >
            <IoMdMenu size={18} />
          </button>

          {menuOpen && menuStyle && (
            <div
              role="menu"
              aria-label="User menu"
              className="popover popover--fixed"
              style={menuStyle}
            >
              <div className="popover-arrow" />
              <button className="menu-item" onClick={() => { setHadirModalOpen(true); setMenuOpen(false); }}>
                ✓ Catat Kehadiran
              </button>
              <button className="menu-item" onClick={() => { setCutiModalOpen(true); setMenuOpen(false); }}>
                📅 Ajukan Cuti
              </button>
              <button className="menu-item" onClick={() => { setLemburModalOpen(true); setMenuOpen(false); }}>
                ⏱️ Ajukan Lembur
              </button>
              <button 
                className="menu-item" 
                onClick={() => {
                  onProfileClick(authUser);  // pass user data up
                  setMenuOpen(false);
                }}
              >
                👤 Profil saya
              </button>
              <div className="popover-divider" />
              <button className="menu-item logout" onClick={() => { openLogoutConfirm(); setMenuOpen(false); }}>
                Logout
              </button>
            </div>
          )}
        </div>

        {/* notifications */}
        <div className="notif-root">
          <button
            ref={notifBtnRef}
            aria-haspopup="true"
            aria-expanded={notifOpen}
            onClick={() => setNotifOpen((s) => !s)}
            className="icon-btn"
            title="Notifications"
            type="button"
          >
            <FiBell />
            {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
          </button>

          {notifOpen && notifStyle && (
            <div
              role="menu"
              aria-label="Notifications"
              className="popover popover--fixed notif-popover"
              style={notifStyle}
            >
              <div className="popover-arrow" />
              <div className="popover-header">
                Notifications
                {unreadCount > 0 && (
                  <button 
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.85rem' }}
                    onClick={() => markAllAsRead()}
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              
              {notifLoading ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>
                  Loading...
                </div>
              ) : realNotifications.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>
                  No notifications
                </div>
              ) : (
                <ul className="notif-list">
                  {realNotifications.slice(0, 5).map((n) => (
                    <li 
                      key={n.kd_notifikasi} 
                      className={`notif-item ${!n.is_read ? 'unread' : ''}`}
                      style={{
                        padding: '0.75rem',
                        borderLeft: !n.is_read ? '3px solid #3b82f6' : '3px solid transparent',
                        backgroundColor: !n.is_read ? '#f0f9ff' : 'transparent',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        setSelectedNotification(n);
                        setNotifModalOpen(true);
                        if (!n.is_read) {
                          markAsRead(n.kd_notifikasi);
                        }
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                            {n.judul}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {n.pesan}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#999' }}>
                            {new Date(n.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '0.9rem' }}
                          onClick={() => deleteNotification(n.kd_notifikasi)}
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}
                  {realNotifications.length > 5 && (
                    <li style={{ padding: '0.75rem', textAlign: 'center', color: '#3b82f6', cursor: 'pointer', fontSize: '0.85rem' }}>
                      View all {realNotifications.length} notifications
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* modal for Ajukan Cuti (unchanged) */}
      {modalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h3>Ajukan cuti</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                submitLeaveRequest({
                  from: fd.get("from") as string,
                  to: fd.get("to") as string,
                  reason: (fd.get("reason") as string) || "",
                });
              }}
            >
              <label>
                Dari
                <input name="from" type="date" className="field" required />
              </label>
              <label>
                Sampai
                <input name="to" type="date" className="field" required />
              </label>
              <label>
                Alasan
                <textarea name="reason" className="field" rows={3} />
              </label>

              <div className="modal-actions">
                <button type="button" className="btn muted" onClick={() => setModalOpen(false)}>Batal</button>
                <button type="submit" className="btn primary">Kirim</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Elegant HR Modals */}
      <HadirModal 
        isOpen={hadirModalOpen} 
        onClose={() => setHadirModalOpen(false)}
        onSubmit={() => {
          // Optionally show success message or refresh data
          setHadirModalOpen(false);
        }}
      />

      <CutiModal 
        isOpen={cutiModalOpen} 
        onClose={() => setCutiModalOpen(false)}
        onSubmit={() => {
          // Optionally show success message or refresh data
          setCutiModalOpen(false);
        }}
      />

      <LemburModal 
        isOpen={lemburModalOpen} 
        onClose={() => setLemburModalOpen(false)}
        onSubmit={() => {
          // Optionally show success message or refresh data
          setLemburModalOpen(false);
        }}
      />

      {/* Profile modal (reuses HrdDetailModal) — show even jika profileDetail belum ada */}
      {profileOpen && (
        <HrdDetailModal
          detail={profileToShow}
          onClose={() => setProfileOpen(false)}
          onPhotoSelect={handleProfilePhotoSelect}
        />
      )}

      {/* Logout confirmation modal */}
      {confirmOpen
        ? createPortal(
            <div className="sb-confirm-overlay" onClick={closeLogoutConfirm}>
              <div className="sb-confirm" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                <div className="sb-confirm-body">
                  <div className="sb-confirm-icon">🔒</div>
                  <div className="sb-confirm-text">
                    <h4>Konfirmasi Logout</h4>
                    <p>Anda yakin ingin keluar dari akun ini?</p>
                  </div>
                </div>
                <div className="sb-confirm-actions">
                  <button className="btn btn-ghost" onClick={closeLogoutConfirm}>Batal</button>
                  <button className="btn btn-danger" onClick={() => { closeLogoutConfirm(); handleLogout(); }}>Keluar</button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {/* Notification Detail Modal */}
      <NotificationDetailModal
        notification={selectedNotification}
        isOpen={notifModalOpen}
        onClose={() => {
          setNotifModalOpen(false);
          setSelectedNotification(null);
        }}
      />
    </div>
  );
}