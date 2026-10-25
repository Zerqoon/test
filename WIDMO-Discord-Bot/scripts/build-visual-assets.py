from PIL import Image, ImageDraw, ImageFilter, ImageChops
import numpy as np, random, math, os, sys
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
assets=os.path.join(ROOT,'assets')
os.makedirs(assets, exist_ok=True)
src_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(assets, 'widmo-logo-source.png')
if not os.path.exists(src_path):
    raise SystemExit(f'Brak źródłowego logo: {src_path}. Przekaż ścieżkę do obrazu jako pierwszy argument.')
src=Image.open(src_path).convert('RGB')
a=np.array(src)
# Flood-fill only bright pixels connected to the outside; the white ghost is enclosed by the dark emblem.
gray=a.mean(axis=2)
mask=gray>220
h,w=mask.shape
seen=np.zeros((h,w),dtype=bool)
from collections import deque
q=deque()
for x in range(w):
    if mask[0,x]: seen[0,x]=1;q.append((0,x))
    if mask[h-1,x] and not seen[h-1,x]: seen[h-1,x]=1;q.append((h-1,x))
for y in range(h):
    if mask[y,0] and not seen[y,0]: seen[y,0]=1;q.append((y,0))
    if mask[y,w-1] and not seen[y,w-1]: seen[y,w-1]=1;q.append((y,w-1))
while q:
    y,x=q.popleft()
    for ny,nx in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
        if 0<=ny<h and 0<=nx<w and mask[ny,nx] and not seen[ny,nx]:
            seen[ny,nx]=1; q.append((ny,nx))
# Determine visual bounds using all pixels far from white.
nonwhite=np.min(a,axis=2)<210
ys,xs=np.where(nonwhite)
x0,x1=max(0,xs.min()-32),min(w,xs.max()+33)
y0,y1=max(0,ys.min()-32),min(h,ys.max()+33)
# Transparent isolated mark; connected white background removed and enclosed ghost retained.
rgba=np.dstack([a, np.full((h,w),255,dtype=np.uint8)])
rgba[seen,3]=0
# Fade antialiasing at the edge of the outside background for a clean transparent edge.
# For any bright external pixel outside the flood mask boundary, alpha ramps down with brightness.
external=seen
# crop transparent emblem
mark=Image.fromarray(rgba.astype('uint8'),'RGBA').crop((x0,y0,x1,y1))
# Trim any fully transparent empty regions but keep breathing room.
bbox=mark.getbbox()
if bbox: mark=mark.crop(bbox)
# Keep the user's supplied emblem as the sole source of the logo asset.
# Square crop of user's exact logo with transparent outer background; place on a subtle white/silver disc for reliable visibility.
size=max(mark.width,mark.height)
pad=34
canvas=Image.new('RGBA',(size+pad*2,size+pad*2),(0,0,0,0))
# Slight white medallion with a black outline gives the original charcoal crown and white ghost contrast.
d=ImageDraw.Draw(canvas)
d.ellipse((pad-14,pad-14,pad+size+14,pad+size+14), fill=(245,245,245,255), outline=(255,255,255,255), width=5)
# add the trimmed transparent source centered at original proportions
canvas.alpha_composite(mark,(pad+(size-mark.width)//2,pad+(size-mark.height)//2))
# Tight crop to square, downsample high quality
canvas=canvas.resize((900,900),Image.Resampling.LANCZOS)
canvas.save(os.path.join(assets,'widmo-logo.png'))
canvas.save(os.path.join(assets,'widmo-mark.png'))
# Generate a dark atmospheric backing that puts the white ghost watermark behind the content.
W,H=1600,900
Y,X=np.mgrid[0:H,0:W]
# vignette + two broad pale pools for smoke
cx,cy=W*0.77,H*0.47
rad=np.sqrt(((X-cx)/(W*.62))**2+((Y-cy)/(H*.90))**2)
base=8+22*np.exp(-(rad**2)*2.1)+8*np.exp(-(((X-W*.12)/(W*.35))**2+((Y-H*.85)/(H*.60))**2)*2)
# soft smoky patches from low-frequency noise
rng=np.random.default_rng(21025)
noise_img=Image.fromarray(rng.integers(0,256,(90,160),dtype=np.uint8),'L').resize((W,H),Image.Resampling.BICUBIC).filter(ImageFilter.GaussianBlur(22))
noise=np.asarray(noise_img,dtype=float)/255.0
base=base+(noise-0.5)*12
v=np.clip(base,2,38)
arr=np.zeros((H,W,3),dtype=np.uint8)
arr[:,:,0]=np.clip(v*0.96,0,255).astype('uint8')
arr[:,:,1]=np.clip(v,0,255).astype('uint8')
arr[:,:,2]=np.clip(v*1.04,0,255).astype('uint8')
bg=Image.fromarray(arr,'RGB').convert('RGBA')
# Soft, low-contrast smoke trails; the Canvas renderer adds the blurred white ghost watermark
# separately so text stays readable and the mascot remains aligned across different card sizes.
smoke = Image.new('RGBA', (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(smoke)
for idx in range(7):
    points = []
    phase = idx * 0.83
    for t in np.linspace(0, 1, 220):
        x = W * (0.42 + 0.62 * t)
        y = H * (0.22 + idx * 0.085) + math.sin(t * 9.5 + phase) * (20 + idx * 3) + math.sin(t * 21 + phase) * 7
        points.append((int(x), int(y)))
    sd.line(points, fill=(205, 205, 210, 12 + (idx % 3) * 2), width=9 + (idx % 2) * 5)
smoke = smoke.filter(ImageFilter.GaussianBlur(28))
bg.alpha_composite(smoke)
# add elegant orbit rings and tiny stars
fx=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(fx)
d.ellipse((W*.53,H*.07,W*.96,H*.94),outline=(240,240,240,22),width=2)
d.ellipse((W*.57,H*.13,W*.92,H*.88),outline=(240,240,240,13),width=1)
for x,y,r,alpha_v in [(135,128,2,170),(370,720,2,105),(1420,145,2,110),(1280,760,3,85),(1000,108,2,100),(151,500,1,120),(1115,675,2,90),(940,800,1,90),(1460,520,1,125)]:
    d.ellipse((x-r,y-r,x+r,y+r),fill=(245,245,245,alpha_v))
    d.line((x-r*3,y,x+r*3,y), fill=(245,245,245,alpha_v//3),width=1)
    d.line((x,y-r*3,x,y+r*3), fill=(245,245,245,alpha_v//3),width=1)
bg.alpha_composite(fx)
bg.convert('RGB').save(os.path.join(assets,'background.png'),quality=95)
print('source',src.size,'bbox',(x0,y0,x1,y1),'mark',mark.size,'avatar',canvas.size,'background',(W,H))
