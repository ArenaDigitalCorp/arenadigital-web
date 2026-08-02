"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { updateArenaPixSplitSettingsAction } from "@/modules/arenas/actions/arenaActions"
import type { ArenaPixSplitSettings } from "@/modules/arenas/types/pix-split.types"
import { AlertCircle, CheckCircle2, Loader2, WalletCards } from "lucide-react"
import { toast } from "sonner"

interface Props {
    arenaId: string
    initialSettings: ArenaPixSplitSettings
}

function statusBadge(settings: ArenaPixSplitSettings) {
    if (settings.enabled) {
        return {
            label: "Pix ativo",
            className: "bg-emerald-100 text-emerald-800 border-transparent",
            icon: CheckCircle2,
        }
    }
    return {
        label: "Pix inativo",
        className: "bg-amber-100 text-amber-900 border-transparent",
        icon: AlertCircle,
    }
}

export function ArenaPixSplitSettingsCard({ arenaId, initialSettings }: Props) {
    const [settings, setSettings] = useState<ArenaPixSplitSettings>(initialSettings)
    const [form, setForm] = useState<ArenaPixSplitSettings>(initialSettings)
    const [saving, setSaving] = useState(false)
    const badge = statusBadge(settings)
    const BadgeIcon = badge.icon

    const setField = (field: keyof ArenaPixSplitSettings, value: string | boolean | number) => {
        setForm((prev) => ({ ...prev, [field]: value }))
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setSaving(true)
        try {
            const res = await updateArenaPixSplitSettingsAction(arenaId, {
                enabled: form.enabled,
                asaasWalletId: form.asaasWalletId,
                asaasAccountId: form.asaasAccountId,
                holderName: form.holderName,
                holderDocument: form.holderDocument,
                pixKey: form.pixKey,
                platformFeeBasisPoints: form.platformFeeBasisPoints,
            })

            if (!res.success) throw new Error(res.error)

            setSettings(res.data)
            setForm(res.data)
            toast.success(res.data.enabled ? "Pix com split ativado para reservas do app." : "Pix com split desativado.")
        } catch (error) {
            const message = error instanceof Error ? error.message : "Não foi possível salvar a configuração Pix."
            toast.error(message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <Card className="border-orange-100 bg-orange-50/30">
            <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <WalletCards className="h-5 w-5 text-arena-button" />
                        <CardTitle>Pix das reservas no app</CardTitle>
                    </div>
                    <CardDescription>
                        Configure a wallet Asaas da arena e defina o percentual de cada novo pagamento destinado à Arena Digital.
                    </CardDescription>
                </div>
                <Badge className={badge.className}>
                    <BadgeIcon className="h-3.5 w-3.5" />
                    {badge.label}
                </Badge>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="flex items-start justify-between gap-4 rounded-lg border bg-white p-4">
                        <div className="space-y-1">
                            <Label htmlFor="app-pix-enabled">Ativar Pix com split para reservas mobile</Label>
                            <p className="text-sm text-muted-foreground">
                                Quando ativo, reservas pagas no app geram QR Pix no Asaas e só confirmam agenda após
                                pagamento.
                            </p>
                        </div>
                        <Switch
                            id="app-pix-enabled"
                            checked={form.enabled}
                            onCheckedChange={(checked) => setField("enabled", checked)}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="asaas-wallet-id">Wallet ID Asaas da arena</Label>
                            <Input
                                id="asaas-wallet-id"
                                value={form.asaasWalletId}
                                onChange={(event) => setField("asaasWalletId", event.target.value)}
                                placeholder="Ex.: 6f2d9d30-..."
                                autoComplete="off"
                            />
                            <p className="text-xs text-muted-foreground">
                                Obrigatório para ativar o split. Esse é o identificador da carteira destino dentro do
                                Asaas.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="platform-split-fee">Taxa Arena Digital (%)</Label>
                            <Input
                                id="platform-split-fee"
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={(form.platformFeeBasisPoints / 100).toFixed(2)}
                                onChange={(event) => setField("platformFeeBasisPoints", Math.round(Number(event.target.value) * 100))}
                                inputMode="decimal"
                            />
                            <p className="text-xs text-muted-foreground">A alteração vale somente para pagamentos criados depois de salvar.</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="asaas-account-id">ID da conta Asaas</Label>
                            <Input
                                id="asaas-account-id"
                                value={form.asaasAccountId}
                                onChange={(event) => setField("asaasAccountId", event.target.value)}
                                placeholder="Opcional"
                                autoComplete="off"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="asaas-pix-key">Chave Pix da arena</Label>
                            <Input
                                id="asaas-pix-key"
                                value={form.pixKey}
                                onChange={(event) => setField("pixKey", event.target.value)}
                                placeholder="Opcional para conferência interna"
                                autoComplete="off"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="asaas-holder-name">Titular</Label>
                            <Input
                                id="asaas-holder-name"
                                value={form.holderName}
                                onChange={(event) => setField("holderName", event.target.value)}
                                placeholder="Nome/Razão social"
                                autoComplete="off"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="asaas-holder-document">CPF/CNPJ do titular</Label>
                            <Input
                                id="asaas-holder-document"
                                value={form.holderDocument}
                                onChange={(event) => setField("holderDocument", event.target.value)}
                                placeholder="Somente números ou formatado"
                                inputMode="numeric"
                                autoComplete="off"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 rounded-lg border border-orange-100 bg-white p-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
                        <span>
                            Taxa Arena Digital: <strong className="text-arena-navy-800">{(form.platformFeeBasisPoints / 100).toFixed(2)}%</strong>. Repasse arena:{" "}
                            <strong className="text-arena-navy-800">{((10000 - form.platformFeeBasisPoints) / 100).toFixed(2)}%</strong>.
                        </span>
                        <Button
                            type="submit"
                            className="bg-arena-button text-white hover:bg-arena-button-hover md:min-w-[180px]"
                            disabled={saving}
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                "Salvar Pix do app"
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
