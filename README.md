# Chirayu Mahajan — Portfolio

AI & ML portfolio. Static site (HTML, CSS, a little JS), hosted on GitHub Pages. No build step.

## Structure

```
index.html            all content (About Me, Projects, Experience, Achievements, Contact)
css/styles.css        design tokens at the top (:root), then layout
js/main.js            mobile menu, active menu link, hero detection score
img/preview-*.webp    project screenshots
fonts/                Bricolage Grotesque, IBM Plex Sans, JetBrains Mono (self-hosted)
resume.pdf            one-page resume, linked from About Me
tools/resume/         resume.html + build.py to regenerate resume.pdf
```

## Editing

- **Add a project:** copy an `<article class="card">` block in `index.html`.
- **Certifications:** the second `<ul class="part" hidden>` under Achievements. Remove `hidden` to show it.
- **Resume:** edit `tools/resume/resume.html`, then run `python tools/resume/build.py`
  (`pip install playwright && playwright install chromium`).
- **Colors:** change the variables in `:root` in `css/styles.css`.
