"use client"

import { useEffect, useState, useTransition, type FormEvent, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Building2, EyeOff, FileSearch, LoaderCircle, MapPin, Plus, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { isValidCnpj, onlyDigits } from "@/lib/brasil-document"
import {
  createPublicArenaListingAction,
  getPublicArenaListingFormOptionsAction,
  getPublicArenaMunicipalitiesAction,
} from "@/modules/platform-admin/actions/platformAdminActions"
import type {
  PlatformReferenceMunicipality,
  PublicArenaListingFormOptions,
} from "@/modules/platform-admin/types/platform-admin.types"

type FormState = {
  name: string
  cnpj: string
  address: string
  number: string
  complement: string
  neighborhood: string
  zipCode: string
  stateCode: number | null
  municipalityId: number | null
  phone: string
  email: string
  description: string
  sportIds: string[]
  platformNotes: string
  reason: string
}

type CnpjLookupData = {
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

const EMPTY_FORM: FormState = {
  name: "",
  cnpj: "",
  address: "",
  number: "",
  complement: "",
  neighborhood: "",
  zipCode: "",
  stateCode: null,
  municipalityId: null,
  phone: "",
  email: "",
  description: "",
  sportIds: [],
  platformNotes: "",
  reason: "Cadastro manual para ampliar o catálogo público",
}

function FieldLabel({ htmlFor, children, optional = false }: { htmlFor: string; children: ReactNode; optional?: boolean }) {
  return <Label htmlFor={htmlFor} className="mb-2 text-xs font-bold text-slate-700">{children}{optional && <span className="font-normal text-slate-400"> — opcional</span>}</Label>
}

export function PublicArenaListingDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [municipalitiesLoading, setMunicipalitiesLoading] = useState(false)
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [options, setOptions] = useState<PublicArenaListingFormOptions | null>(null)
  const [municipalities, setMunicipalities] = useState<PlatformReferenceMunicipality[]>([])
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  useEffect(() => {
    if (!open || options) return
    let active = true
    setOptionsLoading(true)
    void getPublicArenaListingFormOptionsAction().then((result) => {
      if (!active) return
      setOptionsLoading(false)
      if (!result.success || !result.data) {
        toast.error(result.error ?? "Não foi possível carregar os dados do formulário.")
        return
      }
      setOptions(result.data)
    })
    return () => { active = false }
  }, [open, options])

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function loadMunicipalities(stateCode: number, municipalityId: number | null = null) {
    setMunicipalitiesLoading(true)
    const result = await getPublicArenaMunicipalitiesAction(stateCode)
    setMunicipalitiesLoading(false)
    if (!result.success) {
      setMunicipalities([])
      toast.error(result.error ?? "Não foi possível carregar os municípios.")
      return false
    }
    const selectedMunicipality = result.data.some((item) => item.code === municipalityId) ? municipalityId : null
    setMunicipalities(result.data)
    setForm((current) => ({ ...current, stateCode, municipalityId: selectedMunicipality }))
    return true
  }

  async function lookupCnpj() {
    const cnpj = onlyDigits(form.cnpj)
    if (!isValidCnpj(cnpj)) {
      toast.error("Informe um CNPJ válido antes de consultar.")
      return
    }

    setCnpjLoading(true)
    try {
      const response = await fetch(`/api/lookup-cnpj?cnpj=${encodeURIComponent(cnpj)}`)
      const payload = await response.json() as { data?: CnpjLookupData; error?: string }
      if (!response.ok || !payload.data) {
        toast.error(payload.error ?? "Não foi possível consultar o CNPJ.")
        return
      }

      const data = payload.data
      const state = options?.states.find((item) => item.uf === data.uf)
      setForm((current) => ({
        ...current,
        name: data.nomeFantasia?.trim() || data.razaoSocial || current.name,
        cnpj: data.cnpj,
        address: data.logradouro || current.address,
        number: ["S/N", "SN"].includes(data.numero.trim().toUpperCase()) ? "" : data.numero,
        complement: data.complemento ?? "",
        neighborhood: data.bairro || current.neighborhood,
        zipCode: data.cep || current.zipCode,
      }))

      if (state) await loadMunicipalities(state.code, data.codigoMunicipioIbge)
      toast.success("Dados carregados. Revise tudo antes de criar o local.")
    } catch {
      toast.error("Falha ao consultar o CNPJ. Tente novamente.")
    } finally {
      setCnpjLoading(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.stateCode || !form.municipalityId) {
      toast.error("Selecione o estado e o município.")
      return
    }
    if (form.sportIds.length === 0) {
      toast.error("Selecione ao menos um esporte.")
      return
    }

    startTransition(async () => {
      const result = await createPublicArenaListingAction({
        ...form,
        stateCode: form.stateCode!,
        municipalityId: form.municipalityId!,
      })
      if (!result.success) {
        toast.error(result.error ?? "Não foi possível criar o local público.")
        return
      }

      toast.success("Local público criado e mantido oculto no aplicativo.")
      setForm(EMPTY_FORM)
      setMunicipalities([])
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!pending) setOpen(nextOpen) }}>
      <DialogTrigger asChild>
        <Button className="h-11 rounded-xl bg-orange-500 px-4 font-bold text-slate-950 shadow-sm hover:bg-orange-400">
          <Plus className="h-4 w-4" />Adicionar local público
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-4xl flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-slate-50 p-0 shadow-2xl">
        <DialogHeader className="relative overflow-hidden bg-[#07141d] px-6 py-6 pr-14 text-left text-white sm:px-8">
          <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full border-[32px] border-orange-500/10" />
          <div className="relative flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-500 text-slate-950"><MapPin className="h-5 w-5" /></div>
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[.22em] text-orange-300">Catálogo nacional</p>
              <DialogTitle className="mt-1 font-heading text-2xl font-black">Adicionar local público</DialogTitle>
              <DialogDescription className="mt-2 max-w-2xl leading-5 text-slate-400">
                Cadastre um local que poderá ser revisado antes de aparecer para os atletas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="overflow-y-auto px-5 py-5 sm:px-8">
            <div className="mb-6 grid gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950 sm:grid-cols-[auto_1fr]">
              <EyeOff className="mt-0.5 h-5 w-5 text-sky-700" />
              <div><p className="font-bold">O local nasce oculto no aplicativo.</p><p className="mt-1 text-xs leading-5 text-sky-800">Este cadastro não cria cliente, proprietário, assinatura, quadras ou acesso ao backoffice. A publicação será uma etapa separada.</p></div>
            </div>

            {optionsLoading && <div className="mb-6 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Carregando estados e esportes…</div>}

            <div className="space-y-7">
              <section>
                <div className="mb-4 flex items-center gap-2"><Building2 className="h-4 w-4 text-orange-600" /><h3 className="font-heading text-lg font-black text-slate-950">Identificação</h3></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><FieldLabel htmlFor="public-arena-name">Nome do local</FieldLabel><Input id="public-arena-name" required value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Ex.: Arena Beira-Mar" className="bg-white" /></div>
                  <div><FieldLabel htmlFor="public-arena-cnpj" optional>CNPJ</FieldLabel><div className="flex gap-2"><Input id="public-arena-cnpj" value={form.cnpj} onChange={(event) => updateField("cnpj", event.target.value)} placeholder="00.000.000/0000-00" className="bg-white" /><Button type="button" variant="outline" onClick={() => void lookupCnpj()} disabled={cnpjLoading || !options} className="shrink-0 bg-white">{cnpjLoading ? <LoaderCircle className="animate-spin" /> : <FileSearch />}<span className="hidden sm:inline">Consultar</span></Button></div></div>
                </div>
              </section>

              <section className="border-t border-slate-200 pt-6">
                <div className="mb-4 flex items-center gap-2"><MapPin className="h-4 w-4 text-orange-600" /><h3 className="font-heading text-lg font-black text-slate-950">Localização</h3></div>
                <div className="grid gap-4 sm:grid-cols-6">
                  <div className="sm:col-span-4"><FieldLabel htmlFor="public-arena-address">Logradouro</FieldLabel><Input id="public-arena-address" required value={form.address} onChange={(event) => updateField("address", event.target.value)} placeholder="Rua, avenida ou rodovia" className="bg-white" /></div>
                  <div className="sm:col-span-2"><FieldLabel htmlFor="public-arena-number" optional>Número</FieldLabel><Input id="public-arena-number" value={form.number} onChange={(event) => updateField("number", event.target.value)} className="bg-white" /></div>
                  <div className="sm:col-span-2"><FieldLabel htmlFor="public-arena-neighborhood" optional>Bairro</FieldLabel><Input id="public-arena-neighborhood" value={form.neighborhood} onChange={(event) => updateField("neighborhood", event.target.value)} className="bg-white" /></div>
                  <div className="sm:col-span-2"><FieldLabel htmlFor="public-arena-complement" optional>Complemento</FieldLabel><Input id="public-arena-complement" value={form.complement} onChange={(event) => updateField("complement", event.target.value)} className="bg-white" /></div>
                  <div className="sm:col-span-2"><FieldLabel htmlFor="public-arena-zip" optional>CEP</FieldLabel><Input id="public-arena-zip" inputMode="numeric" value={form.zipCode} onChange={(event) => updateField("zipCode", event.target.value)} placeholder="00000-000" className="bg-white" /></div>
                  <div className="sm:col-span-3"><FieldLabel htmlFor="public-arena-state">Estado</FieldLabel><select id="public-arena-state" required value={form.stateCode ?? ""} onChange={(event) => { const code = Number(event.target.value); setMunicipalities([]); setForm((current) => ({ ...current, stateCode: code || null, municipalityId: null })); if (code) void loadMunicipalities(code) }} disabled={!options || optionsLoading} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"><option value="">Selecionar UF</option>{options?.states.map((state) => <option key={state.code} value={state.code}>{state.name} ({state.uf})</option>)}</select></div>
                  <div className="sm:col-span-3"><FieldLabel htmlFor="public-arena-city">Município</FieldLabel><select id="public-arena-city" required value={form.municipalityId ?? ""} onChange={(event) => updateField("municipalityId", Number(event.target.value) || null)} disabled={!form.stateCode || municipalitiesLoading} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"><option value="">{municipalitiesLoading ? "Carregando…" : "Selecionar município"}</option>{municipalities.map((municipality) => <option key={municipality.code} value={municipality.code}>{municipality.name}</option>)}</select></div>
                </div>
              </section>

              <section className="border-t border-slate-200 pt-6">
                <h3 className="mb-4 font-heading text-lg font-black text-slate-950">Contato e apresentação</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><FieldLabel htmlFor="public-arena-phone" optional>Telefone</FieldLabel><Input id="public-arena-phone" type="tel" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder="(00) 00000-0000" className="bg-white" /></div>
                  <div><FieldLabel htmlFor="public-arena-email" optional>E-mail público</FieldLabel><Input id="public-arena-email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} placeholder="contato@local.com.br" className="bg-white" /></div>
                  <div className="sm:col-span-2"><FieldLabel htmlFor="public-arena-description" optional>Descrição para o catálogo</FieldLabel><Textarea id="public-arena-description" value={form.description} onChange={(event) => updateField("description", event.target.value)} placeholder="Estrutura, modalidades e informações úteis para o atleta." className="min-h-24 bg-white" /></div>
                </div>
              </section>

              <section className="border-t border-slate-200 pt-6">
                <h3 className="font-heading text-lg font-black text-slate-950">Esportes disponíveis</h3>
                <p className="mt-1 text-xs text-slate-500">Selecione ao menos uma modalidade para qualificar a busca.</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {options?.sports.map((sport) => {
                    const checked = form.sportIds.includes(sport.id)
                    return <label key={sport.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold transition hover:border-orange-300 hover:bg-orange-50"><Checkbox checked={checked} onCheckedChange={(next) => updateField("sportIds", next ? [...form.sportIds, sport.id] : form.sportIds.filter((id) => id !== sport.id))} /><span>{sport.name}</span></label>
                  })}
                </div>
              </section>

              <section className="border-t border-slate-200 pt-6">
                <div className="mb-4 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-orange-600" /><h3 className="font-heading text-lg font-black text-slate-950">Governança interna</h3></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><FieldLabel htmlFor="public-arena-notes" optional>Notas internas</FieldLabel><Textarea id="public-arena-notes" value={form.platformNotes} onChange={(event) => updateField("platformNotes", event.target.value)} placeholder="Fonte, pendências de revisão ou contexto comercial." className="min-h-24 bg-white" /></div>
                  <div><FieldLabel htmlFor="public-arena-reason">Motivo para auditoria</FieldLabel><Textarea id="public-arena-reason" required minLength={8} value={form.reason} onChange={(event) => updateField("reason", event.target.value)} className="min-h-24 bg-white" /></div>
                </div>
              </section>
            </div>
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-xs text-slate-500">Origem registrada: <strong>manual</strong></p>
            <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button><Button type="submit" disabled={pending || optionsLoading || !options} className="bg-orange-500 font-bold text-slate-950 hover:bg-orange-400">{pending ? <LoaderCircle className="animate-spin" /> : <Plus />}{pending ? "Criando…" : "Criar local oculto"}</Button></div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
