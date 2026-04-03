import { NextRequest, NextResponse } from "next/server";
import { uploadToR2, arenaBannerKey, spaceImageKey, sanitizeFilename } from "@/lib/r2Client";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const arenaId = formData.get("arenaId") as string;
        const spaceId = formData.get("spaceId") as string | null;
        const type = (formData.get("type") as string) || "space"; // "banner" | "space"

        if (!file) {
            return NextResponse.json({ error: "No file received." }, { status: 400 });
        }

        if (!arenaId) {
            return NextResponse.json({ error: "No arenaId received." }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = sanitizeFilename(file.name);

        let key: string;
        if (type === "banner") {
            key = arenaBannerKey(arenaId, filename);
        } else {
            if (!spaceId) {
                return NextResponse.json({ error: "No spaceId received for space upload." }, { status: 400 });
            }
            key = spaceImageKey(arenaId, spaceId, filename);
        }

        const publicUrl = await uploadToR2(buffer, key, file.type);

        return NextResponse.json({ url: publicUrl });
    } catch (error) {
        console.error("Error uploading file to R2:", error);
        return NextResponse.json({ error: "Error uploading file." }, { status: 500 });
    }
}
