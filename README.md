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

## Structure (redesign)

```
index.html          markup + all content
css/styles.css      design system and layout
js/main.js          interactions and motion
js/vendor/          GSAP + ScrollTrigger (vendored, no CDN)
fonts/              Bricolage Grotesque (variable), JetBrains Mono
```

Static site, no build step. Open `index.html` through any static server (or GitHub Pages).
Motion is disabled under `prefers-reduced-motion`, and every section stays visible if JavaScript fails.
The certifications block is kept in `index.html` but hidden, as before; remove its `hidden` attribute to show it.
