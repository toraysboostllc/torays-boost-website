import { buildWhatsAppLink, buildMailtoLink } from "./whatsapp.js";
import { ANSWER_OPTIONS } from "../config/repairRequest.config.js";

const ANSWER_LABEL = Object.fromEntries(ANSWER_OPTIONS.map((a) => [a.id, a.label]));

/**
 * Builds the plain-text summary shared by both the WhatsApp message and
 * the email body. Deliberately has no price/ETA field to omit — the
 * wizard's state never collects one, so there is nothing here that could
 * leak a number even by accident.
 */
export function buildRepairRequestSummary({ answers, category, brand, problem, smartQuestions }) {
  const lines = [];
  lines.push(`Name: ${answers.name.trim()}`);
  lines.push(`Phone: ${answers.phone.trim()}`);
  if (answers.email.trim()) lines.push(`Email: ${answers.email.trim()}`);
  lines.push(`Device: ${category?.label || ""}`);
  if (brand) lines.push(`Brand: ${brand.label}`);
  lines.push(`Model: ${!answers.modelNotSure && answers.model.trim() ? answers.model.trim() : "Not sure"}`);
  lines.push(`Problem: ${problem?.label || ""}`);
  smartQuestions.forEach((q) => {
    lines.push(`${q.text} ${ANSWER_LABEL[answers.smartAnswers[q.id]] || "Not sure"}`);
  });
  if (answers.details.trim()) lines.push(`Additional details: ${answers.details.trim()}`);
  return lines.join("\n");
}

export function buildRepairRequestWhatsAppLink(state) {
  const summary = buildRepairRequestSummary(state);
  return buildWhatsAppLink(`Hi! I'd like to request a repair:\n\n${summary}`);
}

export function buildRepairRequestEmailSubject({ category, answers }) {
  const modelPart = !answers.modelNotSure && answers.model.trim() ? answers.model.trim() : "Not sure";
  return `Repair Request — ${category?.label || ""} ${modelPart}`;
}

export function buildRepairRequestMailtoLink(state) {
  return buildMailtoLink({
    subject: buildRepairRequestEmailSubject(state),
    body: buildRepairRequestSummary(state),
  });
}
