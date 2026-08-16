/**
 * Temporary global site lock — Torays Boost is finishing the public
 * website. While true, App.jsx renders ONLY <MaintenancePage /> for every
 * route (Home, /wholesale, /wholesale/prices, and any other path); none of
 * the real pages mount, so nothing they do — including any Wholesale API
 * call — ever runs.
 *
 * TO RELAUNCH THE SITE: flip this single flag to `false`. That's the only
 * change needed — App.jsx falls back to its normal <Routes>, and
 * MaintenancePage (along with its noindex meta tag) stops rendering
 * anywhere.
 */
// Preview-only: temporarily off on feat/public-smart-repair-request so the
// new Hero/wizard can be reviewed. main stays `true` — do not merge this
// flip; the merge/publish step for this feature must restore `true` unless
// production launch is explicitly authorized at that time.
export const SITE_MAINTENANCE_MODE = false;
