import { describe, it, expect } from "vitest"
import {
  canAutoStartBootstrap,
  canAutoSyncCatalog,
  classifyOutboxStatus,
  type CanAutoStartBootstrapInput,
  type CanAutoSyncCatalogInput,
} from "../bootstrap-predicates"
import type { BootstrapStatusState } from "../../domain/bootstrap-state"

describe("bootstrap-predicates", () => {
  describe("canAutoStartBootstrap", () => {
    const validPendingOnlineState: BootstrapStatusState = {
      status: "pending",
      ready: false,
      syncCursor: null,
      connectivity: "online",
      isOfflineMode: false,
    }

    it("returns true for desktop online unstarted pending state with unconsumed guard", () => {
      const input: CanAutoStartBootstrapInput = {
        isDesktop: true,
        state: validPendingOnlineState,
        autoStartConsumed: false,
      }
      expect(canAutoStartBootstrap(input)).toBe(true)
    })

    it("returns false when autoStartConsumed is true", () => {
      const input: CanAutoStartBootstrapInput = {
        isDesktop: true,
        state: validPendingOnlineState,
        autoStartConsumed: true,
      }
      expect(canAutoStartBootstrap(input)).toBe(false)
    })

    it("returns false when not desktop mode (web mode)", () => {
      const input: CanAutoStartBootstrapInput = {
        isDesktop: false,
        state: validPendingOnlineState,
        autoStartConsumed: false,
      }
      expect(canAutoStartBootstrap(input)).toBe(false)
    })

    it("returns false when connectivity is not online (unknown, reconnecting, offline, undefined)", () => {
      const connectivities: (BootstrapStatusState["connectivity"])[] = [
        "unknown",
        "reconnecting",
        "offline",
        undefined,
      ]

      for (const connectivity of connectivities) {
        const input: CanAutoStartBootstrapInput = {
          isDesktop: true,
          state: { ...validPendingOnlineState, connectivity },
          autoStartConsumed: false,
        }
        expect(canAutoStartBootstrap(input)).toBe(false)
      }
    })

    it("returns false when offline mode is active", () => {
      const input: CanAutoStartBootstrapInput = {
        isDesktop: true,
        state: { ...validPendingOnlineState, isOfflineMode: true },
        autoStartConsumed: false,
      }
      expect(canAutoStartBootstrap(input)).toBe(false)
    })

    it("returns false when status is in_progress, complete, or ready", () => {
      expect(
        canAutoStartBootstrap({
          isDesktop: true,
          state: { ...validPendingOnlineState, status: "in_progress" },
          autoStartConsumed: false,
        }),
      ).toBe(false)

      expect(
        canAutoStartBootstrap({
          isDesktop: true,
          state: { ...validPendingOnlineState, status: "complete", ready: true },
          autoStartConsumed: false,
        }),
      ).toBe(false)

      expect(
        canAutoStartBootstrap({
          isDesktop: true,
          state: { ...validPendingOnlineState, ready: true },
          autoStartConsumed: false,
        }),
      ).toBe(false)
    })

    it("returns false when state is null or undefined", () => {
      expect(
        canAutoStartBootstrap({
          isDesktop: true,
          state: null,
          autoStartConsumed: false,
        }),
      ).toBe(false)

      expect(
        canAutoStartBootstrap({
          isDesktop: true,
          state: undefined,
          autoStartConsumed: false,
        }),
      ).toBe(false)
    })
  })

  describe("canAutoSyncCatalog", () => {
    const validCompleteOnlineState: BootstrapStatusState = {
      status: "complete",
      ready: true,
      syncCursor: "cursor-1",
      connectivity: "online",
      isOfflineMode: false,
    }

    it("returns true for desktop online completed state with new sync key", () => {
      const input: CanAutoSyncCatalogInput = {
        isDesktop: true,
        state: validCompleteOnlineState,
        syncKey: "tok::http://api",
        consumedSyncKey: null,
      }
      expect(canAutoSyncCatalog(input)).toBe(true)
    })

    it("returns false when syncKey is identical to consumedSyncKey", () => {
      const input: CanAutoSyncCatalogInput = {
        isDesktop: true,
        state: validCompleteOnlineState,
        syncKey: "tok::http://api",
        consumedSyncKey: "tok::http://api",
      }
      expect(canAutoSyncCatalog(input)).toBe(false)
    })

    it("returns false when syncKey is null, undefined, or empty string", () => {
      expect(
        canAutoSyncCatalog({
          isDesktop: true,
          state: validCompleteOnlineState,
          syncKey: null,
          consumedSyncKey: null,
        }),
      ).toBe(false)

      expect(
        canAutoSyncCatalog({
          isDesktop: true,
          state: validCompleteOnlineState,
          syncKey: undefined,
          consumedSyncKey: null,
        }),
      ).toBe(false)

      expect(
        canAutoSyncCatalog({
          isDesktop: true,
          state: validCompleteOnlineState,
          syncKey: "",
          consumedSyncKey: null,
        }),
      ).toBe(false)
    })

    it("returns false when not desktop mode", () => {
      const input: CanAutoSyncCatalogInput = {
        isDesktop: false,
        state: validCompleteOnlineState,
        syncKey: "tok::http://api",
        consumedSyncKey: null,
      }
      expect(canAutoSyncCatalog(input)).toBe(false)
    })

    it("returns false when connectivity is not online", () => {
      expect(
        canAutoSyncCatalog({
          isDesktop: true,
          state: { ...validCompleteOnlineState, connectivity: "offline" },
          syncKey: "tok::http://api",
          consumedSyncKey: null,
        }),
      ).toBe(false)

      expect(
        canAutoSyncCatalog({
          isDesktop: true,
          state: { ...validCompleteOnlineState, connectivity: "unknown" },
          syncKey: "tok::http://api",
          consumedSyncKey: null,
        }),
      ).toBe(false)
    })

    it("returns false when isOfflineMode is true", () => {
      const input: CanAutoSyncCatalogInput = {
        isDesktop: true,
        state: { ...validCompleteOnlineState, isOfflineMode: true },
        syncKey: "tok::http://api",
        consumedSyncKey: null,
      }
      expect(canAutoSyncCatalog(input)).toBe(false)
    })

    it("returns false when state is not complete or not ready", () => {
      expect(
        canAutoSyncCatalog({
          isDesktop: true,
          state: { ...validCompleteOnlineState, status: "pending" },
          syncKey: "tok::http://api",
          consumedSyncKey: null,
        }),
      ).toBe(false)

      expect(
        canAutoSyncCatalog({
          isDesktop: true,
          state: { ...validCompleteOnlineState, ready: false },
          syncKey: "tok::http://api",
          consumedSyncKey: null,
        }),
      ).toBe(false)
    })

    it("returns false when state is null or undefined", () => {
      expect(
        canAutoSyncCatalog({
          isDesktop: true,
          state: null,
          syncKey: "tok::http://api",
          consumedSyncKey: null,
        }),
      ).toBe(false)
    })
  })

  describe("classifyOutboxStatus", () => {
    it("returns clean when count is undefined, 0, or negative", () => {
      expect(classifyOutboxStatus(undefined)).toBe("clean")
      expect(classifyOutboxStatus(0)).toBe("clean")
      expect(classifyOutboxStatus(-1)).toBe("clean")
    })

    it("returns blocked when count is greater than 0", () => {
      expect(classifyOutboxStatus(1)).toBe("blocked")
      expect(classifyOutboxStatus(5)).toBe("blocked")
    })
  })
})
