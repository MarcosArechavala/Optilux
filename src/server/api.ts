import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { Prisma } from "@prisma/client";
import { SESSION_COOKIE, verifySession, type SessionUser } from "@/lib/session";
import { can, type Permission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { flattenIssues } from "@/lib/validation";

export class ApiError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}

/** Lee la sesión y verifica que el usuario siga activo en la base. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  if (!user || !user.active) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role as SessionUser["role"] };
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "Sesión expirada. Volvé a iniciar sesión.");
  if (!can(user.role, permission)) throw new ApiError(403, "Tu rol no tiene permiso para esta acción.");
  return user;
}

export function parseBody<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields = flattenIssues(result.error);
    throw new ApiError(400, Object.values(fields)[0] ?? "Datos inválidos", fields);
  }
  return result.data;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "Cuerpo JSON inválido");
  }
}

type Handler<C> = (request: Request, ctx: C) => Promise<Response>;

/** Envuelve un handler con manejo uniforme de errores. */
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (request, ctx) => {
    try {
      return await handler(request, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.message, fields: err.fields }, { status: err.status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json({ error: "Datos inválidos", fields: flattenIssues(err) }, { status: 400 });
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") {
          const target = (err.meta?.target as string[] | undefined)?.join(", ") ?? "campo";
          return NextResponse.json({ error: `Ya existe un registro con ese valor (${target}).` }, { status: 409 });
        }
        if (err.code === "P2025") {
          return NextResponse.json({ error: "Registro no encontrado." }, { status: 404 });
        }
      }
      console.error("[API]", err);
      return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
  };
}
