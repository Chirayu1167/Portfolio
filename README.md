# Chirayu Mahajan — Portfolio

AI & ML portfolio built as one continuous scroll through an ML system. Static site (HTML, CSS, vanilla JS),
hosted on GitHub Pages. No build step, no dependencies.

## How the scroll works

A single fixed `<canvas id="system">` holds one persistent set of nodes that morph between six scenes.
Each section is a stage of the pipeline:

| Section | Scene (canvas) | DOM layer |
|---|---|---|
| Hero | Neural network initialises; activation front sweeps right | Name decodes as the front passes, lede streams like LLM tokens |
| About Me | Raw data → pipeline → clustered embeddings | Scroll-scrubbed "scan" reveals; portrait detection locks on |
| Projects | Patch-grid feature map with a roving ROI | Pinned inference viewfinder: one project per scroll step, wipe transitions, bounding boxes + confidence lock on, hover/tap to inspect |
| Experience | Agents + memory graph that grows as you scroll | SVG synapse path draws itself; a pulse travels it and fires each role |
| Achievements | Gradient descent spiralling into a loss-surface minimum | Training curve draws with scroll; each result is a checkpoint |
| Contact | Lights go out; nodes settle into a "CM" monogram | Bus lines open channels to each link, status types out |

Everything is a pure function of scroll position and time, so scrolling up reverses it exactly.

## Files

```
index.html            all content
css/styles.css        paper/ink/ember/forest theme + layouts (grid fallback and pinned mode)
js/system.js          canvas engine: scenes, morphing, edges, pulses
js/main.js            scroll model, hero decode, pinned projects, experience path, curve, contact, nav
img/, *.png           project screenshots
resume.pdf            one-page resume (source: tools/resume)
```

## Performance and accessibility

- ~0.3 ms per canvas frame; node budget 140 desktop / 80 mobile; DPR capped at 2 / 1.75.
- Animation stops when the tab is hidden; listeners are removed on `pagehide`.
- `prefers-reduced-motion`: no canvas, no pinning, no scrubbing. Plain readable layout with all content.
- If a phone is too short for the pinned Projects stage, it falls back to the normal card grid automatically.
- Hero name, lede and decorative layers are `aria-hidden` with real text exposed to screen readers.

## Editing

- **Add a project:** copy an `<article class="proj">` block; set `data-i`. Detection boxes are the `.bb` spans
  (`--x/--y/--w/--h` are % of the screenshot).
- **Certifications:** the `<ul class="certs" hidden>` under Achievements. Remove `hidden` to show it.
- **Colors:** `:root` in `css/styles.css`; canvas colors are the constants at the top of `js/system.js`.
- **Resume:** edit `tools/resume/resume.html`, then `python tools/resume/build.py`.
