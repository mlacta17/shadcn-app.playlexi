"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Logo } from "@/components/ui/logo"
import { TopNavbar } from "@/components/ui/top-navbar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { useUsernameCheck, type UsernameStatus } from "@/hooks/use-username-check"
import { AGE_RANGES, birthYearFromAgeRange, type AgeRangeValue } from "@/lib/age-utils"
import { sanitizeUsername, USERNAME_MAX_LENGTH } from "@/lib/username-utils"
import { CheckIcon } from "@/lib/icons"
import { AVATARS, getAvatarById } from "@/lib/avatar-utils"
import { AvatarOption, AvatarPreview } from "@/components/ui/avatar-selector"

// =============================================================================
// TYPES
// =============================================================================

type ProfileStep = "username" | "avatar"

interface ProfileFormData {
  username: string
  ageRange: AgeRangeValue | null
  avatarId: number
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Profile Completion Page
 *
 * Two-step form for new users to complete their profile after OAuth:
 * 1. Username & Age (required username, optional age)
 * 2. Avatar Selection
 *
 * ## Flow
 * Tutorial → Placement Test → Rank Result → OAuth → **Profile Completion** → Dashboard
 *
 * ## Architecture Decision
 * Single page with internal step state (not separate routes) because:
 * - Shared state is trivial (useState lives in one component)
 * - No need to persist partial data between navigations
 * - User can't bookmark mid-flow
 *
 * @see Figma node 2760:35902 (Step 1)
 */
export default function ProfilePage() {
  const router = useRouter()

  // ---------------------------------------------------------------------------
  // Step State
  // ---------------------------------------------------------------------------
  const [step, setStep] = React.useState<ProfileStep>("username")

  // ---------------------------------------------------------------------------
  // Form State
  // ---------------------------------------------------------------------------
  const [formData, setFormData] = React.useState<ProfileFormData>({
    username: "",
    ageRange: null,
    avatarId: 1,
  })
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // ---------------------------------------------------------------------------
  // Username Validation
  // ---------------------------------------------------------------------------
  const {
    status: usernameStatus,
    error: usernameError,
    checkUsername,
  } = useUsernameCheck()

  // ---------------------------------------------------------------------------
  // Computed Values
  // ---------------------------------------------------------------------------

  // Step 1 is valid when username is available
  const isStep1Valid = usernameStatus === "available"

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleClose = () => {
    // Return to home (will need to go through onboarding again)
    router.push("/")
  }

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFormData((prev) => ({ ...prev, username: value }))
    checkUsername(value)
  }

