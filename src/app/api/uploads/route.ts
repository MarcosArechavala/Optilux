import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { ApiError, requirePermission, route } from "@/server/api";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const ALLOWED_MIMES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const POST = route(async (request) => {
  await requirePermission("uploads:write");

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new ApiError(400, "No se recibió ningún archivo.");
  }

  const ext = ALLOWED_MIMES[file.type];
  if (!ext) {
    throw new ApiError(400, "Formato no permitido. Subí PDF, JPG, PNG o WebP.");
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new ApiError(400, "El archivo supera el límite de 8 MB.");
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const id = crypto.randomBytes(12).toString("hex");
  const filename = `${id}.${ext}`;
  const fullPath = path.join(UPLOAD_DIR, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(fullPath, buffer);

  return NextResponse.json({
    ok: true,
    attachmentName: file.name,
    attachmentPath: filename,
    attachmentMime: file.type,
  });
});

