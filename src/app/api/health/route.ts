import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, service: "optilux-erp" });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Database unavailable" },
      { status: 500 }
    );
  }
}

