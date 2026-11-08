import { z } from "zod"

export const cancellationPolicyTierSchema = z.object({
    minimumHoursBeforeStart: z.number().int().min(0).max(2_147_483_647),
    refundPercentage: z.number().int().min(0).max(100),
})

// A missing zero-hour tier means no refund below the smallest configured threshold.
// The database materializes that fallback; explicit legacy zero-hour refunds remain valid.
export const cancellationPolicyTiersSchema = z
    .array(cancellationPolicyTierSchema)
    .min(1, "Adicione ao menos uma faixa de cancelamento.")
    .max(100, "A política aceita no máximo 100 faixas.")
    .superRefine((tiers, context) => {
        const thresholds = new Set<number>()

        tiers.forEach((tier, index) => {
            if (thresholds.has(tier.minimumHoursBeforeStart)) {
                context.addIssue({
                    code: "custom",
                    message: "Não repita a mesma antecedência em duas faixas.",
                    path: [index, "minimumHoursBeforeStart"],
                })
            }
            thresholds.add(tier.minimumHoursBeforeStart)
        })
    })
