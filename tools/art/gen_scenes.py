import os
import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_common import *
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'img') + os.sep

def bloom(img, thresh, sigma, gain):
    l = img.max(axis=2, keepdims=True)
    hi = np.clip(img - thresh, 0, None) * (l > thresh)
    b = np.stack([gaussian_filter(hi[..., c], sigma) for c in range(3)], axis=2)
    return img + b * gain

def hash01(i):
    return (np.sin(i * 127.1 + 311.7) * 43758.5453) % 1.0

def grain(img, amt=6, seed=1):
    r = np.random.default_rng(seed); return img + r.normal(0, amt, img.shape[:2])[..., None]

# ---------------------------------------------------------------- hero
W, H = 1920, 1000
sky = storm_sky(W, H, 23, glow_y=0.82, bright=0.92)
sky = gaussian_filter(sky, (1.2, 1.2, 0))
save_webp(sky, OUT + 'hero-sky.webp', q=62)
far = forest_layer(1600, 520, 21, 15, 280, 440, 6, 7, (22, 7, 10), 1.2, 0.92)
save_webp(far, OUT + 'hero-trees-far.webp', q=62, alpha=True)
near = forest_layer(1600, 720, 33, 5, 540, 760, 25, 8, (4, 2, 3), 0.6, 1.0)
save_webp(near, OUT + 'hero-trees-near.webp', q=62, alpha=True)
for i, s in enumerate([5, 9, 14]):
    save_webp(lightning(1100, 900, s), OUT + f'bolt-{i+1}.webp', q=68, alpha=True)
save_webp(fog_tile(1600, 420, 77, 0.55), OUT + 'fog-a.webp', q=58, alpha=True)
save_webp(fog_tile(1600, 360, 78, 0.42, (96, 44, 50)), OUT + 'fog-b.webp', q=58, alpha=True)

# ---------------------------------------------------------------- scenes
SW, SH = 1400, 620
yy, xx = np.mgrid[0:SH, 0:SW].astype(float)

# 1. Synapse: roots / neural vines
def scene_roots():
    base = ramp(n01(fbm(SH, SW, 3.2, 41)) * 0.5, [(0, (4, 2, 3)), (1, (46, 9, 14))])
    base *= vignette(SH, SW, 1.4, 0.7)[..., None]
    rng = np.random.default_rng(7); ss = 2
    m = Image.new('L', (SW * ss, SH * ss), 0); d = ImageDraw.Draw(m)
    tips = []
    origins = [(0.02, 1.02, -0.5), (0.18, 1.04, -1.3), (0.5, 1.05, -1.6), (0.82, 1.04, -1.9), (1.02, 0.9, -2.7), (0.98, 0.2, 2.5), (0.0, 0.1, 0.5)]
    for ox, oy, a in origins:
        draw_tree(d, ox * SW * ss, oy * SH * ss, a, 190 * ss, 5 * ss, 8, rng, bend=0.22, spread=1.1)
    core = np.asarray(m.resize((SW, SH), Image.LANCZOS)).astype(float) / 255
    g = np.clip(gaussian_filter(core, 1.5) * 1.3 + gaussian_filter(core, 7) * 2.2 + gaussian_filter(core, 24) * 2.0, 0, 1)
    img = base + g[..., None] * np.array([205, 40, 44]) * 0.85 + core[..., None] * np.array([255, 170, 160]) * 0.55
    # synapse nodes
    nodes = np.zeros((SH, SW))
    ys, xs = np.nonzero(core > 0.9)
    for k in rng.choice(len(xs), 70, replace=False): nodes[ys[k], xs[k]] = 1
    nodes = gaussian_filter(nodes, 3) * 60
    img += np.clip(nodes, 0, 1)[..., None] * np.array([255, 190, 180]) * 0.8
    return grain(img, 5, 2)

