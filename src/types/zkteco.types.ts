export interface ZKTecoRecord {
  sn: number;
  user_id: string;
  record_time: string;
  type: number;
  state: number;
  ip: string;
}

export interface ZKTecoUser {
  uid: number;
  role: number;
  password?: string;
  name: string;
  cardno?: number;
  userId: string; // The same string used in user_id for records
}
