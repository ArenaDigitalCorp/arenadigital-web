import { SignIn } from "@clerk/nextjs";
import { Logo } from "@/components/shared/Logo";
import Link from "next/link";

export default function Page() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-[#F0E6D2]">
            <div className="w-full max-w-[480px] bg-[#002B40] rounded-[24px] p-8 md:p-12 shadow-2xl flex flex-col items-center">
                {/* Logo */}
                <Logo className="mb-10" />

                {/* Welcome Text */}
                <h1 className="text-3xl font-bold text-white mb-2">Boas-vindas!</h1>
                <p className="text-white/80 text-center mb-8">
                    Entre com sua conta ou{" "}
                    <Link href="/sign-up" className="text-[#FF6B00] hover:underline font-medium">
                        cadastre-se.
                    </Link>
                </p>

                {/* Clerk SignIn */}
                <div className="w-full">
                    <SignIn
                        appearance={{
                            elements: {
                                rootBox: "w-full focus:shadow-none",
                                card: "bg-transparent shadow-none w-full p-0",
                                headerTitle: "hidden",
                                headerSubtitle: "hidden",
                                main: "gap-4",
                                formFieldLabel: "hidden",
                                formFieldInput:
                                    "bg-white border-none h-12 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#FF6B00]",
                                formButtonPrimary:
                                    "bg-[#FF6B00] hover:bg-[#E66000] h-12 rounded-lg text-lg font-bold normal-case shadow-lg transition-all",
                                footer: "hidden",
                                identityPreviewText: "text-white",
                                identityPreviewEditButton: "text-[#FF6B00]",
                                formResendCodeLink: "text-[#FF6B00]",
                                dividerLine: "bg-white/10",
                                dividerText: "text-white/50",
                                socialButtonsBlockButton: "bg-white border-none",
                                socialButtonsBlockButtonText: "text-gray-900 font-medium",
                                alert: "bg-red-500/10 border-red-500/20 text-red-200",
                            },
                        }}
                        routing="path"
                        path="/sign-in"
                    />
                </div>

                {/* Footer Link */}
                <div className="mt-6">
                    <Link
                        href="/forgot-password"
                        className="text-white/80 hover:text-white underline text-sm"
                    >
                        Esqueci minha senha
                    </Link>
                </div>
            </div>
        </div>
    );
}
