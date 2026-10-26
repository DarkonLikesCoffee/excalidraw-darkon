import React from "react";

import {
  applyDarkModeFilter,
  KEYS,
  removeDarkModeFilter,
  THEME,
} from "@excalidraw/common";

import { activeEyeDropperAtom } from "../components/EyeDropper";
import { Excalidraw } from "../index";

import { Keyboard } from "./helpers/ui";
import { act, fireEvent, GlobalTestState, render, waitFor } from "./test-utils";

const { h } = window;

describe("eye dropper", () => {
  it("keeps the color preview within the editor container", async () => {
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);

    Keyboard.keyPress("i");

    const preview = await waitFor(() => {
      const element =
        GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
          ".excalidraw-eye-dropper-preview",
        );
      expect(element).not.toBeNull();
      return element!;
    });

    const eyeDropperContainer =
      GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
        ".excalidraw-eye-dropper-backdrop",
      )!;
    expect(eyeDropperContainer.style.cursor).toMatch(
      /^url\(data:image\/svg\+xml/,
    );
    expect(eyeDropperContainer.style.cursor).toMatch(/\) 2 21, auto$/);

    eyeDropperContainer.getBoundingClientRect = () => ({
      left: 100,
      top: 50,
      right: 500,
      bottom: 350,
      width: 400,
      height: 300,
      x: 100,
      y: 50,
      toJSON: () => {},
    });
    Object.defineProperties(preview, {
      offsetWidth: { configurable: true, value: 48 },
      offsetHeight: { configurable: true, value: 48 },
    });

    // This position fits within the viewport, but not within the editor.
    fireEvent.pointerMove(window, { clientX: 480, clientY: 330 });

    expect(preview.style.left).toBe("325px");
    expect(preview.style.top).toBe("225px");
  });

  it("applies the sampled element color as-is in dark mode", async () => {
    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        theme={THEME.DARK}
      />,
    );

    const ctx = h.app.canvas.getContext("2d")!;
    vi.spyOn(ctx, "getImageData").mockReturnValue({
      data: new Uint8ClampedArray([18, 18, 18, 255]),
    } as ImageData);

    Keyboard.keyPress(KEYS.I);

    const eyeDropperContainer = await waitFor(() => {
      const element =
        GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
          ".excalidraw-eye-dropper-backdrop",
        );
      expect(element).not.toBeNull();
      return element!;
    });

    fireEvent.pointerUp(eyeDropperContainer, {
      clientX: 50,
      clientY: 50,
    });

    // elements are rendered with their exact colors in dark mode, so the
    // sampled pixel is the color to apply
    expect(h.state.currentItemBackgroundColor).toBe("#121212");
  });

  it("un-filters a sampled canvas background color in dark mode", async () => {
    await render(
      <Excalidraw
        autoFocus={true}
        handleKeyboardGlobally={true}
        theme={THEME.DARK}
      />,
    );

    // the canvas background is rendered through the dark-mode filter
    const renderedWhite = applyDarkModeFilter("#ffffff");
    const ctx = h.app.canvas.getContext("2d")!;
    vi.spyOn(ctx, "getImageData").mockReturnValue({
      data: new Uint8ClampedArray([
        parseInt(renderedWhite.slice(1, 3), 16),
        parseInt(renderedWhite.slice(3, 5), 16),
        parseInt(renderedWhite.slice(5, 7), 16),
        255,
      ]),
    } as ImageData);

    const onSelect = vi.fn();
    act(() => {
      h.app.updateEditorAtom(activeEyeDropperAtom, {
        keepOpenOnAlt: false,
        colorPickerType: "canvasBackground",
        onSelect,
      });
    });

    const eyeDropperContainer = await waitFor(() => {
      const element =
        GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
          ".excalidraw-eye-dropper-backdrop",
        );
      expect(element).not.toBeNull();
      return element!;
    });

    fireEvent.pointerUp(eyeDropperContainer, {
      clientX: 50,
      clientY: 50,
    });

    expect(onSelect).toHaveBeenCalledWith(
      removeDarkModeFilter(renderedWhite),
      expect.anything(),
    );
    expect(removeDarkModeFilter(renderedWhite)).toBe("#ffffff");
  });

  it("contrasts the preview border with the sampled color", async () => {
    await render(<Excalidraw autoFocus={true} handleKeyboardGlobally={true} />);

    const ctx = h.app.canvas.getContext("2d")!;
    const getImageDataSpy = vi.spyOn(ctx, "getImageData").mockReturnValue({
      data: new Uint8ClampedArray([18, 18, 18, 255]),
    } as ImageData);

    Keyboard.keyPress(KEYS.I);

    const preview = await waitFor(() => {
      const element =
        GlobalTestState.renderResult.container.querySelector<HTMLDivElement>(
          ".excalidraw-eye-dropper-preview",
        );
      expect(element).not.toBeNull();
      return element!;
    });

    expect(
      preview.style.getPropertyValue("--eye-dropper-preview-border-color"),
    ).toBe("#fff");

    getImageDataSpy.mockReturnValue({
      data: new Uint8ClampedArray([237, 237, 237, 255]),
    } as ImageData);
    fireEvent.pointerMove(window, { clientX: 50, clientY: 50 });

    expect(
      preview.style.getPropertyValue("--eye-dropper-preview-border-color"),
    ).toBe("#222");
  });
});
