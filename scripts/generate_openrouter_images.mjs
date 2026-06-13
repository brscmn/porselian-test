import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const productCsv = path.join(root, "data", "products.csv");
const productImagesDir = path.join(root, "product_images");
const outputDir = path.join(root, "generated_images");
const apiKey = process.env.OPENROUTER_API_KEY;
const model = process.env.OPENROUTER_IMAGE_MODEL;

if (!apiKey) throw new Error("OPENROUTER_API_KEY secret is missing");
if (!model) throw new Error("OPENROUTER_IMAGE_MODEL variable is missing");

fs.mkdirSync(outputDir, { recursive: true });

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

function findProductImage(sku) {
  const extensions = [".jpg", ".jpeg", ".png", ".webp"];
  for (const extension of extensions) {
    const candidate = path.join(productImagesDir, `${sku}${extension}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function mimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "image/jpeg";
}

function dataUrl(filePath) {
  const bytes = fs.readFileSync(filePath);
  return `data:${mimeType(filePath)};base64,${bytes.toString("base64")}`;
}

function imagePrompts(product) {
  const name = product.product_name_tr.trim();
  const type = product.product_type.trim();
  const color = product.color.trim();
  const dimensions = product.dimensions.trim();
  const setCount = product.set_count.trim();
  const note = product.notes.trim();
  const base = `Use the uploaded reference image as the exact product identity. Product: ${name}. Type: ${type}. Color direction: ${color}. Size: ${dimensions}. Set count: ${setCount}. Note: ${note}. Keep the product shape, material, color pattern and realistic scale consistent. Etsy-ready realistic product photography, premium handmade stone powder decor, no logo, no watermark, no extra text unless dimensions are explicitly requested.`;

  return [
    ["01-main-lifestyle", `${base} Create the main Etsy lifestyle image in a bright modern home interior.`],
    ["02-clean-catalog", `${base} Create a clean catalog image on a warm white background with soft shadow.`],
    ["03-dimensions", `${base} Create a clean dimension image with simple measurement lines and visible size context.`],
    ["04-texture-detail", `${base} Create a close-up image showing matte stone texture and handmade surface details.`],
    ["05-use-case", `${base} Create a usage image showing how the product is used naturally in home decor.`],
    ["06-set-count", `${base} Create a clear image showing the full set count and all included pieces.`],
    ["07-packaging-gift", `${base} Create a gift-ready packaging image with protective packaging and handmade shop feeling.`],
    ["08-alternate-style", `${base} Create an alternate interior styling image in a different room or shelf setup.`],
  ];
}

function extractImages(payload) {
  const message = payload?.choices?.[0]?.message;
  const images = [];

  if (Array.isArray(message?.images)) {
    for (const image of message.images) {
      const url = image?.image_url?.url ?? image?.url;
      if (url) images.push(url);
    }
  }

  const content = Array.isArray(message?.content) ? message.content : [];
  for (const item of content) {
    const url = item?.image_url?.url ?? item?.url;
    if (url) images.push(url);
  }

  return images;
}

async function downloadImage(url, target) {
  if (url.startsWith("data:")) {
    const [, encoded] = url.split(",", 2);
    fs.writeFileSync(target, Buffer.from(encoded, "base64"));
    return;
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Image download failed: ${response.status}`);
  fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()));
}

async function generateImage(product, productImage, imageName, prompt) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com",
      "X-Title": "Porselian Etsy Automation",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl(productImage) } },
          ],
        },
      ],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`OpenRouter failed for ${product.sku} ${imageName}: ${JSON.stringify(payload)}`);
  }

  const images = extractImages(payload);
  if (!images.length) {
    const target = path.join(outputDir, product.sku, `${imageName}.json`);
    fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    throw new Error(`No image returned for ${product.sku} ${imageName}. Raw response saved.`);
  }

  const target = path.join(outputDir, product.sku, `${imageName}.png`);
  await downloadImage(images[0], target);
  return target;
}

const products = parseCsv(fs.readFileSync(productCsv, "utf8").replace(/^\uFEFF/, ""));
const manifest = [];

for (const product of products) {
  const productImage = findProductImage(product.sku.trim());
  if (!productImage) {
    console.log(`Skipping ${product.sku}: product image missing`);
    continue;
  }

  fs.mkdirSync(path.join(outputDir, product.sku), { recursive: true });

  for (const [imageName, prompt] of imagePrompts(product)) {
    const file = await generateImage(product, productImage, imageName, prompt);
    manifest.push({ sku: product.sku, imageName, file: path.relative(root, file), prompt });
    console.log(`Generated ${product.sku}/${imageName}`);
  }
}

fs.writeFileSync(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Generated ${manifest.length} images`);
