/**
 * Shared (browser-safe) staff-role vocabulary. Kept out of `$lib/server` so
 * client components can reference role codes without leaking server-only
 * dependencies. Server authority checks live in `$lib/server/admin/roles.ts`.
 */
export const USER_ROLES = [
  "super-admin",
  "admin",
  "inventory-mgr",
  "fulfillment",
  "support",
  "marketing",
  "user",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ADMIN_ROLES: readonly UserRole[] = ["super-admin", "admin"] as const;
export const ROLE_MANAGER_ROLES: readonly UserRole[] = ["super-admin"] as const;

export function isUserRole(value: string | null | undefined): value is UserRole {
  return value !== null && value !== undefined && (USER_ROLES as readonly string[]).includes(value);
}

/** Whether a user may access the admin dashboard. */
export function isAdminRole(role: string | null | undefined): boolean {
  return (ADMIN_ROLES as readonly string[]).includes(role ?? "");
}

/** Whether a user may assign roles on the admin users page. */
export function isRoleManager(role: string | null | undefined): boolean {
  return (ROLE_MANAGER_ROLES as readonly string[]).includes(role ?? "");
}
