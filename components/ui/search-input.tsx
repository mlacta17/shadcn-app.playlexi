"use client"

import * as React from "react"
import { SearchIcon } from "@/lib/icons"

import { cn } from "@/lib/utils"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"

export interface SearchInputProps
  extends Omit<React.ComponentProps<"input">, "type"> {
  /** Additional class names for the container */
  containerClassName?: string
}

/**
 * SearchInput — Input field with search icon prefix.
 *
 * A pre-composed InputGroup with a magnifier icon for search fields.
 * Uses the InputGroup system for consistent styling with other inputs.
 *
 * ## Usage
 * ```tsx
 * <SearchInput
 *   placeholder="Search players"
 *   value={search}
 *   onChange={(e) => setSearch(e.target.value)}
 * />
 * ```
 *
 * @see Figma node 2435:33026 for design reference
 */
function SearchInput({
  className,
  containerClassName,
  placeholder = "Search...",
  ...props
}: SearchInputProps) {
  return (
    <InputGroup className={containerClassName}>
      <InputGroupAddon>
        <InputGroupText>
          <SearchIcon aria-hidden="true" />
        </InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        placeholder={placeholder}
        className={cn("", className)}
        {...props}
      />
    </InputGroup>
  )
}

export { SearchInput }
