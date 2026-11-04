import os
import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_common import *
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'img') + os.sep
W, H = 1920, 1000
sky = np.asarray(Image.open(OUT + 'hero-sky.webp').convert('RGB')).astype(float) * 0.8
yy, xx = np.mgrid[0:H, 0:W].astype(float); u = xx / W; v = yy / H
# red light behind the clouds (was a live CSS layer)
g1 = np.exp(-(((u - 0.64) / 0.30) ** 2 + ((v - 0.46) / 0.34) ** 2)) * 0.34
g2 = np.exp(-(((u - 0.5) / 0.55) ** 2 + ((v - 1.0) / 0.22) ** 2)) * 0.5
img = sky + g1[..., None] * np.array([198, 40, 40]) + g2[..., None] * np.array([94, 17, 24])
# far dead trees, bottom aligned
far = Image.open(OUT + 'hero-trees-far.webp').convert('RGBA').resize((W, int(520 * W / 1600)), Image.LANCZOS)
fa = np.asarray(far).astype(float); fh = fa.shape[0]
a = fa[..., 3:4] / 255.0
img[H - fh:] = img[H - fh:] * (1 - a) + fa[..., :3] * a
# legibility shade (left), nav shade (top), horizon fade (bottom)
def lerp_stops(x, stops):
    return np.interp(x, [s[0] for s in stops], [s[1] for s in stops])
sh = lerp_stops(u, [(0, 0.93), (0.36, 0.74), (0.70, 0.30), (1.0, 0.08)])
top = np.clip(1 - v / 0.24, 0, 1) * 0.85
bot = np.clip((v - 0.74) / 0.26, 0, 1)
alpha = 1 - (1 - sh) * (1 - top) * (1 - bot)
img = img * (1 - alpha[..., None]) + np.array([8, 8, 8]) * alpha[..., None]
img = img + np.random.default_rng(9).normal(0, 3, img.shape[:2])[..., None]
save_webp(img, OUT + 'hero-back.webp', q=66)
