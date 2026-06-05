"""Remove the grey backdrop from hut.png and crop tightly to the hat."""

from pathlib import Path
from PIL import Image

SRC = Path("/Users/jkahlberg/Documents/Dev/hatpicker/hut.png")
DST_DIR = Path(__file__).parent / "assets"
DST_DIR.mkdir(exist_ok=True)
DST = DST_DIR / "hat.png"

img = Image.open(SRC).convert("RGBA")
w, h = img.size
pixels = img.load()

# Sample the four corners to get the background color range
corner_pts = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
samples = [pixels[x, y][:3] for x, y in corner_pts]

# Flood-fill style: BFS from the corners, marking pixels as background while
# their colour stays close to the seed colour.
from collections import deque

visited = [[False] * h for _ in range(w)]
queue = deque()
for x, y in corner_pts:
    queue.append((x, y))
    visited[x][y] = True

TOL_HARD = 55   # hard background — fully transparent
TOL_SOFT = 80   # soft edge — partial transparency
seed_avg = tuple(sum(c[i] for c in samples) // len(samples) for i in range(3))

def col_dist(a, b):
    return max(abs(a[0] - b[0]), abs(a[1] - b[1]), abs(a[2] - b[2]))

bg_mask = [[0] * h for _ in range(w)]  # 0=keep, 255=fully bg, 1-254=soft edge

while queue:
    x, y = queue.popleft()
    r, g, b, a = pixels[x, y]
    d = col_dist((r, g, b), seed_avg)
    if d > TOL_SOFT:
        continue
    if d <= TOL_HARD:
        bg_mask[x][y] = 255
    else:
        # soft fade between TOL_HARD and TOL_SOFT
        frac = (d - TOL_HARD) / (TOL_SOFT - TOL_HARD)
        bg_mask[x][y] = int(255 * (1 - frac))
    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < w and 0 <= ny < h and not visited[nx][ny]:
            visited[nx][ny] = True
            queue.append((nx, ny))

# Apply the mask to alpha
for x in range(w):
    for y in range(h):
        if bg_mask[x][y] > 0:
            r, g, b, a = pixels[x, y]
            new_a = max(0, a - bg_mask[x][y])
            pixels[x, y] = (r, g, b, new_a)

# Tight crop around remaining pixels
bbox = img.getbbox()
if bbox:
    img = img.crop(bbox)

img.save(DST, "PNG", optimize=True)
print(f"saved {DST} ({img.size[0]}x{img.size[1]})")
