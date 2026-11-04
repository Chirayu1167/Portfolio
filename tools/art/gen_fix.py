import os
import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_common import *
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'img') + os.sep
W, H = 1920, 1000
sky = storm_sky(W, H, 23, glow_y=0.82, bright=0.92); sky = gaussian_filter(sky, (1.2, 1.2, 0))
save_webp(sky, OUT + 'hero-sky.webp', q=62)
far = forest_layer(1600, 520, 21, 15, 280, 440, 6, 7, (22, 7, 10), 1.2, 0.92, fade_top=110)
save_webp(far, OUT + 'hero-trees-far.webp', q=62, alpha=True)
near = forest_layer(1600, 720, 33, 5, 540, 760, 25, 8, (4, 2, 3), 0.6, 1.0, fade_top=200)
save_webp(near, OUT + 'hero-trees-near.webp', q=62, alpha=True)