  const handleAgeRangeChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      ageRange: value as AgeRangeValue,
    }))
  }

  const handleNextStep = () => {
    if (isStep1Valid) {
      setStep("avatar")
    }
  }

  const handleBackToStep1 = () => {
    setStep("username")
  }

  const handleAvatarSelect = (avatarId: number) => {
    setFormData((prev) => ({ ...prev, avatarId }))
  }

  const handleFinish = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      // Sanitize username before submission
      const username = sanitizeUsername(formData.username)
      const birthYear = formData.ageRange
        ? birthYearFromAgeRange(formData.ageRange)
        : null

      // TODO: Call API to create user record
      // For now, just navigate to dashboard
      console.log("Creating user with:", {
        username,
        birthYear,
        avatarId: formData.avatarId,
      })

      // Navigate to dashboard after profile completion
      router.push("/")
    } catch (error) {
      console.error("[ProfilePage] Error creating user:", error)
      setIsSubmitting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="bg-background flex min-h-screen flex-col">
      {/* Top Navigation */}
      <TopNavbar onClose={handleClose} hideSkip />

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center px-6 py-10">
        <div className="flex w-full max-w-sm flex-col items-center gap-8">
          {/* Logo - shown on Step 1 only per Figma design */}
          {step === "username" && <Logo size="default" asStatic />}

          {step === "username" ? (
            <UsernameAgeStep
              username={formData.username}
              ageRange={formData.ageRange}
              usernameStatus={usernameStatus}
              usernameError={usernameError}
              onUsernameChange={handleUsernameChange}
              onAgeRangeChange={handleAgeRangeChange}
              onNext={handleNextStep}
              isValid={isStep1Valid}
            />
          ) : (
            <AvatarStep
              selectedAvatarId={formData.avatarId}
              onAvatarSelect={handleAvatarSelect}
              onBack={handleBackToStep1}
              onFinish={handleFinish}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </main>
    </div>
  )
}

// =============================================================================
// STEP 1: USERNAME & AGE
// =============================================================================

interface UsernameAgeStepProps {
  username: string
  ageRange: AgeRangeValue | null
  usernameStatus: UsernameStatus
  usernameError: string | null
  onUsernameChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onAgeRangeChange: (value: string) => void
  onNext: () => void
  isValid: boolean
}

function UsernameAgeStep({
  username,
  ageRange,
  usernameStatus,
  usernameError,
  onUsernameChange,
  onAgeRangeChange,
  onNext,
  isValid,
}: UsernameAgeStepProps) {
  // Determine input state for styling
  const isUsernameError = usernameStatus === "invalid" || usernameStatus === "taken"
  const isUsernameAvailable = usernameStatus === "available"

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Title */}
      <h1 className="text-2xl font-bold text-card-foreground text-center">
        Complete your profile
      </h1>

      {/* Form Fields */}
      <div className="flex flex-col gap-4">
        {/* Username Field */}
        <div className="flex flex-col gap-1.5">
          <div className="relative">
            <Input
              type="text"
              placeholder="Username"
              value={username}
              onChange={onUsernameChange}
              maxLength={USERNAME_MAX_LENGTH}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={isUsernameError}
              aria-describedby={usernameError ? "username-error" : undefined}
              className="pr-10"
            />
            {/* Status indicator */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {usernameStatus === "checking" && (
                <div className="size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              )}
              {isUsernameAvailable && (
                <CheckIcon className="size-4 text-green-600" />
              )}
            </div>
          </div>
          {/* Error message */}
          {usernameError && (
            <p
              id="username-error"
              className="text-sm text-destructive"
            >
              {usernameError}
            </p>
          )}
          {/* Available message */}
          {isUsernameAvailable && (
            <p className="text-sm text-green-600">
              Username is available
            </p>
          )}
        </div>

        {/* Age Range Field */}
        <Select
          value={ageRange ?? undefined}
          onValueChange={onAgeRangeChange}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Age (optional)" />
          </SelectTrigger>
          <SelectContent>
            {AGE_RANGES.map((range) => (
              <SelectItem key={range.value} value={range.value}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Next Button */}
      <Button
        onClick={onNext}
        disabled={!isValid}
        className="w-full"
      >
        Next
      </Button>
    </div>
  )
}

// =============================================================================
// STEP 2: AVATAR SELECTION
// =============================================================================

interface AvatarStepProps {
  selectedAvatarId: number
  onAvatarSelect: (id: number) => void
  onBack: () => void
  onFinish: () => void
  isSubmitting: boolean
}

/**
 * Avatar selection step.
 *
 * Layout:
 * - Title: "Choose your avatar"
 * - Subtitle explaining they can change later
 * - Large avatar preview (204px desktop, 180px mobile)
 * - Selection label
 * - Three avatar options in a row
 * - Finish button + Go back link
 *
 * @see Figma node 2763:36175
 */
function AvatarStep({
  selectedAvatarId,
  onAvatarSelect,
  onBack,
  onFinish,
  isSubmitting,
}: AvatarStepProps) {
  const selectedAvatar = getAvatarById(selectedAvatarId) ?? AVATARS[0]

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {/* Title & Subtitle */}
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold text-card-foreground">
          Choose your avatar
        </h1>
        <p className="text-sm text-muted-foreground">
          Select the photo that represents you! You can always change your avatar later
        </p>
      </div>

      {/* Large Avatar Preview */}
      <AvatarPreview
        avatar={selectedAvatar}
        size={204}
        className="max-sm:size-[180px]"
      />

      {/* Selection Section */}
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-muted-foreground">
          Select 1 out of these 3 avatars:
        </p>

        {/* Avatar Options */}
        <div className="flex justify-center gap-4">
          {AVATARS.map((avatar) => (
            <AvatarOption
              key={avatar.id}
              avatar={avatar}
              isSelected={selectedAvatarId === avatar.id}
              onSelect={onAvatarSelect}
            />
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex w-full flex-col gap-2">
        <Button
          onClick={onFinish}
          disabled={isSubmitting}
          className="w-full"
        >
          {isSubmitting ? "Creating profile..." : "Finish"}
        </Button>
        <Button
          variant="ghost"
          onClick={onBack}
          disabled={isSubmitting}
          className="w-full"
        >
          Go back
        </Button>
      </div>
    </div>
  )
}
