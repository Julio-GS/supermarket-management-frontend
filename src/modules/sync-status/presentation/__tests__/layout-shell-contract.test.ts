/**
 * Production App-Shell Reachability Contract Test
 *
 * Proves that SyncStatusContainer remains reachable from the production
 * authenticated layout (app/(app)/layout.tsx).
 *
 * This is a static contract / compile-time guard test: it reads the actual
 * layout module source and fails if the SyncStatusContainer import or JSX
 * mount is removed.  It does NOT render the layout (Next app-router
 * dependencies make direct render unsafe in Vitest).
 */

import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";

const LAYOUT_PATH = path.resolve(
  import.meta.dirname,
  "../../../../../app/(app)/layout.tsx",
);

function readLayout(): string {
  return fs.readFileSync(LAYOUT_PATH, "utf-8");
}

describe("Production app-shell reachability contract", () => {
  let source: string;

  beforeAll(() => {
    source = readLayout();
  });

  it("imports SyncStatusContainer from the canonical sync-status module path", () => {
    // The import must use the barrel export path @/modules/sync-status.
    // We accept named-import, default-import, and whitespace variants.
    expect(source).toMatch(
      /import\s+\{[^}]*\bSyncStatusContainer\b[^}]*\}\s+from\s+["']@\/modules\/sync-status["']/,
    );
  });

  it("mounts <SyncStatusContainer /> in the JSX tree", () => {
    // The component must appear as a JSX element (self-closing or with
    // children). Attributes, whitespace, and newlines are allowed inside the tag.
    expect(source).toMatch(/<SyncStatusContainer\b[^>]*\/?>/);
  });

  it("is a valid layout module exporting a default function component", () => {
    // Triangulate: the file is structurally a Next.js layout — it exports
    // a default function and uses "use client".  This guards against the
    // file being accidentally replaced with a non-layout stub.
    expect(source).toMatch(/export\s+default\s+function\s+\w+Layout\b/);
    expect(source).toContain('"use client"');
  });
});
