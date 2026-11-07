import numpy as np
from PIL import Image, ImageDraw, ImageFilter
src=Image.open('/home/user/index.html/design-src/logo/white-form-reference.jpg').convert('L')
outer=[(418,240),(470,229),(520,228),(565,224),(620,230),(660,250),(700,268),(750,285),(780,295),(815,310),(832,335),(830,360),(810,372),(780,366),(760,376),(746,398),(746,415),(746,440),(746,462),(722,470),(705,478),(690,495),(686,515),(696,535),(720,550),(752,550),(780,536),(800,533),(822,540),(836,562),(830,595),(805,620),(770,635),(720,642),(670,636),(630,618),(600,595),(580,565),(565,530),(555,505),(540,492),(515,490),(495,491),(492,520),(491,580),(489,624),(479,638),(452,642),(428,638),(419,624),(418,500),(416,300),(416,250)]
hole=[(500,311),(550,310),(596,312),(588,335),(575,365),(562,392),(548,408),(520,410),(499,408),(497,360)]
def cr(pts,n=12):
    P=pts+pts[:3]; out=[]
    for i in range(len(pts)):
        p0,p1,p2,p3=[np.array(P[i+k],float) for k in range(4)]
        for t in np.linspace(0,1,n,endpoint=False):
            t2,t3=t*t,t*t*t
            out.append(tuple(0.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3)))
    return out
S=4; W,H=src.size
m=Image.new('L',(W*S,H*S),0); d=ImageDraw.Draw(m)
d.polygon([(x*S,y*S) for x,y in cr(outer)],fill=255)
d.polygon([(x*S,y*S) for x,y in cr(hole)],fill=0)
m=m.resize((W,H),Image.LANCZOS)
x0,y0,x1,y1=400,214,846,654
mask=np.asarray(m.crop((x0,y0,x1,y1))).astype(float)/255
L=np.asarray(src.crop((x0,y0,x1,y1))).astype(float)/255
# normalise glass luminance inside mask
v=L[mask>0.5]; lo,hi=np.percentile(v,2),np.percentile(v,98)
n=np.clip((L-lo)/(hi-lo),0,1)
h,w=n.shape
yy=np.arange(h)[:,None]+y0
split=468+3*np.sin(np.arange(w)[None,:]/18.0)
red=yy>split
def lerp(a,b,t): a=np.array(a)/255;b=np.array(b)/255; return a+(b-a)*t[...,None]
top=lerp((150,142,140),(255,255,255),n**0.8)
bot=lerp((40,6,8),(196,58,64),n**1.1)
rgb=np.where(red[...,None],bot,top)
from scipy import ndimage as nd
dist=nd.distance_transform_edt(mask>0.5)
rim=np.exp(-dist/2.6)[...,None]
rimcol=np.where(red[...,None],np.array([0.22,0.03,0.04]),np.array([0.52,0.47,0.46]))
rgb=rgb*(1-0.75*rim)+rimcol*0.75*rim
# thin bright meniscus line
edge=np.abs(yy-split)<1.2
rgb[edge]=rgb[edge]*0.4+0.6
out=np.dstack([rgb,mask]); out=(np.clip(out,0,1)*255).astype(np.uint8)
im=Image.fromarray(out,'RGBA')
im.save('rc-mark-full.png')
# square canvas
side=max(im.size)+20; sq=Image.new('RGBA',(side,side),(0,0,0,0)); sq.paste(im,((side-im.size[0])//2,(side-im.size[1])//2)); 
sq.resize((512,512),Image.LANCZOS).save('rc-mark-512.png')
sq.resize((128,128),Image.LANCZOS).save('rc-mark-128.png')
sq.resize((64,64),Image.LANCZOS).save('rc-mark-64.png')
bg=Image.new('RGBA',(900,560),(244,241,236,255))
bg.alpha_composite(sq.resize((512,512),Image.LANCZOS),(20,24))
bg.alpha_composite(sq.resize((128,128),Image.LANCZOS),(560,60))
bg.alpha_composite(sq.resize((64,64),Image.LANCZOS),(720,90))
bg.alpha_composite(sq.resize((32,32),Image.LANCZOS),(810,106))
bg.save('preview2.png')
