/**
 * Account Settings Dialog — PlayLexi
 *
 * Modal dialog for managing user account settings.
 * Opens when user clicks "Account Settings" from the user menu dropdown.
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
 *
 * @see Figma node 2582:6142 (Settings Dialog)
 * @see db/schema.ts users table for editable fields
 */

"use client"

import * as React from "react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"
import { useSession } from "@/lib/auth/client"
import { AVATARS, getAvatarById, type AvatarConfig } from "@/lib/avatar-utils"
import {
  CircleUserIcon,
  ShieldIcon,
  PaletteIcon,
  BellIcon,
  ChevronRightIcon,
} from "@/lib/icons"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { AvatarOption } from "@/components/ui/avatar-selector"

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
 * Features:
 * - Sidebar navigation with 4 tabs
 * - Profile settings (avatar, username, bio)
 * - Privacy & Security (Google account, 2FA)
 * - Appearance (theme switcher)
 * - Notifications (email preferences)
 */
export function AccountSettingsDialog({
  open,
  onOpenChange,
}: AccountSettingsDialogProps) {
  const { data: session } = useSession()
  const { theme: currentTheme, setTheme } = useTheme()

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
        // User has no PlayLexi profile yet - they need to complete onboarding
        setError("Please complete your profile setup first.")
      } else {
        setError("Failed to load settings. Please try again.")
      }
    } catch (error) {
      console.error("[AccountSettings] Failed to load settings:", error)
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
    } catch (error) {
      console.error("[AccountSettings] Save error:", error)
      // TODO: Show error toast
    } finally {
      setIsSaving(false)
    }
  }

  const handleDiscard = () => {
    loadUserSettings()
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

  // Theme changes immediately (applies visually via ThemeProvider + persists to DB)
  const handleThemeChange = (newTheme: "light" | "dark") => {
    // Update local state
    setFormData((prev) => ({ ...prev, theme: newTheme }))
    // Apply theme immediately via next-themes
    setTheme(newTheme)
    // Persist to server
    updateSetting("theme", newTheme)
  }

  // Notification toggles change immediately
  const handleNotificationChange = async (
    key: "emailSocial" | "emailSecurity" | "emailMarketing",
    value: boolean
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
    await updateSetting(key, value)
  }

  // Update a single setting immediately (for theme and notifications)
  const updateSetting = async (
    key: string,
    value: boolean | string
  ) => {
    try {
      await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      })
    } catch (error) {
      console.error("[AccountSettings] Failed to update setting:", error)
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
        className="w-[980px] max-w-[980px] sm:max-w-[980px] h-[680px] p-0 gap-0 overflow-hidden rounded-3xl ring-0 shadow-[var(--shadow-dialog)]"
      >
        <div className="flex h-full">
          {/* Sidebar */}
          <SettingsSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          {/* Content */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <SettingsHeader
              title={activeTabConfig.title}
              description={activeTabConfig.description}
              onClose={() => onOpenChange(false)}
            />

            {/* Tab Content - 24px padding per Figma */}
            <div className="flex-1 overflow-y-auto p-6 bg-background">
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
                    <PrivacyTabContent
                      email={session?.user?.email}
                    />
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

            {/* Footer */}
            <SettingsFooter
              onDiscard={handleDiscard}
              onSave={handleSave}
              isSaving={isSaving}
              hasChanges={hasChanges}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// SIDEBAR COMPONENT
// =============================================================================

interface SettingsSidebarProps {
  activeTab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
}

function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
  return (
    <div className="w-[256px] shrink-0 border-r border-border bg-background h-full">
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
      {/* Close button: 36px, transparent bg per Figma */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClose}
        className="shrink-0 size-9"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
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
}

function SettingsFooter({
  onDiscard,
  onSave,
  isSaving,
  hasChanges,
}: SettingsFooterProps) {
  return (
    <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
      <Button
        variant="outline"
        onClick={onDiscard}
        disabled={!hasChanges || isSaving}
      >
        Discard
      </Button>
      <Button
        onClick={onSave}
        disabled={!hasChanges || isSaving}
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
          className="max-w-[280px]"
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
  // Mask email for display
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
      <div className="flex gap-6 pt-2">
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

  // Static preview colors (intentionally not theme-aware - these show what each theme looks like)
  // Using Tailwind zinc scale for consistency:
  // Light: zinc-100 bg, white cards, zinc-200 skeletons
  // Dark: zinc-950 bg, zinc-900 cards, zinc-700 skeletons

  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-2.5 items-center group"
    >
      <div
        className={cn(
          "w-[250px] p-1.5 rounded-md border-2 transition-all",
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
            <div
              className={cn(
                "h-2 w-16 rounded-full",
                isLight ? "bg-zinc-200" : "bg-zinc-700"
              )}
            />
            <div
              className={cn(
                "h-2 w-24 rounded-full",
                isLight ? "bg-zinc-200" : "bg-zinc-700"
              )}
            />
          </div>
          {/* Mock card 2 */}
          <div
            className={cn(
              "rounded-md p-2.5 flex items-center gap-2 shadow-sm",
              isLight ? "bg-white" : "bg-zinc-900"
            )}
          >
            <div
              className={cn(
                "size-4 rounded-full",
                isLight ? "bg-zinc-200" : "bg-zinc-700"
              )}
            />
            <div
              className={cn(
                "h-2 w-28 rounded-full",
                isLight ? "bg-zinc-200" : "bg-zinc-700"
              )}
            />
          </div>
          {/* Mock card 3 */}
          <div
            className={cn(
              "rounded-md p-2.5 flex items-center gap-2 shadow-sm",
              isLight ? "bg-white" : "bg-zinc-900"
            )}
          >
            <div
              className={cn(
                "size-4 rounded-full",
                isLight ? "bg-zinc-200" : "bg-zinc-700"
              )}
            />
            <div
              className={cn(
                "h-2 w-28 rounded-full",
                isLight ? "bg-zinc-200" : "bg-zinc-700"
              )}
            />
          </div>
        </div>
      </div>
      <span className={cn(
        "text-sm font-medium transition-colors",
        isSelected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
      )}>{label}</span>
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

function SettingsRow({ title, description, children }: SettingsRowProps) {
  return (
    <div className="flex items-center gap-6">
      {/* Text column: 4px gap per Figma */}
      <div className="flex-1 flex flex-col gap-1">
        <p className="text-sm font-medium leading-5 text-foreground">{title}</p>
        <p className="text-sm leading-5 text-muted-foreground">{description}</p>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}
