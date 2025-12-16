import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar/Sidebar';

const MainLay: React.FC = () => {
  return (
    <div className="flex">
      <Sidebar />

      {/* content area uses CSS variables set by Sidebar so it won't overlap */}
      <main
        className="flex-1 min-h-screen"
        style={{
          marginLeft: 'calc(var(--left-offset, 18px) + var(--sidebar-w, 260px))',
          transition: 'margin-left 0.28s ease',
          padding: 24,
        }}
      >
        <Outlet />
      </main>
    </div>
  );
};

export default MainLay;