/**
 * Migration script: Upload local images to Cloudflare R2
 *
 * Reads all images from /public/uploads/courts/[arenaId]/
 * and uploads them to R2 under arenas/{arenaId}/spaces/{filename}.
 * Also migrates arena banners stored in the arenas table.
 *
 * Usage:
 *   node scripts/migrate-to-r2.mjs
 *
 * Requirements:
 *   npm install @aws-sdk/client-s3 @supabase/supabase-js dotenv
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { createClient } from "@supabase/supabase-js"
import { readFile, readdir } from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import { config } from "dotenv"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, "../.env.local") })

// ── R2 client ────────────────────────────────────────────────────────────────
const r2 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
})

const BUCKET = process.env.R2_BUCKET_NAME
const PUBLIC_URL = process.env.R2_PUBLIC_URL

// ── Supabase client ───────────────────────────────────────────────────────────
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Helpers ───────────────────────────────────────────────────────────────────
function mimeFromExt(filename) {
    const ext = filename.split(".").pop()?.toLowerCase()
    const map = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" }
    return map[ext] || "application/octet-stream"
}

async function uploadToR2(buffer, key, contentType) {
    await r2.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType }))
    return `${PUBLIC_URL}/${key}`
}

// ── Migrate courts/spaces images ──────────────────────────────────────────────
async function migrateCourts() {
    const uploadsDir = path.join(__dirname, "../public/uploads/courts")

    let arenaIds
    try {
        arenaIds = await readdir(uploadsDir)
    } catch {
        console.log("No local uploads directory found. Skipping courts migration.")
        return
    }

    for (const arenaId of arenaIds) {
        const arenaDir = path.join(uploadsDir, arenaId)
        let files
        try {
            files = await readdir(arenaDir)
        } catch {
            continue
        }

        console.log(`\n Arena ${arenaId}: ${files.length} file(s)`)

        // Fetch courts for this arena to match images by URL
        const { data: courts } = await supabase
            .from("courts")
            .select("id, image_url")
            .eq("arena_id", arenaId)
            .like("image_url", "/uploads/%")

        for (const filename of files) {
            const localPath = path.join(arenaDir, filename)
            const localUrl = `/uploads/courts/${arenaId}/${filename}`

            // Find the court that references this file
            const court = courts?.find(c => c.image_url === localUrl)
            const spaceId = court?.id ?? "unlinked"

            const key = `arenas/${arenaId}/spaces/${spaceId}/${filename}`

            try {
                const buffer = await readFile(localPath)
                const newUrl = await uploadToR2(buffer, key, mimeFromExt(filename))

                if (court) {
                    await supabase.from("courts").update({ image_url: newUrl }).eq("id", court.id)
                    console.log(`  ✓ ${filename} → ${newUrl}`)
                } else {
                    console.log(`  ↑ ${filename} uploaded (no DB record) → ${newUrl}`)
                }
            } catch (err) {
                console.error(`  ✗ ${filename}: ${err.message}`)
            }
        }
    }
}

// ── Migrate arena banners ─────────────────────────────────────────────────────
async function migrateArenaBanners() {
    const { data: arenas, error } = await supabase
        .from("arenas")
        .select("id, banner_url")
        .like("banner_url", "/uploads/%")

    if (error || !arenas?.length) {
        console.log("\nNo arena banners with local paths found.")
        return
    }

    console.log(`\n Arena banners: ${arenas.length} record(s)`)

    for (const arena of arenas) {
        // banner_url is a relative path like /uploads/courts/[arenaId]/[filename]
        const relativePath = arena.banner_url
        const localPath = path.join(__dirname, "../public", relativePath)
        const filename = path.basename(relativePath)
        const key = `arenas/${arena.id}/banner/${filename}`

        try {
            const buffer = await readFile(localPath)
            const newUrl = await uploadToR2(buffer, key, mimeFromExt(filename))
            await supabase.from("arenas").update({ banner_url: newUrl }).eq("id", arena.id)
            console.log(`  ✓ Arena ${arena.id} banner → ${newUrl}`)
        } catch (err) {
            console.error(`  ✗ Arena ${arena.id}: ${err.message}`)
        }
    }
}

// ── Run ───────────────────────────────────────────────────────────────────────
console.log("Starting migration to Cloudflare R2...\n")
await migrateCourts()
await migrateArenaBanners()
console.log("\nMigration complete.")
console.log("After verifying the URLs in Supabase, you can safely delete /public/uploads/")
