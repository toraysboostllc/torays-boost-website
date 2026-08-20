import { describe, it, expect } from "vitest";
import { wholesaleTranslations } from "../src/i18n/wholesaleTranslations.js";

/**
 * Text-only rename (Task 4): "Estimated profit" -> "Estimated gross profit"
 * in English, "Ganancia estimada" -> "Ganancia bruta estimada" in Spanish.
 * No calculation logic changes — computeTierPricing/formatTierProfit in
 * WholesaleResultPanel.jsx are untouched; this only pins the visible copy.
 */
describe("result.tierEstimatedProfitLabel: renamed for accuracy (this is a GROSS figure, per Document 3 Section 9)", () => {
  it("English is exactly 'Estimated gross profit', never the old 'Estimated profit'", () => {
    expect(wholesaleTranslations.en.result.tierEstimatedProfitLabel).toBe("Estimated gross profit");
  });

  it("Spanish is exactly 'Ganancia bruta estimada', never the old 'Ganancia estimada'", () => {
    expect(wholesaleTranslations.es.result.tierEstimatedProfitLabel).toBe("Ganancia bruta estimada");
  });

  it("the OTHER profit/margin labels (potentialProfit, estimatedMargin — the no-tiers fallback panel) are deliberately untouched by this rename", () => {
    expect(wholesaleTranslations.en.result.potentialProfit).toBe("Potential Profit");
    expect(wholesaleTranslations.en.result.estimatedMargin).toBe("Estimated Margin");
    expect(wholesaleTranslations.es.result.potentialProfit).toBe("Ganancia potencial");
    expect(wholesaleTranslations.es.result.estimatedMargin).toBe("Margen estimado");
  });
});
