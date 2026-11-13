# English edition verification

Verified on 2026-11-13 against the English branch.

- Production TypeScript/Vite build: passed; base `/old-web-outpost/en/`.
- Unit tests: 95 passed, 0 failed (`node --test` over `qa/*.test.mjs`).
- English browser flow: 10 checks passed, 0 page errors, 0 failed asset responses.
- An isolated browser physically picked up Blue and Mushroom; its collection detail had only the name, placeholder and research prompt.
- Isolated ownership fixtures tested all five English archive names through real Old Terminal E interaction. Each unlocked only its own record; image/source/gallery/zoom, collection update, repeat-search counts and refresh were checked.
- Empty/unknown/uncollected searches, IME confirmation, typed game shortcut letters, and Clear Progress were checked.
- Windows, collection and map were inspected at 1024×768. Four map labels fit without clipping.
- The archive sign, awning and CRT material names were verified against the original GLBs. Runtime English textures preserve model geometry and CRT emission.
- No user's browser save was changed by these checks.

Evidence: `english-browser-report.json`, `english-scene-report.json` and `english-*.png`. The supplied meme images, watermarks, source URLs and stable save/pickup IDs remain unchanged. Chinese glyphs are intentional only in original image media, configured legacy search aliases, and the existing audio filename.

The Chinese snapshot is branch `zh-cn`, commit `754697f8475a6ae96adc56be2d66a30ff09fc942`. The main branch's game content remains Chinese; deployment combines its build with the English branch at `/en/`.
