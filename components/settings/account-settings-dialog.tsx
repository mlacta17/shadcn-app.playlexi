/**
 * Account Settings Dialog — PlayLexi
 *
 * Modal dialog for managing user account settings.
 * Opens when user clicks "Account Settings" from the user menu dropdown.
 *
 * ## Responsive Layout (3-tier)
 * - **Desktop (lg+, 1024px+)**: Centered 980×680 dialog with sidebar navigation (Figma 2582:6142)
 * - **Tablet (md–lg, 768–1023px)**: Centered auto-sized dialog with dropdown tab selector, vertical content
 * - **Mobile (<md, <768px)**: Bottom sheet with dropdown tab selector (Figma 3102:49858)
 *
 * ## Tabs
 * 1. **Profile** - Avatar, username, bio
 * 2. **Privacy & Security** - Google account, 2FA
 * 3. **Appearance** - Theme switcher (light/dark)
 * 4. **Notifications** - Email notification preferences
 *
 * ## Behavior
 * - Theme changes apply immediately (no save required)
 * - Notification toggles apply immediately (no save required)
 * - Profile changes require clicking "Save Changes"
 * - Privacy changes are handled via external flows (Google auth, 2FA)
 * - On mobile, "Discard" also closes the dialog (no X button)
 *
 * @see Figma node 2582:6142 (Desktop Settings Dialog)
 * @see Figma node 3102:49858 (Mobile Settings — Profile)
 * @see db/schema.ts users table for editable fields
 */

"use client"

import * as React from "react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"
import { useSession } from "@/lib/auth/client"
import { useMediaQuery } from "@/hooks/use-media-query"
import { AVATARS } from "@/lib/avatar-utils"
import {
  CircleUserIcon,
  ShieldIcon,
  PaletteIcon,
  BellIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  XIcon,
} from "@/lib/icons"

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { AvatarOption } from "@/components/ui/avatar-selector"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"

// =============================================================================
// TYPES
// =============================================================================

type SettingsTab = "profile" | "privacy" | "appearance" | "notifications"

interface TabConfig {
  id: SettingsTab
  label: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}

interface UserSettings {
  username: string
  bio: string
  avatarId: number
  theme: "light" | "dark"
  emailSocial: boolean
  emailSecurity: boolean
  emailMarketing: boolean
}

interface AccountSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TABS: TabConfig[] = [
  {
    id: "profile",
    label: "Profile",
    icon: CircleUserIcon,
    title: "Profile",
    description: "This is how others will see you on the site.",
  },
  {
    id: "privacy",
    label: "Privacy & Security",
    icon: ShieldIcon,
    title: "Privacy & Security",
    description: "Customize your privacy and security settings",
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: PaletteIcon,
    title: "Appearance",
    description: "Customize the appearance of the app.",
  },
  {
    id: "notifications",
    label: "Notification",
    icon: BellIcon,
    title: "Notification Preferences",
    description: "Choose what notifications you want to receive",
  },
]

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Account Settings Dialog.
 *
 * Renders as a centered dialog on desktop (with sidebar navigation)
 * and a bottom sheet on mobile (with dropdown tab selector).
 */
