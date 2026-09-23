"use client"

import { useState } from "react"
import { MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    SendTemplateMessageModal,
    type SendTemplateMessageAthlete,
} from "@/modules/templates-mensagens/components/SendTemplateMessageModal"

export type { SendTemplateMessageAthlete }

function currentCompetencia(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export interface SendTemplateMessageButtonProps {
    arenaId: string
    /**
     * Mês de referência (`YYYY-MM`) usado nas variáveis de mensalista
     * (débito, crédito, recorrência, etc.). Quando a tela de origem não tem
     * um filtro de período próprio, usa o mês corrente.
     */
    competencia?: string
    /** `null`/`undefined` esconde o botão — não há para quem enviar. */
    athlete: SendTemplateMessageAthlete | null | undefined
    className?: string
    title?: string
}

/**
 * Botão + modal de envio de mensagem por template (seleção → prévia com
 * variáveis resolvidas → WhatsApp Web), pronto para cair em qualquer lista
 * que tenha um atleta com telefone — cada instância guarda seu próprio
 * estado de abertura, sem exigir nada do componente pai além destas props.
 */
export function SendTemplateMessageButton({
    arenaId,
    competencia,
    athlete,
    className,
    title = "Enviar mensagem no WhatsApp",
}: SendTemplateMessageButtonProps) {
    const [open, setOpen] = useState(false)

    if (!athlete?.id) return null

    return (
        <>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                    "h-8 w-8 text-[#25D366]/70 hover:text-[#25D366] hover:bg-[#25D366]/10",
                    className
                )}
                title={title}
                onClick={() => setOpen(true)}
                disabled={!athlete.telefone}
            >
                <MessageCircle className="h-4 w-4" />
            </Button>
            <SendTemplateMessageModal
                open={open}
                onOpenChange={setOpen}
                arenaId={arenaId}
                competencia={competencia ?? currentCompetencia()}
                athlete={athlete}
            />
        </>
    )
}
