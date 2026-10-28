import { vi } from "vitest";

import { CommandPalette, Excalidraw, TTDDialog } from "../index";

import { act, fireEvent, render, waitFor } from "./test-utils";

// Mock CodeMirror deps so the dynamic import of CodeMirrorEditor fails,
// causing TTDDialogInput to fall back to <textarea> in tests.
vi.mock("@codemirror/view", () => ({}));
vi.mock("@codemirror/state", () => ({}));
vi.mock("@codemirror/language", () => ({}));
vi.mock("@lezer/highlight", () => ({}));

const { h } = window;

const persistenceAdapter = {
  loadChats: async () => [],
  saveChats: async () => {},
};

const getCommandPaletteItems = async (search: string) => {
  act(() => {
    h.app.setOpenDialog({ name: "commandPalette" });
  });
  const input = await waitFor(() => {
    const element = document.querySelector<HTMLInputElement>(
      ".command-palette-dialog input",
    );
    expect(element).not.toBeNull();
    return element!;
  });
  fireEvent.change(input, { target: { value: search } });
  return Array.from(document.querySelectorAll(".command-item")).map(
    (item) => item.textContent,
  );
};

describe("text to diagram availability", () => {
  it("offers text to diagram when the host renders the TTD dialog", async () => {
    await render(
      <Excalidraw>
        <CommandPalette />
        <TTDDialog
          onTextSubmit={async () => ({ generatedResponse: "", error: null })}
          persistenceAdapter={persistenceAdapter}
        />
      </Excalidraw>,
    );

    expect(h.app.plugins.textToDiagram).toBe(true);
    const items = await getCommandPaletteItems("diagram");
    expect(items.some((item) => item?.includes("Text to diagram"))).toBe(true);
  });

  it("hides text to diagram but keeps Mermaid without the host TTD dialog", async () => {
    await render(
      <Excalidraw>
        <CommandPalette />
      </Excalidraw>,
    );

    expect(h.app.plugins.textToDiagram).toBeUndefined();
    expect(
      (await getCommandPaletteItems("diagram")).some((item) =>
        item?.includes("Text to diagram"),
      ),
    ).toBe(false);
    expect(
      (await getCommandPaletteItems("mermaid")).some((item) =>
        item?.includes("Mermaid to Excalidraw"),
      ),
    ).toBe(true);
  });

  it("shows the Mermaid tab when the fallback dialog is opened for text to diagram", async () => {
    await render(
      <Excalidraw
        initialData={{
          appState: { openDialog: { name: "ttd", tab: "text-to-diagram" } },
        }}
      />,
    );

    const dialog = await waitFor(() => {
      const element = document.querySelector(".ttd-dialog");
      expect(element).not.toBeNull();
      return element!;
    });
    expect(dialog.querySelector(".dialog-mermaid-title")).not.toBeNull();
    // the Mermaid tab content (with its input) is rendered, not an empty tab
    await waitFor(() =>
      expect(dialog.querySelector(".ttd-dialog-input")).not.toBeNull(),
    );
  });
});
