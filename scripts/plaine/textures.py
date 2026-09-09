"""Deterministic procedural turf material, not a lit photograph.

Run with Blender's bundled Python (numpy). Output RGB PNGs use no light,
shadow, vignette, AO or normal signal in base colour. A shared edge field
is dihedrally symmetric; the interior stays asymmetric to reward rotation.
"""
from pathlib import Path
import json, math, struct, zlib
import numpy as np

SIZE = 1024
OUT = Path('public/assets/modeles')
REPORT = Path('assets/livraisons/terrain_plaine')
RNG = np.random.default_rng(842071)
Y, X = np.mgrid[:SIZE, :SIZE]
colour = np.empty((SIZE, SIZE, 3), dtype=np.float64)
colour[:] = [60, 96, 34]
pigment = RNG.normal(0, 1.3, (SIZE, SIZE))
for k, amplitude in [(7, 1.1), (19, 0.8), (43, 0.5)]:
    pigment += amplitude * np.sin(2 * math.pi * (X * k + Y * (k + 2)) / SIZE + RNG.random() * 6.28)
# Mowing changes blade orientation and pigment presentation very faintly.
pigment += 1.35 * np.sin(X / SIZE * math.pi * 12)
colour += pigment[:, :, None] * [0.8, 1, 0.35]
height = np.full((SIZE, SIZE), 0.0012)
rough = np.full((SIZE, SIZE), 0.9)

def paint(cx, cy, rx, ry, angle, rgb, raised, roughness, taper=False):
    """Ellipse/pointed grass blade with its own pigment and microheight."""
    r = int(math.ceil(max(rx, ry))) + 2
    x0, x1 = max(0, int(cx)-r), min(SIZE, int(cx)+r+1)
    y0, y1 = max(0, int(cy)-r), min(SIZE, int(cy)+r+1)
    if x0 >= x1 or y0 >= y1:
        return
    xx, yy = X[y0:y1, x0:x1] - cx, Y[y0:y1, x0:x1] - cy
    u = (xx * math.cos(angle) + yy * math.sin(angle)) / rx
    v = (-xx * math.sin(angle) + yy * math.cos(angle)) / ry
    radius = u*u + v*v
    if taper:
        radius = (u / np.clip(0.8 - 0.30*v, 0.35, 1.1))**2 + v*v
    alpha = np.clip((1-radius) * 3, 0, 1)
    target = colour[y0:y1, x0:x1]
    target[:] = target * (1-alpha[:, :, None]) + np.array(rgb) * alpha[:, :, None]
    h = height[y0:y1, x0:x1]
    h[:] = h * (1-alpha) + (raised + 0.00018*np.maximum(0, 1-radius)) * alpha
    rmap = rough[y0:y1, x0:x1]
    rmap[:] = rmap * (1-alpha) + roughness * alpha

# Tiny worn patches, each broken into irregular overlapping earth flecks.
for _ in range(26):
    cx, cy = RNG.uniform(24, SIZE-24, 2)
    for _ in range(9):
        px, py = RNG.normal(0, 4, 2)
        paint(cx+px, cy+py, RNG.uniform(2, 6), RNG.uniform(2, 5), RNG.uniform(0, 6.28),
              [106+RNG.uniform(-5, 5), 86+RNG.uniform(-4, 4), 53], 0.0004, 0.96)

# Individual short grass blades, millimetres in scale. No painted highlights.
for _ in range(46000):
    cx, cy = RNG.uniform(0, SIZE, 2)
    band = math.sin(cx / SIZE * math.pi * 12)
    angle = RNG.normal(0.25 if band > 0 else -0.25, 1.4)
    tint = RNG.uniform(-22, 25)
    paint(cx, cy, RNG.uniform(0.9, 2.2), RNG.uniform(3.5, 9), angle,
          [73+tint*0.8, 116+tint, 39+tint*0.4], RNG.uniform(0.0010, 0.0032), RNG.uniform(0.79, 0.94), True)

# Scattered small clover leaves, never a large repeated plant silhouette.
for _ in range(165):
    cx, cy = RNG.uniform(12, SIZE-12, 2)
    phase = RNG.uniform(0, 6.28)
    for j in range(3):
        a = phase + j*math.tau/3
        paint(cx+2.4*math.cos(a), cy+2.4*math.sin(a), 2.3, 1.9, a,
              [65, 108+RNG.uniform(0, 12), 45], 0.0020, 0.77)
        # Fine pale leaf marking is pigment, not illumination.
        paint(cx+2.4*math.cos(a), cy+2.4*math.sin(a), 0.45, 1.3, a,
              [99, 136, 64], 0.00205, 0.77)

