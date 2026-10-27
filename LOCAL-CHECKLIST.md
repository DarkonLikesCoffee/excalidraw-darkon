# Desktop verification record

Record of the checks done for the desktop changes on the branch `claude/happy-thompson-hrxcmu`. Checks you did on your own machine are kept separate from checks done by Claude in its cloud environment.

## How to run

```bash
yarn install
yarn desktop          # development: dev server + desktop window
yarn desktop:dist     # build and package for the current system into dist-desktop/
```

## Checked on your machine

You reported that you completed the local checklist on your machine and that everything appears to work correctly. That checklist covered:

- [x] Getting the branch and starting the app with `yarn desktop`.
- [x] **Your existing fonts:** fonts imported before these changes still appear in the font picker, and existing text using them shows the right font.
- [x] **Import dialog:** font picker → "Import font…" → a picked font appears in the list and can be used.
- [x] **Open dialog:** main menu → "Open" and the dashboard's "Open File" open an external `.excalidraw` file.
- [x] **Export dialogs:** SVG and PNG export of a board with custom-font text, in light and dark mode; the SVG keeps the custom font in a web browser and the colors match the canvas.
- [x] **Window buttons:** minimize, maximize/restore and close in the title bar.
- [x] **Packaging:** `yarn desktop:dist` on your system.
- [x] **Installed app:** opens without `yarn desktop` running, shows your boards, custom fonts work.

Not recorded:

- **Operating system** used for these checks.
- **Offline use of the installed app** (starting it with the internet turned off): not explicitly confirmed.

After the merge into `main`, you reported that you tested the final version following the local guide and that it looks fine. The guide covered:

- [x] Pulling `main` and installing dependencies.
- [x] **Single-instance lock** with `yarn desktop`: a second launch focuses the running window instead of opening another one (including when minimized).
- [x] **Packaging** with `yarn desktop:dist` (publishing disabled: no `latest*.yml` files).
- [x] **Installed app without the dev server:** runs from `app://excalidraw/`, shows Settings → About 0.1.0, boards and custom fonts work, and a second launch (also while `yarn desktop` runs) focuses the existing window.

Not checked on your machine, because they were added after your checks:

- Links open in the default browser (links in drawings, menu and help links).
- Live collaboration and shareable links are hidden in the desktop app.
- Excalidraw+ is hidden in the desktop app.

## Checked by Claude in the cloud

Run in the real Electron app on Linux (virtual display, no window manager), driven by scripts. Windows and macOS were not available.

- **Development launcher:** `yarn desktop` starts and stops cleanly and reuses a running dev server; the app opens on the dashboard.
- **Production build:** `yarn desktop:dist` produces an AppImage that runs without a dev server, loads the boards and custom fonts from the same data folder, and makes no network requests (in the cloud, with outbound access to other hosts blocked).
- **Single instance:** with one instance open, a second launch exits within seconds without opening a window, and the running window receives the event and ends up visible and focused. Checked for: development + production build, production build + development (`yarn desktop` also stops the dev server it started), AppImage + AppImage, development + AppImage. Restoring a _minimized_ window could not be checked (no window manager in the cloud).
- **Publishing disabled:** with `"publish": null`, packaging succeeds and no `app-update.yml` / `latest-linux.yml` is generated.
- **Links:** with `yarn desktop` and the AppImage, clicking a link in a drawing, opening a `_blank` link and navigating the main window away all hand the URL to the default browser (recorded instead of launched in the cloud); no extra window stays open and the app stays on its page. `file:` links are not opened, and the temporary blank window they leave is closed after 5 seconds. (Before this change, external pages opened in an app window without access to the desktop APIs.)
- **No collaboration / share links:** in the desktop app (development and AppImage) there is no live collaboration button or menu item, "Save to..." has no "Shareable link" option, and the command palette has no "Live collaboration" or "Share" commands. The browser version is unchanged.
- **No Excalidraw+:** in the desktop app (development and AppImage) the main menu has no "Excalidraw+" / "Sign up", "Save to..." only offers "Save to disk", the command palette has no Excalidraw+ commands, the welcome screen has no sign-up link, the sidebar only has Excalidraw's search and library tabs (no Excalidraw+ promo tabs), and the footer has no "end-to-end encrypted" icon (it links to Excalidraw+'s blog). The browser version still shows all of them.
- **Dashboard dark mode:** the dashboard, its dialogs and menus and the title bar follow the editor theme (also when toggled inside the editor); the light theme is pixel-identical to before.
- **Icon and version:** the AppImage uses `electron/icon.png`; Settings → About shows the version from `package.json` (also in the packaged app).
- **Boards:** create, draw, autosave to the `.excalidraw` file, back to the dashboard, reopen, full restart and reopen; recent list and thumbnails update.
- **Dark mode colors:** typing `00FF00` keeps `00ff00` in the hex box and draws exactly `#00ff00`; the eyedropper picks exactly `#00ff00`; colored text keeps its exact color while editing; hollow arrowheads match the dark background.
- **Fonts:** imported fonts (incl. names like "Lato 300", `.ttf` and `.otf`) render correctly and survive a full restart; two fonts with the same file name show as "Lato" / "Lato 2" and render differently; picking a font is saved; the selection box is centered on custom-font text; after removing a font and importing another, old text does not switch to the new font; text whose font is missing falls back to Excalifont.

## Known limitations

- **Canvas background in dark mode:** very bright colors can't be shown exactly on the themed background; picking `#00FF00` for the background shows the closest possible green (`#37b637`, stored as `#009400`).
- **Separate browser storage:** the installed app and `yarn desktop` keep their own theme and shape library; boards, custom fonts, settings and recent boards are shared (same data folder).
- **Unsigned packages:** Windows (SmartScreen) and macOS (Gatekeeper) warn on first launch; Windows and macOS packages must be built on those systems. Code signing was decided against (the app is for you and a few friends).
- **Welcome screen text:** on an empty board, the welcome screen still says drawings are saved in the browser's storage; in the desktop app boards are saved as `.excalidraw` files.
