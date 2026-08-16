/**
 * Device/problem/smart-question catalog for the public Smart Repair
 * Request wizard. Deliberately has NO price and NO etaDays anywhere in
 * this file — the public site never quotes a number automatically. This
 * replaces the old pricing.config.js (deleted) as the estimator's data
 * source; Wholesale is unaffected — it reads its own catalog from Supabase
 * behind login, never from this file.
 */
function slugify(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toOptions(labels) {
  return labels.map((label) => ({ id: slugify(label), label }));
}

const SMARTPHONE_OTHER_BRANDS = toOptions(["Samsung", "Google Pixel", "Motorola", "OnePlus", "LG", "Other"]);
const LAPTOP_OTHER_BRANDS = toOptions(["Dell", "HP", "Lenovo", "ASUS", "Acer", "Microsoft Surface", "Other"]);

/** The 10 device categories shown in Step 1, in the approved order. */
export const DEVICE_CATEGORIES = [
  { id: "iphone", label: "iPhone", group: "phone" },
  { id: "smartphones-other", label: "Smartphones — Other Brands", group: "phone", brands: SMARTPHONE_OTHER_BRANDS },
  { id: "ipad", label: "iPad", group: "tablet" },
  { id: "tablets-other", label: "Tablets — Other Brands", group: "tablet" },
  { id: "ps5", label: "PlayStation / PS5", group: "console" },
  { id: "xbox", label: "Xbox", group: "console" },
  { id: "controllers", label: "Controllers", group: "controller" },
  { id: "macbook", label: "MacBook", group: "laptop" },
  { id: "laptops-other", label: "Laptops — Other Brands", group: "laptop", brands: LAPTOP_OTHER_BRANDS },
  { id: "data-recovery", label: "Data Recovery", group: "data-recovery" },
];

/**
 * Problem lists per device group, shown in Step 3. Phone and tablet are
 * the same list except tablets never show "Back Glass" (per spec — it
 * only applies "cuando corresponda", i.e. to phones).
 */
export const PROBLEMS_BY_GROUP = {
  phone: toOptions([
    "Broken Screen",
    "Back Glass",
    "Battery Replacement",
    "Charging Port",
    "Camera",
    "No Power",
    "Water Damage",
    "Data Recovery",
    "Other",
  ]),
  tablet: toOptions([
    "Broken Screen",
    "Battery Replacement",
    "Charging Port",
    "Camera",
    "No Power",
    "Water Damage",
    "Data Recovery",
    "Other",
  ]),
  console: toOptions(["HDMI / No Image", "No Power", "Overheating", "Disc Drive", "Liquid Damage", "Other"]),
  controller: toOptions(["Stick Drift", "Buttons", "Charging Port", "No Power", "Physical/Liquid Damage", "Other"]),
  laptop: toOptions([
    "No Power",
    "Broken Screen",
    "Battery Replacement",
    "Charging Port",
    "Overheating",
    "Slow Performance",
    "Liquid Damage",
    "Data Recovery",
    "Motherboard Repair",
    "Other",
  ]),
  "data-recovery": toOptions(["Data Recovery", "Other"]),
};

/** Exactly 3 smart questions per device group, asked in Steps 4-6. */
export const SMART_QUESTIONS_BY_GROUP = {
  phone: [
    { id: "liquid-damage", text: "Has the device had water or liquid damage?" },
    { id: "front-screen-cracked", text: "Is the front screen or glass cracked?" },
    { id: "back-glass-cracked", text: "Is the back glass cracked?" },
  ],
  tablet: [
    { id: "liquid-damage", text: "Has the device had water or liquid damage?" },
    { id: "screen-cracked", text: "Is the screen or front glass cracked?" },
    { id: "dropped-or-bent", text: "Has the device been dropped or bent?" },
  ],
  console: [
    { id: "powers-on", text: "Does the console power on?" },
    { id: "displays-image", text: "Does it display an image on the TV?" },
    { id: "liquid-or-physical-damage", text: "Has it had liquid or physical damage?" },
  ],
  controller: [
    { id: "powers-on-and-connects", text: "Does the controller power on and connect?" },
    { id: "stick-drift-constant", text: "Is the stick drift constant?" },
    { id: "dropped-or-liquid", text: "Has it been dropped or exposed to liquid?" },
  ],
  laptop: [
    { id: "powers-on", text: "Does the computer power on?" },
    { id: "liquid-damage", text: "Has it had liquid damage?" },
    { id: "screen-cracked", text: "Is the screen cracked or damaged?" },
  ],
  "data-recovery": [
    { id: "powers-on", text: "Does the device power on?" },
    { id: "storage-recognized", text: "Is the storage device recognized?" },
    { id: "dropped-or-liquid", text: "Has it been dropped or exposed to liquid?" },
  ],
};

/** Every smart question uses the same three-way answer set. */
export const ANSWER_OPTIONS = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
  { id: "not-sure", label: "Not sure" },
];

export function getCategoryById(categoryId) {
  return DEVICE_CATEGORIES.find((c) => c.id === categoryId) || null;
}
