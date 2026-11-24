export type StoredUser = {
  id: string;
  username: string;
  role: "admin" | "user";
  created_at: string;
  password?: string;
};

export type StoredApiKey = {
  id: string;
  user_id: string;
  created_by_id: string;
  label: string;
  token: string;
  created_at: string;
  expires_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

const USERS_STORAGE_KEY = "decraft_admin_users";
const API_KEYS_STORAGE_KEY = "decraft_admin_api_keys";

const DEFAULT_USERS: StoredUser[] = [
  {
    id: "user-admin-default",
    username: "admin",
    role: "admin",
    created_at: new Date().toISOString(),
  },
  {
    id: "user-demo-1",
    username: "member",
    role: "user",
    created_at: new Date().toISOString(),
  },
];

const DEFAULT_KEYS: StoredApiKey[] = [
  {
    id: "key-default-1",
    user_id: "user-admin-default",
    created_by_id: "user-admin-default",
    label: "Production App Key",
    token: "sk-decraft-" + Array.from({ length: 32 }, () => Math.random().toString(36)[2] || "0").join(""),
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    last_used_at: new Date().toISOString(),
    revoked_at: null,
  },
];

export function getStoredUsers(): StoredUser[] {
  if (typeof window === "undefined") return DEFAULT_USERS;
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_USERS;
  } catch {
    return DEFAULT_USERS;
  }
}

export function saveStoredUsers(users: StoredUser[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (err) {
    console.error("Failed to save users to localStorage:", err);
  }
}

export function getStoredApiKeys(): StoredApiKey[] {
  if (typeof window === "undefined") return DEFAULT_KEYS;
  try {
    const raw = localStorage.getItem(API_KEYS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(DEFAULT_KEYS));
      return DEFAULT_KEYS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_KEYS;
  } catch {
    return DEFAULT_KEYS;
  }
}

export function saveStoredApiKeys(keys: StoredApiKey[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(keys));
  } catch (err) {
    console.error("Failed to save API keys to localStorage:", err);
  }
}
