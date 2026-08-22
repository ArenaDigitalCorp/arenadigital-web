import { DashboardLayoutWrapper } from "@/components/dashboard/DashboardLayoutWrapper";
import {
    AuthorizationError,
    getPlatformAccessLevel,
    requireWebBackofficeAccess,
    type PlatformAccessLevel,
} from "@/lib/server-auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    let platformAccessLevel: PlatformAccessLevel | null = null;

    try {
        const currentUser = await requireWebBackofficeAccess();
        platformAccessLevel = await getPlatformAccessLevel(currentUser.dbUserId);
    } catch (error) {
        if (error instanceof AuthorizationError) {
            const params = new URLSearchParams({ error: error.message });
            redirect(`/auth/sign-out?${params.toString()}`);
        }

        throw error;
    }

    if (platformAccessLevel === "super_admin") {
        redirect("/admin/overview");
    }

    return (
        <DashboardLayoutWrapper>
            {children}
        </DashboardLayoutWrapper>
    );
}
