"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";

export function Navbar() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    return (
        <header className="fixed top-0 w-full border-b border-white/10 bg-[#001D2D]/90 backdrop-blur-md z-50">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <img
                        src="/logo_arena.png"
                        alt="Arena Digital"
                        className="h-12 w-auto object-contain"
                    />
                </Link>

                <nav className="hidden md:flex items-center gap-6">
                    <Link href="#forarenas" className="text-sm font-medium text-white/80 hover:text-white transition-colors">
                        Para Arenas
                    </Link>
                    <Link href="#foratletas" className="text-sm font-medium text-white/80 hover:text-white transition-colors">
                        Para Atletas
                    </Link>
                    <Link href="#howitworks" className="text-sm font-medium text-white/80 hover:text-white transition-colors">
                        Como Funciona
                    </Link>
                    <Link href="#solution" className="text-sm font-medium text-white/80 hover:text-white transition-colors">
                        Solução
                    </Link>
                </nav>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-4">
                        <SignedOut>
                            <Link href="/sign-in">
                                <Button className="h-10 px-6 bg-[#FF6B00] hover:bg-[#E66000] text-white font-bold rounded-lg shadow-lg shadow-[#FF6B00]/20 transition-all">
                                    Entrar
                                </Button>
                            </Link>
                        </SignedOut>
                        <SignedIn>
                            <Link href="/dashboard">
                                <Button size="sm" variant="outline" className="bg-transparent text-white border-white/20 hover:bg-white/10">
                                    Ir para Dashboard
                                </Button>
                            </Link>
                            <UserButton afterSignOutUrl="/" />
                        </SignedIn>
                    </div>

                    <Button variant="ghost" size="icon" className="md:hidden text-white" onClick={toggleMobileMenu}>
                        {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </Button>
                </div>
            </div>

            {/* Mobile Menu Dropdown */}
            {isMobileMenuOpen && (
                <div className="md:hidden border-t border-white/10 bg-[#001D2D]/95 backdrop-blur-md absolute w-full left-0 top-16 shadow-xl py-4 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-top-2">
                    <Link href="#features" onClick={toggleMobileMenu} className="text-sm font-medium text-white/70 hover:text-white transition-colors">
                        Funcionalidades
                    </Link>
                    <Link href="#benefits" onClick={toggleMobileMenu} className="text-sm font-medium text-white/70 hover:text-white transition-colors">
                        Benefícios
                    </Link>
                    <Link href="#contact" onClick={toggleMobileMenu} className="text-sm font-medium text-white/70 hover:text-white transition-colors">
                        Contato
                    </Link>

                    <div className="w-full px-4 pt-4 border-t border-white/10 flex flex-col gap-4">
                        <SignedOut>
                            <Link href="/sign-in" onClick={toggleMobileMenu} className="w-full">
                                <Button className="w-full h-12 bg-[#FF6B00] hover:bg-[#E66000] text-white font-bold rounded-lg shadow-lg shadow-[#FF6B00]/20 transition-all">
                                    Entrar
                                </Button>
                            </Link>
                        </SignedOut>
                        <SignedIn>
                            <div className="flex items-center justify-between px-2">
                                <Link href="/dashboard" onClick={toggleMobileMenu}>
                                    <Button variant="outline" className="h-11 bg-transparent text-white border-white/20 hover:bg-white/10">
                                        Ir para Dashboard
                                    </Button>
                                </Link>
                                <UserButton afterSignOutUrl="/" />
                            </div>
                        </SignedIn>
                    </div>
                </div>
            )}
        </header>
    );
}
