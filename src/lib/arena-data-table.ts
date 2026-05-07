/**
 * Estilo das tabelas de dados do painel, alinhado à lista “Espaços cadastrados”
 * (`ArenaDetailPageClient` → aba Cadastros).
 */
export const arenaDataTable = {
    table: "w-full text-left border-collapse",
    theadRow: "border-b border-slate-100",
    th: "py-4 pr-6 text-sm font-medium text-[#007793]",
    thRight: "py-4 pl-6 pr-0 text-right text-sm font-medium text-[#007793]",
    tbodyRow: "border-b border-slate-100 transition-colors hover:bg-slate-50/60",
    td: "py-5 pr-6 text-sm font-medium text-arena-navy-800 align-middle",
    tdBold: "py-5 pr-6 text-sm font-bold text-arena-navy-800 align-middle",
    tdRight: "py-5 pl-6 pr-0 text-right align-middle",
    emptyCell: "py-16 text-center text-sm text-arena-navy-800/30 font-medium",
} as const
