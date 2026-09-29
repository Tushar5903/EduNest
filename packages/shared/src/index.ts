export * from "./constants/roles";
export * from "./constants/theme";
export * from "./schemas/index";
export * from "./api/client";

export type IDHelpers = never;

export function displayRollNo(rollNo?: number | null): string {
  return rollNo == null ? "—" : String(rollNo);
}

export function isLoginId(value: string): boolean {
  return /^(T-|S-)/i.test(value.trim()) || /^\d{4,}$/.test(value.trim());
}

export function isEmail(value: string): boolean {
  return /.+@.+\..+/.test(value.trim());
}
