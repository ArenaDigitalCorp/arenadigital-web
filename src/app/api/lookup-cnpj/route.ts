import { isValidCnpj, onlyDigits } from '@/lib/brasil-document'
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

const BRASIL_API_CNPJ = 'https://brasilapi.com.br/api/cnpj/v1'

export type CnpjLookupPayload = {
  cnpj: string
  razaoSocial: string
  nomeFantasia: string | null
  cep: string
  logradouro: string
  numero: string
  complemento: string | null
  bairro: string
  uf: string | null
  codigoMunicipioIbge: number | null
}

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const raw = request.nextUrl.searchParams.get('cnpj')
  const cnpj = onlyDigits(raw ?? '')
  if (cnpj.length !== 14 || !isValidCnpj(cnpj)) {
    return NextResponse.json({ error: 'CNPJ inválido.' }, { status: 400 })
  }

  try {
    const upstream = await fetch(`${BRASIL_API_CNPJ}/${cnpj}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })

    const text = await upstream.text()
    let body: unknown
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      return NextResponse.json(
        { error: 'Resposta inválida da consulta de CNPJ.' },
        { status: 502 }
      )
    }

    if (!upstream.ok) {
      const msg =
        body &&
        typeof body === 'object' &&
        'message' in body &&
        typeof (body as { message: unknown }).message === 'string'
          ? (body as { message: string }).message
          : 'Não foi possível consultar o CNPJ.'
      return NextResponse.json({ error: msg }, { status: upstream.status })
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Dados do CNPJ não encontrados.' }, { status: 404 })
    }

    const b = body as Record<string, unknown>
    const codigoMunicipioIbge =
      typeof b.codigo_municipio_ibge === 'number'
        ? b.codigo_municipio_ibge
        : typeof b.codigo_municipio === 'number'
          ? b.codigo_municipio
          : null

    const payload: CnpjLookupPayload = {
      cnpj: typeof b.cnpj === 'string' ? onlyDigits(b.cnpj) : cnpj,
      razaoSocial: typeof b.razao_social === 'string' ? b.razao_social : '',
      nomeFantasia: typeof b.nome_fantasia === 'string' ? b.nome_fantasia : null,
      cep: typeof b.cep === 'string' ? onlyDigits(b.cep) : '',
      logradouro: typeof b.logradouro === 'string' ? b.logradouro : '',
      numero: typeof b.numero === 'string' ? b.numero : '',
      complemento: typeof b.complemento === 'string' ? b.complemento : null,
      bairro: typeof b.bairro === 'string' ? b.bairro : '',
      uf: typeof b.uf === 'string' ? b.uf : null,
      codigoMunicipioIbge,
    }

    return NextResponse.json({ data: payload })
  } catch (e) {
    console.error('[lookup-cnpj]', e)
    return NextResponse.json(
      { error: 'Falha ao consultar CNPJ. Tente novamente.' },
      { status: 500 }
    )
  }
}
