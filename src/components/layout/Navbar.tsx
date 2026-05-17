"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { UserMenu } from "@/components/auth/UserMenu";

export function Navbar() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { user, loading } = useUser();

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    return (
        <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-[rgba(11,24,50,0.90)] backdrop-blur-md">
            <div className="container mx-auto flex h-20 max-w-[1400px] items-center justify-between px-4 md:px-8">
                <Link href="/" className="flex items-center gap-2">
                    <Image
                        src="/logo_arena.png"
                        alt="Arena Digital"
                        width={120}
                        height={48}
                        className="h-12 w-auto object-contain"
                        priority
                    />
                </Link>

                <nav className="hidden md:flex items-center gap-8">
                    <Link href="/#forarenas" className="text-sm font-medium text-white transition-colors hover:text-white/80">
                        Para Arenas
                    </Link>
                    <Link href="/#foratletas" className="text-sm font-medium text-white transition-colors hover:text-white/80">
                        Para Atletas
                    </Link>
                    <Link href="/#howitworks" className="text-sm font-medium text-white transition-colors hover:text-white/80">
                        Como Funciona
                    </Link>
                    <Link href="/#solution" className="text-sm font-medium text-white transition-colors hover:text-white/80">
                        Solução
                    </Link>
                </nav>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-4">
                        {!loading && !user && (
                            <Link href="/sign-in">
                                <Button variant="ghost" className="h-10 rounded-xl border-0 bg-[linear-gradient(90deg,#F97415_0%,#F9A91F_100%)] px-5 text-sm font-semibold text-white shadow-lg shadow-[#F97415]/20 transition-all hover:bg-[linear-gradient(90deg,#F97415_0%,#F9A91F_100%)] hover:text-white hover:brightness-105">
                                    Começar Agora
                                </Button>
                            </Link>
                        )}
                        {!loading && user && (
                            <>
                                <Link href="/dashboard">
                                    <Button size="sm" variant="outline" className="bg-transparent text-white border-white/20 hover:bg-white/10">
                                        Ir para Dashboard
                                    </Button>
                                </Link>
                                <UserMenu />
                            </>
                        )}
                    </div>

                    <Button variant="ghost" size="icon" className="md:hidden text-white" onClick={toggleMobileMenu}>
                        {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </Button>
                </div>
            </div>

            {isMobileMenuOpen && (
                <div className="absolute left-0 top-20 flex w-full animate-in flex-col items-center gap-4 border-t border-white/10 bg-[rgba(11,24,50,0.95)] py-4 shadow-xl backdrop-blur-md fade-in slide-in-from-top-2 md:hidden">
                    <Link href="/#forarenas" onClick={toggleMobileMenu} className="text-sm font-semibold text-white/70 transition-colors hover:text-white">
                        Para Arenas
                    </Link>
                    <Link href="/#foratletas" onClick={toggleMobileMenu} className="text-sm font-semibold text-white/70 transition-colors hover:text-white">
                        Para Atletas
                    </Link>
                    <Link href="/#howitworks" onClick={toggleMobileMenu} className="text-sm font-semibold text-white/70 transition-colors hover:text-white">
                        Como Funciona
                    </Link>
                    <Link href="/#solution" onClick={toggleMobileMenu} className="text-sm font-semibold text-white/70 transition-colors hover:text-white">
                        Solução
                    </Link>

                    <div className="w-full px-4 pt-4 border-t border-white/10 flex flex-col gap-4">
                        {!loading && !user && (
                            <Link href="/sign-in" onClick={toggleMobileMenu} className="w-full">
                                <Button variant="ghost" className="h-12 w-full rounded-xl border-0 bg-[linear-gradient(90deg,#F97415_0%,#F9A91F_100%)] font-extrabold text-white shadow-lg shadow-[#F97415]/20 transition-all hover:bg-[linear-gradient(90deg,#F97415_0%,#F9A91F_100%)] hover:text-white hover:brightness-105">
                                    Começar Agora
                                </Button>
                            </Link>
                        )}
                        {!loading && user && (
                            <div className="flex items-center justify-between px-2">
                                <Link href="/dashboard" onClick={toggleMobileMenu}>
                                    <Button variant="outline" className="h-11 bg-transparent text-white border-white/20 hover:bg-white/10">
                                        Ir para Dashboard
                                    </Button>
                                </Link>
                                <UserMenu />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}
