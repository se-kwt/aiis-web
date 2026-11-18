# Compose per-section crops into one sheet: SSA left, AIIS right, top-aligned at each section's own top, with a label bar.
import json, sys
from PIL import Image, ImageDraw
Image.MAX_IMAGE_PIXELS = None
d, width, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
b = json.load(open(f'{d}/boxes.json'))
def stitch(d, who, s):
    m = json.load(open(f'{d}/{who}-{s}.json'))
    im = Image.new('RGB', (m['width'], m['height']), (255, 255, 255))
    for sl in m['slices']:
        im.paste(Image.open(f"{d}/{sl['file']}").convert('RGB'), (0, sl['offset']))
    im.save(f'{d}/{who}-{s}.png')  # the stitched section (also used for review)
    return im
rows = []
for s in b['sections']:
    l = stitch(d, 'ssa', s); r = stitch(d, 'aiis', s)
    rows.append((s, l, r))
GAP, BAR = 10, 26
H = sum(BAR + max(l.height, r.height) + GAP for _, l, r in rows)
sheet = Image.new('RGB', (width * 2 + GAP, H), (120, 120, 120))
dr = ImageDraw.Draw(sheet); y = 0
for s, l, r in rows:
    dr.rectangle([0, y, sheet.width, y + BAR - 4], fill=(30, 30, 30))
    dr.text((8, y + 6), f'{s}   (left: Shady Side {l.width}x{l.height}   right: AIIS {r.width}x{r.height})', fill=(255, 255, 255))
    y += BAR
    sheet.paste(l, (0, y)); sheet.paste(r, (width + GAP, y))
    y += max(l.height, r.height) + GAP
sheet.save(out)
print('sheet', out, sheet.size)
