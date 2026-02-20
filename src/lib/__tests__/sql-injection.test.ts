import { describe, it, expect } from "vitest";

// Same patterns as in export/route.ts
const forbidden =
  /\b(DROP|DELETE|INSERT|UPDATE|CREATE|ALTER|EXEC|EXECUTE|UNION|INTO|GRANT|TRUNCATE|COPY|LOAD|ATTACH|CALL|PRAGMA)\b/i;
const dangerousChars = /;|--|\/\*|\*\/|\bSELECT\b/i;

function isFilterSafe(filter: string): boolean {
  return !forbidden.test(filter) && !dangerousChars.test(filter);
}

describe("Export SQL injection protection", () => {
  describe("blocks dangerous keywords", () => {
    const dangerous = [
      "1=1; DROP TABLE users",
      "icp_tier = 'Tier 1' UNION SELECT * FROM secrets",
      "1=1 DELETE FROM contacts",
      "1=1 INSERT INTO logs VALUES (1)",
      "1=1 UPDATE contacts SET email = 'hacked'",
      "1=1 CREATE TABLE hack (id INT)",
      "ALTER TABLE contacts ADD COLUMN pwned TEXT",
      "EXEC xp_cmdshell('whoami')",
      "GRANT ALL PRIVILEGES TO hacker",
      "TRUNCATE TABLE contacts",
      "COPY contacts TO '/tmp/stolen.csv'",
      "LOAD 'malicious_extension'",
      "ATTACH 'external.db'",
      "CALL dangerous_procedure()",
      "PRAGMA enable_profiling",
    ];

    it.each(dangerous)("blocks: %s", (filter) => {
      expect(isFilterSafe(filter)).toBe(false);
    });
  });

  describe("blocks dangerous characters/patterns", () => {
    const dangerous = [
      "icp_tier = 'Tier 1'; DROP TABLE x",
      "icp_tier = 'Tier 1' -- comment",
      "icp_tier = 'Tier 1' /* block comment */",
      "1=1 OR (SELECT password FROM users)",
      "icp_tier = (SELECT 1)",
    ];

    it.each(dangerous)("blocks: %s", (filter) => {
      expect(isFilterSafe(filter)).toBe(false);
    });
  });

  describe("allows legitimate filters", () => {
    const safe = [
      "icp_tier IS NOT NULL",
      "icp_tier = 'Tier 1'",
      "icp_tier IN ('Tier 1', 'Tier 1.5')",
      "icp_tier IS NOT NULL AND email IS NOT NULL AND email != ''",
      "icp_tier IS NOT NULL AND (linkedinUrl IS NULL OR linkedinUrl = '')",
      "icp_tier = 'Tier 1' AND email IS NOT NULL",
      "email LIKE '%@gmail.com'",
      "companyName ILIKE '%bank%'",
    ];

    it.each(safe)("allows: %s", (filter) => {
      expect(isFilterSafe(filter)).toBe(true);
    });
  });

  describe("case insensitive blocking", () => {
    it("blocks regardless of case", () => {
      expect(isFilterSafe("drop table x")).toBe(false);
      expect(isFilterSafe("Drop Table x")).toBe(false);
      expect(isFilterSafe("select 1")).toBe(false);
    });
  });
});
