import { describe, it, expect } from "vitest";
import { getTier, matchesExclude } from "@/lib/icp-classifier";

// ---------------------------------------------------------------------------
// Tier 1: Decision Makers
// ---------------------------------------------------------------------------
describe("Tier 1 — Decision Makers", () => {
  const tier1Titles = [
    "CEO", "Chief Executive Officer", "CFO", "Chief Financial Officer",
    "COO", "Chief Operating Officer", "CRO", "Chief Revenue Officer",
    "CGO", "CDO", "Managing Director", "Managing Partner",
    "President", "Executive Director", "General Director",
    "General Manager", "GM", "Founder", "Co-Founder",
    "Cofounder", "Founding Partner", "Owner", "CSO",
  ];

  it.each(tier1Titles)("%s → Tier 1", (title) => {
    expect(getTier(title)).toBe("Tier 1");
  });

  it("President but NOT Vice President", () => {
    expect(getTier("President")).toBe("Tier 1");
    expect(getTier("Vice President of Finance")).not.toBe("Tier 1");
  });

  it("General Manager but NOT Deputy General Manager", () => {
    expect(getTier("General Manager")).toBe("Tier 1");
    expect(getTier("Deputy General Manager")).toBe("Tier 3");
  });
});

// ---------------------------------------------------------------------------
// Tier 1.5: Payment & Finance Owners
// ---------------------------------------------------------------------------
describe("Tier 1.5 — Payment & Finance", () => {
  const tier15Titles = [
    "Head of Payments", "Payment Director", "Director of Payment",
    "Head of PSP", "PSP Director", "FinOps Director",
    "Head of Finance", "Finance Director", "Director of Finance",
    "Head of Treasury", "Treasury Director", "Head of Financial Operations",
  ];

  it.each(tier15Titles)("%s → Tier 1.5", (title) => {
    expect(getTier(title)).toBe("Tier 1.5");
  });
});

// ---------------------------------------------------------------------------
// Tier 2: Influencers/Scouts
// ---------------------------------------------------------------------------
describe("Tier 2 — Influencers", () => {
  const tier2Titles = [
    "Account Director", "VP Partnerships",
    "Vice President of Partnerships", "Operations Director",
    "Director of Operations", "Regional Director",
    "Business Development Director", "Director of Business Development",
    "Partnership Director", "Country Manager", "Regional Manager",
  ];

  it.each(tier2Titles)("%s → Tier 2", (title) => {
    expect(getTier(title)).toBe("Tier 2");
  });

  it("Generic Director/Head → Tier 2 (fallback)", () => {
    expect(getTier("IT Director")).toBe("Tier 2");
    expect(getTier("Head of Risk")).toBe("Tier 2");
  });
});

// ---------------------------------------------------------------------------
// Tier 3: VP/EVP/Deputy
// ---------------------------------------------------------------------------
describe("Tier 3 — VP/Deputy", () => {
  const tier3Titles = [
    "Vice President", "VP", "SVP", "Senior Vice President",
    "EVP", "Executive Vice President",
    "Deputy General Manager", "Deputy Vice President",
    "Deputy Director", 
  ];

  it.each(tier3Titles)("%s → Tier 3", (title) => {
    expect(getTier(title)).toBe("Tier 3");
  });


  // NOTE: Deputy CEO/CFO/COO/Managing Director → Tier 1 (not Tier 3)
  // because \bCEO\b matches before \bDeputy\s+CEO\b — Python parity
  it("Deputy C-suite → Tier 1 (C-suite pattern wins by priority)", () => {
    expect(getTier("Deputy CEO")).toBe("Tier 1");
    expect(getTier("Deputy CFO")).toBe("Tier 1");
    expect(getTier("Deputy COO")).toBe("Tier 1");
    expect(getTier("Deputy Managing Director")).toBe("Tier 1");
  });
});

