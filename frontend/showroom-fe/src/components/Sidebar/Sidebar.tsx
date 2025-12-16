import React, { useEffect, useState } from 'react';
import { FaAngleLeft, FaAngleRight } from 'react-icons/fa';
import SidebarItem from './SidebarItem';
import '../../styles/sidebar.css';

import { useAuth } from '../../providers/AuthProvider';
import { API_BASE } from '../../api/host';
import carlog from '../../assets/carlog.png';

// OPTIONAL: if you add explicit dark/light png variants, import them
// import carlogLight from '../../assets/carlog-white.png';
// import carlogDark from '../../assets/carlog-black.png';

const Sidebar: React.FC = () => {
  // get user from auth provider
  const { logout, user, loading } = useAuth();

  const getInitialTheme = (): 'dark' | 'light' => {
    // single source-of-truth: "theme" (fallbacks for legacy keys)
    const stored = localStorage.getItem('theme') || localStorage.getItem('app-theme');
    if (stored === 'dark' || stored === 'light') return stored as 'dark' | 'light';
    const legacy = localStorage.getItem('darkMode');
    if (legacy === 'true') return 'dark';
    if (legacy === 'false') return 'light';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const getInitialSidebarState = (): boolean => {
    const savedState = localStorage.getItem('sidebarCollapsed');
    return savedState ? JSON.parse(savedState) : false;
  };

  const [isCollapsed, setIsCollapsed] = useState(getInitialSidebarState());
  const [isHidden, setIsHidden] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // DO NOT mutate document.classList or body attributes here.
  // Keep Sidebar reactive to external theme changes (SearchBar toggles theme).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'theme') {
        setTheme(e.newValue === 'dark' ? 'dark' : 'light');
      }
      // keep legacy key in sync if someone updates darkMode directly
      if (e.key === 'darkMode' && (e.newValue === 'true' || e.newValue === 'false')) {
        setTheme(e.newValue === 'true' ? 'dark' : 'light');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const full = '260px';
    const collapsed = '80px';
    const peek = '56px';

    if (isHidden) {
      root.style.setProperty('--sidebar-w', peek);
    } else if (isCollapsed) {
      root.style.setProperty('--sidebar-w', collapsed);
    } else {
      root.style.setProperty('--sidebar-w', full);
    }
  }, [isCollapsed, isHidden]);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // Sidebar must not change global theme. Theme toggle lives in SearchBar.

  const handleLogout = async () => {
    try {
      if (typeof logout === 'function') {
        await logout();
      }
    } catch {
      /* ignore */
    } finally {
      // ensure local redirect to login
      window.location.href = '/login';
    }
  };

  const onNavClick = () => {
    setIsMobileOpen(false);
  };

  // derive profile fields from user (defensive)
  // Prefer backend /auth/me response: use 'nama' and 'avatar_url' (matches HrdManagement upload)
  // jika masih loading jangan tampilkan fallback "User" — tunggu sampai user tersedia
  if (loading) {
    // ringkas: tampilkan skeleton / kosong sementara
    return (
      <aside className="sidebar loading" role="navigation" aria-label="Main sidebar">
        {/* minimal skeleton saat loading */}
      </aside>
    );
  }

  // optional debug: console.log(user);
  // console.log('Auth user:', user);

  const displayName =
    (user && (user.nama || user.nama_karyawan || user.fullName || user.name)) || 'User';

  // This will automatically update when user state changes in AuthProvider
  const rawAvatar = user?.avatar_url || user?.avatar || user?.foto || null;

  const avatarUrl = rawAvatar
    ? rawAvatar.startsWith('http')
      ? rawAvatar
      : `${API_BASE}${rawAvatar}` // make absolute if backend returned relative path
    : '/avatar.png';

  const titleLabel = (user && (user.jabatan?.nama_jabatan || user.role || user.position)) || 'Staff';

  return (
    <>
      <button
        aria-label={isHidden ? 'Open sidebar' : 'Hide sidebar'}
        className={`sidebar-peek-btn ${isHidden ? 'peek-visible' : ''}`}
        aria-hidden={false}
      >
        <span
          role="button"
          tabIndex={0}
          className="peek-icon"
          onClick={(e: React.MouseEvent<HTMLSpanElement>) => {
            setIsHidden(s => !s);
            (e.currentTarget as HTMLElement).blur();
          }}
          onKeyDown={(e: React.KeyboardEvent<HTMLSpanElement>) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setIsHidden(s => !s);
              (e.currentTarget as HTMLElement).blur();
            }
          }}
          title={isHidden ? 'Open sidebar' : 'Hide sidebar'}
        >
          {isHidden ? <FaAngleRight /> : <FaAngleLeft />}
        </span>
      </button>

      <div
        className={`sidebar-backdrop ${isMobileOpen ? 'visible' : ''}`}
        onClick={() => setIsMobileOpen(false)}
        aria-hidden
      />

      <aside
        className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isHidden ? 'hidden' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
        role="navigation"
        aria-label="Main sidebar"
      >
        <div className="inner-panel">
          <div className="logo-container">
            <div className="logo-left">
              {/* Masked logo: PNG used as mask so we can force a green fill in all themes */}
              <div
                className="logo-mask"
                role="img"
                aria-label="Showroom logo"
                style={{
                  WebkitMaskImage: `url(${carlog})`,
                  maskImage: `url(${carlog})`,
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center',
                }}
              />
              {/* fallback img for older browsers (kept visually hidden) */}
              <img src={carlog} alt="Showroom" className="logo-fallback" />

              {!isCollapsed && <span className="logo-text">Showroom</span>}
            </div>

            <div className="logo-right">
              <button
                aria-label="Open menu"
                className="mobile-menu-btn"
                onClick={() => setIsMobileOpen(s => !s)}
              >
                ☰
              </button>
            </div>
          </div>

          <SidebarItem
            isCollapsed={isCollapsed}
            onNavClick={onNavClick}
          />

          <div className="mt-auto pt-4">
            <div className="sidebar-user-profile">
              <img
                src={avatarUrl}
                alt={displayName}
                className="sidebar-avatar"
              />
              {!isCollapsed && (
                <div className="sidebar-user-info">
                  <span className="font-semibold text-[15px]">{displayName}</span>
                  <span className="text-xs opacity-60">{titleLabel}</span>
                </div>
              )}
            </div>

            {/* theme toggle + logout removed from Sidebar (now in SearchBar menu) */}
          </div>

        </div>

        <div className="collapse-btn" aria-hidden>
          <span
            role="button"
            tabIndex={0}
            className="collapse-icon"
            onClick={(e) => {
              if (isHidden) setIsHidden(false);
              const newCollapsedState = !isCollapsed;
              setIsCollapsed(newCollapsedState);
              localStorage.setItem('sidebarCollapsed', JSON.stringify(newCollapsedState));
              (e.currentTarget as HTMLElement).blur();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                if (isHidden) setIsHidden(false);
                const newCollapsedState = !isCollapsed;
                setIsCollapsed(newCollapsedState);
                localStorage.setItem('sidebarCollapsed', JSON.stringify(newCollapsedState));
                (e.currentTarget as HTMLElement).blur();
              }
            }}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <FaAngleRight /> : <FaAngleLeft />}
          </span>
        </div>

      </aside>
    </>
  );
};

export default Sidebar;