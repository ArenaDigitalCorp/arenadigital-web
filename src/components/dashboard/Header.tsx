import { UserButton } from "@clerk/nextjs";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between px-4 md:px-6">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
            </Button>
            <div className="flex-1" />
            <div className="flex items-center gap-4">
                <UserButton afterSignOutUrl="/" />
            </div>
        </header>
    );
}
