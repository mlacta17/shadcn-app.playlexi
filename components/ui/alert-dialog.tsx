"use client"

import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// =============================================================================
// ALERT DIALOG
// =============================================================================
// A modal dialog that interrupts the user with important content and expects
// a response. Built on Radix UI primitives with radix-nova styling.
//
// Features:
// - Size variants: "default" | "sm"
// - Optional media/icon slot
// - Accessible by default (focus trap, escape to close)
// - Smooth center-pop animation
//
// Usage:
// ```tsx
// <AlertDialog>
//   <AlertDialogTrigger asChild>
//     <Button>Open</Button>
//   </AlertDialogTrigger>
//   <AlertDialogContent>
//     <AlertDialogHeader>
//       <AlertDialogTitle>Title</AlertDialogTitle>
//       <AlertDialogDescription>Description</AlertDialogDescription>
//     </AlertDialogHeader>
//     <AlertDialogFooter>
//       <AlertDialogCancel>Cancel</AlertDialogCancel>
//       <AlertDialogAction>Continue</AlertDialogAction>
//     </AlertDialogFooter>
//   </AlertDialogContent>
// </AlertDialog>
// ```
// =============================================================================

// -----------------------------------------------------------------------------
// Root & Trigger
// -----------------------------------------------------------------------------

function AlertDialog({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  )
}

// -----------------------------------------------------------------------------
// Portal & Overlay
// -----------------------------------------------------------------------------

function AlertDialogPortal({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  )
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        // Position & appearance
        "fixed inset-0 z-50 bg-black/10",
        // Backdrop blur (with fallback for unsupported browsers)
        "supports-[backdrop-filter]:backdrop-blur-xs",
        // Animation (100ms - matches radix-nova)
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "duration-100",
        className
      )}
      {...props}
    />
  )
}

// -----------------------------------------------------------------------------
// Content
// -----------------------------------------------------------------------------

function AlertDialogContent({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content> & {
  /** Dialog size variant */
  size?: "default" | "sm"
}) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        data-size={size}
        className={cn(
          // Position (centered)
          "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
          // Layout
          "grid w-full gap-4 p-4",
          // Size variants (matches radix-nova exactly)
          "data-[size=default]:max-w-xs",
          "data-[size=sm]:max-w-xs",
          "data-[size=default]:sm:max-w-sm",
          // Appearance
          "rounded-2xl bg-background ring-1 ring-foreground/10",
          // Animation (100ms zoom + fade - matches radix-nova exactly, NO slide)
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "duration-100",
          // Focus
          "outline-none",
          // Group identifier for child styling
          "group/alert-dialog-content",
          className
        )}
        {...props}
      />
    </AlertDialogPortal>
  )
}

// -----------------------------------------------------------------------------
// Header, Footer & Media
// -----------------------------------------------------------------------------

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        // Base: centered, stacked layout with grid rows
        "grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center",
        // With media icon: add extra row for icon
        "has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr]",
        "has-data-[slot=alert-dialog-media]:gap-x-4",
        // Responsive: left-align on larger screens (default size only)
        "sm:group-data-[size=default]/alert-dialog-content:place-items-start",
        "sm:group-data-[size=default]/alert-dialog-content:text-left",
        "sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        // Base: stacked (mobile-first)
        "flex flex-col-reverse gap-2",
        // Small size: side-by-side grid
        "group-data-[size=sm]/alert-dialog-content:grid",
        "group-data-[size=sm]/alert-dialog-content:grid-cols-2",
        // Responsive: horizontal on larger screens
        "sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogMedia({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        // Icon container (matches radix-nova: rounded-md, not rounded-lg)
        "bg-muted mb-2 inline-flex size-10 items-center justify-center rounded-md",
        // Responsive: span both rows when in grid layout
        "sm:group-data-[size=default]/alert-dialog-content:row-span-2",
        // Default icon size (can be overridden via className)
        "*:[svg:not([class*='size-'])]:size-6",
        className
      )}
      {...props}
    />
  )
}

// -----------------------------------------------------------------------------
// Title & Description
// -----------------------------------------------------------------------------

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(
        "text-base font-medium",
        // When media is present, start in column 2 on desktop
        "sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn(
        "text-sm text-muted-foreground",
        // Text wrapping
        "text-balance md:text-pretty",
        // Link styling within description
        "*:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

// -----------------------------------------------------------------------------
// Action Buttons
// -----------------------------------------------------------------------------

function AlertDialogAction({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action> &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <Button variant={variant} size={size} asChild>
      <AlertDialogPrimitive.Action
        data-slot="alert-dialog-action"
        className={cn(className)}
        {...props}
      />
    </Button>
  )
}

function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel> &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <Button variant={variant} size={size} asChild>
      <AlertDialogPrimitive.Cancel
        data-slot="alert-dialog-cancel"
        className={cn(className)}
        {...props}
      />
    </Button>
  )
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
