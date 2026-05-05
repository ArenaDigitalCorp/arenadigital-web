import Image from "next/image";
import Link from "next/link";
import { Facebook, Instagram } from "lucide-react";

export function Footer() {
    return (
        <footer className="border-t border-white/10 bg-[#0B1832] px-4 pb-10 pt-[41px]">
            <div className="mx-auto flex w-full max-w-[1191px] flex-col items-center gap-[30px]">
                <div className="grid w-full max-w-[956px] gap-10 md:grid-cols-[118px_1fr_151px] md:items-start md:justify-between">
                    <Image
                        src="/logo_arena_front_bgbranco.png"
                        alt="Arena Digital Logo"
                        width={118}
                        height={40}
                        className="h-10 w-[118px] object-contain"
                    />

                    <div className="flex flex-col gap-4 text-sm leading-5 text-[#C2C7CE] md:mx-auto">
                        <a href="#" className="flex items-center gap-2 transition-colors hover:text-white">
                            <Instagram className="h-5 w-5" strokeWidth={1.8} />
                            Instagram
                        </a>
                        <a href="#" className="flex items-center gap-2 transition-colors hover:text-white">
                            <Facebook className="h-5 w-5" strokeWidth={1.8} />
                            Facebook
                        </a>
                    </div>

                    <div className="flex w-[151px] flex-col gap-[15px] text-left text-xs leading-5 text-[#C2C7CE]">
                        <p className="font-bold uppercase">Legal & Social</p>
                        <div className="flex flex-col gap-2">
                            <Link href="/termos-de-uso" className="transition-colors hover:text-white">
                                Termos de Uso
                            </Link>
                            <Link href="#" className="transition-colors hover:text-white">
                                Política de Privacidade
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="h-px w-full bg-white/10" />

                <p className="text-center text-sm font-normal leading-5 text-white/50">
                    © {new Date().getFullYear()} Arena Digital. Todos os direitos reservados.
                </p>
            </div>
        </footer>
    );
}
