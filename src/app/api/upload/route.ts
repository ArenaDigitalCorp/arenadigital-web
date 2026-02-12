import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const arenaId = formData.get("arenaId") as string;

        if (!file) {
            return NextResponse.json(
                { error: "No file received." },
                { status: 400 }
            );
        }

        if (!arenaId) {
            return NextResponse.json(
                { error: "No arenaId received." },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = file.name.replaceAll(" ", "_");
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const extension = path.extname(filename);
        const uniqueFilename = `${path.basename(filename, extension)}-${uniqueSuffix}${extension}`;

        // Define the upload directory
        // Storing in public/uploads/courts/[arenaId]
        const uploadDir = path.join(process.cwd(), "public", "uploads", "courts", arenaId);

        // Ensure the directory exists
        await mkdir(uploadDir, { recursive: true });

        const filePath = path.join(uploadDir, uniqueFilename);

        // Write the file
        await writeFile(filePath, buffer);

        // Return the public URL
        const publicUrl = `/uploads/courts/${arenaId}/${uniqueFilename}`;

        return NextResponse.json({ url: publicUrl });
    } catch (error) {
        console.error("Error uploading file:", error);
        return NextResponse.json(
            { error: "Error uploading file." },
            { status: 500 }
        );
    }
}
