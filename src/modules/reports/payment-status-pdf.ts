/**
 * PDF do relatório de Pagamentos — cabeçalho com a marca Arena Digital e os
 * dados da arena, os filtros aplicados, o resumo do período e a tabela de
 * lançamentos.
 *
 * Só roda no navegador (usa `fetch`/`FileReader` para embutir o logo e
 * `jspdf`/`jspdf-autotable` para desenhar). O componente importa este módulo
 * dinamicamente no clique de "Exportar PDF", do mesmo jeito que já faz com
 * `write-excel-file/browser` — nenhum dos dois entra no bundle inicial.
 */

import type {
  PaymentStatusRow,
  PaymentStatusSummary,
  PaymentStatusArenaInfo,
  PaymentStatusAthleteSummary,
} from '@/modules/reports/types/report.types'
import { buildAppliedFiltersDescription, formatArenaAddressLine, type AppliedFiltersInput } from '@/modules/reports/payment-status-pdf-data'

const LOGO_URL = '/logo_arena_front_bgbranco.png'
/** 625×211 — a mesma proporção do arquivo, para não distorcer ao redimensionar. */
const LOGO_ASPECT_RATIO = 625 / 211
/** Largura fixa do logo no cabeçalho — a marca é um banner horizontal, então quem manda é a largura. */
const LOGO_WIDTH = 130

const statusColor: Record<PaymentStatusRow['status'], [number, number, number]> = {
  Pago: [21, 128, 61],
  Pendente: [161, 98, 7],
  Cancelado: [185, 28, 28],
}

function formatHoras(horas: number): string {
  return `${(Math.round(horas * 100) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}h`
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(LOGO_URL)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    // Sem logo o PDF ainda sai — só sem a marca no topo.
    return null
  }
}

export interface GeneratePaymentStatusPdfInput {
  rows: PaymentStatusRow[]
  summary: PaymentStatusSummary
  arena: PaymentStatusArenaInfo
  filtros: AppliedFiltersInput
  /** "Nome deve de Mensal/Avulso" — só quando um Atleta está filtrado. */
  athleteDebt?: { nome: string; mensal: number; avulso: number } | null
  /** Tabela "Resumo por atleta" antes dos lançamentos (PDF geral). */
  athleteSummaries?: PaymentStatusAthleteSummary[]
  /**
   * Extrato de uso de um atleta — o PDF que vai para ele: título com o nome e,
   * no lugar do resumo do período, horas no mês / total / pago / em aberto.
   */
  extratoDoAtleta?: { nome: string; resumo: PaymentStatusAthleteSummary | null } | null
  formatDate: (iso: string) => string
  formatHorario: (row: PaymentStatusRow) => string
  /** Presente no extrato por hora: acrescenta a coluna "Dia" (Seg, Ter…). */
  formatDiaSemana?: (row: PaymentStatusRow) => string
  formatCurrency: (value: number) => string
  /** Nome do arquivo salvo, sem extensão. */
  fileName: string
}

