"use client"

import * as React from "react"
import { Separator as SeparatorPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Separator variants for different visual styles.
 *
 * - "solid": Default solid line (bg-border)
 * - "dashed": Dashed line with 4px dash, 4px gap (per Figma)
 *
 * @see Figma node 2582:6142 (Settings Dialog with dashed separators)
 * @see app/globals.css for dashed pattern CSS classes
 */
type SeparatorVariant = "solid" | "dashed"

interface SeparatorProps
  extends React.ComponentProps<typeof SeparatorPrimitive.Root> {
  /** Visual style variant. Defaults to "solid". */
  variant?: SeparatorVariant
}

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  variant = "solid",
  ...props
}: SeparatorProps) {
  // Dashed variant uses CSS gradient pattern (4px dash, 4px gap)
  // Defined in globals.css for proper theming support
  if (variant === "dashed") {
    return (
      <div
        role={decorative ? "none" : "separator"}
        aria-orientation={decorative ? undefined : orientation}
        data-slot="separator"
        data-variant="dashed"
        data-orientation={orientation}
        className={cn(
          "shrink-0",
          orientation === "horizontal" && "separator-dashed-horizontal",
          orientation === "vertical" && "separator-dashed-vertical self-stretch",
          className
        )}
        {...props}
      />
    )
  }

  // Solid variant uses Radix primitive
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      data-variant="solid"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "bg-border shrink-0",
        "data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full",
        "data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
