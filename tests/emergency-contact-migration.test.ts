import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationDirectory = join(process.cwd(), "supabase/migrations");
const migrationName = readdirSync(migrationDirectory).find((name) =>
  /^\d+_grant_trip_emergency_contact_insert\.sql$/.test(name),
);

if (!migrationName) {
  throw new Error("Emergency-contact INSERT grant migration was not found.");
}

const migration = readFileSync(join(migrationDirectory, migrationName), "utf8");
const baseline = readFileSync(
  join(migrationDirectory, "20261101162815_khayee_clean_baseline.sql"),
  "utf8",
);
const publishedTripAccess = readFileSync(
  join(migrationDirectory, "20261102113109_public_published_trip_access.sql"),
  "utf8",
);

describe("emergency-contact trip INSERT grant migration", () => {
  it("adds only the column-level emergency-contact INSERT grant", () => {
    const statements = migration
      .replace(/--.*$/gm, "")
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);

    expect(statements).toEqual([
      "GRANT INSERT (emergency_contact_information)\nON public.trips\nTO authenticated",
    ]);
    expect(migration).not.toMatch(
      /GRANT\s+INSERT\s+ON\s+(?:TABLE\s+)?public\.trips\b/i,
    );
  });

  it("preserves existing trip UPDATE grants and RLS policies", () => {
    expect(baseline).toMatch(
      /grant update \(emergency_contact_information\)\s+on table public\.trips to authenticated;/i,
    );
    expect(baseline).toMatch(
      /grant update \([\s\S]*?\)\s+on table public\.trips to authenticated;/i,
    );
    expect(baseline).toContain("create policy trips_insert_own_draft");
    expect(baseline).toContain("create policy trips_update_own_editable");
    expect(baseline).toContain("create policy trips_read_published_owner_or_admin");
    expect(publishedTripAccess).toContain("create policy trips_read_published_anon");
    expect(publishedTripAccess).toContain(
      "create policy trips_read_published_authenticated_owner_or_admin",
    );
    expect(migration).not.toMatch(/\b(?:UPDATE|CREATE|ALTER|DROP)\b/i);
  });
});
