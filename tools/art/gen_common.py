import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter, map_coordinates

def fbm(h, w, beta, seed):
    """Periodic power-law noise via FFT (tiles seamlessly)."""
    r = np.random.default_rng(seed)
    F = np.fft.rfft2(r.standard_normal((h, w)))
    fy = np.fft.fftfreq(h)[:, None]; fx = np.fft.rfftfreq(w)[None, :]
    f = np.sqrt(fx**2 + fy**2); f[0, 0] = 1
    F *= f ** (-beta / 2); F[0, 0] = 0
    n = np.fft.irfft2(F, s=(h, w))
    return (n - n.mean()) / n.std()

def n01(n, lo=1, hi=99):
    a, b = np.percentile(n, [lo, hi]); return np.clip((n - a) / (b - a), 0, 1)

def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def ramp(v, stops):
    """stops: list of (pos, (r,g,b)); v in 0..1 -> HxWx3 float"""
    v = np.clip(v, 0, 1); out = np.zeros(v.shape + (3,))
    pos = [s[0] for s in stops]
    for c in range(3):
        out[..., c] = np.interp(v, pos, [s[1][c] for s in stops])
    return out

def to_img(a): return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def vignette(h, w, power=1.6, strength=0.75):
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    return 1 - strength * np.clip(d / 1.35, 0, 1) ** power

def storm_sky(w, h, seed, glow_y=0.8, bright=1.0, left_dark=0.0, break_xy=(0.62, 0.42)):
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    mid = fbm(h, w, 3.1, seed); fine = fbm(h, w, 2.4, seed + 1); big = fbm(h, w, 3.8, seed + 2)
    wx = (xx + fbm(h, w, 3.4, seed + 3) * 110) % w; wy = np.clip(yy + fbm(h, w, 3.4, seed + 4) * 60, 0, h - 1)
    c = 0.42 * mid + 0.50 * fine + 0.10 * big
    c = map_coordinates(c, [wy, wx], order=1, mode='wrap')
    c = gaussian_filter(c, (1.8, 9), mode='wrap')
    c = n01(c, 2, 98)
    v = yy / h; bx, by = break_xy
    horizon = np.exp(-((v - glow_y) / 0.36) ** 2)
    brk = np.exp(-(((xx / w - bx) / 0.34) ** 2 + ((v - by) / 0.30) ** 2))
    G = np.clip(0.12 + 0.55 * horizon + 0.60 * brk, 0, 1) * bright          # light behind the clouds
    d = smooth(c, 0.40, 0.80) * 0.9                                           # cloud density
    rim = np.clip(smooth(c, 0.30, 0.48) - smooth(c, 0.52, 0.74), 0, 1)        # lit cloud edges
    img = ramp(G, [(0, (6, 2, 4)), (0.25, (40, 8, 14)), (0.55, (110, 20, 28)), (0.85, (190, 42, 42)), (1, (225, 72, 62))])
    img = img * (1 - 0.88 * d)[..., None] + ramp(np.clip(G * 1.25, 0, 1), [(0, (10, 3, 5)), (1, (210, 60, 54))]) * (rim * 0.5)[..., None]
    img *= vignette(h, w, 1.4, 0.72)[..., None]
    if left_dark: img *= (1 - left_dark * np.clip(1 - xx / (w * 0.7), 0, 1))[..., None]
    return img

def draw_tree(d, x, y, ang, length, width, depth, rng, bend=0.12, spread=0.85):
    if depth == 0 or length < 5: return
    steps = max(2, int(length / 9)); px, py = x, y
    for i in range(steps):
        ang += rng.normal(0, bend)
        nx = px + np.cos(ang) * length / steps; ny = py + np.sin(ang) * length / steps
        d.line([(px, py), (nx, ny)], fill=255, width=max(1, int(width * (1 - 0.45 * i / steps))))
        px, py = nx, ny
    for k in range(int(rng.choice([2, 2, 3]))):
        draw_tree(d, px, py, ang + rng.uniform(-spread, spread), length * rng.uniform(0.6, 0.8), width * 0.62, depth - 1, rng, bend, spread)
    # a couple of side twigs along the trunk
    if depth > 2 and rng.random() < 0.6:
        t = rng.uniform(0.35, 0.8); sx = x + (px - x) * t; sy = y + (py - y) * t
        draw_tree(d, sx, sy, ang + rng.choice([-1, 1]) * rng.uniform(0.6, 1.2), length * 0.5, width * 0.5, depth - 2, rng, bend, spread)

