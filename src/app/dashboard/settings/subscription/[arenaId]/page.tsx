"use client"

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useUserSync } from "@/hooks/useUserSync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentSetupForm } from "@/modules/stripe/components/PaymentSetupForm";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { CreditCard, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import type { ArenaSubscription } from "@/modules/stripe/usecases/get-subscription.usecase";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

type SetupData = {
    clientSecret: string;
    planLabel: string;
    priceCents: number;
};

export default function SubscriptionArenaPage() {
    const params = useParams();
    const arenaId = params.arenaId as string;
    const { isLoading: userLoading } = useUserSync();

    const [subscription, setSubscription] = useState<ArenaSubscription | null>(null);
    const [setupData, setSetupData] = useState<SetupData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        if (arenaId) fetchSubscription();
    }, [arenaId]);

    async function fetchSubscription() {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/stripe/subscriptions/${arenaId}`);
            const data = await res.json();
            setSubscription(data);
        } catch {
            toast.error("Erro ao carregar assinatura.");
        } finally {
            setIsLoading(false);
        }
    }

    async function handleSetupCard() {
        setActionLoading(true);
        try {
            const res = await fetch("/api/stripe/setup-intent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ arenaId }),
            });

            const data = await res.json();

            if (!res.ok) {
                toast.error(data.error ?? "Erro ao iniciar cadastro do cartão.");
                return;
            }

            setSetupData({
                clientSecret: data.clientSecret,
                planLabel: data.planLabel,
                priceCents: data.priceCents,
            });
        } finally {
            setActionLoading(false);
        }
    }

    async function handleCancel() {
        setActionLoading(true);
        try {
            const res = await fetch("/api/stripe/subscriptions/cancel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ arenaId, action: "cancel" }),
            });

            if (!res.ok) {
                const data = await res.json();
                toast.error(data.error ?? "Erro ao cancelar assinatura.");
                return;
            }

            toast.success("Assinatura cancelada. Você mantém o acesso até o fim do período atual.");
            await fetchSubscription();
        } finally {
            setActionLoading(false);
        }
    }

    async function handleReactivate() {
        setActionLoading(true);
        try {
            const res = await fetch("/api/stripe/subscriptions/cancel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ arenaId, action: "reactivate" }),
            });

            if (!res.ok) {
                const data = await res.json();
                toast.error(data.error ?? "Erro ao reativar assinatura.");
                return;
            }

            toast.success("Assinatura reativada com sucesso!");
            await fetchSubscription();
        } finally {
            setActionLoading(false);
        }
    }

    function handlePaymentSuccess() {
        setSetupData(null);
        toast.success("Assinatura ativada com sucesso!");
        fetchSubscription();
    }

    function formatPrice(cents: number) {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(cents / 100);
    }

    function formatDate(iso: string) {
        return new Intl.DateTimeFormat("pt-BR").format(new Date(iso));
    }

    if (isLoading || userLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-[200px]" />
                <Skeleton className="h-[200px] w-full max-w-lg" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <CreditCard className="h-8 w-8 text-primary" />
                    Assinatura
                </h2>
                <p className="text-muted-foreground mt-1">
                    Gerencie o plano e método de pagamento desta arena.
                </p>
            </div>

            {/* Subscription info */}
            {subscription && subscription.status !== "none" && !setupData && (
                <Card className="max-w-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-base">{subscription.planLabel}</CardTitle>
                        <StatusBadge status={subscription.status} />
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {subscription.priceCents && (
                            <p className="text-sm text-muted-foreground">
                                {formatPrice(subscription.priceCents)} / mês
                            </p>
                        )}
                        {subscription.maxSpaces && (
                            <p className="text-sm text-muted-foreground">
                                Até {subscription.maxSpaces} espaços
                            </p>
                        )}
                        {subscription.currentPeriodEnd && (
                            <p className="text-sm text-muted-foreground">
                                {subscription.cancelAtPeriodEnd
                                    ? `Acesso garantido até ${formatDate(subscription.currentPeriodEnd)}`
                                    : `Próxima cobrança: ${formatDate(subscription.currentPeriodEnd)}`}
                            </p>
                        )}

                        {subscription.status === "past_due" && (
                            <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
                                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                Pagamento em atraso. Estamos tentando novamente. Verifique seu cartão.
                            </div>
                        )}

                        <div className="pt-2">
                            {subscription.cancelAtPeriodEnd ? (
                                <Button
                                    variant="outline"
                                    onClick={handleReactivate}
                                    disabled={actionLoading}
                                    className="border-[#FF6B00] text-[#FF6B00] hover:bg-[#FF6B00]/10"
                                >
                                    Manter assinatura
                                </Button>
                            ) : (
                                subscription.status === "active" && (
                                    <Button
                                        variant="ghost"
                                        onClick={handleCancel}
                                        disabled={actionLoading}
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                        Cancelar assinatura
                                    </Button>
                                )
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* No subscription yet */}
            {subscription?.status === "none" && !setupData && (
                <Card className="max-w-lg">
                    <CardContent className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                        <div className="rounded-full bg-muted p-4">
                            <CreditCard className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="font-medium">Nenhuma assinatura ativa</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Cadastre um cartão para ativar sua assinatura.
                            </p>
                        </div>
                        <Button
                            onClick={handleSetupCard}
                            disabled={actionLoading}
                            className="bg-[#FF6B00] hover:bg-[#E66000] text-white"
                        >
                            {actionLoading ? "Aguarde..." : "Cadastrar cartão"}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Payment Element */}
            {setupData && (
                <Card className="max-w-lg">
                    <CardHeader>
                        <CardTitle className="text-base">{setupData.planLabel}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {formatPrice(setupData.priceCents)} / mês
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Elements
                            stripe={stripePromise}
                            options={{
                                clientSecret: setupData.clientSecret,
                                appearance: { theme: "stripe" },
                                locale: "pt-BR",
                            }}
                        >
                            <PaymentSetupForm
                                arenaId={arenaId}
                                onSuccess={handlePaymentSuccess}
                                onError={(msg) => toast.error(msg)}
                            />
                        </Elements>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSetupData(null)}
                            className="text-muted-foreground"
                        >
                            Cancelar
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { label: string; className: string }> = {
        active: { label: "Ativo", className: "bg-emerald-500/10 text-emerald-500" },
        incomplete: { label: "Pendente", className: "bg-yellow-500/10 text-yellow-600" },
        past_due: { label: "Em atraso", className: "bg-red-500/10 text-red-500" },
        canceled: { label: "Cancelado", className: "bg-gray-100 text-gray-500" },
        unpaid: { label: "Não pago", className: "bg-red-500/10 text-red-500" },
        paused: { label: "Pausado", className: "bg-gray-100 text-gray-500" },
    };

    const { label, className } = config[status] ?? { label: status, className: "bg-gray-100 text-gray-500" };

    return (
        <Badge variant="secondary" className={className}>
            {label}
        </Badge>
    );
}
