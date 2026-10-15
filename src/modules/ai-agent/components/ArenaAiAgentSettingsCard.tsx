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
import { Textarea } from "@/components/ui/textarea"
import {
    connectChannelAction,
    disconnectChannelAction,
    toggleAgentAction,
    updateAgentConfigAction,
    type AgentSettings,
} from "@/modules/ai-agent/actions/agentActions"
import { Bot, CheckCircle2, Loader2, MessageCircle, PlugZap, Power } from "lucide-react"
import { toast } from "sonner"

interface Props {
    arenaId: string
    initialSettings: AgentSettings
}

interface ConnectForm {
    phoneNumberId: string
    wabaId: string
    displayPhoneNumber: string
    verifiedName: string
    accessToken: string
}

const EMPTY_CONNECT: ConnectForm = {
    phoneNumberId: "",
    wabaId: "",
    displayPhoneNumber: "",
    verifiedName: "",
    accessToken: "",
}

export function ArenaAiAgentSettingsCard({ arenaId, initialSettings }: Props) {
    const [settings, setSettings] = useState<AgentSettings>(initialSettings)
    const [persona, setPersona] = useState(settings.agent.personaPrompt ?? "")
    const [fallback, setFallback] = useState(settings.agent.fallbackMessage ?? "")
    const [monthlyCap, setMonthlyCap] = useState(
        settings.agent.monthlyTokenCap != null ? String(settings.agent.monthlyTokenCap) : ""
    )
    const [connect, setConnect] = useState<ConnectForm>(EMPTY_CONNECT)

    const [savingConfig, setSavingConfig] = useState(false)
    const [connecting, setConnecting] = useState(false)
    const [toggling, setToggling] = useState(false)

    const channel = settings.channel
    const isConnected = channel?.status === "connected"
    const enabled = settings.agent.enabled

    async function handleToggle(next: boolean) {
        setToggling(true)
        try {
            const res = await toggleAgentAction(arenaId, next)
            if (!res.success || !res.data) throw new Error(res.error)
            setSettings((prev) => ({ ...prev, agent: res.data! }))
            toast.success(next ? "Agente ativado." : "Agente desativado.")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível alterar o agente.")
        } finally {
            setToggling(false)
        }
    }

    async function handleSaveConfig(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setSavingConfig(true)
        try {
            const capText = monthlyCap.trim()
            const capValue = capText ? Number(capText) : null
            if (capValue != null && (!/^\d+$/.test(capText) || !Number.isSafeInteger(capValue) || capValue <= 0 || capValue > 2_147_483_647)) {
                throw new Error("O teto mensal de tokens deve ser um número inteiro entre 1 e 2.147.483.647.")
            }
            const res = await updateAgentConfigAction(arenaId, {
                personaPrompt: persona.trim() || null,
                model: settings.agent.model,
                temperature: settings.agent.temperature,
                maxOutputTokens: settings.agent.maxOutputTokens,
                monthlyTokenCap: capValue,
                fallbackMessage: fallback.trim() || null,
            })
            if (!res.success || !res.data) throw new Error(res.error)
            setSettings((prev) => ({ ...prev, agent: res.data! }))
            toast.success("Configuração do agente salva.")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível salvar.")
        } finally {
            setSavingConfig(false)
        }
    }

    async function handleConnect(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setConnecting(true)
        try {
            const res = await connectChannelAction({
                arenaId,
                phoneNumberId: connect.phoneNumberId.trim(),
                wabaId: connect.wabaId.trim(),
                displayPhoneNumber: connect.displayPhoneNumber.trim() || null,
                verifiedName: connect.verifiedName.trim() || null,
                accessToken: connect.accessToken.trim(),
            })
            if (!res.success || !res.data) throw new Error(res.error)
            setSettings((prev) => ({ ...prev, channel: res.data! }))
            setConnect(EMPTY_CONNECT)
            toast.success("Número de WhatsApp conectado.")
            if (res.warning) toast.warning(res.warning)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível conectar o número.")
        } finally {
            setConnecting(false)
        }
    }

    async function handleDisconnect() {
        setConnecting(true)
        try {
            const res = await disconnectChannelAction(arenaId)
            if (!res.success) throw new Error(res.error)
            setSettings((prev) => ({
                ...prev,
                channel: null,
                agent: { ...prev.agent, enabled: false },
            }))
            toast.success("Número desconectado.")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível desconectar.")
        } finally {
            setConnecting(false)
        }
    }

    return (
        <Card className="border-sky-100 bg-sky-50/30">
            <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-arena-button" />
                        <CardTitle>Agente de IA (WhatsApp)</CardTitle>
                    </div>
                    <CardDescription>
                        Conecte o WhatsApp da arena e deixe um agente responder automaticamente sobre horários,
                        quadras, preços e disponibilidade.
                    </CardDescription>
                </div>
                <Badge
                    className={
                        enabled
                            ? "bg-emerald-100 text-emerald-800 border-transparent"
                            : "bg-slate-100 text-slate-700 border-transparent"
                    }
                >
                    <Power className="h-3.5 w-3.5" />
                    {enabled ? "Agente ativo" : "Agente inativo"}
                </Badge>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Conexão do WhatsApp */}
                <div className="space-y-4 rounded-lg border bg-white p-4">
                    <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-arena-button" />
                        <h3 className="font-semibold">Conexão do WhatsApp</h3>
                    </div>

                    {isConnected && channel ? (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1 text-sm">
                                <p className="flex items-center gap-2 font-medium text-emerald-700">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Número conectado
                                </p>
                                <p className="text-muted-foreground">
                                    {channel.displayPhoneNumber ?? channel.phoneNumberId}
                                    {channel.verifiedName ? ` · ${channel.verifiedName}` : ""}
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleDisconnect}
                                disabled={connecting}
                            >
                                {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Desconectar
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleConnect} className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Informe os dados do número no painel do Meta (WhatsApp Business). Um número só pode
                                ser vinculado a uma arena.
                            </p>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="wa-phone-number-id">Phone Number ID</Label>
                                    <Input
                                        id="wa-phone-number-id"
                                        value={connect.phoneNumberId}
                                        onChange={(e) =>
                                            setConnect((p) => ({ ...p, phoneNumberId: e.target.value }))
                                        }
                                        placeholder="Ex.: 1234567890"
                                        autoComplete="off"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="wa-waba-id">WhatsApp Business Account ID</Label>
                                    <Input
                                        id="wa-waba-id"
                                        value={connect.wabaId}
                                        onChange={(e) => setConnect((p) => ({ ...p, wabaId: e.target.value }))}
                                        placeholder="Ex.: 9876543210"
                                        autoComplete="off"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="wa-display">Número exibido (opcional)</Label>
                                    <Input
                                        id="wa-display"
                                        value={connect.displayPhoneNumber}
                                        onChange={(e) =>
                                            setConnect((p) => ({ ...p, displayPhoneNumber: e.target.value }))
                                        }
                                        placeholder="+55 11 99999-9999"
                                        autoComplete="off"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="wa-verified">Nome verificado (opcional)</Label>
                                    <Input
                                        id="wa-verified"
                                        value={connect.verifiedName}
                                        onChange={(e) =>
                                            setConnect((p) => ({ ...p, verifiedName: e.target.value }))
                                        }
                                        placeholder="Nome da arena no WhatsApp"
                                        autoComplete="off"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="wa-token">Token de acesso</Label>
                                    <Input
                                        id="wa-token"
                                        type="password"
                                        value={connect.accessToken}
                                        onChange={(e) =>
                                            setConnect((p) => ({ ...p, accessToken: e.target.value }))
                                        }
                                        placeholder="Token permanente do sistema (Meta)"
                                        autoComplete="off"
                                        required
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Guardado de forma cifrada. Nunca é exibido novamente após salvar.
                                    </p>
                                </div>
                            </div>
                            <Button
                                type="submit"
                                className="bg-arena-button text-white hover:bg-arena-button-hover"
                                disabled={connecting}
                            >
                                {connecting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Conectando...
                                    </>
                                ) : (
                                    <>
                                        <PlugZap className="mr-2 h-4 w-4" />
                                        Conectar número
                                    </>
                                )}
                            </Button>
                        </form>
                    )}
                </div>

                {/* Liga/desliga + configuração do agente */}
                <form onSubmit={handleSaveConfig} className="space-y-5">
                    <div className="flex items-start justify-between gap-4 rounded-lg border bg-white p-4">
                        <div className="space-y-1">
                            <Label htmlFor="agent-enabled">Ativar o agente</Label>
                            <p className="text-sm text-muted-foreground">
                                Quando ativo, o agente responde automaticamente as mensagens recebidas neste número.
                            </p>
                        </div>
                        <Switch
                            id="agent-enabled"
                            checked={enabled}
                            disabled={toggling || !isConnected}
                            onCheckedChange={handleToggle}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="agent-persona">Personalidade do agente</Label>
                        <Textarea
                            id="agent-persona"
                            value={persona}
                            onChange={(e) => setPersona(e.target.value)}
                            placeholder="Ex.: Você é simpático e objetivo, chama o cliente pelo nome, usa uma linguagem informal e sempre convida a conhecer a arena."
                            rows={5}
                            maxLength={4000}
                        />
                        <p className="text-xs text-muted-foreground">
                            Descreva o tom e a personalidade. As regras de segurança e o escopo (horários, quadras,
                            preços, disponibilidade) já são aplicados automaticamente.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="agent-fallback">Mensagem de fallback (opcional)</Label>
                            <Input
                                id="agent-fallback"
                                value={fallback}
                                onChange={(e) => setFallback(e.target.value)}
                                placeholder="Resposta quando estiver fora do escopo"
                                maxLength={1000}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="agent-cap">Teto mensal de tokens (opcional)</Label>
                            <Input
                                id="agent-cap"
                                value={monthlyCap}
                                onChange={(e) => setMonthlyCap(e.target.value)}
                                placeholder="Ex.: 500000"
                                inputMode="numeric"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            className="bg-arena-button text-white hover:bg-arena-button-hover md:min-w-[180px]"
                            disabled={savingConfig}
                        >
                            {savingConfig ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                "Salvar configuração"
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