# 2. Iron Wallet: abandoned lab corridor
def scene_lab():
    cx, cy = SW * 0.5, SH * 0.47
    X = (xx - cx) / (SW * 0.5); Y = (yy - cy) / (SH * 0.5) * 0.85
    ax, ay = np.abs(X), np.abs(Y) * 1.55
    wall = ax > ay
    z = np.where(wall, 1 / (ax + 1e-3), 1 / (ay + 1e-3))
    lat = np.where(wall, Y * z, X * z)
    ceil = (Y < 0) & ~wall; floor = (Y >= 0) & ~wall
    col = np.zeros((SH, SW, 3))
    tile = (np.abs((z * 1.4) % 1 - 0.5) > 0.47) | (np.abs((lat * 1.3) % 1 - 0.5) > 0.48)
    base_floor = np.array([26, 22, 22]); base_wall = np.array([34, 30, 29]); base_ceil = np.array([30, 28, 28])
    col[floor] = base_floor; col[wall] = base_wall; col[ceil] = base_ceil
    col[tile & ~wall] *= 0.55
    wp = (np.abs((z * 0.9) % 1 - 0.5) > 0.465) & wall; col[wp] *= 0.5
    # ceiling lights: flickering panels
    idx = np.floor(z * 0.8); on = hash01(idx) > 0.4
    panel = ceil & (np.abs(lat) < 0.38) & (((z * 0.8) % 1) < 0.42)
    light = np.zeros((SH, SW, 3)); light[panel & on] = np.array([215, 222, 214]) * 1.1
    light[panel & ~on] = np.array([30, 30, 30])
    col += light
    # emergency red wall lamps
    widx = np.floor(z * 0.45); red = wall & (z > 2.6) & (hash01(widx + 3) > 0.55) & (np.abs((z * 0.45) % 1 - 0.5) < 0.05) & (np.abs(lat + 0.15) < 0.12)
    col[red] = np.array([255, 70, 60])
    # fog toward distance, red-tinted
    f = np.exp(-z * 0.16); fogc = np.array([60, 14, 20])
    col = col * f[..., None] + fogc * (1 - f[..., None]) * 0.75
    # far doorway glow
    rr = np.sqrt(((xx - cx) / (SW * 0.09)) ** 2 + ((yy - cy) / (SH * 0.13)) ** 2)
    col += np.exp(-rr ** 2)[..., None] * np.array([255, 80, 66]) * 0.9
    col = bloom(col, 120, 14, 1.3)
    col *= vignette(SH, SW, 1.3, 0.8)[..., None]
    return grain(col, 5, 3)

# 3. PrepHire: Christmas lights against old wallpaper
def scene_lights():
    wp = 10 + 4 * np.sin(xx / 7.0) + 6 * n01(fbm(SH, SW, 3.0, 12))
    img = np.stack([wp * 1.25, wp * 0.8, wp * 0.78], axis=2)
    colors = [(215, 44, 44), (230, 150, 62), (242, 226, 200), (70, 150, 150), (170, 30, 40)]
    rng = np.random.default_rng(5)
    layer = np.zeros((SH, SW, 3)); wire = Image.new('L', (SW, SH), 0); wd = ImageDraw.Draw(wire)
    for r_i, (y0, sag, n) in enumerate([(130, 85, 17), (300, 110, 14), (470, 80, 18)]):
        pts = [(x, y0 + sag * (1 - ((x - SW / 2) / (SW / 2)) ** 2) * 0.55 + (x - SW / 2) * 0.03 * (r_i - 1)) for x in np.linspace(-20, SW + 20, 220)]
        wd.line(pts, fill=255, width=2)
        for k in range(n):
            t = (k + 0.5) / n; x = -20 + t * (SW + 40); y = np.interp(x, [p[0] for p in pts], [p[1] for p in pts]) + 12
            c = np.array(colors[int(rng.integers(len(colors)))], float)
            rad = 6; big = rng.random() < 0.35
            blur = rng.choice([0, 0, 1])
            tmp = np.zeros((SH, SW)); tmp[int(y), int(x)] = 1
            if big:
                disc = gaussian_filter(tmp, 22) * 2400
                disc = np.clip(disc, 0, 1) ** 2.2
                layer += disc[..., None] * c * 0.55
            core = gaussian_filter(tmp, 4.5) * 160
            halo = gaussian_filter(tmp, 28) * 2600
            layer += np.clip(core, 0, 1)[..., None] * c * 1.1 + np.clip(halo, 0, 1)[..., None] * c * 0.32
    w = np.asarray(wire).astype(float) / 255
    img += w[..., None] * np.array([18, 12, 12]) * 1.5
    img += layer
    img *= vignette(SH, SW, 1.3, 0.75)[..., None]
    return grain(img, 5, 4)