def forest_layer(w, h, seed, n, hmin, hmax, trunk, depth, color, blur, base_alpha=1.0, ss=2, fade_top=0):
    rng = np.random.default_rng(seed)
    m = Image.new('L', (w * ss, h * ss), 0); d = ImageDraw.Draw(m)
    xs = np.sort(rng.uniform(-0.03, 1.03, n)) * w
    for x in xs:
        H = rng.uniform(hmin, hmax); tw = trunk * rng.uniform(0.7, 1.3)
        draw_tree(d, x * ss, (h + 4) * ss, -np.pi / 2 + rng.normal(0, 0.08), H * ss * 0.42, tw * ss, depth, rng)
    m = m.resize((w, h), Image.LANCZOS)
    if blur: m = m.filter(ImageFilter.GaussianBlur(blur))
    a = np.asarray(m).astype(float) * base_alpha
    if fade_top:
        a = a * smooth(np.arange(h)[:, None] / fade_top, 0, 1)
    out = np.zeros((h, w, 4)); out[..., :3] = color; out[..., 3] = a
    return out

def bolt_points(rng, p0, p1, disp, iters):
    pts = [p0, p1]
    for _ in range(iters):
        new = [pts[0]]
        for a, b in zip(pts[:-1], pts[1:]):
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            dx, dy = b[0] - a[0], b[1] - a[1]; L = max(np.hypot(dx, dy), 1)
            off = rng.normal(0, disp)
            new += [(mx - dy / L * off, my + dx / L * off), b]
        pts = new; disp *= 0.55
    return pts

def lightning(w, h, seed, branches=5):
    rng = np.random.default_rng(seed); ss = 1
    mask = Image.new('L', (w, h), 0); d = ImageDraw.Draw(mask)
    sx = w * rng.uniform(0.35, 0.65); ex = sx + rng.uniform(-0.18, 0.18) * w; ey = h * rng.uniform(0.62, 0.8)
    main = bolt_points(rng, (sx, -10), (ex, ey), 70, 7)
    d.line(main, fill=255, width=3, joint='curve')
    for _ in range(branches):
        i = int(rng.uniform(0.1, 0.8) * len(main)); p = main[i]
        ang = np.pi / 2 + rng.uniform(-0.9, 0.9); L = rng.uniform(0.12, 0.3) * h
        q = (p[0] + np.cos(ang) * L, p[1] + np.sin(ang) * L)
        br = bolt_points(rng, p, q, 28, 6); d.line(br, fill=255, width=2, joint='curve')
        if rng.random() < 0.5:
            j = int(rng.uniform(.3, .8) * len(br)); p2 = br[j]; a2 = ang + rng.uniform(-.8, .8)
            q2 = (p2[0] + np.cos(a2) * L * .5, p2[1] + np.sin(a2) * L * .5)
            d.line(bolt_points(rng, p2, q2, 14, 5), fill=255, width=1)
    core = np.asarray(mask).astype(float) / 255
    g1 = gaussian_filter(core, 2.2); g2 = gaussian_filter(core, 9); g3 = gaussian_filter(core, 34)
    glow = np.clip(g1 * 1.6 + g2 * 2.2 + g3 * 3.2, 0, 1)
    out = np.zeros((h, w, 4))
    out[..., 0] = 255; out[..., 1] = 70 + 150 * np.clip(core, 0, 1); out[..., 2] = 70 + 150 * np.clip(core, 0, 1)
    out[..., 3] = np.clip(glow, 0, 1) * 255
    return out

def fog_tile(w, h, seed, strength=0.6, color=(110, 52, 58)):
    n = fbm(h, w, 3.3, seed); n = gaussian_filter(n, (5, 26), mode='wrap')
    a = smooth(n01(n), 0.2, 1.0) ** 1.5 * strength
    v = np.linspace(0, 1, h)[:, None]; a = a * smooth(v, 0, 0.3) * smooth(1 - v, 0, 0.4)
    out = np.zeros((h, w, 4)); out[..., :3] = color; out[..., 3] = a * 255
    return out

def save_webp(arr, path, q=70, alpha=False):
    im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA' if alpha else 'RGB')
    im.save(path, 'WEBP', quality=q, alpha_quality=45 if alpha else 80, method=6)
    import os; print(os.path.basename(path), im.size, os.path.getsize(path) // 1024, 'KB')
