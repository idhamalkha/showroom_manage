import React, { useState, useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider';
import LemburApprovalList from '../components/LemburApprovalList/LemburApprovalList';
import ApprovalLemburModal from '../components/ApprovalLemburModal/ApprovalLemburModal';
import '../styles/lembur-approval.css';

interface LemburRequest {
  kd_lembur: number;
  kd_karyawan: number;
  nama_karyawan: string;
  jabatan: string;
  tgl_lembur: string;
  jam_lembur: number;
  alasan: string;
  status: string;
  created_at: string;
}

export default function LemburApprovalPage() {
  const { accessToken } = useAuth();
  const [selectedLembur, setSelectedLembur] = useState<LemburRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSelectLembur = (lembur: LemburRequest) => {
    setSelectedLembur(lembur);
    setIsModalOpen(true);
  };

  const handleApprove = async (kd_lembur: number, notes: string) => {
    if (!accessToken) return;

    try {
      const response = await fetch(`http://localhost:8000/hrd/lembur/approve/${kd_lembur}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ approval_notes: notes }),
      });

      if (!response.ok) throw new Error('Gagal menyetujui lembur');

      // Refresh list
      setRefreshTrigger(prev => prev + 1);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error approving lembur:', error);
      throw error;
    }
  };

  const handleReject = async (kd_lembur: number, notes: string) => {
    if (!accessToken) return;

    try {
      const response = await fetch(`http://localhost:8000/hrd/lembur/reject/${kd_lembur}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ approval_notes: notes }),
      });

      if (!response.ok) throw new Error('Gagal menolak lembur');

      // Refresh list
      setRefreshTrigger(prev => prev + 1);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error rejecting lembur:', error);
      throw error;
    }
  };

  return (
    <div className="lembur-approval-page">
      <div className="page-header">
        <h1>Persetujuan Pengajuan Lembur</h1>
        <p>Kelola dan setujui/tolak permintaan lembur dari karyawan</p>
      </div>

      <div className="page-content">
        <LemburApprovalList 
          onSelectLembur={handleSelectLembur}
          token={accessToken}
          key={refreshTrigger}
        />
      </div>

      <ApprovalLemburModal
        lembur={selectedLembur}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
}
