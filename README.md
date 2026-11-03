# 🌐 Personal Portfolio Website

This is my personal portfolio website built using HTML and images to showcase my projects, skills, and journey in AI & Machine Learning.

The website is hosted online using GitHub Pages for fast and reliable access.

## 🛠 Built With
- HTML5  
- CSS3  
- GitHub Pages  

## ✨ Features
- Multiple pages for content organization  
- Responsive and clean design  
- Easy to update and maintain  

## 👤 Author
Chirayu Mahajan


---

## Structure

```
index.html        markup and all content
css/styles.css    design system, layout, atmosphere
js/main.js        interactions (no animation library)
fonts/            Barlow Condensed, IBM Plex Sans, IBM Plex Mono (self-hosted)
```

Static site, no build step: open `index.html` through any static server or GitHub Pages.

**Motion model.** CSS handles the visuals; `main.js` only toggles classes and drives three small canvases
(dust, signal, preview static). Content is hidden only while JS runs, is always revealed, and the hidden
state is removed afterwards. With `prefers-reduced-motion`, or with JS disabled, everything is visible immediately.

**Previews.** CyberFury and Phoenix use their real screenshots. The other three show a dim "No signal" static tile
(nothing is invented). To add a screenshot, replace the `<canvas class="static">` and `.preview__tag` inside that
project's `.preview` link with an `<img>`, as the CyberFury row does.

**Certifications** stay in `index.html` but hidden, as in the original. Remove the `hidden` attribute to show them.
