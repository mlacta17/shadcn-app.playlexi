"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

/**
 * A composite input component that combines an input field with addons.
 * Use for inputs with prefixes, suffixes, icons, or action buttons.
 *
 * @example
 * ```tsx
 * // With prefix text (e.g., currency)
 * <InputGroup>
 *   <InputGroupAddon>
 *     <InputGroupText>$</InputGroupText>
 *   </InputGroupAddon>
 *   <InputGroupInput placeholder="0.00" />
 * </InputGroup>
 *
 * // With suffix button
 * <InputGroup>
 *   <InputGroupInput placeholder="Search..." />
 *   <InputGroupAddon align="inline-end">
 *     <InputGroupButton>
 *       <IconSearch />
 *     </InputGroupButton>
 *   </InputGroupAddon>
 * </InputGroup>
 *
 * // With textarea
 * <InputGroup>
 *   <InputGroupTextarea placeholder="Message..." />
 *   <InputGroupAddon align="block-end">
 *     <InputGroupButton>Send</InputGroupButton>
 *   </InputGroupAddon>
 * </InputGroup>
 * ```
 *
 * @remarks
 * - Container handles focus ring for the entire group
 * - Set `aria-invalid="true"` on InputGroup for error state
 * - Addons can be positioned: `inline-start`, `inline-end`, `block-start`, `block-end`
 */
function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "border-input bg-input/30 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 focus-within:outline focus-within:outline-[length:var(--focus-ring-width)] focus-within:outline-[var(--focus-ring-color)] focus-within:outline-offset-[var(--focus-ring-offset)] aria-invalid:focus-within:outline-[var(--destructive)] h-9 rounded-lg border transition-colors has-data-[align=block-end]:rounded-lg has-data-[align=block-start]:rounded-lg has-[textarea]:rounded-lg has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=inline-end]]:[&>input]:pr-1.5 has-[>[data-align=inline-start]]:[&>input]:pl-1.5 [[data-slot=combobox-content]_&]:focus-within:border-inherit group/input-group relative flex w-full min-w-0 items-center has-[>textarea]:h-auto",
        className
      )}
      {...props}
    />
  )
}

const inputGroupAddonVariants = cva(
  "text-muted-foreground **:data-[slot=kbd]:bg-muted-foreground/10 h-auto gap-2 py-2 text-sm font-medium group-data-[disabled=true]/input-group:opacity-50 **:data-[slot=kbd]:rounded-4xl **:data-[slot=kbd]:px-1.5 [&>svg:not([class*='size-'])]:size-4 flex cursor-text items-center justify-center select-none",
  {
    variants: {
      align: {
        "inline-start": "pl-3 has-[>button]:ml-[-0.25rem] has-[>kbd]:ml-[-0.15rem] order-first",
        "inline-end": "pr-3 has-[>button]:mr-[-0.25rem] has-[>kbd]:mr-[-0.15rem] order-last",
        "block-start":
          "px-3 pt-3 group-has-[>input]/input-group:pt-3 [.border-b]:pb-3 order-first w-full justify-start",
        "block-end":
          "px-3 pb-3 group-has-[>input]/input-group:pb-3 [.border-t]:pt-3 order-last w-full justify-start",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
)

/**
 * Container for addon content (text, icons, buttons) within InputGroup.
 *
 * @param align - Position of the addon
 *   - `inline-start` - Left side (default)
 *   - `inline-end` - Right side
 *   - `block-start` - Above input
 *   - `block-end` - Below input
 */
function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus()
      }}
      {...props}
    />
  )
}

const inputGroupButtonVariants = cva(
  "gap-2 rounded-4xl text-sm shadow-none flex items-center",
  {
    variants: {
      size: {
        xs: "h-6 gap-1 px-1.5 [&>svg:not([class*='size-'])]:size-3.5",
        sm: "",
        "icon-xs": "size-6 p-0 has-[>svg]:p-0",
        "icon-sm": "size-8 p-0 has-[>svg]:p-0",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  }
)

/** Compact button designed for use inside InputGroupAddon. */
function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size"> &
  VariantProps<typeof inputGroupButtonVariants>) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  )
}

/** Static text or icon display inside InputGroupAddon (e.g., "$", "@", icons). */
function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-muted-foreground gap-2 text-sm [&_svg:not([class*='size-'])]:size-4 flex items-center [&_svg]:pointer-events-none",
        className
      )}
      {...props}
    />
  )
}

/** Input field for use inside InputGroup. Inherits focus/error states from container. */
function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn("rounded-none border-0 bg-transparent shadow-none dark:bg-transparent flex-1 focus-ring-none", className)}
      {...props}
    />
  )
}

/** Textarea for use inside InputGroup. Auto-expands container height. */
function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn("rounded-none border-0 bg-transparent py-2 shadow-none dark:bg-transparent flex-1 resize-none focus-ring-none", className)}
      {...props}
    />
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}
