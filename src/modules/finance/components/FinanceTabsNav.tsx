"use client"

import { usePathname, useRouter } from "next/navigation";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";

const TABS = [
    { resource: "finance.overview", key: "visao-geral", label: "Visão geral", path: "" },
    { resource: "finance.cash", key: "caixa", label: "Caixa", path: "/caixa" },
    { resource: "finance.overview", key: "notas-fiscais", label: "Notas fiscais", path: "/notas-fiscais" },
    { resource: "finance.settings", key: "cadastros-auxiliares", label: "Cadastros Auxiliares", path: "/cadastros-auxiliares" },
] as const;

interface Props {
    arenaId: string;
    resources: string[];
}

export function FinanceTabsNav({ arenaId, resources }: Props) {
    const pathname = usePathname();
    const router = useRouter();
    const base = `/dashboard/finance/${arenaId}`;
    const active = TABS.find((tab) => pathname === `${base}${tab.path}`)?.key ?? "visao-geral";

    return (
        <DashboardTabs
            className="gap-5 overflow-x-auto pt-12 sm:gap-8 md:pt-0 [&>button]:shrink-0"
            value={active}
            onChange={(value) => {
                const tab = TABS.find((t) => t.key === value);
                if (tab) router.push(`${base}${tab.path}`);
            }}
            tabs={TABS.filter(tab => resources.includes(tab.resource)).map((tab) => ({ label: tab.label, value: tab.key }))}
        />
    );
}
