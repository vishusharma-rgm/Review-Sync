import type { Role } from "@/lib/types";

export function canEdit(role: Role) {
  return role === "OWNER" || role === "REVIEWER";
}

export function canManage(role: Role) {
  return role === "OWNER";
}

export function canReview(role: Role) {
  return role === "OWNER" || role === "REVIEWER";
}