export function AccountSettingsDialog({
  open,
  onOpenChange,
}: AccountSettingsDialogProps) {
  const { data: session } = useSession()
  const { theme: currentTheme, setTheme } = useTheme()
  const isDesktop = useMediaQuery("(min-width: 768px)")

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [activeTab, setActiveTab] = React.useState<SettingsTab>("profile")
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Form state for settings that require "Save"
  const [formData, setFormData] = React.useState<UserSettings>({
    username: "",
    bio: "",
    avatarId: 1,
    theme: "light",
    emailSocial: true,
    emailSecurity: true,
    emailMarketing: false,
  })

  // Track if form has unsaved changes
  const [hasChanges, setHasChanges] = React.useState(false)

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Load user settings when dialog opens
  React.useEffect(() => {
    if (open && session?.user) {
      loadUserSettings()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session?.user?.id])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const loadUserSettings = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/users/me")
      if (response.ok) {
        const data = (await response.json()) as Partial<UserSettings>
        setFormData({
          username: data.username || "",
          bio: data.bio || "",
          avatarId: data.avatarId || 1,
          theme: data.theme || "light",
          emailSocial: data.emailSocial ?? true,
          emailSecurity: data.emailSecurity ?? true,
          emailMarketing: data.emailMarketing ?? false,
        })
        setHasChanges(false)
      } else if (response.status === 404) {
        setError("Please complete your profile setup first.")
      } else {
        setError("Failed to load settings. Please try again.")
      }
    } catch (err) {
      console.error("[AccountSettings] Failed to load settings:", err)
      setError("Failed to load settings. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          bio: formData.bio,
          avatarId: formData.avatarId,
        }),
      })

      if (response.ok) {
        setHasChanges(false)
        // TODO: Show success toast
      } else {
        const data = (await response.json()) as { error?: string }
        console.error("[AccountSettings] Save failed:", data.error)
        // TODO: Show error toast
      }
    } catch (err) {
      console.error("[AccountSettings] Save error:", err)
      // TODO: Show error toast
    } finally {
      setIsSaving(false)
    }
  }

  const handleDiscard = () => {
    loadUserSettings()
  }

  /** On mobile, Discard also closes the dialog (no X button per Figma) */
  const handleMobileDiscard = () => {
    loadUserSettings()
    onOpenChange(false)
  }

  const handleAvatarSelect = (avatarId: number) => {
    setFormData((prev) => ({ ...prev, avatarId }))
    setHasChanges(true)
  }

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, username: e.target.value }))
    setHasChanges(true)
  }

  const handleBioChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, bio: e.target.value }))
    setHasChanges(true)
  }

  const handleThemeChange = (newTheme: "light" | "dark") => {
    setFormData((prev) => ({ ...prev, theme: newTheme }))
    setTheme(newTheme)
    updateSetting("theme", newTheme)
  }

  const handleNotificationChange = async (
    key: "emailSocial" | "emailSecurity" | "emailMarketing",
    value: boolean
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
    await updateSetting(key, value)
  }

  const updateSetting = async (key: string, value: boolean | string) => {
    try {
      await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      })
    } catch (err) {
      console.error("[AccountSettings] Failed to update setting:", err)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const activeTabConfig = TABS.find((t) => t.id === activeTab)!

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          // ---------------------------------------------------------------
          // Override base dialog styles (flex instead of grid, reset spacing)
          // ---------------------------------------------------------------
          "flex flex-col p-0 gap-0 overflow-hidden ring-0 shadow-[var(--shadow-dialog)]",

          // ---------------------------------------------------------------
          // Mobile-first defaults: bottom sheet anchored to screen bottom
          // Overrides base dialog's centered positioning (top-1/2 left-1/2)
          // ---------------------------------------------------------------
          "top-auto bottom-0 left-0 right-0",
          "translate-x-0 translate-y-0",
          "w-full max-w-full sm:max-w-full",
          "rounded-t-3xl rounded-b-none max-h-[85vh]",

          // ---------------------------------------------------------------
          // Tablet (md+): centered dialog with 40px margin on each side
          // Re-applies centered positioning that mobile defaults override
          // ---------------------------------------------------------------
          "md:top-1/2 md:left-1/2 md:right-auto md:bottom-auto",
          "md:-translate-x-1/2 md:-translate-y-1/2",
          "md:max-w-[calc(100%-5rem)] md:rounded-3xl md:max-h-[80vh]",

          // ---------------------------------------------------------------
          // Desktop (lg+): fixed-size centered dialog with sidebar
          // ---------------------------------------------------------------
          "lg:w-[980px] lg:max-w-[980px] lg:h-[680px]"
        )}
      >
        {/* Tab selector — visible on mobile + tablet, hidden at lg+ (Figma 3102:49895) */}
        <TabSelectorHeader
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Main layout: sidebar (desktop) + content */}
        <div className="flex flex-1 min-h-0">
          {/* Desktop: sidebar navigation (hidden on mobile) */}
          <SettingsSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          {/* Content area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Content header: title + description */}
            <SettingsHeader
              title={activeTabConfig.title}
              description={activeTabConfig.description}
              onClose={() => onOpenChange(false)}
            />

            {/* Scrollable tab content */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6 bg-background">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="size-8 animate-spin rounded-full border-4 border-muted-foreground border-t-transparent" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <p className="text-muted-foreground">{error}</p>
                  <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                </div>
              ) : (
                <>
                  {activeTab === "profile" && (
                    <ProfileTabContent
                      avatarId={formData.avatarId}
                      username={formData.username}
                      bio={formData.bio}
                      onAvatarSelect={handleAvatarSelect}
                      onUsernameChange={handleUsernameChange}
                      onBioChange={handleBioChange}
                    />
                  )}
                  {activeTab === "privacy" && (
                    <PrivacyTabContent email={session?.user?.email} />
                  )}
                  {activeTab === "appearance" && (
                    <AppearanceTabContent
                      theme={(currentTheme as "light" | "dark") || formData.theme}
                      onThemeChange={handleThemeChange}
                    />
                  )}
                  {activeTab === "notifications" && (
                    <NotificationsTabContent
                      emailSocial={formData.emailSocial}
                      emailSecurity={formData.emailSecurity}
                      emailMarketing={formData.emailMarketing}
                      onToggle={handleNotificationChange}
                    />
                  )}
                </>
              )}
            </div>

            {/* Footer: Discard + Save */}
            <SettingsFooter
              onDiscard={isDesktop ? handleDiscard : handleMobileDiscard}
              onSave={handleSave}
              isSaving={isSaving}
              hasChanges={hasChanges}
              isMobile={!isDesktop}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// TAB SELECTOR HEADER (mobile + tablet)
