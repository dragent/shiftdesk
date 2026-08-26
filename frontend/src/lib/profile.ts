import { api, setToken } from "./api";
import type { User } from "./types";

export interface ContactUpdate {
  email: string;
  phone: string | null;
}

export interface JobUpdate {
  role?: string;
  contractMinutes: number;
}

/**
 * Saves the current user's email and phone. A new JWT is stored when the
 * email changes, because the session identity is the email address.
 */
export async function saveOwnContact(payload: ContactUpdate): Promise<User> {
  const updated = await api.patch<User & { token?: string }>("/api/me", payload);
  const { token, ...user } = updated;
  if (token) {
    setToken(token);
  }
  return user;
}

/** Direction/admin: change anyone's job and weekly contract. */
export async function saveJobAndContract(userId: number, payload: JobUpdate): Promise<User> {
  return api.patch<User>(`/api/users/${userId}`, payload);
}
