import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate as flush } from 'node:timers/promises'
import { hookController } from './helpers/hook-controller.mjs'

const pendente = {
  calendario: { agendaStatus: 'conflito' },
  porBlocos: false, mensalidadeStatus: 'aberto', valorAtual: 400, valorSugerido: 500,
}
const resposta = (linhas = [pendente]) => ({ success: true, data: { linhas } })

function setup() {
  const chamadas = []
  const args = ['arena-a', '2026-11']
  const hook = hookController('src/modules/mensalistas/use-aviso-reajuste-mes.ts', 'useAvisoReajusteMes', args, {
    '@/modules/mensalistas/actions/mensalistaActions': {
      getReajusteMesPreviewAction: (arenaId, competencia) => new Promise((resolve, reject) => {
        chamadas.push({ arenaId, competencia, resolve, reject })
      }),
    },
  })
  return { hook, chamadas, args }
}

test('abre a revisão após a prévia; fechar e recontar não reabre nesta visita', async () => {
  const { hook, chamadas } = setup()
  assert.equal(hook.render().carregando, true)
  assert.equal(hook.render().aberto, false)
  chamadas[0].resolve(resposta())
  await flush()
  assert.equal(hook.render().aberto, true)
  assert.equal(hook.render().total, 1)
  hook.render().fechar()
  hook.render().atualizar()
  hook.render()
  chamadas[1].resolve(resposta())
  await flush()
  assert.equal(hook.render().aberto, false)
  assert.equal(hook.render().total, 1)
  hook.render().abrir()
  assert.equal(hook.render().aberto, true)
})

test('revisão manual durante a consulta não volta a abrir quando a resposta chega', async () => {
  const { hook, chamadas } = setup()
  hook.render().abrir()
  hook.render().fechar()
  chamadas[0].resolve(resposta())
  await flush()
  assert.equal(hook.render().aberto, false)
  assert.equal(hook.render().total, 1)
})

test('sem diferença, quitadas, canceladas e blocos não abrem revisão', async () => {
  const { hook, chamadas } = setup()
  hook.render()
  chamadas[0].resolve(resposta([
    { ...pendente, calendario: { agendaStatus: 'preparada' }, valorAtual: 500 },
    { ...pendente, mensalidadeStatus: 'quitado' },
    { ...pendente, mensalidadeStatus: 'cancelado' },
    { ...pendente, calendario: { agendaStatus: 'preparada', revisadoEm: null }, porBlocos: true },
  ]))
  await flush()
  assert.equal(hook.render().total, 0)
  assert.equal(hook.render().aberto, false)
  assert.equal(hook.render().carregando, false)
})

test('erro ou rejeição permitem tentar de novo e não consomem a abertura automática', async () => {
  for (const rejeitar of [false, true]) {
    const { hook, chamadas } = setup()
    hook.render()
    if (rejeitar) chamadas[0].reject(new Error('offline'))
    else chamadas[0].resolve({ success: false, error: 'Sem permissão' })
    await flush()
    assert.equal(hook.render().erro, true)
    assert.equal(hook.render().aberto, false)
    hook.render().atualizar()
    assert.equal(hook.render().carregando, true)
    chamadas[1].resolve(resposta())
    await flush()
    assert.equal(hook.render().erro, false)
    assert.equal(hook.render().aberto, true)
  }
})

test('trocar arena ou mês descarta respostas antigas e permite novo aviso', async () => {
  const { hook, chamadas, args } = setup()
  hook.render()
  args[1] = '2026-12'
  hook.render()
  chamadas[0].resolve(resposta())
  await flush()
  assert.equal(hook.render().aberto, false)
  assert.equal(hook.render().carregando, true)
  chamadas[1].resolve(resposta())
  await flush()
  assert.equal(hook.render().aberto, true)
  hook.render().fechar()
  args[0] = 'arena-b'
  assert.equal(hook.render().total, 0)
  chamadas[2].resolve(resposta())
  await flush()
  assert.equal(hook.render().aberto, true)
})

test('atualizar após aplicar remove o aviso e preserva a tela de resultado', async () => {
  const { hook, chamadas } = setup()
  hook.render()
  chamadas[0].resolve(resposta())
  await flush()
  hook.render().atualizar()
  hook.render()
  chamadas[1].resolve(resposta([{ ...pendente, calendario: { agendaStatus: 'preparada' }, valorAtual: 500 }]))
  await flush()
  assert.equal(hook.render().total, 0)
  assert.equal(hook.render().aberto, true)
})

test('voltar a um mês já apresentado não ressuscita um modal antigo', async () => {
  const { hook, chamadas, args } = setup()
  hook.render()
  chamadas[0].resolve(resposta())
  await flush()
  assert.equal(hook.render().aberto, true)
  args[1] = '2026-12'
  hook.render()
  chamadas[1].resolve(resposta([]))
  await flush()
  args[1] = '2026-11'
  assert.equal(hook.render().aberto, false)
  chamadas[2].resolve(resposta())
  await flush()
  assert.equal(hook.render().aberto, false)
  assert.equal(hook.render().total, 1)
})

test('sair da página antes da resposta descarta a consulta', async () => {
  const { hook, chamadas } = setup()
  hook.render()
  hook.unmount()
  chamadas[0].resolve(resposta())
  await flush()
  assert.equal(hook.render().aberto, false)
  assert.equal(hook.render().total, 0)
})

 test('diferença de calendário sem exceção não pede confirmação', async () => {
  const { hook, chamadas } = setup()
  hook.render()
  chamadas[0].resolve(resposta([{ ...pendente, calendario: { agendaStatus: 'preparada', revisadoEm: null } }]))
  await flush()
  assert.equal(hook.render().aberto, false)
  assert.equal(hook.render().total, 0)
})
test('pendência financeira abre com motivo e pode ser resolvida sem lote de ajuste', async () => {
  const { hook, chamadas } = setup()
  hook.render()
  chamadas[0].resolve(resposta([{ ...pendente, calendario: { agendaStatus: 'preparada', cobrancaErro: 'Confira o rateio' } }]))
  await flush()
  assert.equal(hook.render().aberto, true)
  assert.equal(hook.render().linhas[0].calendario.cobrancaErro, 'Confira o rateio')
})
