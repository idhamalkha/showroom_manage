export interface Employee {
  id: number | string;
  fullName: string;
  position?: string;
  division?: string;
  avatar?: string;
  contract?: string | null;
  salary?: number | null;
  phone?: string;
  email?: string;
  note?: string;
  raw?: any;
}