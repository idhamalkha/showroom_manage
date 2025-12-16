// lightweight service to fetch employees from backend /hrd/karyawan
import { API_BASE } from "../api/host";
export type BackendKaryawan = Record<string, any>;


function resolveAvatar(foto?: string) {
  if (!foto) return undefined;
  if (/^https?:\/\//.test(foto)) return foto;
  return `${API_BASE.replace(/\/$/, "")}/${String(foto).replace(/^\//, "")}`;
}

function mapBackendToEmployee(src: BackendKaryawan) {
  const id = src.kd_karyawan ?? src.id ?? src.karyawan_id ?? src.uuid;
  const fullName = src.nama_karyawan ?? src.full_name ?? src.fullName ?? src.name ?? "";
  const avatar = resolveAvatar(src.foto ?? src.avatar_url ?? src.avatar);
  const contract = src.masa_kontrak ?? src.contract ?? null;

  // normalize salary: backend may return jumlah_gaji directly or nested under gaji object
  const salaryRaw =
    src.jumlah_gaji ??
    src.gaji_pokok ??
    (src.gaji && (src.gaji.jumlah_gaji ?? src.gaji.gaji_pokok)) ??
    null;
  const salary = salaryRaw != null ? Number(salaryRaw) : null;
  
  const kd_jabatan = typeof src.kd_jabatan === "number" ? src.kd_jabatan : (src.jabatan?.kd_jabatan ? Number(src.jabatan.kd_jabatan) : undefined);
  const kd_gaji = typeof src.kd_gaji === "number" ? src.kd_gaji : (src.kd_gaji ? Number(src.kd_gaji) : undefined);
  const kd_kontrak = typeof src.kd_kontrak === "number" ? src.kd_kontrak : (src.kd_kontrak ? Number(src.kd_kontrak) : undefined);

  const jabatan = src.jabatan ? {
    kd_jabatan: src.jabatan.kd_jabatan,
    nama_jabatan: src.jabatan.nama_jabatan
  } : undefined;

  // position: prefer explicit jabatan.nama_jabatan, otherwise undefined (so frontend will lookup from master lists)
  const position = jabatan?.nama_jabatan ?? undefined;

  return {
    id,
    fullName,
    position,
    avatar,
    contract,
    salary,
    phone: src.phone ?? src.no_hp ?? undefined,
    email: src.email ?? src.email_address ?? undefined,
    note: src.note ?? src.catatan ?? undefined,
    kd_jabatan,
    kd_gaji,
    kd_kontrak,
    jabatan,
    raw: src
  };
}

async function parseJsonSafe(res: Response) {
  const text = await res.text().catch(() => "");
  try { return text ? JSON.parse(text) : null; } catch { return res.json().catch(()=>null); }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = localStorage.getItem("authToken");
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  return headers;
}

export async function updateEmployee(id: string, payload: any) {
  const url = `${API_BASE}/hrd/karyawan/${encodeURIComponent(id)}`;
  const headers = await getAuthHeaders();
  return requestJson(url, { 
    method: "PUT", 
    headers,
    body: JSON.stringify(payload)
  });
}

export async function fetchEmployees(kd_jabatan?: number) {
  let url = `${API_BASE}/hrd/karyawan`;
  if (typeof kd_jabatan !== "undefined" && kd_jabatan !== null) {
    url = `${API_BASE}/hrd/karyawan/divisi/${encodeURIComponent(String(kd_jabatan))}`;
  }
  const headers = await getAuthHeaders();
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await parseJsonSafe(res);
    const msg = body?.detail || body?.error || body?.message || (await res.text().catch(()=>res.statusText));
    throw new Error(`API error ${res.status}: ${msg}`);
  }
  const json = await res.json().catch(()=>null);
  if (!json) return [];
  const arr = Array.isArray(json) ? json : (Array.isArray(json.karyawan) ? json.karyawan : (Array.isArray(json.data) ? json.data : []));
  return arr.map(mapBackendToEmployee);
}

async function requestJson(url: string, opts: RequestInit) {
  const headers = { "Accept": "application/json", "Content-Type": "application/json", ...(opts.headers || {}) };
  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) {
    const txt = await res.text().catch(()=>res.statusText);
    throw new Error(`API error ${res.status}: ${txt}`);
  }
  return res.json().catch(()=>null);
}

export async function createEmployee(payload: any) {
  const url = `${API_BASE}/hrd/karyawan`;
  const headers = await getAuthHeaders();
  return requestJson(url, {
    method: "POST", 
    headers,
    body: JSON.stringify(payload)
  });
}

export async function deleteEmployee(id: string) {
  const url = `${API_BASE}/hrd/karyawan/${encodeURIComponent(id)}`;
  const headers = await getAuthHeaders();
  return requestJson(url, {
    method: "DELETE",
    headers
  });
}

export async function fetchJabatan() {
  const url = `${API_BASE}/master/jabatan`; // endpoint sesuai backend
  const headers = await getAuthHeaders();
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error("Gagal fetch jabatan");
  const json = await res.json().catch(() => []);
  return Array.isArray(json) ? json : (json.data ?? []);
}

export async function fetchGaji() {
  const url = `${API_BASE}/master/gaji`; // endpoint sesuai backend
  const headers = await getAuthHeaders();
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error("Gagal fetch gaji");
  const json = await res.json().catch(() => []);
  return Array.isArray(json) ? json : (json.data ?? []);
}

export async function fetchKontrak() {
  const url = `${API_BASE}/master/kontrak`;
  const headers = await getAuthHeaders();
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error("Gagal fetch kontrak");
  const json = await res.json().catch(() => []);
  return Array.isArray(json) ? json : (json.data ?? []);
}