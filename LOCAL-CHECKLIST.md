# Local checklist

Things that can only be checked on your computer, in the desktop app. Tick the boxes as you go and send back the results (a short note per section is enough, plus screenshots where asked).

Branch with the changes: `claude/happy-thompson-hrxcmu`

## 0. Setup

- [ ] Get the branch:
  ```bash
  git fetch origin
  git checkout claude/happy-thompson-hrxcmu
  git pull
  yarn install
  ```
- [ ] Start the app the way you usually do. The repo has no launch script; `electron/main.cjs` loads `http://localhost:3001`, so it is presumably:
  ```bash
  yarn start          # terminal 1: dev server on port 3001
  npx electron .      # terminal 2: desktop window
  ```
  If you launch it differently, tell me how, so I can add a script for it.

## 1. Desktop app still works (quick regression check)

The app's startup code was reorganized so it also runs in a plain browser. Nothing should look different in the desktop app.

- [ ] The app opens on the board dashboard (not directly in an empty editor).
- [ ] Open a board, draw something, go back to the dashboard, reopen the board: the drawing is still there.
- [ ] The main menu still has your "Open" item for external `.excalidraw` files, and it works.
- [ ] The title bar buttons (minimize, maximize, close, Dashboard) work.

## 2. Dark mode colors

Expected: shapes and text keep their exact color in dark mode; the canvas background is dark (follows the theme).

- [ ] Switch to dark mode. Draw a rectangle, open its stroke color and type `00FF00` in the hex box. The canvas shows bright green, and the hex box still says `00FF00` (not `009400`).
- [ ] Use the eyedropper (press `I`) on that rectangle: it picks `#00FF00`.
- [ ] Give some text a color, then double-click it to edit: the color stays the same while editing and after you click away.
- [ ] Open the canvas background color picker, use its eyedropper on a colored shape: the background becomes the same color you see on the shape.
- [ ] Draw an arrow with a hollow arrowhead (e.g. outlined triangle): the inside of the arrowhead matches the dark background (no white fill).
- [ ] Export in dark mode as PNG and as SVG: shape colors match the canvas, and both exports look the same.

Known and expected: the default near-black stroke color is hard to see on the dark canvas (that's the "exact colors + themed background" choice).

## 3. Custom fonts

- [ ] Rename a font file to have a space and a number, e.g. `Lato 300.ttf`, import it (font picker → "Import font…"), write some text with it.
- [ ] The text renders in that font (not a default font).
- [ ] When the text is selected, it sits centered in its selection box (not too high, not too low, not cut off).
- [ ] Save, **fully quit the app**, start it again and reopen the board: the text still uses the font.
- [ ] Import two **different** fonts with the same file name (e.g. two files both named `Lato.ttf` from different folders): the picker shows "Lato" and "Lato 2", and text in each looks different.
- [ ] Remove a font ("Remove selected") that some text uses, then import a different font: the old text does **not** switch to the new font.
- [ ] Export text that uses a custom font as **SVG**, and open the SVG file in a web browser: the text keeps the custom font.
- [ ] **Screenshot:** open the font picker so the "Import font…" and "Remove selected" buttons are visible and send it to me, plus a note on what looks off compared to the rest of the app.

## 4. What to send back

- Which boxes failed, with a screenshot or a short description each.
- Any error shown in the app (DevTools: `Ctrl+Shift+I` → Console).
- The font picker screenshot from section 3.
