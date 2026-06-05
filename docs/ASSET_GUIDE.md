# Asset Guide

This guide documents asset conventions for AI agents.
Do not modify binary, image, audio, video, or other media files unless the user explicitly instructs you to do so.

## Flarepaw Animation Frame Folders

Flarepaw animations must use individual transparent PNG frames grouped in folders.
Do not reintroduce sprite-sheet slicing.

Expected structure:

```text
assets/
  flarepaw/
    animations/
      idle/
        idle_000.png
        idle_001.png
      run/
        run_000.png
        run_001.png
      guard/
        guard_000.png
        guard_001.png
      flame_guard/
        flame_guard_000.png
        flame_guard_001.png
```

If the project uses a different asset root, preserve the same concept: one folder per animation and one transparent PNG per frame.

## Frame Naming Rules

- Use lowercase folder and file names.
- Use underscores between words.
- Use zero-padded frame numbers, such as `idle_000.png`, `idle_001.png`, and `idle_002.png`.
- Keep the animation folder name and frame prefix aligned.
- Do not rename existing frame folders unless explicitly instructed.
- Do not mix sprite sheets with individual frame folders.

## Transparency Requirement

- Animation frames must be transparent PNG files.
- Preserve alpha channels.
- Do not flatten animation frames onto solid backgrounds.
- Do not convert animation frames to lossy formats.

## Required Spellings

Use these spellings everywhere in paths, file names, code references, docs, and labels:

- `guard`, not `gaurd`
- `flame_guard`, not `flame_gaurd`

If a misspelled legacy path exists, do not create new misspelled paths.
Document the mismatch and ask for an explicit migration task before renaming assets or code references.

## Background Image Folder Naming Rules

- Use lowercase folder names.
- Use descriptive scene or biome names.
- Use underscores between words, such as `training_room`, `forest_arena`, or `moonlit_courtyard`.
- Group backgrounds by scene when multiple layers or variants exist.
- Keep parallax, foreground, midground, and background layers clearly named when present.
- Do not modify image/media files unless explicitly instructed.
