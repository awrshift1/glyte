import { describe, it, expect } from "vitest";
import { detectContactCsv } from "@/lib/contact-detector";

describe("detectContactCsv", () => {
  it("detects a typical conference CSV", () => {
    const result = detectContactCsv(["Name", "Email", "Company", "Job Title", "Country"]);
    expect(result.isContact).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result.emailColumn).toBe("Email");
    expect(result.titleColumn).toBe("Job Title");
    expect(result.companyColumn).toBe("Company");
  });

  it("detects CRM export columns", () => {
    const result = detectContactCsv([
      "firstName", "lastName", "e-mail", "linkedinUrl",
      "companyName", "position", "phone",
    ]);
    expect(result.isContact).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result.emailColumn).toBe("e-mail");
    expect(result.linkedinColumn).toBe("linkedinUrl");
    expect(result.companyColumn).toBe("companyName");
  });

  it("rejects financial data CSV", () => {
    const result = detectContactCsv(["date", "transaction_id", "amount", "currency", "status"]);
    expect(result.isContact).toBe(false);
    expect(result.confidence).toBeLessThan(0.4);
  });

  it("rejects product inventory CSV", () => {
    const result = detectContactCsv(["product_id", "sku", "price", "quantity", "category"]);
    expect(result.isContact).toBe(false);
  });

  it("handles minimal contact columns", () => {
    const result = detectContactCsv(["email", "name"]);
    expect(result.isContact).toBe(true);
    expect(result.emailColumn).toBe("email");
  });

  it("maps title column from multiple patterns", () => {
    expect(detectContactCsv(["job_title"]).titleColumn).toBe("job_title");
    expect(detectContactCsv(["title"]).titleColumn).toBe("title");
    expect(detectContactCsv(["role"]).titleColumn).toBe("role");
    expect(detectContactCsv(["designation"]).titleColumn).toBe("designation");
  });

  it("maps LinkedIn column from multiple patterns", () => {
    expect(detectContactCsv(["linkedin"]).linkedinColumn).toBe("linkedin");
    expect(detectContactCsv(["linkedin_url"]).linkedinColumn).toBe("linkedin_url");
    expect(detectContactCsv(["linkedinUrl"]).linkedinColumn).toBe("linkedinUrl");
    expect(detectContactCsv(["linkedin_profile"]).linkedinColumn).toBe("linkedin_profile");
  });

  it("confidence caps at 1.0", () => {
    const result = detectContactCsv([
      "email", "linkedin", "job_title", "company",
      "name", "first_name", "last_name", "phone",
      "country", "city", "website", "industry",
    ]);
    expect(result.confidence).toBeLessThanOrEqual(1.0);
  });

  it("handles empty column list", () => {
    const result = detectContactCsv([]);
    expect(result.isContact).toBe(false);
    expect(result.confidence).toBe(0);
  });
});
