import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Menu } from "lucide-react";

export function Navbar() {
    return (
        <header className="fixed top-0 w-full border-b bg-background/80 backdrop-blur-md z-50">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <img
                        src="/logo_arena_front_bgbranco.png"
                        alt="Arena Digital"
                        className="h-10 w-auto object-contain"
                    />
                </Link>

                <nav className="hidden md:flex items-center gap-6">
                    <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                        Funcionalidades
                    </Link>
                    <Link href="#benefits" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                        Benefícios
                    </Link>
                    <Link href="#contact" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                        Contato
                    </Link>
                </nav>

                <div className="flex items-center gap-4">
                    <SignedOut>
                        <Link href="/sign-in">
                            <Button className="h-10 px-6 bg-[#FF6B00] hover:bg-[#E66000] text-white font-bold rounded-lg shadow-lg shadow-[#FF6B00]/20 transition-all">
                                Entrar
                            </Button>
                        </Link>
                    </SignedOut>
                    <SignedIn>
                        <Link href="/dashboard">
                            <Button size="sm" variant="outline">
                                Ir para Dashboard
                            </Button>
                        </Link>
                        <UserButton afterSignOutUrl="/" />
                    </SignedIn>

                    <Button variant="ghost" size="icon" className="md:hidden">
                        <Menu className="h-5 w-5" />
                    </Button>
                </div>
            </div>
        </header>
    );
}
