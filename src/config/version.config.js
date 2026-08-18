/**
 * Site version tracking. Bumped only after a change has been verified and
 * approved for production — never mid-round. Keep in sync with the
 * "version" field in package.json.
 */
export const APP_VERSION = "1.0.1";

export const VERSION_HISTORY = [
  {
    version: "1.0.1",
    date: "2026-08-18",
    summary:
      "Replaced the Xbox Services card photo with an original Torays Boost graphic; removed the now-unused Wikimedia CC BY-SA attribution for the previous stock photo.",
  },
  {
    version: "1.0.0",
    date: "unrecorded — pre-dates version tracking",
    summary: "Baseline. Prior site work was not individually versioned before this file existed.",
  },
];
