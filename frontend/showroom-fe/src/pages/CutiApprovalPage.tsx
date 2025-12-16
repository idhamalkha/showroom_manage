import React, { useState, useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider';
import CutiApprovalList from '../components/CutiApprovalList/CutiApprovalList';
import ApprovalCutiModal from '../components/ApprovalCutiModal/ApprovalCutiModal';
import '../styles/cuti-approval.css';

interface CutiRequest {
  kd_cuti: number;
  kd_karyawan: number;
  nama_karyawan: string;
  jabatan: string;
  tgl_mulai: string;
  tgl_selesai: string;
  durasi_hari: number;
  alasan: string;
  status: string;
  created_at: string;
}

export default function CutiApprovalPage() {
  const { accessToken } = useAuth();
  const [selectedCuti, setSelectedCuti] = useState<CutiRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSelectCuti = (cuti: CutiRequest) => {
    setSelectedCuti(cuti);
    setIsModalOpen(true);
  };

  const handleApprove = async (kd_cuti: number, notes: string) => {
    if (!accessToken) return;

    try {
      const response = await fetch(`http://localhost:8000/hrd/cuti/approve/${kd_cuti}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ approval_notes: notes }),
      });

      if (!response.ok) throw new Error('Gagal menyetujui cuti');

      // Refresh list
      setRefreshTrigger(prev => prev + 1);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error approving cuti:', error);
      throw error;
    }
  };

  const handleReject = async (kd_cuti: number, notes: string) => {
    if (!accessToken) return;

    try {
      const response = await fetch(`http://localhost:8000/hrd/cuti/reject/${kd_cuti}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ approval_notes: notes }),
      });

      if (!response.ok) throw new Error('Gagal menolak cuti');

      // Refresh list
      setRefreshTrigger(prev => prev + 1);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error rejecting cuti:', error);
      throw error;
    }
  };

  return (
    <div className="cuti-approval-page">
      <div className="page-header">
        <h1>Persetujuan Pengajuan Cuti</h1>
        <p>Kelola dan setujui/tolak permintaan cuti dari karyawan</p>
      </div>

      <div className="page-content">
        <CutiApprovalList 
          onSelectCuti={handleSelectCuti}
          token={accessToken}
          key={refreshTrigger}
        />
      </div>

      <ApprovalCutiModal
        cuti={selectedCuti}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
}
