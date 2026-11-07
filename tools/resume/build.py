"""Render resume.html to ../../resume.pdf (A4). Needs: pip install playwright && playwright install chromium"""
from pathlib import Path
from playwright.sync_api import sync_playwright
here = Path(__file__).resolve().parent
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.goto((here / "resume.html").as_uri()); pg.wait_for_timeout(500)
    pg.pdf(path=str(here.parent.parent / "resume.pdf"), format="A4", print_background=True, prefer_css_page_size=True)
    b.close()
