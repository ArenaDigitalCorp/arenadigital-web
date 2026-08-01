import { NextRequest, NextResponse } from "next/server";
import { uploadToR2, arenaBannerKey, spaceImageKey } from "@/lib/r2Client";
import { AuthorizationError, assertArenaAdminAccess, assertCourtAccess } from "@/lib/server-auth";
import {
    UploadPolicyError,
    createUploadObjectName,
    validateImageSignature,
    validateMultipartContentLength,
    validateUploadDescriptor,
} from "@/lib/upload-policy";
import * as z from "zod";

const uploadFieldsSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("banner"), arenaId: z.string().uuid(), spaceId: z.null() }),
    z.object({ type: z.literal("space"), arenaId: z.string().uuid(), spaceId: z.string().uuid() }),
]);

export async function POST(request: NextRequest) {
    try {
        validateMultipartContentLength(request.headers.get("content-length"));
        const formData = await request.formData();
        const file = formData.get("file");

        if (!(file instanceof File)) {
            return NextResponse.json({ error: "No file received." }, { status: 400 });
        }

        const rawType = formData.get("type");
        const fields = uploadFieldsSchema.parse({
            type: rawType,
            arenaId: formData.get("arenaId"),
            spaceId: rawType === "banner" ? null : formData.get("spaceId"),
        });
        const accepted = validateUploadDescriptor(file);

        await assertArenaAdminAccess(fields.arenaId);

        const buffer = Buffer.from(await file.arrayBuffer());
        validateImageSignature(buffer, accepted.contentType);
        const filename = createUploadObjectName(accepted.extension);

        let key: string;
        if (fields.type === "banner") {
            key = arenaBannerKey(fields.arenaId, filename);
        } else {
            await assertCourtAccess(fields.spaceId, fields.arenaId);
            key = spaceImageKey(fields.arenaId, fields.spaceId, filename);
        }

        const publicUrl = await uploadToR2(buffer, key, accepted.contentType);

        return NextResponse.json({ url: publicUrl });
    } catch (error) {
        if (error instanceof AuthorizationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        if (error instanceof UploadPolicyError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid upload fields." }, { status: 400 });
        }
        console.error("Error uploading file to R2:", error);
        return NextResponse.json({ error: "Error uploading file." }, { status: 500 });
    }
}
