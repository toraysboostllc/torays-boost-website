import { buildWhatsAppLink, buildMailtoLink } from "./whatsapp.js";

/**
 * Builds the plain-text summary shared by both the WhatsApp message and
 * the email body, in whichever language `t` resolves (the caller passes
 * the current useLanguage().t — these are plain functions, not hooks, so
 * they can't call useLanguage() themselves). Deliberately has no
 * price/ETA field to omit — the wizard's state never collects one, so
 * there is nothing here that could leak a number even by accident.
 */
export function buildRepairRequestSummary({ answers, category, brand, problem, smartQuestions, group, t }) {
  const lines = [];
  lines.push(`${t("wizard.summary.name")}: ${answers.name.trim()}`);
  lines.push(`${t("wizard.summary.phone")}: ${answers.phone.trim()}`);
  if (answers.email.trim()) lines.push(`${t("wizard.summary.email")}: ${answers.email.trim()}`);
  lines.push(`${t("wizard.summary.device")}: ${category ? t(`wizard.categories.${category.id}`) : ""}`);
  if (brand) {
    const brandLabel =
      brand.id === "other" && answers.customBrandName?.trim()
        ? answers.customBrandName.trim()
        : t(`wizard.brands.${brand.id}`);
    lines.push(`${t("wizard.summary.brand")}: ${brandLabel}`);
  }
  const modelText = !answers.modelNotSure && answers.model.trim() ? answers.model.trim() : t("wizard.summary.notSureModel");
  lines.push(`${t("wizard.summary.model")}: ${modelText}`);
  lines.push(`${t("wizard.summary.problem")}: ${problem ? t(`wizard.problems.${problem.id}`) : ""}`);
  smartQuestions.forEach((q) => {
    const questionText = t(`wizard.questions.${group}.${q.id}`);
    const answerId = answers.smartAnswers[q.id];
    const answerText = answerId ? t(`wizard.answers.${answerId}`) : t("wizard.answers.not-sure");
    lines.push(`${questionText} ${answerText}`);
  });
  if (answers.details.trim()) lines.push(`${t("wizard.summary.additionalDetails")}: ${answers.details.trim()}`);
  return lines.join("\n");
}

export function buildRepairRequestWhatsAppLink(state) {
  const { t } = state;
  const summary = buildRepairRequestSummary(state);
  return buildWhatsAppLink(`${t("wizard.summary.whatsappGreeting")}\n\n${summary}`);
}

export function buildRepairRequestEmailSubject({ category, answers, t }) {
  const modelPart = !answers.modelNotSure && answers.model.trim() ? answers.model.trim() : t("wizard.summary.notSureModel");
  const device = category ? t(`wizard.categories.${category.id}`) : "";
  return `${t("wizard.summary.emailSubjectPrefix")} — ${device} ${modelPart}`;
}

export function buildRepairRequestMailtoLink(state) {
  return buildMailtoLink({
    subject: buildRepairRequestEmailSubject(state),
    body: buildRepairRequestSummary(state),
  });
}
