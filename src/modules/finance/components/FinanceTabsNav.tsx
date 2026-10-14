"use client"

import { usePathname, useRouter } from "next/navigation";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";

const TABS = [
    { key: "visao-geral", label: "Visão geral", path: "" },
    { key: "caixa", label: "Caixa", path: "/caixa" },
    { key: "cadastros-auxiliares", label: "Cadastros Auxiliares", path: "/cadastros-auxiliares" },
] as const;

interface Props {
    arenaId: string;
}

export function FinanceTabsNav({ arenaId }: Props) {
    const pathname = usePathname();
    const router = useRouter();
    const base = `/dashboard/finance/${arenaId}`;
    const active = TABS.find((tab) => pathname === `${base}${tab.path}`)?.key ?? "visao-geral";

    return (
        <DashboardTabs
            value={active}
            onChange={(value) => {
                const tab = TABS.find((t) => t.key === value);
                if (tab) router.push(`${base}${tab.path}`);
            }}
            tabs={TABS.map((tab) => ({ label: tab.label, value: tab.key }))}
        />
    );
}
