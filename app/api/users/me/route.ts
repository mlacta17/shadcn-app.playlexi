/**
 * Current User API Route — PlayLexi
 *
 * GET: Returns the current user's PlayLexi profile data.
 * PATCH: Updates the current user's profile and settings.
 *
 * ## GET Response
 * - 200: User profile (username, avatarId, settings, etc.)
 * - 401: Not authenticated
 * - 404: Authenticated but no PlayLexi profile (new user)
 *
 * ## PATCH Request Body
 * Any subset of: { username, bio, avatarId, theme, emailSocial, emailSecurity, emailMarketing }
 *
 * ## PATCH Response
 * - 200: Updated user profile
 * - 400: Validation error
 * - 401: Not authenticated
 * - 404: Profile not found
 *
 * @see lib/services/user-service.ts for getUserById, updateUser
 */

import { NextResponse, type NextRequest } from "next/server"
import { requireAuth, handleApiError, AppError, ErrorCode } from "@/lib/api"
import { getUserById, updateUser, type UpdateUserInput } from "@/lib/services/user-service"

export async function GET() {
  try {
    // Require authentication
    const { user, db } = await requireAuth()

    // Get PlayLexi user profile
    const profile = await getUserById(db, user.id)

    if (!profile) {
      // Special case: authenticated but no profile yet (new user)
      throw new AppError(
        "Profile not found",
        ErrorCode.NOT_FOUND,
        { needsProfile: true }
      )
    }

    // Return user profile data needed by client (including settings)
    return NextResponse.json({
      id: profile.id,
      username: profile.username,
      email: profile.email,
      avatarId: profile.avatarId,
      bio: profile.bio,
      createdAt: profile.createdAt,
      // Settings
      theme: profile.theme,
      emailSocial: profile.emailSocial,
      emailSecurity: profile.emailSecurity,
      emailMarketing: profile.emailMarketing,
      // Tutorial tracking
      hasCompletedTutorial: profile.hasCompletedTutorial,
      // Include ranks for leaderboard display (XP-based)
      ranks: profile.ranks,
      // Include skill ratings for game difficulty matching (Glicko-2)
      skillRatings: profile.skillRatings,
    })
  } catch (error) {
    return handleApiError(error, "[GetCurrentUser]")
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Require authentication
    const { user, db } = await requireAuth()

    // Parse request body
    const body = await request.json() as Partial<UpdateUserInput>

    // Validate: ensure user exists
    const existingProfile = await getUserById(db, user.id)
    if (!existingProfile) {
      throw new AppError(
        "Profile not found",
        ErrorCode.NOT_FOUND
      )
    }

    // Build update object with only allowed fields
    const updateData: UpdateUserInput = {}

    if (body.username !== undefined) {
      // TODO: Add username validation (unique check, format check)
      updateData.username = body.username
    }
    if (body.bio !== undefined) {
      updateData.bio = body.bio
    }
    if (body.avatarId !== undefined) {
      // Validate avatarId (must be 1, 2, or 3)
      if (![1, 2, 3].includes(body.avatarId)) {
        throw new AppError(
          "Invalid avatar ID. Must be 1, 2, or 3.",
          ErrorCode.VALIDATION_ERROR
        )
      }
      updateData.avatarId = body.avatarId
    }
    if (body.theme !== undefined) {
      // Validate theme
      if (!["light", "dark"].includes(body.theme)) {
        throw new AppError(
          "Invalid theme. Must be 'light' or 'dark'.",
          ErrorCode.VALIDATION_ERROR
        )
      }
      updateData.theme = body.theme
    }
    if (body.emailSocial !== undefined) {
      updateData.emailSocial = Boolean(body.emailSocial)
    }
    if (body.emailSecurity !== undefined) {
      updateData.emailSecurity = Boolean(body.emailSecurity)
    }
    if (body.emailMarketing !== undefined) {
      updateData.emailMarketing = Boolean(body.emailMarketing)
    }
    if (body.hasCompletedTutorial !== undefined) {
      updateData.hasCompletedTutorial = Boolean(body.hasCompletedTutorial)
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      throw new AppError(
        "No valid fields to update",
        ErrorCode.VALIDATION_ERROR
      )
    }

    // Perform update
    const updatedProfile = await updateUser(db, user.id, updateData)

    // Return updated profile
    return NextResponse.json({
      id: updatedProfile.id,
      username: updatedProfile.username,
      email: updatedProfile.email,
      avatarId: updatedProfile.avatarId,
      bio: updatedProfile.bio,
      theme: updatedProfile.theme,
      emailSocial: updatedProfile.emailSocial,
      emailSecurity: updatedProfile.emailSecurity,
      emailMarketing: updatedProfile.emailMarketing,
    })
  } catch (error) {
    return handleApiError(error, "[UpdateCurrentUser]")
  }
}
