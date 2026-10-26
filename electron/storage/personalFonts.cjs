const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MANIFEST_FILENAME = "fonts.json";
const FIRST_FONT_ID = 1001;
const MAX_FONT_FILE_SIZE = 20 * 1024 * 1024;
const FONT_FORMATS = { ".ttf": "truetype", ".otf": "opentype", ".woff": "woff", ".woff2": "woff2" };

function readManifest(folder) {
  try {
    const fonts = JSON.parse(fs.readFileSync(path.join(folder, MANIFEST_FILENAME), "utf8"));
    return Array.isArray(fonts) ? fonts : [];
  } catch {
    return [];
  }
}

function writeManifest(folder, fonts) {
  const manifestPath = path.join(folder, MANIFEST_FILENAME);
  const tempPath = `${manifestPath}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(fonts, null, 2));
    fs.renameSync(tempPath, manifestPath);
  } catch (error) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    throw new Error(`Failed to save font library: ${error.message}`);
  }
}

// Text elements store the font id, so an id must never be handed out twice:
// removed fonts stay in the manifest as tombstones and still count here.
function getNextFontId(fonts) {
  return Math.max(FIRST_FONT_ID, ...fonts.map((font) => font.id + 1));
}

// Keep display names distinct so the font picker can tell fonts apart
// ("Lato", "Lato 2", ...).
function getUniqueFamily(fonts, family) {
  const taken = new Set(fonts.filter((font) => !font.removed).map((font) => font.family.toLowerCase()));
  let candidate = family;
  for (let suffix = 2; taken.has(candidate.toLowerCase()); suffix++) candidate = `${family} ${suffix}`;
  return candidate;
}

function toRendererFont(folder, font) {
  return {
    id: font.id,
    family: font.family,
    dataUrl: fs.readFileSync(path.join(folder, font.fileName)).toString("base64"),
    format: font.format,
  };
}

function listFonts(folder) {
  fs.mkdirSync(folder, { recursive: true });
  return readManifest(folder)
    .filter((font) => !font.removed && fs.existsSync(path.join(folder, font.fileName)))
    .map((font) => toRendererFont(folder, font));
}

function importFont(folder, source) {
  if (fs.statSync(source).size > MAX_FONT_FILE_SIZE) throw new Error("Font files must be 20 MB or smaller.");
  const extension = path.extname(source).toLowerCase();
  const format = FONT_FORMATS[extension];
  if (!format) throw new Error("Unsupported font format.");
  fs.mkdirSync(folder, { recursive: true });
  const fonts = readManifest(folder);
  const family = getUniqueFamily(fonts, path.basename(source, path.extname(source)).replace(/[-_]+/g, " ").trim() || "Custom Font");
  const id = getNextFontId(fonts);
  const fileName = `font-${id}${extension}`;
  fs.copyFileSync(source, path.join(folder, fileName));
  const font = { id, family, fileName, format };
  writeManifest(folder, [...fonts, font]);
  return toRendererFont(folder, font);
}

function removeFont(folder, id) {
  const fonts = readManifest(folder);
  const font = fonts.find((item) => item.id === id && !item.removed);
  if (!font) return false;
  try { fs.unlinkSync(path.join(folder, font.fileName)); } catch {}
  writeManifest(folder, fonts.map((item) => (item === font ? { ...item, removed: true } : item)));
  return true;
}

module.exports = { listFonts, importFont, removeFont, getNextFontId };
