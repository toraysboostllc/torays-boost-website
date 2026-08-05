import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Sparkles } from "lucide-react";
import { SectionHeading } from "../components/ui/SectionHeading.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { useQuoteEstimator } from "../hooks/useQuoteEstimator.js";
import { buildContactLink } from "../lib/whatsapp.js";

function StepSelect({ label, step, value, onChange, options, disabled, getLabel }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-heading font-semibold uppercase tracking-wide text-torays-text-secondary">
        {step}. {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-torays-line bg-torays-surface-alt px-4 py-3 text-torays-text disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-torays-red/50"
      >
        <option value="">{disabled ? "—" : `Select ${label.toLowerCase()}`}</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {getLabel(opt)}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatRange(min, max, unit) {
  if (min === max) return `${min}${unit}`;
  return `${min}–${max}${unit}`;
}

export function QuoteEstimator() {
  const estimator = useQuoteEstimator();
  const { devices, brands, models, issues, selection, isComplete } = estimator;

  const summaryMessage = isComplete
    ? `Hi! I'd like a final quote for:\n- Device: ${selection.device.label}\n- Brand: ${selection.brand.label}\n- Model: ${selection.model.label}\n- Issue: ${selection.issue.label}\n- Estimated price: $${formatRange(
        selection.issue.price.min,
        selection.issue.price.max,
        ""
      )}`
    : undefined;

  return (
    <section id="quote-estimator" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Smart Quote"
          title="Instant Repair Estimator"
          subtitle="Select your device, brand, model, and issue to get an instant price and turnaround estimate."
        />

        <Card className="mt-10">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <StepSelect
              label="Device Type"
              step={1}
              value={selection.device?.id || ""}
              onChange={estimator.selectDevice}
              options={devices}
              getLabel={(d) => d.label}
            />
            <StepSelect
              label="Brand"
              step={2}
              value={selection.brand?.id || ""}
              onChange={estimator.selectBrand}
              options={brands}
              disabled={!selection.device}
              getLabel={(b) => b.label}
            />
            <StepSelect
              label="Model"
              step={3}
              value={selection.model?.id || ""}
              onChange={estimator.selectModel}
              options={models}
              disabled={!selection.brand}
              getLabel={(m) => m.label}
            />
            <StepSelect
              label="Problem"
              step={4}
              value={selection.issue?.id || ""}
              onChange={estimator.selectIssue}
              options={issues}
              disabled={!selection.model}
              getLabel={(i) => i.label}
            />
          </div>

          <AnimatePresence>
            {isComplete && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="mt-8 rounded-2xl border border-torays-red/30 bg-torays-red/5 p-6">
                  <div className="mb-4 flex items-center gap-2 text-torays-red">
                    <Sparkles size={18} />
                    <span className="text-xs font-heading font-semibold uppercase tracking-wide">
                      Your Estimate
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs text-torays-text-secondary">Estimated Price</p>
                      <p className="mt-1 text-2xl font-heading font-semibold text-torays-text">
                        ${formatRange(selection.issue.price.min, selection.issue.price.max, "")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-torays-text-secondary">Estimated Time</p>
                      <p className="mt-1 text-2xl font-heading font-semibold text-torays-text">
                        {formatRange(selection.issue.etaDays.min, selection.issue.etaDays.max, " days")}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-torays-text-muted">
                    Final pricing is confirmed after diagnostics. This is a placeholder estimate range.
                  </p>

                  <Button
                    href={buildContactLink(summaryMessage)}
                    target="_blank"
                    rel="noreferrer"
                    icon={MessageCircle}
                    className="mt-5 w-full sm:w-auto"
                  >
                    Get Final Quote on WhatsApp
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>
    </section>
  );
}
