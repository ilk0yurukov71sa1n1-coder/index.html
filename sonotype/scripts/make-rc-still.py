# Composes ilko's glass RC photo onto a 16:9 canvas for the scroll-driven studio hero.
# usage: python3 make-rc-still.py <photo.png> <out-2x.webp> <out-1x.webp>
import subprocess, sys, math
from PIL import Image, ImageFilter, ImageDraw
src = Image.open(sys.argv[1]).convert('RGB')
W, H = 1600, 900
S = 2  # supersample base
# background: blurred stretch of the photo
bg = src.resize((W*S, W*S)).filter(ImageFilter.GaussianBlur(60*S)).crop((0, (W*S-H*S)//2, W*S, (W*S+H*S)//2))
fg = src.resize((H*S, H*S), Image.LANCZOS)
mask = Image.new('L', fg.size, 0)
d = ImageDraw.Draw(mask); pad = 140*S
d.ellipse((pad, pad - 40*S, fg.size[0]-pad, fg.size[1]-pad + 40*S), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(110*S))
ox = (W*S - H*S)//2
bg.paste(fg, (ox, 0), mask)
base = bg
# logo centre from red pixels
px = src.load(); xs=ys=n=0
for y in range(0,1024,2):
    for x in range(0,1024,2):
        r,g,b = px[x,y]
        if r>100 and r>g*1.6 and r>b*1.6: xs+=x; ys+=y; n+=1
cx = ox + xs/n*H*S/1024; cy = ys/n*H*S/1024
print('logo centre', cx/S, cy/S, file=sys.stderr)
edge = base.resize((1,1), Image.BOX).getpixel((0,0)); print('avg', edge, file=sys.stderr)
for x in (0, W*S-1):
    print('edge px', base.getpixel((x, H*S//2)), file=sys.stderr)

base.save(sys.argv[2], 'WEBP', quality=86)
base.resize((W, H), Image.LANCZOS).save(sys.argv[3], 'WEBP', quality=84)
