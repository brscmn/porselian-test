import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = path.join(root, "data", "products.csv");
const csvOutput = path.join(root, "data", "etsy_listings.csv");
const jsonOutput = path.join(root, "data", "etsy_listings.json");

const productMap = {
  vase: {
    etsy_category: "Home & Living > Home Decor > Vases",
    name: "vase",
    use: "dried flowers, shelf styling, console tables and modern home accents",
    tags: ["stone vase", "ceramic look vase", "dried flower vase", "shelf decor"],
  },
  candle_holder: {
    etsy_category: "Home & Living > Home Decor > Candleholders",
    name: "candle holder",
    use: "dinner tables, coffee tables, bedside styling and cozy home corners",
    tags: ["candle holder", "minimal candle", "table decor", "cozy decor"],
  },
  tray: {
    etsy_category: "Home & Living > Home Decor > Decorative Trays",
    name: "decorative tray",
    use: "jewelry, candles, perfumes, coffee table styling and vanity organization",
    tags: ["decorative tray", "jewelry tray", "vanity tray", "trinket dish"],
  },
  bowl: {
    etsy_category: "Home & Living > Home Decor > Decorative Bowls",
    name: "decorative bowl",
    use: "entryway styling, small accessories, shelf decor and coffee table styling",
    tags: ["decor bowl", "catchall bowl", "entryway bowl", "table accent"],
  },
  wall_decor: {
    etsy_category: "Home & Living > Home Decor > Wall Decor",
    name: "wall decor",
    use: "gallery walls, entryways, living rooms and calm modern interiors",
    tags: ["wall decor", "minimal wall art", "home wall accent", "modern decor"],
  },
  bookend: {
    etsy_category: "Home & Living > Office > Bookends",
    name: "bookend",
    use: "bookshelves, work desks, reading corners and office styling",
    tags: ["bookend", "shelf decor", "desk decor", "book lover gift"],
  },
  incense_holder: {
    etsy_category: "Home & Living > Spirituality & Religion > Incense Holders",
    name: "incense holder",
    use: "incense rituals, meditation corners, bedside styling and calm home spaces",
    tags: ["incense holder", "zen decor", "meditation gift", "ritual decor"],
  },
};

const baseTags = [
  "stone powder decor",
  "handmade decor",
  "minimalist decor",
  "modern home decor",
  "housewarming gift",
  "neutral home decor",
  "aesthetic decor",
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const headers = rows.shift().map((header) => header.trim());
  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function titleCase(value) {
  return value.replace(/\w\S*/g, (part) => part[0].toUpperCase() + part.slice(1).toLowerCase());
}

function splitKeywords(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function limitTitle(title) {
  return title.slice(0, 137).replace(/[,\-| ]+$/g, "");
}

function makeTitle(row, product) {
  const color = titleCase(row.color.trim());
  const style = titleCase(row.style.trim());
  const setText = row.set_count && row.set_count !== "1" ? ` Set of ${row.set_count}` : "";
  const keywords = splitKeywords(row.keywords);
  const keywordText = keywords.length ? `, ${titleCase(keywords[0])}` : "";
  return limitTitle(
    `${color} ${style} Stone Powder ${titleCase(product.name)}${setText}, Handmade Minimalist Home Decor${keywordText}, Housewarming Gift`,
  );
}

function makeTags(row, product) {
  const candidates = [
    ...product.tags,
    ...splitKeywords(row.keywords),
    `${row.color.trim()} decor`,
    `${row.style.trim()} decor`,
    ...baseTags,
  ];
  const tags = [];
  const seen = new Set();

  for (const candidate of candidates) {
    const tag = candidate.toLowerCase().replace(/\s+/g, " ").trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag.slice(0, 20));
    if (tags.length === 13) break;
  }
  return tags;
}

function makeDescription(row, product) {
  const note = row.notes?.trim() ? `\nNote: ${row.notes.trim()}` : "";
  return `${row.product_name_tr.trim()} is a handmade stone powder ${product.name} designed for calm, modern and giftable home styling.

DETAILS
- Material: stone powder composite
- Color: ${row.color.trim()}
- Style: ${row.style.trim()}
- Size: ${row.dimensions.trim()}
- Quantity: ${row.set_count.trim() || "1"} piece(s)
- Use: ${product.use}

WHY YOU WILL LOVE IT
- Handmade decorative object with a ceramic-like matte look
- Works beautifully in neutral, minimalist, scandi and modern interiors
- A thoughtful gift for housewarmings, birthdays, weddings and new home celebrations

CARE
- Wipe gently with a soft dry or slightly damp cloth
- Keep away from long water exposure
- Each piece is handmade, so tiny surface differences may appear${note}`;
}

function photoChecklist(product) {
  return [
    "main image on clean background",
    "lifestyle image in home setting",
    "close-up texture detail",
    "scale image with hand or common object",
    "dimension image",
    `use-case image for ${product.name}`,
    "packaging or gift-ready image",
    "alternate interior styling image",
  ].join(" | ");
}

function buildListing(row) {
  const product = productMap[row.product_type.trim()] ?? productMap.tray;
  return {
    sku: row.sku.trim(),
    etsy_title: makeTitle(row, product),
    etsy_description: makeDescription(row, product),
    etsy_tags: makeTags(row, product).join(", "),
    etsy_category: product.etsy_category,
    materials: "stone powder composite, water-based pigment, protective finish",
    photo_checklist: photoChecklist(product),
    visual_brief: visualBrief(row, product),
  };
}

function visualBrief(row, product) {
  const name = row.product_name_tr.trim();
  const color = row.color.trim();
  const dimensions = row.dimensions.trim();
  const setCount = row.set_count.trim() || "1";

  return [
    `Create an 8-image Etsy visual set from one reference image for ${name}, a handmade stone powder ${product.name}.`,
    `Show ${setCount} piece(s), ${color} color direction, ${dimensions} size context.`,
    `Use bright natural light, clean neutral interior styling, realistic matte stone texture and premium handmade decor feeling.`,
    `Include: main lifestyle image, clean catalog image, dimension image, close texture image, use-case image, set/count image, packaging or gift image and alternate interior styling image.`,
    `Do not show water or fresh flowers unless the product note says it can hold water.`,
  ].join(" ");
}

const products = parseCsv(fs.readFileSync(input, "utf8").replace(/^\uFEFF/, ""));
const listings = products.map(buildListing);
const headers = Object.keys(listings[0]);
const csv = [headers.join(","), ...listings.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");

fs.writeFileSync(csvOutput, `${csv}\n`, "utf8");
fs.writeFileSync(jsonOutput, `${JSON.stringify(listings, null, 2)}\n`, "utf8");

console.log(`Generated ${listings.length} Etsy listings`);
