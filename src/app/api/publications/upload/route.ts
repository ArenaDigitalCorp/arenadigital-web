import { authorizePublicationScope } from "@/modules/publications/authorization";
import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError } from "@/lib/server-auth";
import { uploadToR2 } from "@/lib/r2Client";
import {
  createUploadObjectName,
  validateImageSignature,
  validateMultipartContentLength,
  validateUploadDescriptor,
  UploadPolicyError,
} from "@/lib/upload-policy";
import { z } from "zod";
export async function POST(request: NextRequest) {
  try {
    validateMultipartContentLength(request.headers.get("content-length"));
    const form = await request.formData();
    const arenaId = z.string().uuid().nullable().parse(form.get("arenaId"));
    await authorizePublicationScope(arenaId, "upload");
    const file = form.get("file");
    if (!(file instanceof File))
      return NextResponse.json(
        { error: "Selecione uma imagem." },
        { status: 400 },
      );
    const accepted = validateUploadDescriptor(file),
      buffer = Buffer.from(await file.arrayBuffer());
    validateImageSignature(buffer, accepted.contentType);
    const key = `publications/${arenaId ?? "platform"}/${createUploadObjectName(accepted.extension)}`;
    return NextResponse.json({
      url: await uploadToR2(buffer, key, accepted.contentType),
    });
  } catch (e) {
    const status =
      e instanceof AuthorizationError || e instanceof UploadPolicyError
        ? e.status
        : e instanceof z.ZodError
          ? 400
          : 500;
    return NextResponse.json(
      {
        error:
          status === 500
            ? "Não foi possível enviar a imagem. Tente novamente."
            : e instanceof Error
              ? e.message
              : "Upload inválido.",
      },
      { status },
    );
  }
}
