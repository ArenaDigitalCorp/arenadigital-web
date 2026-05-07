import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-xs w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "bg-primary font-medium text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary font-medium text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive font-medium text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border-border font-medium text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        warning:
          "h-[22px] min-w-[62px] w-fit shrink-0 border-transparent bg-arena-inactive-pill-bg px-[11px] py-[3px] font-sans text-[12px] font-semibold leading-none text-arena-inactive-pill-fg shadow-none antialiased [a&]:hover:bg-arena-inactive-pill-bg/90",
        ghost:
          "font-medium [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "font-medium text-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  style,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      style={{
        ...(variant === "warning"
          ? {
              fontFamily: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif",
              fontWeight: 600,
              fontVariationSettings: '"wght" 600',
            }
          : {}),
        ...style,
      }}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
