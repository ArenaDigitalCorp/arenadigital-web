/**
 * Lógica de agenda da recorrência do mensalista.
 *
 * Fica fora do componente porque é aritmética de calendário pura: dá para
 * testar sem montar a grade, e a mesma contagem alimenta o subtotal, o
 * pró-rata exibido e o payload enviado ao RPC.
 *
 * O banco é a autoridade final sobre disponibilidade e preço — o que está aqui
 * existe para o gestor ver antes de salvar, não para decidir no lugar dele.
 */

export const DIAS_SEMANA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

export const DIAS_SEMANA_LONGO = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

/** Meses de agenda que o RPC gera: o corrente confirmado e os dois seguintes. */
export const MESES_HORIZONTE = 3;

export type SlotKey = `${string}|${number}|${number}`;

export type SlotStatus =
  | 'free'
  | 'busy'
  | 'closed'
  | 'conflict-future'
  | 'past';

export interface SlotInfo {
  status: SlotStatus;
  /** Quem ocupa, quando `busy`. */
  occupantName?: string;
  /** Data da primeira ocorrência em conflito, quando `conflict-future`. */
  conflictDate?: Date;
}

export interface CourtDayConfig {
  day: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export interface CourtLike {
  id: string;
  name: string;
  day_config?: CourtDayConfig[] | null;
}

export interface BookingLike {
  court_id: string;
  start_time: string;
  end_time: string;
  status?: string | null;
  athlete_name?: string | null;
}

export interface Bloco {
  courtId: string;
  diaSemana: number;
  /** Hora cheia de início, ex. 19. */
  from: number;
  /** Hora cheia de fim (exclusiva no calendário), ex. 21. */
  to: number;
  hours: number[];
}

export function slotKey(courtId: string, dia: number, hora: number): SlotKey {
  return `${courtId}|${dia}|${hora}` as SlotKey;
}

export function parseSlotKey(key: string): {
  courtId: string;
  diaSemana: number;
  hora: number;
} {
  const [courtId, dia, hora] = key.split('|');
  return { courtId, diaSemana: Number(dia), hora: Number(hora) };
}

export function formatHora(hora: number): string {
  return `${String(hora).padStart(2, '0')}:00`;
}

/**
 * Horas contíguas do mesmo espaço e dia viram um bloco só — é assim que o
 * gestor pensa ("terça das 19 às 21") e é o que o RPC recebe.
 */
export function agruparBlocos(keys: Iterable<string>): Bloco[] {
  const porCourtDia = new Map<string, number[]>();

  for (const key of keys) {
    const { courtId, diaSemana, hora } = parseSlotKey(key);
    const agrupador = `${courtId}|${diaSemana}`;
    const lista = porCourtDia.get(agrupador);
    if (lista) lista.push(hora);
    else porCourtDia.set(agrupador, [hora]);
  }

  const blocos: Bloco[] = [];
  for (const [agrupador, horas] of porCourtDia) {
    const [courtId, dia] = agrupador.split('|');
    const diaSemana = Number(dia);
    horas.sort((a, b) => a - b);

    let corrente: number[] = [horas[0]];
    for (let i = 1; i <= horas.length; i++) {
      if (horas[i] === corrente[corrente.length - 1] + 1) {
        corrente.push(horas[i]);
        continue;
      }
      blocos.push({
        courtId,
        diaSemana,
        from: corrente[0],
        to: corrente[corrente.length - 1] + 1,
        hours: [...corrente],
      });
      if (horas[i] !== undefined) corrente = [horas[i]];
    }
  }

  return blocos.sort(
    (a, b) => a.diaSemana - b.diaSemana || a.from - b.from || a.courtId.localeCompare(b.courtId)
  );
}

/** Datas em que `diaSemana` cai entre `de` e `ate`, ambos inclusive. */
export function ocorrencias(diaSemana: number, de: Date, ate: Date): Date[] {
  const datas: Date[] = [];
  const cursor = new Date(de.getFullYear(), de.getMonth(), de.getDate());
  while (cursor.getDay() !== diaSemana) cursor.setDate(cursor.getDate() + 1);
  while (cursor <= ate) {
    datas.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return datas;
}

export function fimDoMes(base: Date): Date {
  return new Date(base.getFullYear(), base.getMonth() + 1, 0);
}

/**
 * Primeiro dia do primeiro mês em que o plano roda **inteiro** — o mês que serve
 * de referência tanto para sugerir a mensalidade quanto para dividir o pró-rata.
 *
 * Plano que começa no dia 1º já roda o próprio mês inteiro; começando no meio, a
 * referência é o mês seguinte.
 *
 * Usar a MESMA referência dos dois lados é o que garante que o preço por sessão
 * implícito na mensalidade seja o mesmo que o pró-rata cobra. Quando o mensal
 * saía de um mês com 5 ocorrências e o pró-rata dividia por um mês com 4, a
 * primeira mensalidade vinha 25% acima do combinado.
 */
export function mesReferencia(inicioVigencia: Date): Date {
  const comecaNoDiaUm = inicioVigencia.getDate() === 1;
  return new Date(
    inicioVigencia.getFullYear(),
    inicioVigencia.getMonth() + (comecaNoDiaUm ? 0 : 1),
    1
  );
}

/** Último dia do horizonte de agenda gerado pelo RPC. */
export function fimDoHorizonte(inicio: Date): Date {
  return new Date(inicio.getFullYear(), inicio.getMonth() + MESES_HORIZONTE, 0);
}

function nomeDoDia(date: Date): string {
  return DIAS_SEMANA_LONGO[date.getDay()];
}

/** A quadra está aberta nessa hora, segundo o `day_config`? */
export function estaAberto(court: CourtLike, date: Date, hora: number): boolean {
  const config = court.day_config?.find(
    (dia) => dia.day.toLowerCase() === nomeDoDia(date).toLowerCase()
  );
  if (!config || !config.enabled) return false;

  const inicio = Number.parseInt(config.startTime.split(':')[0], 10);
  const fim = Number.parseInt(config.endTime.split(':')[0], 10);
  if (Number.isNaN(inicio) || Number.isNaN(fim)) return false;

  // Fechamento após a meia-noite (ex. 18h–02h) vira um intervalo circular.
  return inicio < fim ? hora >= inicio && hora < fim : hora >= inicio || hora < fim;
}

function ocupaIntervalo(booking: BookingLike, inicio: Date, fim: Date): boolean {
  if (booking.status === 'cancelled') return false;
  const bookingInicio = new Date(booking.start_time);
  const bookingFim = new Date(booking.end_time);
  return bookingInicio < fim && bookingFim > inicio;
}

export interface AvaliarSlotParams {
  court: CourtLike;
  diaSemana: number;
  hora: number;
  /** Primeira data possível — normalmente hoje. */
  inicioVigencia: Date;
  /** Última data do horizonte de 3 meses. */
  fimHorizonte: Date;
  bookingsPorCourt: Map<string, BookingLike[]>;
  agora: Date;
}

/**
 * Estado de uma célula da grade considerando **todas** as ocorrências do
 * horizonte, não só a semana exibida.
 *
 * Um horário livre nesta terça pode estar ocupado na terça de daqui a seis
 * semanas. Como a decisão de produto é bloquear o bloco nesse caso, a célula
 * precisa dizer isso antes do gestor montar o plano em cima dela.
 */
export function avaliarSlot({
  court,
  diaSemana,
  hora,
  inicioVigencia,
  fimHorizonte,
  bookingsPorCourt,
  agora,
}: AvaliarSlotParams): SlotInfo {
  const datas = ocorrencias(diaSemana, inicioVigencia, fimHorizonte);
  if (datas.length === 0) return { status: 'past' };

  const bookings = bookingsPorCourt.get(court.id) ?? [];
  const [primeira, ...demais] = datas;

  if (!estaAberto(court, primeira, hora)) return { status: 'closed' };

  const intervaloDe = (data: Date) => {
    const inicio = new Date(data);
    inicio.setHours(hora, 0, 0, 0);
    const fim = new Date(data);
    fim.setHours(hora + 1, 0, 0, 0);
    return { inicio, fim };
  };

  const { inicio: primeiroInicio, fim: primeiroFim } = intervaloDe(primeira);
  if (primeiroFim <= agora && demais.length === 0) return { status: 'past' };

  const conflitoAgora = bookings.find((booking) =>
    ocupaIntervalo(booking, primeiroInicio, primeiroFim)
  );
  if (conflitoAgora) {
    return {
      status: 'busy',
      occupantName: conflitoAgora.athlete_name ?? 'Reservado',
    };
  }

  for (const data of demais) {
    const { inicio, fim } = intervaloDe(data);
    if (fim <= agora) continue;
    const conflito = bookings.find((booking) => ocupaIntervalo(booking, inicio, fim));
    if (conflito) {
      return { status: 'conflict-future', conflictDate: data };
    }
  }

  return { status: 'free' };
}

export function podeSelecionar(status: SlotStatus): boolean {
  return status === 'free';
}

export interface ResumoBloco extends Bloco {
  /** Preço de uma ocorrência, vindo do servidor. */
  valorOcorrencia: number;
  ocorrenciasMesCheio: number;
  ocorrenciasPrimeiroMes: number;
}

/** Um valor que a mensalidade assume, e quantas ocorrências o justificam. */
export interface ValorMensalPossivel {
  ocorrencias: number;
  valor: number;
}

export interface ResumoPlano {
  blocos: ResumoBloco[];
  horasSemana: number;
  valorSemana: number;
  valorMesCheio: number;
  valorPrimeiroMes: number;
  ocorrenciasPrimeiroMes: number;
  ocorrenciasMesCheio: number;
  /**
   * Valores distintos que a mensalidade assume ao longo de um ano. Um plano de
   * quinta cai em meses de 4 e de 5 quintas, então a fatura alterna — o gestor
   * precisa ver isso antes de fechar o plano.
   */
  variacaoMensal: ValorMensalPossivel[];
}

/** Quantas ocorrências dos blocos caem inteiramente num mês. */
function ocorrenciasNoMes(blocos: Bloco[], mesInicio: Date): number {
  const mesFim = fimDoMes(mesInicio);
  return blocos.reduce(
    (total, bloco) => total + ocorrencias(bloco.diaSemana, mesInicio, mesFim).length,
    0
  );
}

/** Minutos que os blocos ocupam num mês — base do rateio, igual ao banco. */
function minutosNoMes(blocos: Bloco[], mesInicio: Date): number {
  const mesFim = fimDoMes(mesInicio);
  return blocos.reduce(
    (total, bloco) =>
      total + ocorrencias(bloco.diaSemana, mesInicio, mesFim).length * bloco.hours.length * 60,
    0
  );
}

/**
 * Compõe o subtotal. `valorPrimeiroMes` espelha o pró-rata por minutos que
 * `generate_mensalista_mensalidades_atomic` aplica na primeira competência.
 */
export function resumirPlano(
  blocos: Bloco[],
  valoresPorBloco: number[],
  inicioVigencia: Date
): ResumoPlano {
  const mesAtualFim = fimDoMes(inicioVigencia);
  const referenciaInicio = mesReferencia(inicioVigencia);
  const referenciaFim = fimDoMes(referenciaInicio);

  const resumos: ResumoBloco[] = blocos.map((bloco, index) => ({
    ...bloco,
    valorOcorrencia: valoresPorBloco[index] ?? 0,
    ocorrenciasMesCheio: ocorrencias(bloco.diaSemana, referenciaInicio, referenciaFim).length,
    ocorrenciasPrimeiroMes: ocorrencias(bloco.diaSemana, inicioVigencia, mesAtualFim).length,
  }));

  let horasSemana = 0;
  let valorSemana = 0;
  let valorMesCheio = 0;
  let valorPrimeiroMes = 0;
  let ocorrenciasPrimeiroMes = 0;
  let ocorrenciasMesCheio = 0;

  for (const bloco of resumos) {
    horasSemana += bloco.hours.length;
    valorSemana += bloco.valorOcorrencia;
    valorMesCheio += bloco.valorOcorrencia * bloco.ocorrenciasMesCheio;
    valorPrimeiroMes += bloco.valorOcorrencia * bloco.ocorrenciasPrimeiroMes;
    ocorrenciasPrimeiroMes += bloco.ocorrenciasPrimeiroMes;
    ocorrenciasMesCheio += bloco.ocorrenciasMesCheio;
  }

  const mesCheioArredondado = Math.round(valorMesCheio * 100) / 100;

  // Como cada competência é proporcional aos minutos do mês, a fatura varia
  // conforme o calendário. Percorre um ano a partir da referência e reduz aos
  // valores distintos.
  const minutosReferencia = minutosNoMes(blocos, referenciaInicio);
  const porValor = new Map<number, ValorMensalPossivel>();
  if (minutosReferencia > 0) {
    for (let i = 0; i < 12; i++) {
      const mes = new Date(referenciaInicio.getFullYear(), referenciaInicio.getMonth() + i, 1);
      const minutos = minutosNoMes(blocos, mes);
      if (minutos <= 0) continue;
      const valor = Math.round(mesCheioArredondado * (minutos / minutosReferencia) * 100) / 100;
      porValor.set(valor, { ocorrencias: ocorrenciasNoMes(blocos, mes), valor });
    }
  }

  return {
    blocos: resumos,
    horasSemana,
    valorSemana,
    valorMesCheio: mesCheioArredondado,
    valorPrimeiroMes: Math.round(valorPrimeiroMes * 100) / 100,
    ocorrenciasPrimeiroMes,
    ocorrenciasMesCheio,
    variacaoMensal: [...porValor.values()].sort((a, b) => a.valor - b.valor),
  };
}

/**
 * Fração da primeira competência que será cobrada.
 *
 * Espelha `private.mensalista_month_minutes`: o numerador são os minutos que
 * ainda cabem no mês de início, contados da data de vigência; o denominador são
 * os minutos do **mês de referência** (`mesReferencia`) — o mesmo mês que
 * sugeriu a mensalidade. Usar minutos (e não número de sessões) é o que faz um
 * sábado de 2h pesar o dobro de uma terça de 1h, igual ao banco.
 *
 * O denominador NÃO é o mês de início: um plano que começa em setembro (4
 * quintas) com mensalidade calculada sobre outubro (5 quintas) cobraria 1/4 do
 * mês por sessão, e não 1/5 — 25% a mais do que o combinado.
 */
export function fracaoPrimeiroMes(blocos: Bloco[], inicioVigencia: Date): number {
  const mesFim = fimDoMes(inicioVigencia);
  const referenciaInicio = mesReferencia(inicioVigencia);
  const referenciaFim = fimDoMes(referenciaInicio);

  let minutosReferencia = 0;
  let minutosRestantes = 0;

  for (const bloco of blocos) {
    const duracao = bloco.hours.length * 60;
    minutosReferencia +=
      ocorrencias(bloco.diaSemana, referenciaInicio, referenciaFim).length * duracao;
    minutosRestantes += ocorrencias(bloco.diaSemana, inicioVigencia, mesFim).length * duracao;
  }

  if (minutosReferencia <= 0) return 0;
  return Math.min(1, minutosRestantes / minutosReferencia);
}

/**
 * Data-base para cotar um bloco: a primeira ocorrência do dia da semana a
 * partir do início da vigência. O horário vai no fuso do navegador do gestor,
 * que é o mesmo que `resolve_court_price` converte para America/Sao_Paulo.
 */
export function intervaloDeCotacao(
  bloco: Bloco,
  inicioVigencia: Date
): { startISO: string; endISO: string } {
  const [primeira] = ocorrencias(bloco.diaSemana, inicioVigencia, fimDoHorizonte(inicioVigencia));
  const base = primeira ?? inicioVigencia;

  const inicio = new Date(base);
  inicio.setHours(bloco.from, 0, 0, 0);
  const fim = new Date(base);
  fim.setHours(bloco.to, 0, 0, 0);

  return { startISO: inicio.toISOString(), endISO: fim.toISOString() };
}
