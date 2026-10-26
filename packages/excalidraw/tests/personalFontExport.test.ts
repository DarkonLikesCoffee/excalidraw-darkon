import fs from "fs";
import path from "path";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { Fonts } from "../fonts/Fonts";
import * as exportUtils from "../scene/export";
import { subsetToBase64 } from "../subset/subset-shared.chunk";
import loadWoff2 from "../subset/woff2/woff2-loader";

import { API } from "./helpers/api";

const PERSONAL_FONT_ID = 1001;

// a plain truetype font, as users import them (bundled fonts are all woff2)
const getTrueTypeFont = async () => {
  const woff2 = await fs.promises.readFile(
    path.resolve(
      __dirname,
      "../fonts/Nunito/Nunito-Regular-XRXI3I6Li01BKofiOc5wtlZ2di8HDIkhdTQ3j6zbXWjgeg.woff2",
    ),
  );
  const { decompress } = await loadWoff2();
  return Buffer.from(decompress(new Uint8Array(woff2).buffer));
};

describe("personal fonts in SVG export", () => {
  beforeAll(() => {
    // the setupTests document.fonts stub lacks delete(), used on unregister
    Object.assign(document.fonts, { delete: vi.fn() });
  });

  afterEach(() => {
    Fonts.unregisterPersonalFont(PERSONAL_FONT_ID);
  });

  it("embeds a subset of an imported truetype font", async () => {
    const ttf = await getTrueTypeFont();
    expect(ttf.subarray(0, 4)).toEqual(Buffer.from([0, 1, 0, 0]));

    await Fonts.registerPersonalFont({
      id: PERSONAL_FONT_ID,
      family: "My Font",
      dataUrl: ttf.toString("base64"),
      format: "truetype",
    });

    const text = API.createElement({
      type: "text",
      text: "Hello",
      fontFamily: PERSONAL_FONT_ID as ExcalidrawTextElement["fontFamily"],
    });

    const svg = await exportUtils.exportToSvg(
      [text],
      {
        exportBackground: false,
        viewBackgroundColor: "#ffffff",
        exportWithDarkMode: false,
      },
      null,
    );

    expect(svg.querySelector("text")?.getAttribute("font-family")).toMatch(
      /^"ExcalidrawPersonalFont-1001", "My Font", /,
    );

    const css = svg.querySelector("style.style-fonts")?.textContent ?? "";
    const match = css.match(
      /@font-face \{ font-family: ExcalidrawPersonalFont-1001; src: url\(data:font\/woff2;base64,([^)]+)\); \}/,
    );
    expect(match).not.toBeNull();
    // subset to the used glyphs and compressed, so much smaller than the source
    expect(Buffer.from(match![1], "base64").length).toBeLessThan(
      ttf.length / 4,
    );
  }, 30_000);

  it("embeds woff (1.0) fonts whole, labelled with their format", async () => {
    const woff = new Uint8Array([
      ..."wOFF".split("").map((char) => char.charCodeAt(0)),
      1,
      2,
      3,
    ]);

    expect(await subsetToBase64(woff.buffer, [72])).toBe(
      `data:font/woff;base64,${Buffer.from(woff).toString("base64")}`,
    );
  });
});
