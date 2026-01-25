/**
 * API Error Handling Tests
 *
 * Tests the centralized error handling system to ensure:
 * 1. Error codes map correctly to HTTP status codes
 * 2. AppError properly serializes to JSON
 * 3. Error factories create correct error types
 * 4. handleApiError produces correct responses
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"
import {
  AppError,
  ErrorCode,
  Errors,
  handleApiError,
  type ApiErrorResponse,
} from "./errors"

// =============================================================================
// AppError Class
// =============================================================================

describe("AppError", () => {
  describe("construction", () => {
    it("creates error with message and code", () => {
      const error = new AppError("Test error", ErrorCode.NOT_FOUND)
      expect(error.message).toBe("Test error")
      expect(error.code).toBe(ErrorCode.NOT_FOUND)
      expect(error.status).toBe(404)
      expect(error.name).toBe("AppError")
    })

    it("uses default INTERNAL_ERROR code when not specified", () => {
      const error = new AppError("Test error")
      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR)
      expect(error.status).toBe(500)
    })

    it("includes optional details", () => {
      const details = { field: "email", expected: "string" }
      const error = new AppError("Invalid", ErrorCode.VALIDATION_ERROR, details)
      expect(error.details).toEqual(details)
    })

    it("allows custom status code override", () => {
      const error = new AppError("Custom", ErrorCode.INTERNAL_ERROR, undefined, 503)
      expect(error.status).toBe(503)
    })
  })

  describe("status code mapping", () => {
    it("maps UNAUTHORIZED to 401", () => {
      const error = new AppError("Auth failed", ErrorCode.UNAUTHORIZED)
      expect(error.status).toBe(401)
    })

    it("maps FORBIDDEN to 403", () => {
      const error = new AppError("No access", ErrorCode.FORBIDDEN)
      expect(error.status).toBe(403)
    })

    it("maps NOT_FOUND to 404", () => {
      const error = new AppError("Not found", ErrorCode.NOT_FOUND)
      expect(error.status).toBe(404)
    })

    it("maps CONFLICT to 409", () => {
      const error = new AppError("Already exists", ErrorCode.CONFLICT)
      expect(error.status).toBe(409)
    })

    it("maps VALIDATION_ERROR to 400", () => {
      const error = new AppError("Invalid", ErrorCode.VALIDATION_ERROR)
      expect(error.status).toBe(400)
    })

    it("maps INVALID_INPUT to 400", () => {
      const error = new AppError("Bad input", ErrorCode.INVALID_INPUT)
      expect(error.status).toBe(400)
    })

    it("maps RATE_LIMITED to 429", () => {
      const error = new AppError("Too many requests", ErrorCode.RATE_LIMITED)
      expect(error.status).toBe(429)
    })

    it("maps DATABASE_ERROR to 500", () => {
      const error = new AppError("DB failed", ErrorCode.DATABASE_ERROR)
      expect(error.status).toBe(500)
    })
  })

  describe("toJSON()", () => {
    it("serializes basic error", () => {
      const error = new AppError("Test message", ErrorCode.NOT_FOUND)
      const json = error.toJSON()

      expect(json).toEqual({
        error: "Test message",
        code: ErrorCode.NOT_FOUND,
      })
    })

    it("includes details when present", () => {
      const error = new AppError("Invalid", ErrorCode.VALIDATION_ERROR, {
        field: "name",
        reason: "too short",
      })
      const json = error.toJSON()

      expect(json).toEqual({
        error: "Invalid",
        code: ErrorCode.VALIDATION_ERROR,
        details: {
          field: "name",
          reason: "too short",
        },
      })
    })

    it("omits details when not provided", () => {
      const error = new AppError("Simple error", ErrorCode.INTERNAL_ERROR)
      const json = error.toJSON()

      expect(json).not.toHaveProperty("details")
    })
  })
})

// =============================================================================
// Error Factories (Errors object)
// =============================================================================

describe("Errors", () => {
  describe("unauthorized()", () => {
    it("creates UNAUTHORIZED error with default message", () => {
      const error = Errors.unauthorized()
      expect(error.code).toBe(ErrorCode.UNAUTHORIZED)
      expect(error.message).toBe("Not authenticated")
      expect(error.status).toBe(401)
    })

    it("allows custom message", () => {
      const error = Errors.unauthorized("Session expired")
      expect(error.message).toBe("Session expired")
    })
  })

  describe("forbidden()", () => {
    it("creates FORBIDDEN error with default message", () => {
      const error = Errors.forbidden()
      expect(error.code).toBe(ErrorCode.FORBIDDEN)
      expect(error.message).toBe("Permission denied")
      expect(error.status).toBe(403)
    })
  })

  describe("notFound()", () => {
    it("creates NOT_FOUND error with resource name", () => {
      const error = Errors.notFound("User")
      expect(error.code).toBe(ErrorCode.NOT_FOUND)
      expect(error.message).toBe("User not found")
      expect(error.status).toBe(404)
    })

    it("includes resource ID when provided", () => {
      const error = Errors.notFound("Game", "abc123")
      expect(error.message).toBe("Game not found: abc123")
      expect(error.details).toEqual({ resource: "Game", id: "abc123" })
    })
  })

  describe("validation()", () => {
    it("creates VALIDATION_ERROR with message", () => {
      const error = Errors.validation("Input is invalid")
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR)
      expect(error.status).toBe(400)
    })

    it("includes details when provided", () => {
      const error = Errors.validation("Invalid fields", {
        fields: ["email", "name"],
      })
      expect(error.details).toEqual({ fields: ["email", "name"] })
    })
  })

  describe("invalidInput()", () => {
    it("creates INVALID_INPUT error for a field", () => {
      const error = Errors.invalidInput("mode", "Must be valid")
      expect(error.code).toBe(ErrorCode.INVALID_INPUT)
      expect(error.message).toBe("Invalid mode: Must be valid")
      expect(error.details).toEqual({ field: "mode" })
    })

    it("includes expected and received values", () => {
      const error = Errors.invalidInput(
        "mode",
        "Must be valid",
        ["endless", "blitz"],
        "invalid"
      )
      expect(error.details).toEqual({
        field: "mode",
        expected: ["endless", "blitz"],
        received: "invalid",
      })
    })
  })

  describe("conflict()", () => {
    it("creates CONFLICT error for resource", () => {
      const error = Errors.conflict("User")
      expect(error.code).toBe(ErrorCode.CONFLICT)
      expect(error.message).toBe("User already exists")
      expect(error.status).toBe(409)
    })

    it("includes field when provided", () => {
      const error = Errors.conflict("User", "email")
      expect(error.message).toBe("User with this email already exists")
      expect(error.details).toEqual({ resource: "User", field: "email" })
    })
  })

  describe("database()", () => {
    it("creates DATABASE_ERROR with operation", () => {
      const error = Errors.database("insert")
      expect(error.code).toBe(ErrorCode.DATABASE_ERROR)
      expect(error.message).toBe("Database error during insert")
      expect(error.status).toBe(500)
    })
  })
})

// =============================================================================
// handleApiError()
// =============================================================================

describe("handleApiError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(console, "log").mockImplementation(() => {})
  })

  it("handles AppError and returns correct response", async () => {
    const appError = new AppError("Not found", ErrorCode.NOT_FOUND)
    const response = handleApiError(appError, "[Test]")

    expect(response).toBeInstanceOf(NextResponse)
    expect(response.status).toBe(404)

    const body = await response.json()
    expect(body).toEqual({
      error: "Not found",
      code: ErrorCode.NOT_FOUND,
    })
  })

  it("handles AppError with details", async () => {
    const appError = new AppError("Invalid input", ErrorCode.INVALID_INPUT, {
      field: "mode",
    })
    const response = handleApiError(appError)

    const body = await response.json()
    expect(body.details).toEqual({ field: "mode" })
  })

  it("handles standard Error and returns 500", async () => {
    const stdError = new Error("Something went wrong")
    const response = handleApiError(stdError, "[Test]")

    expect(response.status).toBe(500)

    const body = await response.json()
    expect(body).toEqual({
      error: "An unexpected error occurred",
      code: ErrorCode.INTERNAL_ERROR,
    })
  })

  it("does not expose internal error details", async () => {
    const stdError = new Error("Database connection failed: credentials wrong")
    const response = handleApiError(stdError)

    const body = await response.json()
    expect(body.error).not.toContain("credentials")
    expect(body.error).toBe("An unexpected error occurred")
  })

  it("handles non-Error throws", async () => {
    const response = handleApiError("string error")

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.code).toBe(ErrorCode.INTERNAL_ERROR)
  })

  it("logs 500 errors", () => {
    const appError = new AppError("Server failed", ErrorCode.INTERNAL_ERROR)
    handleApiError(appError, "[ServerError]")

    expect(console.error).toHaveBeenCalled()
  })
})