for _ in range(31):
    cx, cy = RNG.uniform(14, SIZE-14, 2)
    for j in range(7):
        a = j*math.tau/7
        paint(cx+1.3*math.cos(a), cy+1.3*math.sin(a), 0.65, 1.4, a,
              [218, 185+RNG.uniform(-6, 6), 39], 0.0024, 0.81)
    paint(cx, cy, 0.8, 0.8, 0, [192, 149, 23], 0.0025, 0.85)

def edge_compatible(field):
    """All four edges and their reversals share exactly the same samples.

    Canonical D4 coordinates preserve crisp detail instead of averaging eight
    differently oriented images. Only the 48px collar uses that symmetry.
    The first two rows/columns form a zero-normal-derivative boundary.
    """
    d = np.minimum.reduce([X, Y, SIZE-1-X, SIZE-1-Y]).astype(float)
    ax, ay = np.abs(X-(SIZE-1)/2), np.abs(Y-(SIZE-1)/2)
    sx = np.minimum(ax, ay)+(SIZE-1)/2
    sy = np.maximum(ax, ay)+(SIZE-1)/2
    sx = np.minimum(sx, SIZE-3).astype(int)
    sy = np.minimum(sy, SIZE-3).astype(int)
    border = field[sy, sx]
    t = np.clip((d-2)/46, 0, 1)
    w = t*t*(3-2*t)
    if field.ndim == 3:
        w = w[:, :, None]
    return border*(1-w)+field*w

colour = edge_compatible(colour)
height = edge_compatible(height)
rough = edge_compatible(rough)
# Millimetric blade detail only. No six-centimetre world terrain relief is baked.
spacing = 1/(SIZE-1)
dx = (np.roll(height,-1,axis=1)-np.roll(height,1,axis=1))/(2*spacing)
dy = (np.roll(height,-1,axis=0)-np.roll(height,1,axis=0))/(2*spacing)
normal = np.stack([-dx, dy, np.ones_like(dx)], axis=2)
normal /= np.linalg.norm(normal,axis=2)[:, :, None]
normal_png = np.rint(128+127*normal).clip(0,255).astype(np.uint8)
# Only local turf interstices contribute to the separate AO channel.
local = sum(np.roll(height,s,axis=a) for a in [0,1] for s in [-2,2])/4
ao = np.clip(1-np.maximum(0,local-height)*24, 0.94, 1)

def rgb8(a):
    if a.ndim == 2:
        a=np.repeat(a[:, :, None],3,axis=2)
    return np.rint(a).clip(0,255).astype(np.uint8)

def write_png(path, pixels):
    h,w,_=pixels.shape
    def chunk(tag,data):
        return struct.pack('>I',len(data))+tag+data+struct.pack('>I',zlib.crc32(tag+data)&0xffffffff)
    raw=b''.join(b'\0'+row.tobytes() for row in pixels)
    path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))

# Average 2x2 blocks: D4 symmetry survives the AO downsample exactly.
ao512=ao.reshape(512,2,512,2).mean(axis=(1,3))
maps={'albedo':rgb8(colour),'normale':normal_png,'rugosite':rgb8(rough*255),'occlusion':rgb8(ao512*255)}
OUT.mkdir(parents=True,exist_ok=True)
REPORT.mkdir(parents=True,exist_ok=True)
for channel,pixels in maps.items():
    write_png(OUT/f'terrain_plaine_{channel}.png',pixels)

def edges(a): return [a[0], a[-1], a[:,0], a[:,-1]]
validation={}
for channel,a in maps.items():
    if channel=='normale': continue
    e=edges(a)
    worst=max(int(np.abs(e[0].astype(int)-v.astype(int)).max()) for v in e+[v[::-1] for v in e])
    assert worst==0,(channel,worst)
    validation[channel]={'all_edges_and_reversals_max_difference':worst,'resolution':list(a.shape[:2])}
# Rotated normal maps must rotate their tangent vectors, not just their pixels.
def rotated_normal(a,k):
    a=np.rot90(a,k).astype(float)
    nx=(a[:,:,0]-128)/127; ny=(a[:,:,1]-128)/127
    for _ in range(k): nx,ny=-ny,nx
    return np.stack([nx,ny,(a[:,:,2]-128)/127],axis=2)
worst=0
for a in range(4):
    for b in range(4):
        left,right=rotated_normal(normal_png,a),rotated_normal(normal_png,b)
        worst=max(worst,float(np.abs(left[:,-1]-right[:,0]).max()),float(np.abs(left[-1]-right[0]).max()))
assert worst<0.017, worst
validation['normale']={'rotated_edges_max_vector_difference':worst,'resolution':[1024,1024]}
validation['flat_surface']={'top_y_m':0.02,'bottom_y_m':0,'undulation_in_mesh':False,'macro_relief':'supplied by game terrain'}
(REPORT/'texture-validation.json').write_text(json.dumps(validation,indent=2)+'\n')
print(json.dumps(validation,indent=2))
