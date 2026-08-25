/**
 * Easy Search initial device directory — source of truth for
 * supabase/wholesale-easy-search-seed.sql (regenerate with
 * `node scripts/generate-wholesale-easy-search-seed-sql.mjs`, checked for
 * drift by tests/wholesaleEasySearchSeedSql.test.js — same pattern as
 * scripts/wholesaleCatalogSeed.data.js).
 *
 * Started from Carlos's `especificaciones_buscador_moviles.csv` (54 rows:
 * 27 Apple, 27 Samsung), with these deliberate corrections/additions — see
 * the per-device comments below for the exact source of each:
 *
 *  1. The CSV's "iPhone SE (4ª gen) / A3300" row is WRONG — replaced with
 *     the real device, iPhone 16e (A3212/A3408/A3410/A3409). Its spec
 *     values (screen/chip/RAM/storage/camera/battery) are carried over
 *     unchanged from the CSV row — only the NAME and CODES were wrong
 *     (this device was rumored pre-launch as an "SE 4th gen"; the specs
 *     match the real 16e), verified against Apple's official model-number
 *     page.
 *  2. The CSV's "iPhone 17 Pro Max / 2026 / A3575" row is WRONG on both
 *     year and code — corrected to 2025, A3257/A3525/A3527/A3526.
 *  3. iPhone 17e is a NEW device, not in the original CSV at all — added
 *     because A3575 (which the CSV wrongly attached to 17 Pro Max) is
 *     officially iPhone 17e's code. Its spec sheet is sourced separately
 *     from Apple's iPhone 17e technical-specifications page (RAM is never
 *     published by Apple for any iPhone — left null, not guessed; battery
 *     is Apple's own "up to 26 hours video playback" figure, no mAh
 *     disclosed — stored as given, not converted/guessed).
 *  4. "A2214" does NOT appear anywhere in this file, on purpose — verified
 *     against Apple's official page that it is not a real iPhone model
 *     number. Searching it in Easy Search must resolve to "not found".
 *  5. Every Samsung device keeps its original international F/B code
 *     (region: "Intl"). A US-market U/U1 code is added ONLY where a real
 *     source confirms it exists (region: "US") — nine models (Galaxy S5,
 *     S6, Note 4, Note 5, J7 2016, A7 2018, A52s 5G, A55 5G — see each
 *     one's own comment) genuinely never had a US-market code or were
 *     never sold in the US at all, per dedicated research, and deliberately
 *     carry NO fabricated U/U1 code — Easy Search will only ever match
 *     their real Intl code for those.
 *
 * catalogModelId is intentionally left null for every row here — this
 * initial seed has no live connection to Supabase at data-authoring time,
 * so it cannot safely guess a real wholesale_categories.id to link against
 * without risking a WRONG link (worse than no link). Linking each device to
 * its real Wholesale catalog Model is an ADMIN task, done from Desk's
 * Wholesale Shops -> Easy Search panel after this migration/seed runs, not
 * something this file infers.
 */