// =============================================================================

interface TabSelectorHeaderProps {
  activeTab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
}

/**
 * Combobox-style tab selector for mobile + tablet.
 *
 * Styled to match our form control conventions (Input, SelectTrigger):
 * - `border border-input` for the border
 * - `bg-input/30` for the background
 * - `rounded-lg` for the border radius
 * - `h-10` for the height
 *
 * The trigger is inset from dialog edges via container padding (px-5 / md:px-6),
 * which aligns with the content area's padding. The dropdown matches the trigger
 * width automatically via `w-(--radix-dropdown-menu-trigger-width)`.
 *
 * Visible on mobile and tablet. Hidden on desktop (lg+) where the sidebar
 * provides navigation.
 */
function TabSelectorHeader({ activeTab, onTabChange }: TabSelectorHeaderProps) {
  const activeTabConfig = TABS.find((t) => t.id === activeTab)!
  const ActiveIcon = activeTabConfig.icon

  return (
    <div className="shrink-0 border-b border-border px-3 py-4 md:px-3 lg:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "group/trigger flex w-full items-center gap-3.5 rounded-lg px-3 h-10",
              "transition-colors",
              "hover:bg-input/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            )}
          >
            <ActiveIcon className="size-6 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate text-left text-lg font-medium">
              {activeTabConfig.label}
            </span>
            <ChevronDownIcon
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                "group-data-[state=open]/trigger:rotate-180"
              )}
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup
            value={activeTab}
            onValueChange={(val) => onTabChange(val as SettingsTab)}
          >
            {TABS.map((tab) => {
              const TabIcon = tab.icon
              return (
                <DropdownMenuRadioItem key={tab.id} value={tab.id}>
                  <TabIcon className="size-4 shrink-0 text-muted-foreground" />
                  {tab.label}
                </DropdownMenuRadioItem>
              )
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// =============================================================================
// SIDEBAR COMPONENT (Desktop only)
// =============================================================================

interface SettingsSidebarProps {
  activeTab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
}

/** Desktop sidebar navigation. Hidden on mobile/tablet, visible at lg+ (1024px). */
function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
  return (
    <div className="hidden lg:flex w-[256px] shrink-0 border-r border-border bg-background h-full flex-col">
      <div className="p-4 flex flex-col gap-2">
        {/* Label - 32px height, 12px text, 70% opacity per Figma */}
        <div className="h-8 flex items-center px-2">
          <p className="text-xs font-medium text-foreground/70 uppercase tracking-wide">
            PERSONAL SETTINGS
          </p>
        </div>
        {/* Menu items - 32px height, 8px gap, 8px padding per Figma */}
        <nav className="flex flex-col gap-2">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-2 h-8 px-2 rounded-lg text-sm transition-colors w-full text-left",
                  isActive
                    ? "bg-muted font-medium text-foreground"
                    : "font-normal text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1 truncate">{tab.label}</span>
                <ChevronRightIcon className="size-4 shrink-0" />
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

// =============================================================================
// HEADER COMPONENT
// =============================================================================

interface SettingsHeaderProps {
  title: string
  description: string
  onClose: () => void
}

function SettingsHeader({ title, description, onClose }: SettingsHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border p-4">
      <div className="flex flex-col">
        {/* DialogTitle required by Radix for screen reader accessibility */}
        <DialogTitle className="text-lg font-medium leading-7">{title}</DialogTitle>
        {/* DialogDescription for screen reader accessibility */}
        <DialogDescription className="text-sm leading-5 text-muted-foreground">
          {description}
        </DialogDescription>
      </div>
      {/* Close button: tablet + desktop (mobile bottom sheet uses Discard to close) */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClose}
        className="hidden md:flex shrink-0 size-9"
      >
        <XIcon />
        <span className="sr-only">Close</span>
      </Button>
    </div>
  )
}

// =============================================================================
// FOOTER COMPONENT
// =============================================================================

interface SettingsFooterProps {
  onDiscard: () => void
  onSave: () => void
  isSaving: boolean
  hasChanges: boolean
  /** When true, Discard is always enabled (acts as dialog close on mobile) */
  isMobile: boolean
}

function SettingsFooter({
  onDiscard,
  onSave,
  isSaving,
  hasChanges,
  isMobile,
}: SettingsFooterProps) {
  return (
    <div
      className={cn(
        // Mobile-first: stacked full-width buttons, primary action on top
        // (flex-col-reverse flips DOM order so Save appears above Discard)
        "flex flex-col-reverse gap-2 border-t border-border px-5 py-4",
        // Tablet/Desktop (md+): horizontal row, right-aligned
        "md:flex-row md:items-center md:justify-end md:gap-3 md:px-6"
      )}
    >
      <Button
        variant="outline"
        onClick={onDiscard}
        // On mobile: always enabled (acts as close). On desktop: only when changes exist.
        disabled={isMobile ? isSaving : !hasChanges || isSaving}
        className="w-full md:w-auto"
      >
        Discard
      </Button>
      <Button
        onClick={onSave}
        disabled={!hasChanges || isSaving}
        className="w-full md:w-auto"
      >
        {isSaving ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  )
}

// =============================================================================
// PROFILE TAB
// =============================================================================

interface ProfileTabContentProps {
  avatarId: number
  username: string
  bio: string
  onAvatarSelect: (id: number) => void
  onUsernameChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBioChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
}

function ProfileTabContent({
  avatarId,
  username,
  bio,
  onAvatarSelect,
  onUsernameChange,
  onBioChange,
}: ProfileTabContentProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* Profile Photo - 12px gap, 48px avatars per Figma */}
      <SettingsRow
        title="Profile Photo"
        description="Select an image to represent yourself."
      >
        <div className="flex items-center gap-3">
          {AVATARS.map((avatar) => (
            <AvatarOption
              key={avatar.id}
              avatar={avatar}
              isSelected={avatarId === avatar.id}
              onSelect={onAvatarSelect}
              size={48}
            />
          ))}
        </div>
      </SettingsRow>

      <Separator variant="dashed" />

      {/* Username */}
      <SettingsRow
        title="Username"
        description="This is your public display name."
      >
        <Input
          value={username}
          onChange={onUsernameChange}
          placeholder="Username"
          className="lg:max-w-[280px]"
        />
      </SettingsRow>

      <Separator variant="dashed" />

      {/* Bio */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium">Bio</p>
          <p className="text-sm text-muted-foreground">
            You can @mention other users and organizations to link to them.
          </p>
        </div>
        <Textarea
          value={bio}
          onChange={onBioChange}
          placeholder="Tell us about yourself..."
          className="min-h-24 resize-none"
        />
      </div>
    </div>
  )
}

// =============================================================================
// PRIVACY TAB
// =============================================================================

interface PrivacyTabContentProps {
  email?: string
}

function PrivacyTabContent({ email }: PrivacyTabContentProps) {
  const maskedEmail = email
    ? email.replace(/(.{2})(.*)(@.*)/, "$1*****$3")
    : "****@gmail.com"

  return (
    <div className="flex flex-col gap-5">
      {/* Google Account */}
      <SettingsRow
        title="Logged in using Google Account"
        description={`The account that you used is ${maskedEmail}`}
      >
        <Button variant="outline" className="h-9">
          Change google authentication
        </Button>
      </SettingsRow>

      <Separator variant="dashed" />

      {/* 2FA */}
      <SettingsRow
        title="2FA-Authentication"
        description="Add an extra layer of protection to your account."
      >
        <Button variant="outline" className="h-9">
          Manage Authentication
        </Button>
      </SettingsRow>
    </div>
  )
}

// =============================================================================
// APPEARANCE TAB
// =============================================================================

interface AppearanceTabContentProps {
  theme: "light" | "dark"
  onThemeChange: (theme: "light" | "dark") => void
}

function AppearanceTabContent({
  theme,
  onThemeChange,
}: AppearanceTabContentProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">Theme</p>
        <p className="text-sm text-muted-foreground">
          Select the theme for the dashboard.
        </p>
      </div>
      <div className="flex gap-4 lg:gap-6 pt-2">
        <ThemeCard
          label="Light"
          isSelected={theme === "light"}
          onClick={() => onThemeChange("light")}
          variant="light"
        />
        <ThemeCard
          label="Dark"
          isSelected={theme === "dark"}
          onClick={() => onThemeChange("dark")}
          variant="dark"
        />
      </div>
    </div>
  )
}

interface ThemeCardProps {
  label: string
  isSelected: boolean
  onClick: () => void
  variant: "light" | "dark"
}

function ThemeCard({ label, isSelected, onClick, variant }: ThemeCardProps) {
  const isLight = variant === "light"

  return (
    <button
      onClick={onClick}
      className="flex flex-1 lg:flex-initial flex-col gap-2.5 items-center group"
    >
      <div
        className={cn(
          "w-full lg:w-[250px] p-1.5 rounded-md border-2 transition-all",
          isSelected
            ? "border-primary ring-2 ring-primary/20"
            : "border-transparent hover:border-muted-foreground/20"
        )}
      >
        <div
          className={cn(
            "rounded-md p-3 flex flex-col gap-2.5",
            isLight ? "bg-zinc-100" : "bg-zinc-950"
          )}
        >
          {/* Mock card 1 */}
          <div
            className={cn(
              "rounded-md p-2.5 flex flex-col gap-2 shadow-sm",
              isLight ? "bg-white" : "bg-zinc-900"
            )}
          >
            <div className={cn("h-2 w-16 rounded-full", isLight ? "bg-zinc-200" : "bg-zinc-700")} />
            <div className={cn("h-2 w-24 rounded-full", isLight ? "bg-zinc-200" : "bg-zinc-700")} />
          </div>
          {/* Mock card 2 */}
          <div
            className={cn(
              "rounded-md p-2.5 flex items-center gap-2 shadow-sm",
              isLight ? "bg-white" : "bg-zinc-900"
            )}
          >
            <div className={cn("size-4 rounded-full", isLight ? "bg-zinc-200" : "bg-zinc-700")} />
            <div className={cn("h-2 w-28 rounded-full", isLight ? "bg-zinc-200" : "bg-zinc-700")} />
          </div>
          {/* Mock card 3 */}
          <div
            className={cn(
              "rounded-md p-2.5 flex items-center gap-2 shadow-sm",
              isLight ? "bg-white" : "bg-zinc-900"
            )}
          >
            <div className={cn("size-4 rounded-full", isLight ? "bg-zinc-200" : "bg-zinc-700")} />
            <div className={cn("h-2 w-28 rounded-full", isLight ? "bg-zinc-200" : "bg-zinc-700")} />
          </div>
        </div>
      </div>
      <span
        className={cn(
          "text-sm font-medium transition-colors",
          isSelected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
        )}
      >
        {label}
      </span>
    </button>
  )
}

// =============================================================================
// NOTIFICATIONS TAB
// =============================================================================

interface NotificationsTabContentProps {
  emailSocial: boolean
  emailSecurity: boolean
  emailMarketing: boolean
  onToggle: (
    key: "emailSocial" | "emailSecurity" | "emailMarketing",
    value: boolean
  ) => void
}

function NotificationsTabContent({
  emailSocial,
  emailSecurity,
  emailMarketing,
  onToggle,
}: NotificationsTabContentProps) {
  return (
    <div className="flex flex-col gap-5">
      <NotificationToggle
        title="Social emails"
        description="Receive emails for friend requests, follows, and more."
        checked={emailSocial}
        onCheckedChange={(checked) => onToggle("emailSocial", checked)}
      />

      <Separator variant="dashed" />

      <NotificationToggle
        title="Security emails"
        description="Receive emails about your account activity and security."
        checked={emailSecurity}
        onCheckedChange={(checked) => onToggle("emailSecurity", checked)}
      />

      <Separator variant="dashed" />

      <NotificationToggle
        title="Marketing emails"
        description="Receive emails about new products, features, and more."
        checked={emailMarketing}
        onCheckedChange={(checked) => onToggle("emailMarketing", checked)}
      />
    </div>
  )
}

interface NotificationToggleProps {
  title: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

function NotificationToggle({
  title,
  description,
  checked,
  onCheckedChange,
}: NotificationToggleProps) {
  return (
    <div className="flex items-start gap-4">
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="mt-0.5" />
      <div className="flex-1 flex flex-col gap-1.5">
        <p className="text-sm font-medium leading-tight">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

// =============================================================================
// SHARED COMPONENTS
// =============================================================================

interface SettingsRowProps {
  title: string
  description: string
  children: React.ReactNode
}

/**
 * Settings row layout.
 * - Desktop (lg+): horizontal two-column (label left, content right)
 * - Mobile + tablet: vertical stack (label top, content below)
 */
function SettingsRow({ title, description, children }: SettingsRowProps) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
      {/* Text column */}
      <div className="flex flex-col gap-1 lg:flex-1">
        <p className="text-sm font-medium leading-5 text-foreground">{title}</p>
        <p className="text-sm leading-5 text-muted-foreground">{description}</p>
      </div>
      {/* Content column */}
      <div className="lg:flex-1">{children}</div>
    </div>
  )
}
