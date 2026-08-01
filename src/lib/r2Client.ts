import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"

export const r2 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
})

const BUCKET = process.env.R2_BUCKET_NAME!
const PUBLIC_URL = process.env.R2_PUBLIC_URL!

export async function uploadToR2(
    buffer: Buffer,
    key: string,
    contentType: string
): Promise<string> {
    await r2.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: buffer,
            ContentType: contentType || "application/octet-stream",
            IfNoneMatch: "*",
        })
    )

    return `${PUBLIC_URL}/${key}`
}

export function arenaBannerKey(arenaId: string, filename: string): string {
    return `arenas/${arenaId}/banner/${filename}`
}

export function spaceImageKey(arenaId: string, spaceId: string, filename: string): string {
    return `arenas/${arenaId}/spaces/${spaceId}/${filename}`
}
