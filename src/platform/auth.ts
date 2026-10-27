import type { PlatformRole, PlatformUser } from "./types";

export class AuthorizationError extends Error {
  constructor(message = "Not authorised") {
    super(message);
    this.name = "AuthorizationError";
  }
}
export function requireRole(user: PlatformUser | undefined, roles: PlatformRole[]): PlatformUser {
  if (!user || user.suspendedAt || !roles.some((role) => user.roles.includes(role)))
    throw new AuthorizationError();
  return user;
}
export function canReview(user: PlatformUser | undefined) {
  return requireRole(user, ["admin", "reviewer", "mentor"]);
}
export function canAdmin(user: PlatformUser | undefined) {
  return requireRole(user, ["admin"]);
}
