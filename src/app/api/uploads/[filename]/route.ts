import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { ApiError, requirePermission, route } from "@/server/api";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export const GET = route<{ params: Promise<{ filename: string }> }>(
  async (_request, ctx) => {
    await requirePermission("uploads:read");
    const { filename } = await ctx.params;

    if (!/^[a-z0-9]+\.(pdf|png|jpg|jpeg|webp)$/i.test(filename)) {
      throw new ApiError(400, "Nombre de archivo inválido");
    }

    const fullPath = path.join(UPLOAD_DIR, filename);
    try {
      const buf = await fs.readFile(fullPath);
      const ext = path.extname(filename).toLowerCase();
      const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
      return new NextResponse(buf, {
        headers: {
          "Content-Type": mime,
          "Cache-Control": "private, max-age=3600",
        },
      });
    } catch {
      throw new ApiError(404, "Adjunto no encontrado");
    }
  }
);

