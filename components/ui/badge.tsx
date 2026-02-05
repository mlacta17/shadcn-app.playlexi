import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Badge variant styles using class-variance-authority.
 *
 * @param variant - Visual style of the badge
 *   - `default` - Primary color background
 *   - `secondary` - Muted background (used for step numbers)
 *   - `destructive` - Error/danger state
 *   - `outline` - Border only, no fill
 *   - `gold/silver/bronze` - Placement badges for leaderboards
 *
 * @param size - Badge dimensions
 *   - `default` - Standard pill badge (h-5, rounded-md)
 *   - `number` - Circular badge for step indicators (size-7, rounded-full)
 */
const badgeVariants = cva(
  "border border-transparent inline-flex items-center justify-center whitespace-nowrap shrink-0 [&>svg]:pointer-events-none transition-colors overflow-hidden group/badge",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary: "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive: "bg-destructive text-destructive-foreground [a]:hover:bg-destructive/80",
        outline: "text-foreground border-border",
        gold: "bg-placement-gold text-placement-gold-foreground",
        silver: "bg-placement-silver text-placement-silver-foreground",
        bronze: "bg-placement-bronze text-placement-bronze-foreground",
      },
      size: {
        default:
          "h-5 gap-1 rounded-md px-2 py-0.5 text-xs font-medium w-fit has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:size-3!",
        number: "size-7 rounded-full text-sm font-semibold border-border",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * A versatile badge component for labels, status indicators, and step numbers.
 *
 * @example
 * ```tsx
 * // Standard pill badge
 * <Badge variant="secondary">New</Badge>
 *
 * // Circular step indicator
 * <Badge variant="secondary" size="number">1</Badge>
 *
 * // Placement badge
 * <Badge variant="gold">1st</Badge>
 * ```
 */
function Badge({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      data-size={size}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
