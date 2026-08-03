export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
}

export interface MyInfo {
  userId: number;
  email: string;
  nickname: string;
  role: "USER" | "ADMIN";
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "DELETED";
  profileImageUrl: string | null;
  pointBalance: number;
}
