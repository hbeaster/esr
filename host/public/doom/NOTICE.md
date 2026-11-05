# DOOM shareware bundle

`doom-shareware.zip` is a js-dos bundle served only by the demo host at `/doom.html`. It is excluded from the npm package and the component build.

- Source: the DOOM v1.9 shareware release by id Software, from <https://archive.org/download/DoomsharewareEpisode/DoomV1.9sw1995idSoftwareInc.action.zip> (SHA-1 `b8d52ae8aa1318aa996cc348de5a4ebe2a6eddde`).
- `DOOM1.WAD` MD5 `f0cefca49926d00903cf57551d901abe`, the published shareware v1.9 IWAD. `DOOM.EXE` MD5 `e2382b7dc47ae2433d26b6e6bc312999`.
- The shareware files are unmodified. `file_id.diz`, which a later archiver added, is omitted.
- Added for the emulator: `DEFAULT.CFG` (Sound Blaster at 220h, IRQ 7, DMA 1) and `.jsdos/dosbox.conf` (autoexec runs `DOOM.EXE`).

DOOM is © id Software. The shareware episode is freely redistributable in unmodified form. Do not add modified levels; see the bundled `README.TXT`.

The player is js-dos 8.5.3, loaded from `cdn.jsdelivr.net` and pinned in `doom.html` and `host/doom.ts`.
