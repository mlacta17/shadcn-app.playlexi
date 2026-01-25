/**
 * Centralized icon exports from Nucleo icon library.
 *
 * All icons use the Outline 24px variant from nucleo-core-outline-24.
 * Import from this file instead of directly from nucleo-core-outline-24
 * for consistent naming and easier discovery.
 *
 * ## Organization
 * Icons are grouped by current usage:
 * 1. **Active** - Currently used in the codebase
 * 2. **Reserved** - Planned for upcoming features (per COMPONENT_INVENTORY.md)
 *
 * ## Usage
 * @example
 * ```tsx
 * import { PlusIcon, TrashIcon, SettingsIcon } from "@/lib/icons"
 *
 * <Button>
 *   <PlusIcon data-icon="inline-start" />
 *   Add Item
 * </Button>
 * ```
 *
 * @see STYLE_GUIDE.md for icon usage patterns and data-icon attribute
 */

// =============================================================================
// ACTIVE ICONS - Currently used in the codebase
// =============================================================================

// Common UI icons
export { IconPlusOutline24 as PlusIcon } from "nucleo-core-outline-24"
export { IconXmarkOutline24 as XIcon } from "nucleo-core-outline-24"
export { IconCheckOutline24 as CheckIcon } from "nucleo-core-outline-24"
export { IconTrashOutline24 as TrashIcon } from "nucleo-core-outline-24"

// Navigation/Chevrons
export { IconChevronDownOutline24 as ChevronDownIcon } from "nucleo-core-outline-24"
export { IconChevronUpOutline24 as ChevronUpIcon } from "nucleo-core-outline-24"
export { IconChevronRightOutline24 as ChevronRightIcon } from "nucleo-core-outline-24"

// Navigation/Arrows (Tutorial navigation, pagination)
export { IconArrowLeftOutline24 as ArrowLeftIcon } from "nucleo-core-outline-24"
export { IconArrowRightOutline24 as ArrowRightIcon } from "nucleo-core-outline-24"

// Menu icons
export { IconMenuOutline24 as MenuIcon } from "nucleo-core-outline-24"
export { IconDotsVerticalOutline24 as MoreVerticalIcon } from "nucleo-core-outline-24"
export { IconDotsOutline24 as MoreHorizontalIcon } from "nucleo-core-outline-24"

// User/Account icons (Navbar)
export { IconUserOutline24 as UserIcon } from "nucleo-core-outline-24"
export { IconCircleUserOutline24 as CircleUserIcon } from "nucleo-core-outline-24"
export { IconCircleLogoutOutline24 as LogOutIcon } from "nucleo-core-outline-24"

// Settings/System icons (Navbar)
export { IconGearOutline24 as SettingsIcon } from "nucleo-core-outline-24"
export { IconBellOutline24 as BellIcon } from "nucleo-core-outline-24"

// Media icons (SpeechInput)
export { IconMediaPlayOutline24 as PlayIcon } from "nucleo-core-outline-24"
export { IconMediaStopOutline24 as StopIcon } from "nucleo-core-outline-24"
export { IconMicrophoneOutline24 as MicIcon } from "nucleo-core-outline-24"

// Theme icons (ThemeSwitcher)
export { IconSunOutline24 as SunIcon } from "nucleo-core-outline-24"
export { IconMoonOutline24 as MoonIcon } from "nucleo-core-outline-24"
export { IconMonitorOutline24 as MonitorIcon } from "nucleo-core-outline-24"

// Game icons
export { IconHeartOutline24 as HeartIcon } from "nucleo-core-outline-24"

// Debug/Refresh icons
export { IconArrowRotateClockwiseOutline24 as RefreshIcon } from "nucleo-core-outline-24"

// SpeechInput helper buttons
export { IconMessage2ContentOutline24 as SentenceIcon } from "nucleo-core-outline-24"
export { IconBookOutline24 as DictionaryIcon } from "nucleo-core-outline-24"

// Alert/Feedback icons (AlertDialog)
export { IconAlertWarningOutline24 as AlertWarningIcon } from "nucleo-core-outline-24"
export { IconCircleCheckOutline24 as CircleCheckIcon } from "nucleo-core-outline-24"

// Search/Filter icons (Leaderboard, tables)
export { IconMagnifierOutline24 as SearchIcon } from "nucleo-core-outline-24"
export { IconBarsFilterOutline24 as FilterIcon } from "nucleo-core-outline-24"

// =============================================================================
// RESERVED ICONS - Planned for upcoming features
// See COMPONENT_INVENTORY.md for feature roadmap
// =============================================================================

// KeyboardInput component (P0 - MVP)
export { IconKeyboardOutline24 as KeyboardIcon } from "nucleo-core-outline-24"

// Navigation (may need for mobile back button)
export { IconChevronLeftOutline24 as ChevronLeftIcon } from "nucleo-core-outline-24"

// Leaderboard/Social features (P3)
// export { IconShieldOutline24 as ShieldIcon } from "nucleo-core-outline-24"
// export { IconEnvelopeOutline24 as MailIcon } from "nucleo-core-outline-24"
// export { IconMessage2ContentOutline24 as MessageIcon } from "nucleo-core-outline-24"

// Profile/Settings features (P3)
// export { IconEyeOutline24 as EyeIcon } from "nucleo-core-outline-24"
// export { IconCreditCardOutline24 as CreditCardIcon } from "nucleo-core-outline-24"
// export { IconCircleQuestionOutline24 as HelpCircleIcon } from "nucleo-core-outline-24"