export async function generatePaymentStatusPdf(input: GeneratePaymentStatusPdfInput): Promise<void> {
  const {
    rows,
    summary,
    arena,
    filtros,
    athleteDebt,
    athleteSummaries,
    extratoDoAtleta,
    formatDate,
    formatHorario,
    formatDiaSemana,
    formatCurrency,
    fileName,
  } = input

  const [{ jsPDF }, autoTableModule, logoDataUrl] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    loadLogoDataUrl(),
  ])
  const autoTable = autoTableModule.default

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 40
  let y = 36

  // ── Cabeçalho: logo + marca Arena Digital, centralizado ──────────────────
  if (logoDataUrl) {
    const logoWidth = LOGO_WIDTH
    const logoHeight = logoWidth / LOGO_ASPECT_RATIO
    doc.addImage(logoDataUrl, 'PNG', (pageWidth - logoWidth) / 2, y, logoWidth, logoHeight)
    y += logoHeight + 8
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(140)
  doc.text('Sistema de Gestão para Arenas Esportivas', pageWidth / 2, y, { align: 'center' })
  y += 18

  // ── Dados da arena, centralizados abaixo da marca ─────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(20)
  doc.text(arena.name, pageWidth / 2, y, { align: 'center' })
  y += 15

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(90)
  const enderecoLinha = formatArenaAddressLine(arena)
  if (enderecoLinha) {
    doc.text(enderecoLinha, pageWidth / 2, y, { align: 'center' })
    y += 12
  }

  y += 10
  doc.setDrawColor(225)
  doc.line(marginX, y, pageWidth - marginX, y)
  y += 20

  // ── Título + filtros aplicados ────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(20)
  doc.text(
    extratoDoAtleta
      ? `Extrato de uso — ${extratoDoAtleta.nome} — ${filtros.monthLabel}`
      : `Relatório de Pagamentos — ${filtros.monthLabel}`,
    marginX,
    y
  )
  y += 16

  const filtrosAplicados = buildAppliedFiltersDescription(filtros)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(90)
  doc.text('Filtros aplicados', marginX, y)
  y += 12

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(70)
  const filtrosTexto = filtrosAplicados.map((f) => `${f.label}: ${f.value}`).join('     ·     ')
  const filtrosQuebrados = doc.splitTextToSize(filtrosTexto, pageWidth - marginX * 2)
  doc.text(filtrosQuebrados, marginX, y)
  y += filtrosQuebrados.length * 11 + 10

  if (extratoDoAtleta) {
    // ── Extrato: o que o atleta precisa para conferir e pagar ───────────────
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(90)
    doc.text('Resumo do mês', marginX, y)
    y += 12

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(70)
    const r = extratoDoAtleta.resumo
    const partes = r
      ? [
          `Horas no mês: ${formatHoras(r.horas)}`,
          `Total do mês: ${formatCurrency(r.devido)}`,
          `Pago: ${formatCurrency(r.pago)}`,
          `Em aberto: ${formatCurrency(r.emAberto)}`,
          `Situação: ${r.status}`,
        ]
      : ['Nenhum valor em aberto ou pago neste período.']
    doc.text(partes.join('     ·     '), marginX, y)
    y += 20
  } else {
    // ── Resumo do período — os mesmos totais dos cards da tela ───────────────
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(90)
    doc.text('Resumo do período', marginX, y)
    y += 12

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(70)
    // "Horas ocupadas" saiu: soma só `horas` de reserva avulsa/mensal ainda sem
    // mensalidade gerada, então subconta o mês inteiro (uma recorrência de vários
    // blocos, já consolidada em mensalidade, não entra) — o número não tinha
    // como representar o total do período e mais confundia do que ajudava.
    const resumoPartes = [
      `Confirmados: ${formatCurrency(summary.totalPago)} (${summary.countPago})`,
      `Pendentes: ${formatCurrency(summary.totalPendente)} (${summary.countPendente})`,
      `Cancelados: ${formatCurrency(summary.totalCancelado)} (${summary.countCancelado})`,
      `Total a cobrar: ${formatCurrency(summary.totalACobrar)}`,
    ]
    doc.text(resumoPartes.join('     ·     '), marginX, y)
    y += 14

    if (athleteDebt) {
      doc.text(
        `${athleteDebt.nome} deve neste mês: ${formatCurrency(athleteDebt.mensal)} de Mensal   ·   ${formatCurrency(athleteDebt.avulso)} de Avulso`,
        marginX,
        y
      )
      y += 14
    }
    y += 6
  }

  // ── Tabela de lançamentos — mesmas colunas da tela ────────────────────────
  const tableStyles = {
    margin: { left: marginX, right: marginX, bottom: 36 },
    styles: { fontSize: 8, cellPadding: 5, textColor: [51, 51, 51] as [number, number, number] },
    headStyles: { fillColor: [17, 24, 64] as [number, number, number], textColor: 255, fontStyle: 'bold' as const },
    alternateRowStyles: { fillColor: [248, 249, 251] as [number, number, number] },
  }
  const pintarStatus = (statusColIndex: number) => (data: {
    section: string
    column: { index: number }
    cell: { raw: unknown; styles: { textColor: unknown; fontStyle: unknown } }
  }) => {
    if (data.section !== 'body' || data.column.index !== statusColIndex) return
    const status = data.cell.raw as PaymentStatusRow['status']
    if (!statusColor[status]) return
    data.cell.styles.textColor = statusColor[status]
    data.cell.styles.fontStyle = 'bold'
  }
  const finalY = () =>
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y

  // ── Resumo por atleta: quem deve quanto (PDF geral) ───────────────────────
  if (!extratoDoAtleta && athleteSummaries && athleteSummaries.length > 0) {
    const comHoras = filtros.detalharPorHora
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(90)
    doc.text('Resumo por atleta', marginX, y)
    y += 6

    const total = athleteSummaries.reduce(
      (acc, s) => ({
        horas: acc.horas + s.horas,
        devido: acc.devido + s.devido,
        pago: acc.pago + s.pago,
        emAberto: acc.emAberto + s.emAberto,
      }),
      { horas: 0, devido: 0, pago: 0, emAberto: 0 }
    )
    const resumoHead = ['Atleta', ...(comHoras ? ['Horas'] : []), 'Total do mês', 'Pago', 'Em aberto', 'Status']
    const resumoBody = athleteSummaries.map((s) => [
      s.atleta,
      ...(comHoras ? [s.horas > 0 ? formatHoras(s.horas) : '—'] : []),
      formatCurrency(s.devido),
      formatCurrency(s.pago),
      formatCurrency(s.emAberto),
      s.status,
    ])
    // Tudo entre o nome (coluna 0) e o Status (última) é número: à direita.
    const alinhadasDireita = Object.fromEntries(
      Array.from({ length: resumoHead.length - 2 }, (_, i) => [i + 1, { halign: 'right' as const }])
    )

    autoTable(doc, {
      ...tableStyles,
      head: [resumoHead],
      body: resumoBody,
      foot: [[
        `Total (${athleteSummaries.length})`,
        ...(comHoras ? [formatHoras(total.horas)] : []),
        formatCurrency(total.devido),
        formatCurrency(total.pago),
        formatCurrency(total.emAberto),
        '',
      ]],
      footStyles: { fillColor: [240, 242, 246], textColor: 20, fontStyle: 'bold' },
      showFoot: 'lastPage',
      startY: y,
      columnStyles: alinhadasDireita,
      didParseCell: pintarStatus(resumoHead.length - 1),
    })
    y = finalY() + 22

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(90)
    doc.text('Lançamentos', marginX, y)
    y += 6
  }

  // ── Tabela de lançamentos — mesmas colunas da tela ────────────────────────
  const head = [
    'Data',
    ...(formatDiaSemana ? ['Dia'] : []),
    'Horário',
    'Atleta',
    'Serviço',
    'Espaço',
    'Esporte',
    'Valor',
    'Status',
  ]
  const body = rows.map((row) => [
    formatDate(row.data),
    ...(formatDiaSemana ? [formatDiaSemana(row)] : []),
    formatHorario(row),
    row.atleta ?? 'Avulsa',
    row.servico,
    row.espaco ?? '—',
    row.esporte ?? '—',
    row.valor != null ? formatCurrency(row.valor) : '—',
    row.status,
  ])
  const valorColIndex = head.length - 2

  autoTable(doc, {
    ...tableStyles,
    head: [head],
    body,
    startY: y,
    columnStyles: { [valorColIndex]: { halign: 'right' } },
    didParseCell: pintarStatus(head.length - 1),
  })

  // Rodapé depois de tudo desenhado — só aí o total de páginas é conhecido.
  const pageCount = doc.getNumberOfPages()
  const geradoEm = `Gerado em ${new Date().toLocaleString('pt-BR')}`
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    doc.setPage(pageNumber)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(150)
    doc.text(geradoEm, marginX, doc.internal.pageSize.getHeight() - 18)
    doc.text(
      `Página ${pageNumber} de ${pageCount}`,
      pageWidth - marginX,
      doc.internal.pageSize.getHeight() - 18,
      { align: 'right' }
    )
  }

  doc.save(`${fileName}.pdf`)
}