export const EASY_SEARCH_DEVICE_SEED = [
  // ==========================================================================
  // Apple — every code verified against https://support.apple.com/en-us/108044
  // ==========================================================================
  {
    brand: "Apple", commercialName: "iPhone 6", deviceCategory: "phone", year: 2014,
    screen: '4.7" Retina HD', processor: "Apple A8", ram: "1 GB", storage: "16/64/128 GB",
    mainCamera: "8 MP", battery: "1810 mAh",
    codes: [{ code: "A1549", region: null }, { code: "A1586", region: null }],
  },
  {
    brand: "Apple", commercialName: "iPhone 6 Plus", deviceCategory: "phone", year: 2014,
    screen: '5.5" Retina HD', processor: "Apple A8", ram: "1 GB", storage: "16/64/128 GB",
    mainCamera: "8 MP OIS", battery: "2915 mAh",
    codes: [{ code: "A1522", region: null }, { code: "A1524", region: null }],
  },
  {
    brand: "Apple", commercialName: "iPhone 6s", deviceCategory: "phone", year: 2015,
    screen: '4.7" Retina HD', processor: "Apple A9", ram: "2 GB", storage: "16/32/64/128 GB",
    mainCamera: "12 MP", battery: "1715 mAh",
    codes: [{ code: "A1633", region: null }, { code: "A1688", region: null }],
  },
  {
    brand: "Apple", commercialName: "iPhone 6s Plus", deviceCategory: "phone", year: 2015,
    screen: '5.5" Retina HD', processor: "Apple A9", ram: "2 GB", storage: "16/32/64/128 GB",
    mainCamera: "12 MP OIS", battery: "2750 mAh",
    codes: [{ code: "A1634", region: null }, { code: "A1687", region: null }],
  },
  {
    brand: "Apple", commercialName: "iPhone 7", deviceCategory: "phone", year: 2016,
    screen: '4.7" Retina HD', processor: "Apple A10 Fusion", ram: "2 GB", storage: "32/128/256 GB",
    mainCamera: "12 MP OIS", battery: "1960 mAh",
    codes: [{ code: "A1660", region: null }, { code: "A1778", region: null }],
  },
  {
    brand: "Apple", commercialName: "iPhone 7 Plus", deviceCategory: "phone", year: 2016,
    screen: '5.5" Retina HD', processor: "Apple A10 Fusion", ram: "3 GB", storage: "32/128/256 GB",
    mainCamera: "Doble 12 MP", battery: "2900 mAh",
    codes: [{ code: "A1661", region: null }, { code: "A1784", region: null }],
  },
  {
    brand: "Apple", commercialName: "iPhone SE (1ª gen)", deviceCategory: "phone", year: 2016,
    screen: '4.0" Retina', processor: "Apple A9", ram: "2 GB", storage: "16/32/64/128 GB",
    mainCamera: "12 MP", battery: "1624 mAh",
    codes: [{ code: "A1662", region: null }, { code: "A1723", region: null }],
  },
  {
    brand: "Apple", commercialName: "iPhone 8", deviceCategory: "phone", year: 2017,
    screen: '4.7" Retina HD', processor: "Apple A11 Bionic", ram: "2 GB", storage: "64/128/256 GB",
    mainCamera: "12 MP OIS", battery: "1821 mAh",
    codes: [{ code: "A1863", region: null }, { code: "A1905", region: null }],
  },
  {
    brand: "Apple", commercialName: "iPhone X", deviceCategory: "phone", year: 2017,
    screen: '5.8" Super Retina OLED', processor: "Apple A11 Bionic", ram: "3 GB", storage: "64/256 GB",
    mainCamera: "Doble 12 MP OIS", battery: "2716 mAh",
    codes: [{ code: "A1865", region: null }, { code: "A1901", region: null }],
  },
  {
    brand: "Apple", commercialName: "iPhone XR", deviceCategory: "phone", year: 2018,
    screen: '6.1" Liquid Retina LCD', processor: "Apple A12 Bionic", ram: "3 GB", storage: "64/128/256 GB",
    mainCamera: "12 MP OIS", battery: "2942 mAh",
    codes: [{ code: "A1984", region: null }, { code: "A2105", region: null }],
  },
  {
    brand: "Apple", commercialName: "iPhone XS Max", deviceCategory: "phone", year: 2018,
    screen: '6.5" Super Retina OLED', processor: "Apple A12 Bionic", ram: "4 GB", storage: "64/256/512 GB",
    mainCamera: "Doble 12 MP OIS", battery: "3174 mAh",
    codes: [{ code: "A1921", region: null }, { code: "A2101", region: null }],
  },
  {
    brand: "Apple", commercialName: "iPhone 11", deviceCategory: "phone", year: 2019,
    screen: '6.1" Liquid Retina LCD', processor: "Apple A13 Bionic", ram: "4 GB", storage: "64/128/256 GB",
    mainCamera: "Doble 12 MP (W/UW)", battery: "3110 mAh",
    codes: [{ code: "A2111", region: null }, { code: "A2221", region: null }],
  },
  {
    // A2220 (China mainland/Hong Kong/Macao) added beyond the raw CSV —
    // found on Apple's own official page alongside the two codes the CSV
    // already had; included for completeness since it was already
    // verified while confirming A2218 below. A2218 = United States.
    brand: "Apple", commercialName: "iPhone 11 Pro Max", deviceCategory: "phone", year: 2019,
    screen: '6.5" Super Retina XDR OLED', processor: "Apple A13 Bionic", ram: "4 GB", storage: "64/256/512 GB",
    mainCamera: "Triple 12+12+12 MP", battery: "3969 mAh",
    codes: [
      { code: "A2161", region: null },
      { code: "A2218", region: "US" },
      { code: "A2220", region: null },
    ],
  },
  {
    brand: "Apple", commercialName: "iPhone 12", deviceCategory: "phone", year: 2020,
    screen: '6.1" Super Retina XDR OLED', processor: "Apple A14 Bionic", ram: "4 GB", storage: "64/128/256 GB",
    mainCamera: "Doble 12 MP", battery: "2815 mAh",
    codes: [{ code: "A2172", region: null }, { code: "A2403", region: null }],
  },
  {
    brand: "Apple", commercialName: "iPhone 12 Pro Max", deviceCategory: "phone", year: 2020,
    screen: '6.7" Super Retina XDR OLED', processor: "Apple A14 Bionic", ram: "6 GB", storage: "128/256/512 GB",
    mainCamera: "Triple 12+12+12 MP + LiDAR", battery: "3687 mAh",
    codes: [{ code: "A2342", region: null }, { code: "A2411", region: null }],
  },
  {
    brand: "Apple", commercialName: "iPhone SE (2ª gen)", deviceCategory: "phone", year: 2020,
    screen: '4.7" Retina HD', processor: "Apple A13 Bionic", ram: "3 GB", storage: "64/128/256 GB",
    mainCamera: "12 MP OIS", battery: "1821 mAh",
    codes: [{ code: "A2275", region: null }, { code: "A2296", region: null }],
  },
  {
    brand: "Apple", commercialName: "iPhone 13", deviceCategory: "phone", year: 2021,
    screen: '6.1" Super Retina XDR OLED', processor: "Apple A15 Bionic", ram: "4 GB", storage: "128/256/512 GB",
    mainCamera: "Doble 12 MP", battery: "3227 mAh",
    codes: [{ code: "A2482", region: null }, { code: "A2633", region: null }],
  },
  {
    brand: "Apple", commercialName: "iPhone 13 Pro Max", deviceCategory: "phone", year: 2021,
    screen: '6.7" Super Retina XDR ProMotion', processor: "Apple A15 Bionic", ram: "6 GB", storage: "128/256/512GB / 1TB",
    mainCamera: "Triple 12+12+12 MP + LiDAR", battery: "4352 mAh",
    codes: [{ code: "A2484", region: null }, { code: "A2643", region: null }],
  },
  {
    brand: "Apple", commercialName: "iPhone 14", deviceCategory: "phone", year: 2022,
    screen: '6.1" Super Retina XDR OLED', processor: "Apple A15 Bionic", ram: "6 GB", storage: "128/256/512 GB",
    mainCamera: "Doble 12 MP", battery: "3279 mAh",
    codes: [{ code: "A2649", region: null }, { code: "A2882", region: null }],
  },
  {
    brand: "Apple", commercialName: "iPhone 14 Pro Max", deviceCategory: "phone", year: 2022,
    screen: '6.7" LTPO Super Retina XDR', processor: "Apple A16 Bionic", ram: "6 GB", storage: "128/256/512GB / 1TB",
    mainCamera: "48 MP + 12 MP + 12 MP + LiDAR", battery: "4323 mAh",
    codes: [{ code: "A2651", region: null }, { code: "A2894", region: null }],
  },
  {
    brand: "Apple", commercialName: "iPhone SE (3ª gen)", deviceCategory: "phone", year: 2022,
    screen: '4.7" Retina HD', processor: "Apple A15 Bionic", ram: "4 GB", storage: "64/128/256 GB",
    mainCamera: "12 MP OIS", battery: "2018 mAh",
    codes: [{ code: "A2595", region: null }, { code: "A2783", region: null }],
  },
  {
    brand: "Apple", commercialName: "iPhone 15", deviceCategory: "phone", year: 2023,
    screen: '6.1" Super Retina XDR OLED', processor: "Apple A16 Bionic", ram: "6 GB", storage: "128/256/512 GB",
    mainCamera: "Doble 48+12 MP", battery: "3349 mAh",
    codes: [{ code: "A2846", region: null }, { code: "A3090", region: null }],
  },
  {
    brand: "Apple", commercialName: "iPhone 15 Pro Max", deviceCategory: "phone", year: 2023,
    screen: '6.7" LTPO Super Retina XDR', processor: "Apple A17 Pro", ram: "8 GB", storage: "256/512GB / 1TB",
    mainCamera: "48 MP + 12 MP + 12 MP Prisma", battery: "4441 mAh",
    codes: [{ code: "A2849", region: null }, { code: "A3106", region: null }],
  },
  {
    brand: "Apple", commercialName: "iPhone 16", deviceCategory: "phone", year: 2024,
    screen: '6.1" Super Retina XDR OLED', processor: "Apple A18", ram: "8 GB", storage: "128/256/512 GB",
    mainCamera: "Doble 48+12 MP Fusion", battery: "3561 mAh",
    codes: [{ code: "A3286", region: null }, { code: "A3287", region: null }],
  },
  {
    brand: "Apple", commercialName: "iPhone 16 Pro Max", deviceCategory: "phone", year: 2024,
    screen: '6.9" LTPO Super Retina XDR', processor: "Apple A18 Pro", ram: "8 GB", storage: "128/256/512GB / 1TB",
    mainCamera: "48 MP + 48 MP + 12 MP Ultra", battery: "4685 mAh",
    codes: [{ code: "A3295", region: null }, { code: "A3296", region: null }],
  },
  {
    // CORRECTED — CSV had this as "iPhone SE (4ª gen) / A3300", which is
    // not a real device/code. Real device: iPhone 16e. Spec values carried
    // over unchanged from the CSV row (see file header). All 4 codes
    // verified on Apple's official page; A3212 = United States.
    brand: "Apple", commercialName: "iPhone 16e", deviceCategory: "phone", year: 2025,
    screen: '6.1" OLED Notch', processor: "Apple A18", ram: "8 GB", storage: "128/256 GB",
    mainCamera: "48 MP", battery: "3279 mAh",
    codes: [
      { code: "A3212", region: "US" },
      { code: "A3408", region: null },
      { code: "A3410", region: null },
      { code: "A3409", region: null },
    ],
  },
  {
    // CORRECTED — CSV had year 2026 and code A3575 for this device; both
    // wrong. Real iPhone 17 Pro Max is 2025 with these 4 codes (A3257 =
    // United States); A3575 belongs to iPhone 17e (see below).
    brand: "Apple", commercialName: "iPhone 17 Pro Max", deviceCategory: "phone", year: 2025,
    screen: '6.9" LTPO Super Retina Pro 120Hz', processor: "Apple A19 Pro", ram: "12 GB", storage: "256/512GB / 1TB",
    mainCamera: "Triple 48+48+48 MP", battery: "4850 mAh",
    codes: [
      { code: "A3257", region: "US" },
      { code: "A3525", region: null },
      { code: "A3527", region: null },
      { code: "A3526", region: null },
    ],
  },
  {
    // NEW — not in the original CSV. Added because A3575 (the code the CSV
    // wrongly attached to 17 Pro Max above) is officially iPhone 17e's
    // code. Specs sourced from Apple's iPhone 17e technical-specifications
    // page, 2026-08-25: RAM is never published by Apple for any iPhone,
    // left null rather than guessed; battery is Apple's own published
    // "up to 26 hours video playback" claim — no mAh figure is disclosed,
    // so the string is stored as-is rather than converting/guessing a
    // number.
    brand: "Apple", commercialName: "iPhone 17e", deviceCategory: "phone", year: 2026,
    screen: '6.1" OLED, 2532x1170', processor: "Apple A19", ram: null, storage: "256/512 GB",
    mainCamera: "48MP Fusion Main + 12MP 2x Telephoto", battery: "Up to 26 hours video playback",
    codes: [
      { code: "A3575", region: "US" },
      { code: "A3635", region: null },
      { code: "A3634", region: null },
    ],
  },

  // ==========================================================================
  // Samsung — international F/B code from the CSV kept on every device
  // (region: "Intl"); US "U"/"U1" code added ONLY where confirmed/
  // corroborated by dedicated research (samsung.com/us business-support
  // pages, major US retailers, FCC filings, PhoneDB/GSMArena regional
  // listings) — see each device's own comment for its actual source and
  // confidence. Nine devices below never had a real US code and correctly
  // carry none.
  // ==========================================================================
  {
    // No US "U" code ever existed for this model (Samsung sold it in the
    // US only as carrier-locked G900A/T/V/P/R4/W8, no unified SKU) —
    // confirmed against GSMArena's regional-variant listing; no code
    // fabricated.
    brand: "Samsung", commercialName: "Galaxy S5", deviceCategory: "phone", year: 2014,
    screen: '5.1" FHD Super AMOLED', processor: "Snapdragon 801", ram: "2 GB", storage: "16/32 GB",
    mainCamera: "16 MP", battery: "2800 mAh",
    codes: [{ code: "SM-G900F", region: "Intl" }],
  },
  {
    // SM-N910U is real but is an Asia-Pacific/LATAM SKU, NOT American (US
    // buyers got N910A/T/V/P/R4) — confirmed via GSMArena + PhoneDB
    // regional listings. Not added as a US code here.
    brand: "Samsung", commercialName: "Galaxy Note 4", deviceCategory: "phone", year: 2014,
    screen: '5.7" QHD Super AMOLED', processor: "Snapdragon 805 / Exynos 5433", ram: "3 GB", storage: "32 GB",
    mainCamera: "16 MP OIS", battery: "3220 mAh",
    codes: [{ code: "SM-N910F", region: "Intl" }],
  },
  {
    // No US "U" code found on GSMArena's regional list or PhoneDB.
    brand: "Samsung", commercialName: "Galaxy S6", deviceCategory: "phone", year: 2015,
    screen: '5.1" QHD Super AMOLED', processor: "Exynos 7420", ram: "3 GB", storage: "32/64/128 GB",
    mainCamera: "16 MP OIS", battery: "2550 mAh",
    codes: [{ code: "SM-G920F", region: "Intl" }],
  },
  {
    // No US "U" code found.
    brand: "Samsung", commercialName: "Galaxy Note 5", deviceCategory: "phone", year: 2015,
    screen: '5.7" QHD Super AMOLED', processor: "Exynos 7420", ram: "4 GB", storage: "32/64 GB",
    mainCamera: "16 MP OIS", battery: "3000 mAh",
    codes: [{ code: "SM-N920F", region: "Intl" }],
  },
  {
    // SM-G930U confirmed on samsung.com/us's own business-support page
    // ("Galaxy S7 SM-G930U Support & Manual"); this generation predates
    // the U/U1 split (no separate unlocked U1 SKU).
    brand: "Samsung", commercialName: "Galaxy S7", deviceCategory: "phone", year: 2016,
    screen: '5.1" QHD Super AMOLED', processor: "Snapdragon 820 / Exynos 8890", ram: "4 GB", storage: "32/64 GB",
    mainCamera: "12 MP Dual Pixel", battery: "3000 mAh",
    codes: [{ code: "SM-G930F", region: "Intl" }, { code: "SM-G930U", region: "US" }],
  },
  {
    // No unified US "J710U" found on any retailer or Samsung page (only
    // carrier-specific variants); the SM-J727U that does exist belongs to
    // the different 2017 Galaxy J7, not this one.
    brand: "Samsung", commercialName: "Galaxy J7 (2016)", deviceCategory: "phone", year: 2016,
    screen: '5.5" HD Super AMOLED', processor: "Exynos 7870", ram: "2 GB", storage: "16 GB",
    mainCamera: "13 MP", battery: "3300 mAh",
    codes: [{ code: "SM-J710F", region: "Intl" }],
  },
  {
    // SM-G950U/U1 confirmed on samsung.com/us business-support (U1) plus
    // major US retailers (U) — the generation where the U/U1 split begins.
    brand: "Samsung", commercialName: "Galaxy S8", deviceCategory: "phone", year: 2017,
    screen: '5.8" QHD+ Infinity Display', processor: "Snapdragon 835 / Exynos 8895", ram: "4 GB", storage: "64 GB",
    mainCamera: "12 MP Dual Pixel", battery: "3000 mAh",
    codes: [
      { code: "SM-G950F", region: "Intl" },
      { code: "SM-G950U", region: "US" },
      { code: "SM-G950U1", region: "US" },
    ],
  },
  {
    brand: "Samsung", commercialName: "Galaxy Note 8", deviceCategory: "phone", year: 2017,
    screen: '6.3" QHD+ Infinity Display', processor: "Snapdragon 835 / Exynos 8895", ram: "6 GB", storage: "64/128/256 GB",
    mainCamera: "Doble 12 MP OIS", battery: "3300 mAh",
    codes: [
      { code: "SM-N950F", region: "Intl" },
      { code: "SM-N950U", region: "US" },
      { code: "SM-N950U1", region: "US" },
    ],
  },
  {
    brand: "Samsung", commercialName: "Galaxy S9+", deviceCategory: "phone", year: 2018,
    screen: '6.2" QHD+ Super AMOLED', processor: "Snapdragon 845 / Exynos 9810", ram: "6 GB", storage: "64/128/256 GB",
    mainCamera: "Doble 12 MP (Var. Apertura)", battery: "3500 mAh",
    codes: [
      { code: "SM-G965F", region: "Intl" },
      { code: "SM-G965U", region: "US" },
      { code: "SM-G965U1", region: "US" },
    ],
  },
  {
    // Never officially sold in the US — confirmed absent from every US
    // retailer and from PhoneDB's own US-variant listing for this model
    // (EMEA/LATAM/Japan/Global only).
    brand: "Samsung", commercialName: "Galaxy A7 (2018)", deviceCategory: "phone", year: 2018,
    screen: '6.0" FHD+ Super AMOLED', processor: "Exynos 7885", ram: "4/6 GB", storage: "64/128 GB",
    mainCamera: "Triple 24+8+5 MP", battery: "3300 mAh",
    codes: [{ code: "SM-A750F", region: "Intl" }],
  },
  {
    brand: "Samsung", commercialName: "Galaxy S10+", deviceCategory: "phone", year: 2019,
    screen: '6.4" QHD+ Dynamic AMOLED', processor: "Snapdragon 855 / Exynos 9820", ram: "8/12 GB", storage: "128/512GB / 1TB",
    mainCamera: "Triple 12+12+16 MP", battery: "4100 mAh",
    codes: [
      { code: "SM-G975F", region: "Intl" },
      { code: "SM-G975U", region: "US" },
      { code: "SM-G975U1", region: "US" },
    ],
  },
  {
    brand: "Samsung", commercialName: "Galaxy A50", deviceCategory: "phone", year: 2019,
    screen: '6.4" FHD+ Super AMOLED', processor: "Exynos 9610", ram: "4/6 GB", storage: "64/128 GB",
    mainCamera: "Triple 25+8+5 MP", battery: "4000 mAh",
    codes: [
      { code: "SM-A505F", region: "Intl" },
      { code: "SM-A505U", region: "US" },
      { code: "SM-A505U1", region: "US" },
    ],
  },
  {
    brand: "Samsung", commercialName: "Galaxy Fold", deviceCategory: "phone", year: 2019,
    screen: '7.3" QHD+ Dynamic AMOLED Fold', processor: "Snapdragon 855", ram: "12 GB", storage: "512 GB",
    mainCamera: "Triple 12+12+16 MP", battery: "4380 mAh",
    codes: [
      { code: "SM-F900F", region: "Intl" },
      { code: "SM-F900U", region: "US" },
      { code: "SM-F900U1", region: "US" },
    ],
  },
  {
    brand: "Samsung", commercialName: "Galaxy S20 Ultra", deviceCategory: "phone", year: 2020,
    screen: '6.9" QHD+ Dynamic AMOLED 2X', processor: "Snapdragon 865 / Exynos 990", ram: "12/16 GB", storage: "128/256/512 GB",
    mainCamera: "108 MP + 48 MP + 12 MP", battery: "5000 mAh",
    codes: [
      { code: "SM-G988F", region: "Intl" },
      { code: "SM-G988U", region: "US" },
      { code: "SM-G988U1", region: "US" },
    ],
  },
  {
    brand: "Samsung", commercialName: "Galaxy A51", deviceCategory: "phone", year: 2020,
    screen: '6.5" FHD+ Super AMOLED', processor: "Exynos 9611", ram: "4/6/8 GB", storage: "64/128 GB",
    mainCamera: "Cuádruple 48+12+5+5 MP", battery: "4000 mAh",
    codes: [
      { code: "SM-A515F", region: "Intl" },
      { code: "SM-A515U", region: "US" },
      { code: "SM-A515U1", region: "US" },
    ],
  },
  {
    brand: "Samsung", commercialName: "Galaxy S21 Ultra", deviceCategory: "phone", year: 2021,
    screen: '6.8" QHD+ Dynamic AMOLED 2X', processor: "Snapdragon 888 / Exynos 2100", ram: "12/16 GB", storage: "128/256/512 GB",
    mainCamera: "108 MP + 10 MP + 10 MP + 12 MP", battery: "5000 mAh",
    codes: [
      { code: "SM-G998B", region: "Intl" },
      { code: "SM-G998U", region: "US" },
      { code: "SM-G998U1", region: "US" },
    ],
  },
  {
    // Never officially released in the US — only the plain Galaxy A52 5G
    // (SM-A526U) launched here in 2021; the A52s variant was
    // international-only, confirmed via GSMArena/xda-developers coverage.
    brand: "Samsung", commercialName: "Galaxy A52s 5G", deviceCategory: "phone", year: 2021,
    screen: '6.5" FHD+ Super AMOLED 120Hz', processor: "Snapdragon 778G 5G", ram: "6/8 GB", storage: "128/256 GB",
    mainCamera: "Cuádruple 64+12+5+5 MP", battery: "4500 mAh",
    codes: [{ code: "SM-A528B", region: "Intl" }],
  },
  {
    brand: "Samsung", commercialName: "Galaxy S22 Ultra", deviceCategory: "phone", year: 2022,
    screen: '6.8" Dynamic AMOLED 2X 120Hz', processor: "Snapdragon 8 Gen 1 / Exynos 2200", ram: "8/12 GB", storage: "128/256/512GB / 1TB",
    mainCamera: "108 MP + 10 MP + 10 MP + 12 MP", battery: "5000 mAh",
    codes: [
      { code: "SM-S908B", region: "Intl" },
      { code: "SM-S908U", region: "US" },
      { code: "SM-S908U1", region: "US" },
    ],
  },
  {
    brand: "Samsung", commercialName: "Galaxy A53 5G", deviceCategory: "phone", year: 2022,
    screen: '6.5" FHD+ Super AMOLED 120Hz', processor: "Exynos 1280", ram: "4/6/8 GB", storage: "128/256 GB",
    mainCamera: "Cuádruple 64+12+5+5 MP", battery: "5000 mAh",
    codes: [
      { code: "SM-A536B", region: "Intl" },
      { code: "SM-A536U", region: "US" },
      { code: "SM-A536U1", region: "US" },
    ],
  },
  {
    // The explicit worked example from Carlos's spec — SM-S918U/U1/B must
    // all resolve to this exact device.
    brand: "Samsung", commercialName: "Galaxy S23 Ultra", deviceCategory: "phone", year: 2023,
    screen: '6.8" Dynamic AMOLED 2X 120Hz', processor: "Snapdragon 8 Gen 2 f. Galaxy", ram: "8/12 GB", storage: "256/512GB / 1TB",
    mainCamera: "200 MP + 10 MP + 10 MP + 12 MP", battery: "5000 mAh",
    codes: [
      { code: "SM-S918B", region: "Intl" },
      { code: "SM-S918U", region: "US" },
      { code: "SM-S918U1", region: "US" },
    ],
  },
  {
    brand: "Samsung", commercialName: "Galaxy A54 5G", deviceCategory: "phone", year: 2023,
    screen: '6.4" FHD+ Super AMOLED 120Hz', processor: "Exynos 1380", ram: "6/8 GB", storage: "128/256 GB",
    mainCamera: "Triple 50+12+5 MP", battery: "5000 mAh",
    codes: [
      { code: "SM-A546B", region: "Intl" },
      { code: "SM-A546U", region: "US" },
      { code: "SM-A546U1", region: "US" },
    ],
  },
  {
    brand: "Samsung", commercialName: "Galaxy Z Fold5", deviceCategory: "phone", year: 2023,
    screen: '7.6" Dynamic AMOLED 2X Fold', processor: "Snapdragon 8 Gen 2 f. Galaxy", ram: "12 GB", storage: "256/512GB / 1TB",
    mainCamera: "Triple 50+10+12 MP", battery: "4400 mAh",
    codes: [
      { code: "SM-F946B", region: "Intl" },
      { code: "SM-F946U", region: "US" },
      { code: "SM-F946U1", region: "US" },
    ],
  },
  {
    brand: "Samsung", commercialName: "Galaxy S24 Ultra", deviceCategory: "phone", year: 2024,
    screen: '6.8" Dynamic AMOLED 2X Flat', processor: "Snapdragon 8 Gen 3 f. Galaxy", ram: "12 GB", storage: "256/512GB / 1TB",
    mainCamera: "200 MP + 50 MP + 10 MP + 12 MP", battery: "5000 mAh",
    codes: [
      { code: "SM-S928B", region: "Intl" },
      { code: "SM-S928U", region: "US" },
      { code: "SM-S928U1", region: "US" },
    ],
  },
  {
    // Confirmed NOT launched in the US (Samsung explicitly skipped the US
    // market for this model) — corroborated by 9to5Google, SamMobile,
    // PhoneArena, and Android Authority coverage. Case/accessory listings
    // that mention "SM-A556U" describe compatibility with the
    // international model only, not a real US retail device — not added.
    brand: "Samsung", commercialName: "Galaxy A55 5G", deviceCategory: "phone", year: 2024,
    screen: '6.6" FHD+ Super AMOLED 120Hz', processor: "Exynos 1480", ram: "8/12 GB", storage: "128/256 GB",
    mainCamera: "Triple 50+12+5 MP", battery: "5000 mAh",
    codes: [{ code: "SM-A556B", region: "Intl" }],
  },
  {
    brand: "Samsung", commercialName: "Galaxy S25 Ultra", deviceCategory: "phone", year: 2025,
    screen: '6.86" Dynamic AMOLED 2X Slim', processor: "Snapdragon 8 Elite f. Galaxy", ram: "12/16 GB", storage: "256/512GB / 1TB",
    mainCamera: "200 MP + 50 MP + 50 MP + 12 MP", battery: "5000 mAh",
    codes: [
      { code: "SM-S938B", region: "Intl" },
      { code: "SM-S938U", region: "US" },
      { code: "SM-S938U1", region: "US" },
    ],
  },
  {
    brand: "Samsung", commercialName: "Galaxy A56 5G", deviceCategory: "phone", year: 2025,
    screen: '6.6" Super AMOLED 120Hz', processor: "Exynos 1580", ram: "8 GB", storage: "128/256 GB",
    mainCamera: "Triple 50+12+5 MP", battery: "5000 mAh",
    codes: [
      { code: "SM-A566B", region: "Intl" },
      { code: "SM-A566U", region: "US" },
      { code: "SM-A566U1", region: "US" },
    ],
  },
  {
    // 2026 release — no direct samsung.com confirmation found yet given
    // how recent it is; U/U1 corroborated by multiple independent US
    // retailers (Target, NeweggBusiness, eBay, Newegg).
    brand: "Samsung", commercialName: "Galaxy S26 Ultra", deviceCategory: "phone", year: 2026,
    screen: '6.9" Dynamic AMOLED 2X UltraFlat', processor: "Snapdragon 8 Gen 5 / Exynos 2600", ram: "16 GB", storage: "256/512GB / 1TB",
    mainCamera: "200 MP + 50 MP + 50 MP + 50 MP", battery: "5100 mAh",
    codes: [
      { code: "SM-S948B", region: "Intl" },
      { code: "SM-S948U", region: "US" },
      { code: "SM-S948U1", region: "US" },
    ],
  },
];
