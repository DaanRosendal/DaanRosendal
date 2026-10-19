---
title: Pinboard for VS Code
track: build
when: "Since March 2026"
stat: "{total} installs and downloads"
summary: "I built a VS Code extension for pinning files and folders, born out of working in a huge monorepo at work. It has {installs} VS Code installs and {downloads} Open VSX downloads{asOf}."
order: 3
marketplace: DaanRosendal.pinboard
installsFallback: 742
openVsx: daanrosendal/pinboard
downloadsFallback: 4400
date: 2026-03-14
thumbnail: /achievements/pinboard.webp
cardImage: /achievements/pinboard-card.webp
links:
  - label: Marketplace
    url: https://marketplace.visualstudio.com/items?itemName=DaanRosendal.pinboard
  - label: Open VSX
    url: https://open-vsx.org/extension/daanrosendal/pinboard
  - label: Code
    url: https://github.com/DaanRosendal/pinboard
---

At Lakera / Check Point we work in a huge monorepo, and I kept digging through the same deep folder trees to reach the same few places. So I built Pinboard, a VS Code extension that pins any file or folder as a persistent shortcut in a panel at the top of the Explorer sidebar.

I published it on the Visual Studio Marketplace in March 2026, where it has {installs} installs. It is also on Open VSX, so it works in Cursor, Windsurf, Antigravity etc., and it has {downloads} downloads there{asOf}. It is open source under the MIT licence.

Once you pin something, it stays one click away, however deep it sits in the project. Pinboard lets you:

- Pin files and folders globally or per workspace.
- Drag pins into your own order and give them aliases.
- Move or copy files between folders inside the panel.
- Define named presets for a monorepo in a committed `.pinboard.json`, so a whole team can switch to the same set of folders in one click.
