"use client";

import { useEffect, useRef, useState } from "react";

const TOTAL_FRAMES = 82;
const DURATION_MS = 7000;
const FRAME_TIME_MS = DURATION_MS / TOTAL_FRAMES;

export function HeroAnimation() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imagesRef = useRef<HTMLImageElement[]>([]);
    // We don't strictly need to re-render on load, but we keep track internally
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        let loaded = 0;
        const images: HTMLImageElement[] = [];

        for (let i = 0; i < TOTAL_FRAMES; i++) {
            const img = new Image();
            const frameNum = i.toString().padStart(3, '0');
            // The filename contains an accented 'i'. Using encodeURI helps ensure it's requested correctly by the browser.
            const basePath = encodeURI("/img/imgs_hero_landingpg/Vídeo_de_Jogo_Animado_e_Torcida_");
            img.src = `${basePath}${frameNum}.png`;

            img.onload = () => {
                loaded += 1;
                if (loaded === Math.min(TOTAL_FRAMES, 5)) {
                    // Consider it 'loaded' enough to start showing after the first few frames
                    setIsLoaded(true);
                }
            };
            images.push(img);
        }

        imagesRef.current = images;
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let currentFrame = 0;
        let animationFrameId: number;
        let lastTime = performance.now();

        const render = (time: number) => {
            const deltaTime = time - lastTime;

            // Update frame if enough time has passed
            if (deltaTime >= FRAME_TIME_MS) {
                currentFrame = (currentFrame + 1) % TOTAL_FRAMES;
                lastTime = time - (deltaTime % FRAME_TIME_MS);
            }

            const img = imagesRef.current[currentFrame];
            if (img && img.complete && img.naturalHeight > 0) {
                // Calculate object-fit: cover dimensions
                const canvasRatio = canvas.width / canvas.height;
                const imgRatio = img.width / img.height;

                let drawWidth = canvas.width;
                let drawHeight = canvas.height;
                let offsetX = 0;
                let offsetY = 0;

                if (canvasRatio > imgRatio) {
                    drawHeight = canvas.width / imgRatio;
                    offsetY = (canvas.height - drawHeight) / 2;
                } else {
                    drawWidth = canvas.height * imgRatio;
                    offsetX = (canvas.width - drawWidth) / 2;
                }

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
            }

            animationFrameId = requestAnimationFrame(render);
        };

        animationFrameId = requestAnimationFrame(render);

        const resizeCanvas = () => {
            const parent = canvas.parentElement;
            if (parent) {
                // Adjust for device pixel ratio for sharper rendering if needed, 
                // but for a 1MB image sequence, 1x is usually better for performance.
                canvas.width = parent.clientWidth;
                canvas.height = parent.clientHeight;
            }
        };

        window.addEventListener("resize", resizeCanvas);
        resizeCanvas(); // Initial sizing

        return () => {
            window.removeEventListener("resize", resizeCanvas);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <div className="absolute inset-0 z-0 bg-[#001D2D] overflow-hidden">
            {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#001D2D]">
                    <div className="w-8 h-8 border-4 border-[#FF6B00] border-t-transparent rounded-full animate-spin opacity-50"></div>
                </div>
            )}
            <canvas ref={canvasRef} className="w-full h-full opacity-60" />

            {/* Required Overlays */}
            <div className="absolute inset-0 bg-[#001D2D]/60 mix-blend-multiply pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#001D2D]/20 via-[#001D2D]/60 to-[#001D2D] pointer-events-none" />
        </div>
    );
}
