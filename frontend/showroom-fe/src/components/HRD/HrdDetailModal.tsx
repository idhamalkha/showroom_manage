import { useRef, useState, useEffect, type ChangeEvent } from "react";
import { API_BASE } from "../../api/host";
// Change this import to avoid conflict
import type { Kontrak, Gaji } from "./HrdManagement";
import { useAuth } from "../../providers/AuthProvider";

// Define Employee interface here instead of importing
interface Employee {
  id?: string | number;
  kd_karyawan?: number;  // Add this
  fullName: string;
  position?: string;
  avatar?: string | null;
  avatar_url?: string | null;
  foto?: string | null;
  salary?: number;
  contract?: string | null;
  kd_jabatan?: number;
  kd_gaji?: number;
  kd_kontrak?: number;
  jabatan?: {
    kd_jabatan?: number;
    nama_jabatan?: string;
  };
  // Add other fields that might come from auth/me
  role?: string;
  username?: string;
  username_karyawan?: string;
  nama?: string;
  password?: string;
  generated_password?: string;
}

export default function HrdDetailModal({
  detail,
  onClose,
  onPhotoSelect,
  kontrakList = [], // Add default empty array
  gajiList = [],    // Add default empty array
}: {
  detail: Employee;
  onClose: () => void;
  onPhotoSelect?: (file: File) => void;
  kontrakList?: Kontrak[];
  gajiList?: Gaji[];
}) {
  const { updateUser } = useAuth(); // Add this

  if (!detail) return null;
  
  // ensure page/sidebar is disabled while this modal is open (same flag used by HrdManagement)
  useEffect(() => {
    document.body.classList.add("hrd-modal-open");
    return () => {
      document.body.classList.remove("hrd-modal-open");
    };
  }, []);

  const avatarSrc =
    (detail as any).avatar ??
    (detail as any).avatar_url ??
    (detail as any).github_url ??
    null;

  const username =
    (detail as any).username ??
    (detail as any).username_karyawan ??
    (detail as any).raw?.username_karyawan ??
    "-";

  const password =
    (detail as any).generated_password ??
    (detail as any).generatedPassword ??
    (detail as any).password ??
    "—";

  const jabatan = 
    (detail as any).jabatan?.nama_jabatan ?? 
    detail.position ?? 
    (detail as any).role ??
    "-";

  // Fix type annotations in these functions
  const findKontrak = (kd?: number) =>
    kontrakList?.find((k: Kontrak) => k.kd_kontrak === kd)?.masa_kontrak ?? "-";
    
  const findGaji = (kd?: number) =>
    gajiList?.find((g: Gaji) => g.kd_gaji === kd)?.jumlah_gaji ?? (detail as any).salary ?? null;

  const fmtRp = (v?: number | null) =>
    v == null ? "-" : "Rp " + Number(v).toLocaleString("id-ID");

  const fileRef = useRef<HTMLInputElement | null>(null);

  // confirmation UI state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const openPicker = () => {
    fileRef.current?.click();
  };

  useEffect(() => {
    if (!pendingFile) {
      setPendingPreview(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPendingPreview(url);
    return () => {
      URL.revokeObjectURL(url);
      setPendingPreview(null);
    };
  }, [pendingFile]);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f) {
      setPendingFile(f);
      setConfirmOpen(true);
    }
    // reset so same file can be selected again later
    e.currentTarget.value = "";
  };

  const doUploadFallback = async (file: File) => {
    const UPLOAD_URL = `${API_BASE}/api/upload`; // http://localhost:8000/api/upload
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      // Tambahkan log untuk debug
      console.log("Uploading to:", UPLOAD_URL);

      const token = localStorage.getItem("authToken") ?? "";
      const res = await fetch(UPLOAD_URL, {
        method: "POST",
        body: fd,
        headers: {
          // PENTING: JANGAN set Content-Type untuk FormData
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Upload failed:", errText);
        throw new Error(`Upload failed: ${res.status} ${errText}`);
      }

      const json = await res.json();
      console.log("Upload response:", json); // Debug log

      return json?.github_url ?? json?.url ?? json?.data?.url ?? null;
    } catch (err) {
      console.error("Upload error:", err);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const confirmUpload = async () => {
    if (!pendingFile) {
      setConfirmOpen(false);
      return;
    }

    try {
      setUploading(true);
      console.log("Starting upload..."); // Debug log

      // 1. Upload file
      const url = await doUploadFallback(pendingFile);
      console.log("Upload result URL:", url); // Debug log

      if (!url) {
        throw new Error("Upload failed - no URL returned");
      }

      // 2. Update karyawan
      const userId = detail.id ?? detail.kd_karyawan;
      if (!userId) throw new Error("No valid ID found");

      const token = localStorage.getItem("authToken");
      if (!token) throw new Error("No auth token found");

      const updateRes = await fetch(`${API_BASE}/hrd/karyawan/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ foto: url }),
      });

      if (!updateRes.ok) throw new Error("Failed to update karyawan");

      // 3. Refresh data dari /auth/me
      const meRes = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!meRes.ok) throw new Error("Failed to refresh user data");
      
      const me = await meRes.json();

      // 4. Update state lokal & global
      const normalized = { 
        ...me, 
        avatar: me.avatar_url ?? me.foto ?? me.avatar 
      };

      // Update AuthProvider state (akan refresh sidebar)
      updateUser(normalized);

      // Update state lokal
      (detail as any).avatar = url;
      (detail as any).avatar_url = url;
      (detail as any).foto = url;

      // 5. Update localStorage
      try {
        localStorage.setItem("user", JSON.stringify(normalized));
      } catch {}

    } catch (err) {
      console.error("Upload flow failed:", err);
      // Tambahkan alert untuk user feedback
      alert("Gagal mengunggah foto. Silakan coba lagi.");
    } finally {
      setUploading(false);
      setPendingFile(null);
      setConfirmOpen(false);
    }
  };

  const cancelUpload = () => {
    setPendingFile(null);
    setConfirmOpen(false);
  };

  // prefer masa_kontrak from detail (auth/me) else lookup via kd_kontrak
  const masaKontrak = (detail as any).masa_kontrak ?? findKontrak(detail.kd_kontrak);
  const salaryValue = (detail as any).salary ?? findGaji(detail.kd_gaji);

  return (
    <div className="hrd-overlay" onMouseDown={onClose}>
      <div
        className="hrd-modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button className="hrd-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="hrd-modal-avatar">
          {avatarSrc ? (
            <img src={avatarSrc} alt={detail.fullName ?? username} className="hrd-avatar-img" />
          ) : (
            <div className="hrd-avatar-placeholder" />
          )}
        </div>

        <div className="hrd-modal-name">{detail.fullName ?? (detail as any).nama ?? username}</div>
        <div className="hrd-modal-position">{jabatan}</div>

        {/* Tambahkan row jabatan setelah nama/posisi */}

        <div className="hrd-modal-row">
          <strong>Gaji:</strong> {fmtRp(salaryValue)}
        </div>
        <div className="hrd-modal-row">
          <strong>Masa Kontrak:</strong> {masaKontrak ?? "-"}
        </div>

        <hr style={{ margin: "12px 0", border: "none", borderTop: "1px solid rgba(0,0,0,0.06)" }} />

        <div className="hrd-modal-row">
          <strong>Username:</strong> <span>{username}</span>
        </div>
        <div className="hrd-modal-row" style={{ fontFamily: "monospace" }}>
          <strong>Password:</strong> <span>{password}</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted-text)", marginTop: 8 }}>
          Password hanya tersedia jika API mengembalikannya saat pembuatan.
        </div>

        <div className="hrd-modal-actions">
          <button className="upload-btn btn primary" onClick={openPicker} style={{ minWidth: 140 }}>
            Pilih Foto
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={onFileChange}
          />
        </div>

        {/* Confirmation pop-up rendered as fixed overlay (outside modal) */}
      </div> {/* end .hrd-modal */}

      {confirmOpen && (
        <div
          className="hrd-confirm-wrapper"
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.52)",
            zIndex: 20000,
            pointerEvents: "auto",
          }}
          onMouseDown={(e) => {
            // click on backdrop closes confirm
            e.stopPropagation();
            cancelUpload();
          }}
        >
          <div
            className="hrd-confirm-card"
            style={{
              width: 360,
              maxWidth: "92%",
              background: "var(--card-bg, #fff)",
              color: "var(--panel-text, #000)",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", gap: 12 }}>
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "rgba(0,0,0,0.04)",
                }}
              >
                {pendingPreview ? (
                  <img
                    src={pendingPreview}
                    alt="preview"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <div style={{ width: "100%", height: "100%", background: "#e5e7eb" }} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 6, fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)" }}>
                  Konfirmasi unggah foto
                </div>
                <div style={{ fontSize: 13, color: "var(--muted-text)", fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)" }}>
                  Apakah Anda yakin ingin mengunggah foto ini untuk {detail.fullName ?? (detail as any).nama ?? username}?
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button className="btn neutral" onClick={cancelUpload} style={{ minWidth: 90 }} disabled={uploading}>
                Batal
              </button>
              <button className="btn primary" onClick={confirmUpload} style={{ minWidth: 110 }} disabled={uploading}>
                {uploading ? "Mengunggah..." : "Konfirmasi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}