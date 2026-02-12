import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Menu } from "lucide-react";

export function Navbar() {
    return (
        <header className="fixed top-0 w-full border-b bg-background/80 backdrop-blur-md z-50">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <span className="text-xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                        Arena Digital
                    </span>
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
                            <Button variant="ghost" size="sm">
                                Entrar
                            </Button>
                        </Link>
                        <SignUpButton mode="modal">
                            <Button size="sm">
                                Começar Grátis
                            </Button>
                        </SignUpButton>
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
