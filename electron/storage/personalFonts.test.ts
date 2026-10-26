import fs from "fs";
import os from "os";
import path from "path";

import personalFonts from "./personalFonts.cjs";

describe("personal font library", () => {
  let root: string;
  let folder: string;

  const createFontFile = (name: string, content = name) => {
    const filePath = path.join(root, name);
    fs.writeFileSync(filePath, content);
    return filePath;
  };

  const readManifest = () =>
    JSON.parse(fs.readFileSync(path.join(folder, "fonts.json"), "utf8"));

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "personal-fonts-"));
    folder = path.join(root, "personal-fonts");
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("imports and lists fonts with sequential ids", () => {
    const first = personalFonts.importFont(
      folder,
      createFontFile("My-Font.ttf"),
    );
    const second = personalFonts.importFont(
      folder,
      createFontFile("Other_Font.woff2"),
    );

    expect(first).toMatchObject({
      id: 1001,
      family: "My Font",
      format: "truetype",
    });
    expect(second).toMatchObject({
      id: 1002,
      family: "Other Font",
      format: "woff2",
    });
    expect(Buffer.from(first.dataUrl, "base64").toString()).toBe("My-Font.ttf");
    expect(personalFonts.listFonts(folder).map((font: any) => font.id)).toEqual(
      [1001, 1002],
    );
  });

  it("gives fonts with the same name distinct display names", () => {
    fs.mkdirSync(path.join(root, "other"));
    const first = personalFonts.importFont(folder, createFontFile("Lato.ttf"));
    const second = personalFonts.importFont(
      folder,
      createFontFile(path.join("other", "lato.otf")),
    );
    const third = personalFonts.importFont(folder, createFontFile("Lato.woff"));

    expect([first.family, second.family, third.family]).toEqual([
      "Lato",
      "lato 2",
      "Lato 3",
    ]);

    // a removed font's name becomes available again
    personalFonts.removeFont(folder, first.id);
    expect(
      personalFonts.importFont(folder, createFontFile("Lato.woff2")).family,
    ).toBe("Lato");
  });

  it("never reuses the id of a removed font", () => {
    personalFonts.importFont(folder, createFontFile("A.ttf"));
    const removed = personalFonts.importFont(folder, createFontFile("B.ttf"));

    expect(personalFonts.removeFont(folder, removed.id)).toBe(true);
    expect(personalFonts.listFonts(folder).map((font: any) => font.id)).toEqual(
      [1001],
    );
    expect(fs.existsSync(path.join(folder, `font-${removed.id}.ttf`))).toBe(
      false,
    );

    // existing text referencing the removed font must not silently pick up
    // a newly imported font
    const next = personalFonts.importFont(folder, createFontFile("C.ttf"));
    expect(next.id).toBe(1003);
    expect(personalFonts.removeFont(folder, removed.id)).toBe(false);
  });

  it("reads manifests written before removed fonts were tracked", () => {
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, "font-1005.otf"), "legacy");
    fs.writeFileSync(
      path.join(folder, "fonts.json"),
      JSON.stringify([
        {
          id: 1005,
          family: "Legacy",
          fileName: "font-1005.otf",
          format: "opentype",
        },
      ]),
    );

    expect(personalFonts.listFonts(folder)).toMatchObject([
      { id: 1005, family: "Legacy", format: "opentype" },
    ]);
    expect(personalFonts.importFont(folder, createFontFile("New.ttf")).id).toBe(
      1006,
    );
    expect(readManifest()).toHaveLength(2);
  });

  it("treats a missing or corrupt manifest as an empty library", () => {
    expect(personalFonts.listFonts(folder)).toEqual([]);
    fs.writeFileSync(path.join(folder, "fonts.json"), "{not json");
    expect(personalFonts.listFonts(folder)).toEqual([]);
  });

  it("rejects unsupported font files without touching the library", () => {
    expect(() =>
      personalFonts.importFont(folder, createFontFile("readme.txt")),
    ).toThrow("Unsupported font format.");
    expect(fs.existsSync(path.join(folder, "fonts.json"))).toBe(false);
  });
});
