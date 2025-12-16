import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  FiClock,
} from 'react-icons/fi';

import { IoPersonSharp } from "react-icons/io5";
import { FaPersonChalkboard } from "react-icons/fa6";
import { IoCarSportSharp } from "react-icons/io5";
import { FaHandshake } from "react-icons/fa";
import { FaHome } from "react-icons/fa";
import { MdHolidayVillage } from "react-icons/md";
import { FaFileArchive } from "react-icons/fa";
import { FaMoneyBill } from "react-icons/fa";
import { FaCreditCard } from "react-icons/fa6";
import { useAuth } from '../../providers/AuthProvider';

export interface MenuItem {
  icon: JSX.Element;
  label: string;
  path: string;
  roles?: string[]; // array of roles yang dapat access item ini
}

interface SidebarItemProps {
  isCollapsed: boolean;
  onNavClick?: () => void;
}

export const menuItems: MenuItem[] = [
  { icon: <FaHome />, label: 'Home', path: '/dash_sales', roles: ['sales'] },
  { icon: <FaHome />, label: 'Home', path: '/hrd_dashboard', roles: ['hrd'] },
  { icon: <FaHome />, label: 'Home', path: '/dash_finance', roles: ['finance'] },
  { icon: <IoPersonSharp />, label: 'Karyawan', path: '/hrd_management', roles: ['hrd'] },
  { icon: <FaPersonChalkboard />, label: 'Kinerja', path: '/kinerja', roles: ['hrd'] },
  { icon: <MdHolidayVillage />, label: 'Persetujuan Cuti', path: '/cuti_approval', roles: ['hrd'] },
  { icon: <FiClock />, label: 'Persetujuan Lembur', path: '/lembur_approval', roles: ['hrd'] },
  { icon: <FaHandshake />, label: 'Transaksi', path: '/transaksi_sales', roles: ['sales'] },
  { icon: <IoCarSportSharp />, label: 'Mobil Management', path: '/mobil_sales', roles: ['sales'] },
  { icon: <FaFileArchive />, label: 'Laporan Keuangan', path: '/laporan_keuangan', roles: ['finance'] },
  { icon: <FaMoneyBill />, label: 'Persetujuan Pengeluaran', path: '/finance_approval', roles: ['finance'] },
  { icon: <FaCreditCard />, label: 'Manajemen Cicilan', path: '/cicilan_management', roles: ['finance'] },
];

const SidebarItem: React.FC<SidebarItemProps> = ({ isCollapsed, onNavClick }) => {
  const { user } = useAuth();
  
  // Get user role from user object (flexible untuk berbagai field names)
  const userRole = user?.role || user?.jabatan?.nama_jabatan?.toLowerCase() || '';
  
  // Filter menu items berdasarkan user role
  const filteredMenuItems = menuItems.filter(item => {
    // Jika item tidak punya roles restriction, tampilkan ke semua
    if (!item.roles || item.roles.length === 0) {
      return true;
    }
    // Jika user role cocok dengan salah satu roles di item
    return item.roles.some(role => userRole.toLowerCase().includes(role));
  });

  return (
    <nav className="menu" aria-label="Main menu">
      {filteredMenuItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `menu-item ${isActive ? 'active' : ''} ${isCollapsed ? 'collapsed' : ''}`
          }
          onClick={() => onNavClick && onNavClick()}
        >
          <span className="icon" aria-hidden>
            {item.icon}
          </span>

          {!isCollapsed && <span className="label">{item.label}</span>}
        </NavLink>
      ))}
    </nav>
  );
};

export default SidebarItem;