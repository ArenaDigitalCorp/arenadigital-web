import { SignUp } from "@clerk/nextjs";
import { Logo } from "@/components/shared/Logo";
import Link from "next/link";
import { CustomSignUp } from "@/components/auth/CustomSignUp";

export default function Page() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-[#F0E6D2] py-10">
            <div className="w-full max-w-[480px] bg-[#002B40] rounded-[24px] p-8 md:p-12 shadow-2xl flex flex-col items-center">
                {/* Logo */}
                <Logo className="mb-10" />

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
