# Local checklist

Things that can only be checked on your computer. Tick the boxes as you go and send back the results (a short note per item is enough, plus screenshots where asked).

Branch with the changes: `claude/happy-thompson-hrxcmu`

## 0. Setup

- [ ] Get the branch and start the app:
  ```bash
  git fetch origin
  git checkout claude/happy-thompson-hrxcmu
  git pull
  yarn install
  yarn desktop
  ```
  `yarn desktop` starts the dev server (or reuses one on port 3001) and opens the desktop window; closing the window stops the dev server it started. The first run may download the Electron binary.
- [ ] Tell me which system you ran it on (Windows / Linux / Mac). If it fails, send the terminal output.

## 1. Things the cloud can't do

These need native file dialogs, a real window manager or your own data.

- [ ] **Your existing fonts:** fonts you imported before these changes still appear in the font picker, and existing text using them still shows the right font.
- [ ] **Import dialog:** font picker → "Import font…" → pick a font file. It appears in the list and can be used.
- [ ] **Open dialog:** main menu → "Open" (and the dashboard's "Open File") opens an external `.excalidraw` file.
- [ ] **Export dialogs:** export a board with custom-font text as **SVG** and as **PNG**, once in light and once in dark mode. Open the SVG in a web browser: the text keeps the custom font and the colors match the canvas.
- [ ] **Window buttons:** minimize, maximize/restore and close in the title bar work.

## 2. Installable desktop build

`yarn desktop:dist` builds the app and packages it for the system you run it on (Windows installer, macOS `.dmg` or Linux AppImage) into `dist-desktop/`. Packages for Windows and macOS have to be built on those systems.

- [ ] Run `yarn desktop:dist`. Send the terminal output if it fails.
- [ ] Install/open the result from `dist-desktop/`. The app is not code-signed, so Windows (SmartScreen) or macOS (Gatekeeper) will warn the first time; allow it to run.
- [ ] The installed app opens without `yarn desktop` running, shows your boards, and your custom fonts work.
- [ ] Turn off your internet connection and start it again: everything still works, including fonts.
- [ ] Note: the installed app keeps its own theme and library (browser storage is separate from the `yarn desktop` dev version); boards, custom fonts and recent boards are shared.

## 3. What to send back

- Which boxes failed, with a screenshot or a short description each.
- Any error shown in the app (DevTools: `Ctrl+Shift+I` → Console).

## Already verified in the cloud (no need to repeat)

Checked in the real Electron app (Linux, virtual display), driven by a script:

- **Desktop:** `yarn desktop` starts and stops cleanly, reuses a running dev server; the app opens on the dashboard.
- **Dashboard dark mode:** the dashboard, its dialogs and menus and the title bar follow the editor theme (also when toggled inside the editor); the light theme is pixel-identical to before.
- **Icon and version:** the AppImage uses `electron/icon.png`; Settings → About shows the version from `package.json` (also in the packaged app).
- **Production build (Linux):** `yarn desktop:dist` produces an AppImage that runs without a dev server, loads the boards and custom fonts from the same data folder, and makes no network requests.
- **Boards:** create, draw, autosave to the `.excalidraw` file, back to the dashboard (title bar button), reopen, full restart and reopen; recent list and thumbnails update.
- **Dark mode:** typing `00FF00` keeps `00ff00` in the hex box and draws exactly `#00ff00`; the eyedropper picks exactly `#00ff00`; colored text keeps its exact color while editing; hollow arrowheads match the dark background.
- **Canvas background in dark mode** (expected limitation of the themed background): very bright colors can't be shown exactly; picking `#00FF00` for the background shows the closest possible green (`#37b637`, stored as `#009400`).
- **Fonts:** imported fonts (incl. names like "Lato 300", `.ttf` and `.otf`) render correctly and survive a full restart; two fonts with the same file name show as "Lato" / "Lato 2" and render differently; picking a font in the picker works and is saved; the selection box is centered on custom-font text; after removing a font and importing another, old text does not switch to the new font; text whose font is missing falls back to Excalifont.