// ---------------------------------------------------------------------------
// iGaming
// ---------------------------------------------------------------------------
describe("iGaming Tier", () => {
  const igamingTitles = [
    "Betting Director", "iGaming Director", "Head of Casino",
    "Head of Gaming", "Head of Betting", "Head of iGaming",
    "Casino Director", "Director of Casino", "SVP iGaming",
  ];

  it.each(igamingTitles)("%s → iGaming", (title) => {
    expect(getTier(title)).toBe("iGaming");
  });
});

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------
describe("Board Tier", () => {
  const boardTitles = [
    "Chairman", "Chairperson", "Board Member",
    "Board Director", "Member of the Board",
  ];

  it.each(boardTitles)("%s → Board", (title) => {
    expect(getTier(title)).toBe("Board");
  });
});

// ---------------------------------------------------------------------------
// Exclusions
// ---------------------------------------------------------------------------
describe("Exclusions", () => {
  it("CTO excluded (ADR-035)", () => {
    expect(getTier("CTO")).toBeNull();
    expect(getTier("Chief Technology Officer")).toBeNull();
  });

  it("CTO + CEO dual role → NOT excluded (Tier 1)", () => {
    expect(getTier("CEO & CTO")).toBe("Tier 1");
    expect(getTier("Co-Founder & CTO")).toBe("Tier 1");
  });

  it("Marketing roles excluded", () => {
    expect(getTier("CMO")).toBeNull();
    expect(getTier("Marketing Director")).toBeNull();
    expect(getTier("VP of Marketing")).toBeNull();
    expect(getTier("Head of Marketing")).toBeNull();
  });

  it("HR/Legal/Compliance excluded", () => {
    expect(getTier("Chief People Officer")).toBeNull();
    expect(getTier("General Counsel")).toBeNull();
    expect(getTier("Head of Compliance")).toBeNull();
  });

  it("Non-decision makers excluded", () => {
    expect(getTier("Analyst")).toBeNull();
    expect(getTier("Consultant")).toBeNull();
    expect(getTier("Software Engineer")).toBeNull();
    expect(getTier("Account Manager")).toBeNull();
    expect(getTier("Sales Manager")).toBeNull();
    expect(getTier("Intern")).toBeNull();
    expect(getTier("Junior Developer")).toBeNull();
  });

  it("Bare Director excluded", () => {
    expect(getTier("Director")).toBeNull();
  });

  it("Founder from marketing agency excluded", () => {
    expect(getTier("Founder", "Digital Marketing Agency")).toBeNull();
    expect(getTier("Founder", "Creative Agency")).toBeNull();
  });

  it("Founder from fintech NOT excluded", () => {
    expect(getTier("Founder", "PayTech Solutions")).toBe("Tier 1");
    expect(getTier("Founder", "Kea Banking")).toBe("Tier 1");
  });
});

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------
describe("Edge Cases", () => {
  it("Empty/blank returns null", () => {
    expect(getTier("")).toBeNull();
    expect(getTier("  ")).toBeNull();
  });

  it("Truncated C-suite titles are fixed", () => {
    expect(getTier("Chief Executive Offi")).toBe("Tier 1");
    expect(getTier("Chief Financial Offic")).toBe("Tier 1");
  });

  it("CCO handling", () => {
    expect(getTier("CCO")).toBe("Tier 1");
    expect(getTier("Chief Compliance Officer")).toBeNull();
    expect(getTier("Chief Commercial Officer")).toBe("Tier 1");
  });

  it("Case insensitive", () => {
    expect(getTier("ceo")).toBe("Tier 1");
    expect(getTier("MANAGING DIRECTOR")).toBe("Tier 1");
    expect(getTier("head of payments")).toBe("Tier 1.5");
  });

  it("matchesExclude exempt patterns", () => {
    expect(matchesExclude("Country Manager")).toBe(false);
    expect(matchesExclude("Regional Manager")).toBe(false);
    expect(matchesExclude("General Manager")).toBe(false);
    expect(matchesExclude("Marketing Manager")).toBe(true);
  });
});
