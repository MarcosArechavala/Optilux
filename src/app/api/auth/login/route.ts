import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from "@/lib/session";
import { ApiError, parseBody, readJson, route } from "@/server/api";
import type { UserRole } from "@/lib/permissions";

export const POST = route(async (request) => {
  const body = parseBody(loginSchema, await readJson(request));

  const user = await prisma.user.findUnique({
    where: { email: body.email },
  });

  if (!user || !user.active) {
    throw new ApiError(401, "Credenciales inválidas o usuario inactivo.");
  }

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, "Credenciales inválidas.");
  }

  const sessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
  };

  const token = await signSession(sessionUser);
  const res = NextResponse.json({ ok: true, user: sessionUser });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
});

