import React from "react";
import Image from "next/image";

interface LogoProps {
    className?: string;
    showText?: boolean;
}

export function Logo({ className, showText = true }: LogoProps) {
    return (
        <div className={`flex items-center gap-4 ${className}`}>
            <Image
                src="/logo_arena.png"
                alt="Arena Digital"
                width={200}
                height={60}
                priority
                className="object-contain"
            />
        </div>
    );
}
