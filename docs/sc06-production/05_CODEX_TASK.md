# CODEX TASK — integrate SC06 «Лучшая подруга»

## Scope
This is a **new story scene**, not a replacement of `SC04A_CONFESSION`, `SC04B_PHONE`, `ENDING_B` or the Sora reveal addon. **Read existing project engine schemas and real IDs before editing.** Do not assume the provided JSON is directly importable: `data/SC06_content.json` is a **content contract**.

## Routing
1. Connect **both** reveal addon exit routes (from 4A in-person and 4B phone) to the single start `SC06_D01`, only after `sora_identity_known=true` is set on the earlier name-reveal dialogue.
2. Choices `KNOW` -> name reveal -> SC06; `LEAVE` -> unchanged Ending B. Never expose SC06 from LEAVE. The happy false ending A remains untouched.
3. No choices inside SC06. After SC06_D34 link to existing ending C if implemented; otherwise use guarded `ENDING_C_START` placeholder, clearly identified in report. **Do not jump to any unrelated story ID.**
4. Preserve autosave, back navigation, branch replay, scene order, teacher mode and difficulty toggle. If saved IDs need migration, provide a safe mapping and do not silently re-route existing completed runs.

## Dialogue
- Import exactly 34 steps from `03_DIALOGUE_READING.md` / `data/SC06_content.json` with original, simple, ru, speaker, teacher notes and vocabulary. They are **complete**, not samples.
- Keep line order, punctuation, emotional progression, and `-요` speech style. No invented extra confession, no villain cues.
- Simple only changes the current displayed line, not state or image; reset to original on every next/previous/reaction/teacher jump. Hide toggle for identical text.
- Teacher-mode may show translations, grammar, vocabulary. Avoid spoiler leaks in player view before the actual reveal in the prior scene; scene itself begins after reveal.

## Visuals
- Generate **seven standalone final 16:9 images** `SC06_SH01.webp` … `SC06_SH07.webp` according to `02_FULL_SHOT_CARDS.md`, with `04_VISUAL_BIBLE.md` and project-native SC02 faces (fallback references folder).
- Strong distinct camera changes with locked stage. Reuse each shot across its assigned dialogue steps and **never cycle earlier images**. Before creating SH05/SH06, compare Yuna's face carefully with SC02.
- If generating 7 coherent images is not possible, build the scene with clearly marked pending image placeholders and report what is missing. Do **not** crop storyboard sheets to simulate final images.

## QA
- 34 nodes in order; 7 unique images each displayed in order only once on a single playthrough.
- Character identity stable; no third woman, no Minsu; café set and outfits stable; 2 drinks not 3.
- Cold → guarded → anger → tears only SH06 → cold exit. No early sobbing in SH01 or early villain expression in SH02.
- Phrasing about guard and third cup correct; Sora's motive is limited to the stated confession.
- Both upstream routes connect to SC06; Ending B branch unchanged; scene ends at Ending C or explicit safe placeholder.
- Confirm screenshots in player desktop/mobile, no vertical scrolling necessary, text legible.

## Reporting
Provide actual IDs created, image filenames/dimensions, test results, and placeholders or schema adaptations. Report unresolved conflicts rather than rewriting story to hide them.
