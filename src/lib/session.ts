import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "./permissions";

/**
 * Sesiones firmadas (JWT HS256 en cookie httpOnly).
 * Este módulo NO importa Prisma ni APIs de Node para poder usarse en el middleware (Edge).
 */
export const SESSION_COOKIE = "optilux_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 h (un turno largo)

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET no configurado (mínimo 32 caracteres) en .env");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ name: user.name, email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.role !== "string") return null;
    return {
      id: payload.sub,
      name: String(payload.name ?? ""),
      email: String(payload.email ?? ""),
      role: payload.role as UserRole,
    };
  } catch {
    return null;
  }
}

