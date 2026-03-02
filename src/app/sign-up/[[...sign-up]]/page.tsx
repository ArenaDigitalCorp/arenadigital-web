import { SignUp } from "@clerk/nextjs";
import { Logo } from "@/components/shared/Logo";
import Link from "next/link";
import { CustomSignUp } from "@/components/auth/CustomSignUp";

export default function Page() {
    return (
        <div className="flex flex-col min-h-screen bg-[#F0E6D2] p-4 py-8 md:py-12 overflow-y-auto">
            <div className="m-auto w-full max-w-[720px] bg-[#002B40] rounded-3xl p-6 sm:p-8 md:p-12 shadow-2xl flex flex-col items-center">
                {/* Logo */}
                <Link href="/">
                    <Logo className="mb-8 hover:opacity-80 transition-opacity cursor-pointer" />
                </Link>

                {/* Welcome Text */}
                <h1 className="text-3xl font-bold text-white mb-2">Crie sua conta</h1>
                <p className="text-white/80 text-center mb-8">
                    Já possui uma conta?{" "}
                    <Link href="/sign-in" className="text-[#FF6B00] hover:underline font-medium">
                        Faça login.
                    </Link>
                </p>

                {/* Custom SignUp Flow */}
                <div className="w-full">
                    <CustomSignUp />
                </div>
            </div>
        </div>
    );
}
