# Old Web Outpost — English Edition

A first-person exploration game about forgotten internet memes, built with Vite, TypeScript and Three.js. Explore an 84 × 74 metre landscape, collect five floating folders, and recover their meaning at the Old Terminal in the Echo Archive.

## Editions and branches

- [Play in English](https://kur11912.github.io/old-web-outpost/en/) — maintained on the `en` branch.
- [Play in Chinese](https://kur11912.github.io/old-web-outpost/) — maintained on `main`.
- `zh-cn` preserves the Chinese release at commit `754697f` before English localization.
- [Chinese development history](README.zh-CN.md) records earlier implementation and asset validation.

The English edition translates the interface, instructions, archive text, search names, map labels, signs and terminal screen. Original meme images, embedded Chinese text, watermarks and source links are preserved as historical material. English captions explain their context. These images are not newly translated reproductions.

## Run locally

Use Node.js 24 and the pinned pnpm 11.25.0 version:

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

Open `http://127.0.0.1:5180/`. The existing Windows launcher also works. Do not open `index.html` directly; models and modules require an HTTP server.

```sh
pnpm run build
pnpm run preview
```

Production preview: `http://127.0.0.1:5180/old-web-outpost/en/`. Stop the development server before previewing on the same port.

## Controls and collection flow

1. Choose **Start Exploring** for mouse look, or **Use Drag Controls** to look by dragging. Move with WASD; Esc pauses and releases the mouse.
2. Walk up to a yellow floating folder to collect it. Collection reveals only the meme's name and an archive placeholder.
3. Press B for the collection. Unresearched entries hide images, explanations, periods and source notes.
4. Walk to the Old Terminal outside the Echo Archive, look at it and press E. Type the collected meme's name and click **Search** or press Enter.
5. A successful search opens that archive, updates the same collection entry and saves immediately. Repeat searches do not award items or increase the count.
6. Press M for the map. Close a window and click the scene or a start button to resume movement.

English search names:

- Blue and Mushroom
- Friendship Boat
- Are You GG or MM?
- Awesome, My Bro!
- Devil or Show-off?

Explicit aliases accept common punctuation variants and the original Chinese names. Matching normalizes full-width characters, surrounding whitespace and letter case; it does not use fuzzy matching. Uncollected memes cannot be acquired through search. IME confirmation and typing in search do not trigger movement or shortcuts.

The mailbox remains a narrative note. The bridge is open. The lighthouse remains a landmark with a later quest indicated; localization does not add a quest.

**Music** controls the looping background track (15% by default); **SFX** controls footsteps and the pickup chime. **Clear Progress** opens a confirmation dialog. Confirming clears collection, research, investigation and old collection backup, respawns all folders and returns to the starting point. Audio preferences remain saved.

## Saves and language compatibility

All stable meme, pickup and clue IDs and the existing save schema are unchanged. The editions share the same `old-web-outpost:save:v1` key on the same browser origin. Therefore, the Chinese and English Pages URLs share progress and audio preferences: changing language does not reset or award items. Clearing progress in either edition also clears that shared save. Localhost and GitHub Pages have separate browser storage.

Old saves retain explicit pickup and research records. Historical clues alone never manufacture collection entries or unlock an archive. Reset and repair continue to require the player's action.

## Content and implementation

- `src/archive-data.ts`: archive prose, periods, examples, context, image captions, credits and source notes. Uncertain origin claims remain uncertain.
- `src/meme-archives.ts`: canonical English names, explicit aliases and independent archive unlocking.
- `src/pickup-data.ts`: stable IDs, world locations and pickup definitions.
- `src/investigation-ui.ts`: locked collection, terminal search, archive details and image viewer.
- `src/main.ts`, `src/collection-repair-ui.ts`, `src/player.ts`: interface, controls and progress actions.
- `src/map-config.ts`, `src/world.ts`, `src/map-environment.ts`, `src/archive-scene.ts`: map labels and editable nameplates.
- `src/english-scene-text.ts`: English canvas lettering for the archive's signs and CRT screen; original model geometry remains unchanged.
- `public/assets/memes/`: original archive illustrations. `meme_asset/source/old-web-meme-pack/` preserves the supplied source pack.
- `src/save.ts`: unchanged compatible progress storage. Audio preferences are separate.

## Verification

Run the unit suites in PowerShell:

```powershell
$tests = @(rg --files qa -g '*.test.mjs')
node --test @tests
```

`qa/english-browser-test.mjs` checks the English game in isolated browser contexts. It accepts a Playwright module path and preview URL. Historical Chinese QA reports describe their original release; they are retained for provenance, not presented as English test results.

## Publishing

`.github/workflows/deploy.yml` builds `main` into the existing Chinese root and `en` into its `en/` subdirectory, then publishes both in one Pages artifact. Pushes to either branch refresh both editions. `zh-cn` is the preserved Chinese snapshot and does not trigger a replacement of the live site. Never merge English content into `main` to publish it.

Only `dist/` is deployed. Source models, scripts, references and QA records stay in the repository. The original asset and audio attribution files remain alongside their resources.
