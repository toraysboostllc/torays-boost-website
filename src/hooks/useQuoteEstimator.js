import { useMemo, useState } from "react";
import { getPricingData } from "../config/pricing.config.js";

const initialState = { deviceId: "", brandId: "", modelId: "", issueId: "" };

/** Drives the cascading Device -> Brand -> Model -> Issue estimator form. */
export function useQuoteEstimator() {
  const data = useMemo(() => getPricingData(), []);
  const [selection, setSelection] = useState(initialState);

  const device = data.find((d) => d.id === selection.deviceId) || null;
  const brand = device?.brands.find((b) => b.id === selection.brandId) || null;
  const model = brand?.models.find((m) => m.id === selection.modelId) || null;
  const issue = model?.issues.find((i) => i.id === selection.issueId) || null;

  function selectDevice(deviceId) {
    setSelection({ deviceId, brandId: "", modelId: "", issueId: "" });
  }

  function selectBrand(brandId) {
    setSelection((prev) => ({ ...prev, brandId, modelId: "", issueId: "" }));
  }

  function selectModel(modelId) {
    setSelection((prev) => ({ ...prev, modelId, issueId: "" }));
  }

  function selectIssue(issueId) {
    setSelection((prev) => ({ ...prev, issueId }));
  }

  function reset() {
    setSelection(initialState);
  }

  return {
    devices: data,
    brands: device?.brands || [],
    models: brand?.models || [],
    issues: model?.issues || [],
    selection: { device, brand, model, issue },
    isComplete: Boolean(issue),
    selectDevice,
    selectBrand,
    selectModel,
    selectIssue,
    reset,
  };
}
