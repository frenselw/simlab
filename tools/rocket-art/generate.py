"""Bake the rocket's illustrative Earth from pinned public-domain geography.
Run: python tools/rocket-art/generate.py (Pillow, NumPy and SciPy; offline only).
"""
from pathlib import Path
import hashlib, json, math, struct, zipfile, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import distance_transform_edt, map_coordinates, gaussian_filter

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).parent / 'sources'
OUT = ROOT / 'sim/rocket-space-mission-lab/assets'
R, EXTENT, LAT, LON = 6371000., 120000., .605629, -2.101376
SEED = 731
UP = np.array([math.cos(LAT)*math.cos(LON), math.sin(LAT), math.cos(LAT)*math.sin(LON)])
EAST = np.array([-math.sin(LON), 0., math.cos(LON)])
NORTH = np.array([-math.sin(LAT)*math.cos(LON), math.cos(LAT), -math.sin(LAT)*math.sin(LON)])
RIDGES = [dict(x=3200+i%3*1600+math.sin(i*.8)*600,z=-14000+i//3*2400,h=450+i%5*170,r=900+i%4*180) for i in range(36)]


def load_shapes(name):
    """The pinned source uses only standard Polygon / PolyLine records."""
    with zipfile.ZipFile(SOURCE / (name+'.zip')) as archive:
        data = archive.read(name+'.shp')
    offset, shapes = 100, []
    while offset < len(data):
        length = struct.unpack_from('>i', data, offset+4)[0]*2
        record = data[offset+8:offset+8+length]
        offset += 8+length
        kind = struct.unpack_from('<i', record)[0]
        if kind == 0:
            continue
        assert kind in (3, 5), (name, kind)
        count, points = struct.unpack_from('<ii', record, 36)
        parts = list(struct.unpack_from('<'+str(count)+'i', record, 44))+[points]
        xy = np.frombuffer(record, '<f8', points*2, 44+count*4).reshape(-1, 2).copy()
        shapes.append([xy[a:b] for a,b in zip(parts, parts[1:])])
    assert offset == len(data)
    return shapes


def refine_coasts(shapes):
    # The same bounded decorative coves are baked at both resolutions.
    for shape in shapes:
        for k, ring in enumerate(shape):
            points = []
            for i in range(len(ring)-1):
                a,b = ring[i],ring[i+1]
                if -122 < a[0] < -119 and 33.4 < a[1] < 36.1 and -122 < b[0] < -119 and 33.4 < b[1] < 36.1:
                    prev,nxt = ring[i-1],ring[(i+2)%(len(ring)-1)]
                    delta = b-a
                    length = np.linalg.norm(delta)
                    normal = np.array([-delta[1],delta[0]])/max(length,1e-9)
                    count = max(4, int(length/.004))
                    for t in np.arange(count)/count:
                        q = .5*((2*a)+(-prev+b)*t+(2*prev-5*a+4*b-nxt)*t*t+(-prev+3*a-3*b+nxt)*t*t*t)
                        q += normal * min(.0035,length*.06)*math.sin(math.pi*t)**2*math.sin(t*math.pi*6+i*1.4)
                        points.append(q)
                else:
                    points.append(a)
            points.append(ring[-1])
            shape[k] = np.asarray(points)
    return shapes


def local_to_geo(x,z):
    y = np.sqrt(np.maximum(0, 1-(x/R)**2-(z/R)**2))
    v = EAST[:,None,None]*(x/R)+UP[:,None,None]*y+NORTH[:,None,None]*(z/R)
    return np.degrees(np.arctan2(v[2],v[0])),np.degrees(np.arcsin(v[1]))


def geo_to_local(points):
    lon,lat = np.radians(points).T
    v = np.array([np.cos(lat)*np.cos(lon),np.sin(lat),np.cos(lat)*np.sin(lon)]).T
    return np.column_stack((v@EAST*R,v@NORTH*R,v@UP))


def project(points,w,h,regional=False):
    if regional:
        q = geo_to_local(points)
        return np.column_stack(((q[:,0]+EXTENT)/(2*EXTENT)*w,(EXTENT-q[:,1])/(2*EXTENT)*h))
    return np.column_stack(((points[:,0]+180)/360*w,(90-points[:,1])/180*h))


def land_mask(land,lakes,w,h,regional=False):
    im = Image.new('L',(w,h)); draw = ImageDraw.Draw(im)
    for shapes,fill in [(land,255),(lakes,0)]:
        for shape in shapes:
            holes=[]
            for ring in shape:
                if regional and not np.any((ring[:,0]>-123)&(ring[:,0]<-118)&(ring[:,1]>32)&(ring[:,1]<38)):
                    continue
                area=np.sum(ring[:-1,0]*ring[1:,1]-ring[1:,0]*ring[:-1,1])
                pts=[tuple(p) for p in project(ring,w,h,regional)]
                if area>0:
                    holes.append(pts)
                else:
                    draw.polygon(pts,fill=fill)
            for pts in holes:
                draw.polygon(pts,fill=255-fill)
    return np.asarray(im)>127


NOISE = {}
def noise(lon,lat,frequency):
    if frequency not in NOISE:
        rng=np.random.default_rng(SEED+frequency)
        NOISE[frequency]=gaussian_filter(rng.random((frequency//2,frequency)).astype(np.float32),.55,mode='wrap')
    return (map_coordinates(NOISE[frequency],[(90-lat)/180*(frequency//2),(lon+180)/360*frequency],order=1,mode='grid-wrap')-.5)*2.6


def tint(image,color,weight):
    return image*(1-weight[...,None])+np.array(color,dtype=np.float32)*weight[...,None]


def terrain(lon,lat,mask,km_per_pixel):
    n=noise(lon,lat,96); medium=noise(lon,lat,384); fine=noise(lon,lat,1536)
    color=np.empty((*mask.shape,3),np.float32); color[:]=[135,172,128]
    forest=np.clip((np.exp(-(lat/18)**2)*.65+np.exp(-((lat-58)/11)**2)*.5+medium*.25-.12),0,.82)
    color=tint(color,[74,127,104],forest)
    dry=np.zeros(mask.shape,np.float32)
    for cx,cy,sx,sy in [(14,23,31,10),(46,25,15,9),(82,43,24,10),(134,-25,19,10),(23,-23,10,9),(-112,36,15,10),(-68,-24,5,12)]:
        field=np.exp(-((lon-cx)/sx)**4-((lat-cy)/sy)**4)
        dry=np.maximum(dry,np.clip(field*.95+n*.23,0,1))
    color=tint(color,[202,184,128],np.clip(dry*.85,0,.95))
    color+=((np.round(n*5)/5)*5+medium*3+fine*.9)[...,None]
    cold=np.clip((abs(lat)-65+n*5)/10,0,1)
    cold=np.maximum(cold,np.clip((lat-57)/10,0,1)*np.exp(-((lon+42)/14)**4))
    color=tint(color,[231,238,218],cold)
    ocean=np.empty_like(color); ocean[:]=[42,109,133]
    ocean+=((np.cos(np.radians(lat))*4+n*3+medium*1.4))[...,None]*np.array([.4,1,1.1])
    # Distances operate only while baking; runtime simply samples the image.
    distance=distance_transform_edt(~mask)*km_per_pixel
    shelf=np.exp(-distance/38)*.63
    ocean=tint(ocean,[82,157,158],shelf)
    ocean=tint(ocean,[108,176,166],np.exp(-distance/5.5)*.4)
    shore=distance_transform_edt(mask)*km_per_pixel
    color=tint(color,[203,193,145],np.exp(-shore/2.3)*.32)
    return np.where(mask[...,None],color,ocean).clip(0,255).astype(np.uint8)


MOUNTAIN_CHAINS=[([(-129,56),(-123,49),(-117,43),(-110,36),(-105,29)],2.7),([(-77,9),(-76,-4),(-71,-18),(-69,-31),(-72,-45),(-70,-53)],2.1),([(62,36),(73,34),(81,29),(92,29),(103,34)],2.2),([(8,45),(14,47),(21,45)],1),([(-7,31),(0,33),(9,35)],1.1),([(35,10),(39,1),(34,-9),(29,-24)],1.2),([(143,-18),(148,-26),(147,-36)],1.2),([(96,49),(111,52),(126,55),(142,58)],1.2)]


def paint_global_features(image,mask,rivers):
    w,h=image.size
    ink=Image.new('RGBA',image.size); d=ImageDraw.Draw(ink)
    chains=MOUNTAIN_CHAINS
    rng=np.random.default_rng(SEED)
    for points,width in chains:
        for a,b in zip(points,points[1:]):
            a,b=np.array(a),np.array(b); delta=b-a; length=np.linalg.norm(delta); normal=np.array([-delta[1],delta[0]])/length
            for t in np.arange(0,1,.6/length):
                center=a+delta*t+normal*math.sin(t*16)*width*.15
                for side in [-1,1]:
                    r=width*(.4+rng.random()*.5)
                    peak=center+normal*rng.uniform(-.3,.3)
                    tail=peak+normal*r*side-delta/length*r*.4
                    points_geo=np.array([peak,tail,tail+delta/length*r*.7,peak+delta/length*r*.42])
                    d.polygon([tuple(p) for p in project(points_geo,w,h)],fill=(75,111,93,52) if side==1 else (221,214,161,93))
                if abs(center[1])>36 or center[0]>60:
                    p=project(np.array([center,center+delta/length*.3]),w,h)
                    d.line([tuple(q) for q in p],fill=(232,231,199,130),width=max(1,w//2200))
    for shape in rivers:
        for line in shape:
            if len(line)>6:
                pts=project(line,w,h)
                d.line([tuple(p) for p in pts],fill=(76,143,151,160),width=max(1,round(w/3400)),joint='curve')
    alpha=np.minimum(np.asarray(ink.getchannel('A')),mask.astype(np.uint8)*255)
    ink.putalpha(Image.fromarray(alpha)); image.alpha_composite(ink)
    return image.convert('RGB')


def curve(points,steps=30):
    points=np.asarray(points,float); out=[]
    for i in range(len(points)-1):
        p0,p1,p2,p3=points[max(0,i-1)],points[i],points[i+1],points[min(len(points)-1,i+2)]
        for t in np.arange(steps)/steps:
            out.append(.5*(2*p1+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t))
    return np.array(out+[points[-1]])


def river_path():
    near=np.array([[-540+math.sin(z/4400*math.pi*3)*90,z] for z in np.arange(-2200,2201,100)])
    south=curve([[-23400,-9200],[-17600,-8300],[-14800,-10400],[-12100,-8200],[-9600,-9800],[-6500,-7500],[-3200,-7200],[-900,-4000],near[0]])
    north=curve([near[-1],[-800,4500],[700,7000],[-300,10000],[-2800,14500],[-1600,20000],[-5300,26000],[-3600,34000],[-7000,40000]])
    return np.vstack([south,near,north])


def regional_colors(color,mask):
    h,w=mask.shape; yy,xx=np.mgrid[0:h,0:w].astype(np.float32)
    rng=np.random.default_rng(SEED+4)
    fields=[]
    for size in [13,47,131]:
        grid=gaussian_filter(rng.random((size,size)).astype(np.float32),.55)
        field=map_coordinates(grid,[yy/h*(size-1),xx/w*(size-1)],order=1)
        fields.append((field-.5)*3)
    broad,detail,grain=fields
    forest=np.clip(.30+broad*.8+detail*.25,0,.85)
    painted=tint(color.astype(np.float32),[130,169,119],.38+np.zeros(mask.shape))
    painted=tint(painted,[78,133,101],forest)
    painted+=(np.round(detail*5)/5*7+grain*1.8)[...,None]
    # A little chromatic relief reads as watercolor cut-paper without a bump shader.
    height=gaussian_filter(broad*.6+detail*.4,2)
    dy,dx=np.gradient(height)
    painted+=np.clip((dx-dy)*280,-8,8)[...,None]
    return np.where(mask[...,None],painted,color).clip(0,255).astype(np.uint8)


def paint_region(image,mask):
    w,h=image.size; factor=w/(2*EXTENT)
    def pt(points):return [((x+EXTENT)*factor,(EXTENT-z)*factor) for x,z in points]
    ink=Image.new('RGBA',image.size);d=ImageDraw.Draw(ink)
    rng=np.random.default_rng(SEED+2)
    # Preserve the existing 3D ridge footprints.
    for ridge in RIDGES:
        x,z,r=ridge['x'],ridge['z'],ridge['r']
        a=rng.uniform(-.35,.35)
        for side,color in [(-1,(185,187,136,150)),(1,(81,126,101,105))]:
            points=[(x,z+r*.5),(x+side*r,z-r*.6),(x+side*r*.35,z-r*.38),(x,z-r*.65)]
            d.polygon(pt(points),fill=color)
        d.line(pt([(x,z+r*.45),(x+math.sin(a)*r*.15,z),(x,z-r*.6)]),fill=(218,212,170,145),width=2)
    # Short, tapering ridge branches follow a shared hillside rather than repeated icons.
    for j in range(28):
        x=rng.uniform(12000,90000);z=rng.uniform(-12000,95000);r=rng.uniform(1700,4500)
        spine=curve([(x-r*.7,z-r),(x-r*.3,z-r*.2),(x,z+r*.15),(x+r*.45,z+r)])
        left=spine+np.column_stack((-np.sin(np.linspace(0,math.pi,len(spine)))*r*.30,np.zeros(len(spine))))
        right=spine+np.column_stack((np.sin(np.linspace(0,math.pi,len(spine)))*r*.25,np.zeros(len(spine))))
        d.polygon(pt(np.vstack((spine,left[::-1]))),fill=(207,202,147,65))
        d.polygon(pt(np.vstack((spine,right[::-1]))),fill=(67,117,91,48))
        d.line(pt(spine),fill=(213,209,159,85),width=2)
    river=river_path()
    # The artificial launch-area river is no longer painted.
    # Quiet field mosaics and scattered woodland are baked, never extra meshes.
    for i in range(4400):
        x=rng.uniform(-EXTENT,EXTENT);z=rng.uniform(-EXTENT,EXTENT)
        px,py=int((x+EXTENT)*factor),int((EXTENT-z)*factor)
        if not (0<=px<w and 0<=py<h and mask[py,px]) or math.hypot(x,z)>95000:continue
        r=rng.uniform(60,360)
        d.ellipse([px-r*factor,py-r*factor*.65,px+r*factor,py+r*factor*.65],fill=(59,111,88,int(rng.uniform(15,38))))
    alpha=np.minimum(np.asarray(ink.getchannel('A')),mask.astype(np.uint8)*255)
    ink.putalpha(Image.fromarray(alpha));image.alpha_composite(ink)
    return image.convert('RGB'),river


def clouds():
    w,h=1024,512
    yy,xx=np.mgrid[0:h,0:w].astype(np.float32)
    lon=xx/(w-1)*360-180;lat=90-yy/(h-1)*180
    # Warp a continuous density field instead of stamping overlapping discs.
    flow_lon=lon+24*noise(lon,lat,8);flow_lat=lat+13*noise(lon,lat,16)
    field=.55*noise(flow_lon,flow_lat,20)+.28*noise(flow_lon,flow_lat,40)+.12*noise(flow_lon,flow_lat,80)+.05*noise(flow_lon,flow_lat,160)
    edge=np.quantile(field,.69);core=np.quantile(field,.95)
    density=np.clip((field-edge)/(core-edge),0,1)
    density=density*density*(3-2*density)
    density*=np.clip((86-np.abs(lat))/14,0,1)
    a=np.round(density*235).astype(np.uint8)
    a[:,0]=a[:,-1]=np.round((a[:,0].astype(float)+a[:,-1])/2)
    coverage=np.mean(a>32);quadrants=[np.mean(a[:,i*w//4:(i+1)*w//4]>32) for i in range(4)]
    print('Cloud coverage:',round(float(coverage),4),'quadrants:',[round(float(v),4) for v in quadrants],flush=True)
    assert .12<coverage<.32 and min(quadrants)>.08, 'Moderate clouds across longitudes'
    assert np.array_equal(a[:,0],a[:,-1]), 'Cloud longitude seam'
    assert np.mean((a>8)&(a<200))>.08, 'Continuous thin and thick clouds'
    rgba=np.empty((h,w,4),np.uint8);rgba[:,:,:3]=[239,244,245];rgba[:,:,3]=a
    return Image.fromarray(rgba,'RGBA')


def stars():
    w,h=1024,512;yy,xx=np.mgrid[0:h,0:w];lon=xx/w*360-180;lat=90-yy/h*180
    band=np.exp(-((lat-24*np.sin(np.radians(lon)*2)-8)/12)**2)
    n=noise(lon,lat,96)
    color=np.zeros((h,w,3),np.float32);color[:]=[3,8,18]
    color+=np.maximum(0,band*(.7+n*.45))[...,None]*np.array([3,4,7])
    image=Image.fromarray(color.astype(np.uint8));d=ImageDraw.Draw(image);rng=np.random.default_rng(SEED+17)
    for i in range(420):
        x=rng.integers(w);y=int(math.acos(rng.uniform(-1,1))/math.pi*h)
        level=int(rng.uniform(14,40));d.point((x,y),fill=(level,level+2,level+5))
    a=np.array(image);a[:,0]=a[:,-1]=(a[:,0].astype(int)+a[:,-1])/2
    return Image.fromarray(a)


def save(image,name):
    image.save(OUT/name,'WEBP',quality=90,method=6,exact=True)
    print(name,image.size,(OUT/name).stat().st_size,flush=True)


def clip_ring(points, xmin, xmax, zmin, zmax):
    points = [list(p) for p in points]
    for axis, bound, sign in [(0,xmin,1),(0,xmax,-1),(1,zmin,1),(1,zmax,-1)]:
        result=[]
        for a,b in zip(points,points[1:]+points[:1]):
            inside_a=(a[axis]-bound)*sign>=0;inside_b=(b[axis]-bound)*sign>=0
            if inside_a:result.append(a)
            if inside_a!=inside_b:
                t=(bound-a[axis])/(b[axis]-a[axis]);result.append([a[j]+t*(b[j]-a[j]) for j in range(2)])
        points=result
        if not points:break
    return points


def bake_relief(land):
    # Bake geometry once: the browser only selects prebuilt detail levels.
    extent=240000.
    groups=[]
    for shape in land:
        rings=[]
        for ring in shape:
            if not np.any((ring[:,0]>-125)&(ring[:,0]<-116)&(ring[:,1]>30)&(ring[:,1]<39)):continue
            clipped=clip_ring(ring,-125,-116,30,39)
            if len(clipped)<3:continue
            local=geo_to_local(np.asarray(clipped))[:,:2]
            points=clip_ring(local,-extent,extent,-extent,extent)
            if len(points)<3:continue
            # Preserve the refined coast while discarding sub-40m redundant points.
            reduced=[points[0]]
            for q in points[1:]:
                if math.dist(q,reduced[-1])>40:reduced.append(q)
            if len(reduced)>2 and math.dist(reduced[0],reduced[-1])<40:reduced.pop()
            if len(reduced)>=3:rings.append([[round(x,2),round(z,2)] for x,z in reduced])
        if rings:groups.append(rings)
    canvas=Image.new('L',(2048,2048));draw=ImageDraw.Draw(canvas)
    for rings in groups:
        for i,ring in enumerate(rings):
            draw.polygon([((x+extent)/(2*extent)*2048,(extent-z)/(2*extent)*2048) for x,z in ring],fill=255 if i==0 else 0)
    mask=np.asarray(canvas)>127
    shore=(distance_transform_edt(mask)-distance_transform_edt(~mask))*(2*extent/mask.shape[0])
    field=Image.fromarray(shore.astype(np.float32),'F').resize((257,257),Image.Resampling.BILINEAR)
    source={'extent':extent,'groups':groups,'shore':np.round(np.asarray(field)).astype(int).tolist(),'ridges':RIDGES}
    tmp=ROOT/'output/rocket/terrain-source.json';tmp.parent.mkdir(parents=True,exist_ok=True)
    tmp.write_text(json.dumps(source,separators=(',',':')),encoding='utf-8')
    subprocess.run(['node',str(Path(__file__).with_name('bake-terrain.mjs')),str(tmp)],cwd=ROOT,check=True)
    return json.loads((OUT/'geography.json').read_text(encoding='utf-8'))['terrain']


def main():
    OUT.mkdir(exist_ok=True)
    land=refine_coasts(load_shapes('ne_50m_land'));lakes=load_shapes('ne_50m_lakes');rivers=load_shapes('ne_50m_rivers_lake_centerlines')
    w,h=4096,2048;yy,xx=np.mgrid[0:h,0:w].astype(np.float32);lon=xx/w*360-180;lat=90-yy/h*180
    mask=land_mask(land,lakes,w,h)
    earth=paint_global_features(Image.fromarray(terrain(lon,lat,mask,2*math.pi*R/1000/w)).convert('RGBA'),mask,rivers)
    a=np.array(earth);a[:,0]=a[:,-1]=(a[:,0].astype(int)+a[:,-1])/2;earth=Image.fromarray(a)
    save(earth,'earth-4k.webp')
    small=np.array(earth.resize((2048,1024),Image.Resampling.LANCZOS));small[:,0]=small[:,-1]=(small[:,0].astype(int)+small[:,-1])/2
    save(Image.fromarray(small),'earth-2k.webp')
    w=h=2048;yy,xx=np.mgrid[0:h,0:w].astype(np.float32);x=(xx+.5)/w*2*EXTENT-EXTENT;z=EXTENT-(yy+.5)/h*2*EXTENT
    lon,lat=local_to_geo(x,z);regional_mask=land_mask(land,lakes,w,h,True)
    regional=Image.fromarray(regional_colors(terrain(lon,lat,regional_mask,2*EXTENT/1000/w),regional_mask)).convert('RGBA')
    regional,river=paint_region(regional,regional_mask)
    # Match the global color exactly at the patch edge, where the shader fades it out.
    base=np.stack([map_coordinates(a[:,:,c],[(90-lat)/180*2048,(lon+180)/360*4096],order=1,mode='grid-wrap') for c in range(3)],axis=-1)
    weight=np.clip((112000-np.hypot(x,z))/22000,0,1);weight=weight*weight*(3-2*weight)
    regional=Image.fromarray((np.asarray(regional)*weight[...,None]+base*(1-weight[...,None])).astype(np.uint8))
    save(regional,'launch-region.webp');save(clouds(),'clouds.webp');save(stars(),'starfield.webp')
    rows=[]
    for north in range(-120000,120001,500):
        row=max(0,min(h-1,int((EXTENT-north)/(2*EXTENT)*h)))
        # The eastern-connected mainland is distinct from the offshore islands.
        values=regional_mask[row];indices=np.flatnonzero(~values)
        east=None if not values[-1] else float((indices[-1]+1 if len(indices) else 0)/w*2*EXTENT-EXTENT)
        rows.append({'z':north,'x':None if east is None else round(east)})
    grid=Image.fromarray((regional_mask*255).astype(np.uint8)).resize((129,129),Image.Resampling.NEAREST)
    grid_rows=[''.join('1' if v else '0' for v in row) for row in np.array(grid)]
    sources=[]
    for source in sorted(SOURCE.glob('*.zip')):
        with zipfile.ZipFile(source) as archive:version=archive.read(source.stem+'.VERSION.txt').decode().strip()
        sources.append({'file':source.name,'version':version,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'url':'https://naturalearth.s3.amazonaws.com/50m_physical/'+source.name})
    landmarks=[{'name':'launch','x':0,'z':0,'land':True},{'name':'river-near-pad','x':-540,'z':0,'land':True},{'name':'west-coast','x':next(v['x'] for v in rows if v['z']==0),'z':0,'land':False},{'name':'ridge','x':round(RIDGES[0]['x']),'z':RIDGES[0]['z'],'land':True}]
    for p in landmarks:
        glon,glat=local_to_geo(np.array([[p['x']]]),np.array([[p['z']]]));p['longitude']=round(float(glon[0,0]),7);p['latitude']=round(float(glat[0,0]),7)
    relief=bake_relief(land)
    existing=json.loads((OUT/'geography.json').read_text(encoding='utf-8'))
    metadata={**existing,'terrain':relief,'version':1,'seed':SEED,'projection':{'radius':R,'latitudeRadians':LAT,'longitudeRadians':LON,'extentMetres':EXTENT,'imagesNorthUp':True,'globalUV':'u=(lon+180)/360; imageY=(90-lat)/180','regionalUV':'imageX=(east+120000)/240000; imageY=(120000-north)/240000','localVector':'(east/R,sqrt(1-(east*east+north*north)/(R*R)),north/R)','sceneToChart':'east=.764842*x+.644218*z; north=-.644218*x+.764842*z'},'sources':sources,'coastRows':rows,'landGrid':{'width':129,'height':129,'extentMetres':EXTENT,'northUp':True,'rows':grid_rows},'ridges':RIDGES,'river':{'nearPad':{'minZ':-2200,'maxZ':2200,'center':'-540+sin(z/4400*pi*3)*90','waterWidth':76,'bankWidth':112},'samples':[[round(v[0]),round(v[1])] for v in river[::3]]},'landmarks':landmarks,'assets':{p.name:{'dimensions':list(Image.open(p).size),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(OUT.glob('*.webp'))}}
    (OUT/'geography.json').write_text(json.dumps(metadata,separators=(',',':'))+'\n',encoding='utf-8')
    assert regional_mask[h//2,w//2], 'Launch pad must be dry land'
    assert all(abs(v['x'])>10000 for v in rows if v['z'] is not None and abs(v['z'])<10000 and v['x'] is not None), 'Pad area must stay away from coastline'
    assert np.max(np.abs(a[:,0].astype(int)-a[:,-1]))==0, 'Global longitude seam'
    assert sum(v['bytes'] for v in metadata['assets'].values())<2500000, 'Shipping image budget'
    for p in landmarks:
        local=geo_to_local(np.array([[p['longitude'],p['latitude']]]))[0]
        assert np.linalg.norm(local[:2]-[p['x'],p['z']])<.03, 'Shader coordinate roundtrip'
    assert len(rows)==481 and len(RIDGES)==36
    print('Self-check: source parsing, launch land, coastline clearance, seam, budget and shader coordinate roundtrip passed.',flush=True)

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--clouds-only',action='store_true');args=parser.parse_args()
    if args.clouds_only:
        image=clouds();save(image,'clouds.webp')
        metadata=json.loads((OUT/'geography.json').read_text(encoding='utf-8'));asset=OUT/'clouds.webp'
        metadata['assets']['clouds.webp']={'dimensions':list(image.size),'bytes':asset.stat().st_size,'sha256':hashlib.sha256(asset.read_bytes()).hexdigest()}
        (OUT/'geography.json').write_text(json.dumps(metadata,separators=(',',':'))+'\n',encoding='utf-8')
    else:main()