# 4. CyberFury: flashlight beam through the forest
def scene_beam():
    sk = storm_sky(SW, SH, 61, glow_y=0.85, bright=0.5)
    tr = forest_layer(SW, SH, 71, 11, 360, 620, 11, 7, (8, 4, 6), 0.9, 1.0)
    fg = fog_tile(SW, SH, 91, 0.5, (90, 40, 46))
    img = sk.copy()
    for layer in (tr, fg):
        a = layer[..., 3:4] / 255; img = img * (1 - a) + layer[..., :3] * a
    # flashlight cone from lower-left
    ox, oy = SW * 0.10, SH * 0.88; ang = -0.42; spread = 0.20
    vx, vy = xx - ox, yy - oy; dist = np.hypot(vx, vy) + 1e-3
    th = np.arctan2(vy, vx); dth = np.abs(((th - ang + np.pi) % (2 * np.pi)) - np.pi)
    cone = smooth(1 - dth / spread, 0, 0.7) * np.exp(-dist / 820)
    cone = gaussian_filter(cone, 6)
    img += cone[..., None] * np.array([235, 215, 195]) * 0.62
    spot = np.exp(-(dist / 26) ** 2)
    img += spot[..., None] * np.array([255, 240, 225]) * 1.2
    img = bloom(img, 150, 18, 0.9)
    img *= vignette(SH, SW, 1.3, 0.7)[..., None]
    return grain(img, 5, 5)

# 5. Phoenix: ember storm
def scene_embers():
    sk = storm_sky(SW, SH, 23, glow_y=0.9, bright=1.0)
    bolt = lightning(1100, 900, 9)
    bolt = np.asarray(Image.fromarray(bolt.astype(np.uint8), 'RGBA').resize((int(1100 * SH / 900 * 1.0), SH)))
    img = sk.copy(); bw = bolt.shape[1]; x0 = int(SW * 0.52 - bw / 2)
    a = bolt[..., 3:4] / 255.0
    sub = img[:, max(0, x0):x0 + bw]; ba = a[:, max(0, -x0):max(0, -x0) + sub.shape[1]]; bc = bolt[:, max(0, -x0):max(0, -x0) + sub.shape[1], :3]
    img[:, max(0, x0):x0 + bw] = sub + ba * bc * 0.9
    rng = np.random.default_rng(13); em = np.zeros((SH, SW, 3)); sm = np.zeros((SH, SW))
    for _ in range(180):
        x = rng.uniform(0, SW); y = SH * (1 - rng.beta(1.2, 2.4)); r = rng.uniform(0.8, 2.2)
        c = np.array([255, rng.uniform(70, 150), rng.uniform(30, 60)]); L = int(rng.uniform(4, 22))
        for t in range(L):
            yy_i = int(y + t * 1.3); xx_i = int(x + np.sin(t * 0.3 + x) * 1.5)
            if 0 <= yy_i < SH and 0 <= xx_i < SW: sm[yy_i, xx_i] = max(sm[yy_i, xx_i], 1 - t / L)
        em[int(min(y, SH - 1)), int(x)] = c
    glow = np.stack([gaussian_filter(em[..., c], 2.0) for c in range(3)], axis=2) * 22
    streak = gaussian_filter(sm, 0.9)[..., None] * np.array([255, 110, 50]) * 0.9
    img += np.clip(glow, 0, 255) + streak
    tr = forest_layer(SW, 330, 83, 7, 240, 330, 20, 7, (3, 2, 3), 0.7, 1.0)
    a = tr[..., 3:4] / 255; img[SH - 330:] = img[SH - 330:] * (1 - a) + tr[..., :3] * a
    img = bloom(img, 160, 16, 0.8)
    img *= vignette(SH, SW, 1.3, 0.7)[..., None]
    return grain(img, 5, 6)

for name, fn in [('scene-synapse', scene_roots), ('scene-ironwallet', scene_lab), ('scene-prephire', scene_lights), ('scene-cyberfury', scene_beam), ('scene-phoenix', scene_embers)]:
    arr = fn(); save_webp(arr, OUT + name + '.webp', q=58)

# vines creeping from a corner (transparent) for section edges
def vines_edge():
    w, h, ss = 900, 720, 2; rng = np.random.default_rng(29)
    m = Image.new('L', (w * ss, h * ss), 0); d = ImageDraw.Draw(m)
    for ox, oy, a in [(1.02, -0.02, 2.2), (0.9, -0.03, 1.9), (1.03, 0.25, 2.8), (0.7, -0.03, 1.7)]:
        draw_tree(d, ox * w * ss, oy * h * ss, a, 230 * ss, 7 * ss, 8, rng, bend=0.2, spread=1.0)
    core = np.asarray(m.resize((w, h), Image.LANCZOS)).astype(float) / 255
    out = np.zeros((h, w, 4)); out[..., :3] = (84, 14, 22); out[..., 3] = np.clip(gaussian_filter(core, 0.7) * 255 * 0.85, 0, 255)
    return out
save_webp(vines_edge(), OUT + 'vines-edge.webp', q=62, alpha=True)
