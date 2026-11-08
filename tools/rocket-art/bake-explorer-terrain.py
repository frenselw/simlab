"""Rebuild only the explorer's canonical relief and mesh attributes, offline."""
from pathlib import Path
import argparse, base64, gzip, hashlib, importlib.util, json, math, struct, subprocess
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt, map_coordinates, gaussian_filter
from scipy.spatial import Delaunay
from scipy.stats import qmc

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
spec = importlib.util.spec_from_file_location('globe', HERE / 'global-terrain.py')
globe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(globe)
art = globe.art
R, E, N = art.R, 240000, 1025
smooth = globe.smooth


def aridity(e,n,lat,lon):
    u=np.sin(np.radians(lat))*np.sin(art.LAT)+np.cos(np.radians(lat))*np.cos(art.LAT)*np.cos(np.radians(lon)-art.LON)
    extent=(np.abs(e)**8+np.abs(n)**8)**(1/8);core=np.where(u>0,1-smooth(175000,239500,extent),0);dry=np.zeros_like(lat)
    for x,y,sx,sy in [(14,23,31,10),(46,25,15,9),(82,43,24,10),(134,-25,19,10),(23,-23,10,9),(-112,36,15,10),(-68,-24,5,12)]:dry=np.maximum(dry,np.exp(-(((lon-x+540)%360-180)/sx)**4-((lat-y)/sy)**4))
    return dry*(1-core)

def forest(e, n, lat, height, lon):
    def noise(x,y):
        i=np.floor(x);j=np.floor(y);a=smooth(0,1,x-i);b=smooth(0,1,y-j)
        def hash(i,j):
            v=np.sin(i*127.1+j*311.7)*43758.5453;return v-np.floor(v)
        return hash(i,j)*(1-a)*(1-b)+hash(i+1,j)*a*(1-b)+hash(i,j+1)*(1-a)*b+hash(i+1,j+1)*a*b
    moisture=.28+.6*noise(e/13000+31.4,n/13000-17.8)+.2*noise(e/3100-7.3,n/3100+11.2)
    return np.clip((moisture-.30)*1.8, 0, 1)*(1-smooth(1450,2600,height))*(1-smooth(57,73,np.abs(lat)))*(1-.98*aridity(e,n,lat,lon))


def paint(e, n, lat, height, lon):
    trees = forest(e, n, lat, height,lon)
    color=np.tile([.24,.37,.22],(len(e),1))*(1-trees[:,None]*.6)+np.array([.075,.19,.12])*trees[:,None]*.6
    dry=(1-smooth(.15,.45,trees))*(1-smooth(45,65,np.abs(lat)))
    color=color*(1-dry[:,None]*.4)+np.array([.43,.37,.25])*dry[:,None]*.4
    arid=aridity(e,n,lat,lon)*.8
    color=color*(1-arid[:,None])+np.array([.55,.44,.28])*arid[:,None]
    rock=smooth(1100,2500,height)*.65
    color=color*(1-rock[:,None])+np.array([.34,.32,.26])*rock[:,None]
    snowline=4800-2200*smooth(25,65,np.abs(lat));cold=np.maximum(smooth(65,78,np.abs(lat)),smooth(snowline-450,snowline+500,height))
    return color*(1-cold[:,None])+np.array([.76,.81,.72])*cold[:,None]


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--target', required=True, type=Path)
    args=parser.parse_args()
    target=args.target.resolve()
    assert target == (ROOT/'sim/rocket-side-booster-lab').resolve(), 'Explorer target required; original activity is protected'
    assets=target/'assets'
    scratch=ROOT/'output/tmp/explorer-terrain'
    scratch.mkdir(parents=True,exist_ok=True)
    image=Image.new('L',(3601,1801));draw=ImageDraw.Draw(image)
    land=art.load_shapes('ne_50m_land')
    for outer in (True,False):
        for shape in land:
            for ring in shape:
                if (globe.area(ring)<0)==outer:
                    draw.polygon([((lon+180)*10,(90-lat)*10) for lon,lat in ring],fill=255 if outer else 0)
    mask=np.asarray(image)>127
    mask[-1,:]=mask[-2,:]
    shore=distance_transform_edt(mask)*11.12
    width,height=721,361
    lon,lat=np.meshgrid(np.linspace(-180,180,width),np.linspace(90,-90,height))
    points=np.column_stack((lon.ravel(),lat.ravel()))
    coords=[(90-points[:,1])*10,(points[:,0]+180)*10]
    global_land=map_coordinates(mask.astype('u1'),coords,order=0,mode='nearest').reshape(height,width).astype(bool)
    distance=map_coordinates(shore,coords,order=1,mode='nearest')
    world_meta=json.loads((HERE/'sources/explorer-world-terrain/runtime.json').read_text(encoding='utf-8'))
    world_grid=np.asarray(Image.open(HERE/'sources/explorer-world-terrain/height-land-8k.png')).astype('<u2')
    assert world_grid.shape==(world_meta['height'],world_meta['width'])
    world_h=(world_grid&32767).astype('f4');world_land=(world_grid&32768)>0
    world_coords=[(90-lat)/180*(world_meta['height']-1),(lon+180)/360*(world_meta['width']-1)]
    global_land=map_coordinates(world_land.astype('u1'),world_coords,order=0,mode='nearest').astype(bool)
    global_h=map_coordinates(world_h,world_coords,order=1,mode='nearest');global_h[~global_land]=0

    groups=[]
    for shape in art.refine_coasts(art.load_shapes('ne_50m_land')):
        rings=[]
        for ring in shape:
            if not np.any((ring[:,0]>-125)&(ring[:,0]<-116)&(ring[:,1]>30)&(ring[:,1]<39)):continue
            clipped=art.clip_ring(ring,-125,-116,30,39)
            if len(clipped)<3:continue
            local=art.geo_to_local(np.asarray(clipped))[:,:2]
            clipped=art.clip_ring(local,-E,E,-E,E)
            if len(clipped)<3:continue
            reduced=[clipped[0]]
            for q in clipped[1:]:
                if math.dist(q,reduced[-1])>40:reduced.append(q)
            if len(reduced)>2 and math.dist(reduced[0],reduced[-1])<40:reduced.pop()
            if len(reduced)>=3:rings.append([[round(x,2),round(z,2)] for x,z in reduced])
        if rings:groups.append(rings)
    image=Image.new('L',(4096,4096));draw=ImageDraw.Draw(image)
    for rings in groups:
        for i,ring in enumerate(rings):draw.polygon([((x+E)/(2*E)*4096,(E-z)/(2*E)*4096) for x,z in ring],fill=255 if i==0 else 0)
    mask=np.asarray(image)>127
    local_shore=(distance_transform_edt(mask)-distance_transform_edt(~mask))*(2*E/4096)
    shore_local=np.asarray(Image.fromarray(local_shore.astype('f4'),'F').resize((N,N),Image.Resampling.BILINEAR))
    F=4097
    xx,zz=np.meshgrid(np.linspace(-E,E,F),np.linspace(E,-E,F))
    llon,llat=art.local_to_geo(xx,zz)
    source_dir=HERE/'sources/explorer-natural-region'
    source_meta=json.loads((source_dir/'source.json').read_text(encoding='utf-8'))
    source_blob=(source_dir/'usgs-region-dem.tif').read_bytes()
    assert hashlib.sha256(source_blob).hexdigest()==source_meta['sha256']
    image=Image.open(source_dir/'usgs-region-dem.tif')
    assert image.mode=='F' and image.size==(4096,4096)
    keys=image.tag_v2[34735];keys={keys[i]:keys[i+3] for i in range(4,len(keys),4)}
    assert keys[2048]==4326 and keys[1025]==1
    dx,dy,_=image.tag_v2[33550];_,_,_,west,north,_=image.tag_v2[33922]
    with np.errstate(invalid='ignore'):raw=np.asarray(image).astype(float)
    valid=np.isfinite(raw)&(raw> -500)&(raw<5000)
    invalid_fraction=float(1-valid.mean())
    nearest=distance_transform_edt(~valid,return_distances=False,return_indices=True)
    raw[~valid]=raw[tuple(q[~valid] for q in nearest)]
    coords=[(north-llat)/dy-.5,(llon-west)/dx-.5]
    assert min(float(q.min()) for q in coords)>=0 and max(float(q.max()) for q in coords)<4095
    fine_h=gaussian_filter(map_coordinates(raw,coords,order=1,mode='nearest'),.45)
    fine_shore=map_coordinates(local_shore,[(E-zz)/(2*E)*4095,(xx+E)/(2*E)*4095],order=1,mode='nearest')
    fine_land=fine_shore>0
    # The launch apron alone is level; the facilities follow the real surrounding ground.
    fine_h=np.maximum(0,fine_h)*smooth(0,350,fine_shore)*smooth(250,650,np.hypot(xx,zz))
    fine_h[~fine_land]=0;fine_land[F//2,F//2]=True
    fine_h=np.rint(fine_h*10)*.1
    assert fine_h.max()<5000
    fine=np.where(fine_land,np.rint(fine_h*10)+1,0).astype('<u2')
    fine_file=assets/'regional-heights.bin.gz';fine_file.write_bytes(gzip.compress(fine.tobytes(),compresslevel=9,mtime=0))
    local_h=fine_h[::4,::4];local_land=fine_land[::4,::4]
    def globe_sample(lon,lat):return map_coordinates(world_h,[(90-lat)/180*(world_meta['height']-1),(lon+180)/360*(world_meta['width']-1)],order=1,mode='nearest')
    def pack(h,l):return (np.rint(h).astype('<u2') | (l.astype('<u2')*32768))
    data=dict(version=1,width=width,height=height,global_=base64.b64encode(pack(global_h,global_land).tobytes()).decode(),localSize=257,extent=E,local=base64.b64encode(pack(local_h[::4,::4],local_land[::4,::4]).tobytes()).decode(),maxHeight=9000,fine=dict(size=F,file='assets/regional-heights.bin.gz',bytes=fine_file.stat().st_size,sha256=hashlib.sha256(fine_file.read_bytes()).hexdigest()))
    data['global']=data.pop('global_');data['world']={k:v for k,v in world_meta.items() if k!='source'}
    text="/* Generated USGS regional and NOAA ETOPO global relief. */\n(function(root){const data="+json.dumps(data,separators=(',',':'))+";if(typeof module==='object'&&module.exports)module.exports=data;else root.RocketSurfaceData=data;})(typeof globalThis!=='undefined'?globalThis:this);\n"
    (target/'surface-data.js').write_text(text,encoding='utf-8',newline='\n')
    def sample(e,u,n):
        geographic=e[:,None]*art.EAST+u[:,None]*art.UP+n[:,None]*art.NORTH
        lon=np.degrees(np.arctan2(geographic[:,2],geographic[:,0]));lat=np.degrees(np.arcsin(np.clip(geographic[:,1],-1,1)))
        gh=globe_sample(lon,lat)
        is_land=map_coordinates(world_land.astype('u1'),[(90-lat)/180*(world_meta['height']-1),(lon+180)/360*(world_meta['width']-1)],order=0,mode='nearest').astype(bool)
        extent=(np.abs(e)**8+np.abs(n)**8)**(1/8)*R
        fy=np.clip((1-n*R/E)*(F-1)/2,0,F-1);fx=np.clip((e*R/E+1)*(F-1)/2,0,F-1)
        i=np.minimum(F-2,np.floor(fx).astype(int));j=np.minimum(F-2,np.floor(fy).astype(int));a=fx-i;b=fy-j
        lh=np.where(a+b<=1,fine_h[j,i]*(1-a-b)+fine_h[j,i+1]*a+fine_h[j+1,i]*b,fine_h[j+1,i+1]*(a+b-1)+fine_h[j,i+1]*(1-b)+fine_h[j+1,i]*(1-a))
        land_near=fine_land[np.rint(fy).astype(int),np.rint(fx).astype(int)]
        w=np.where(u>0,1-smooth(175000,239500,extent),0)
        h=np.where(is_land,gh,0)*(1-w)+np.where(land_near,lh,0)*w
        return h,lon,lat
    metadata=json.loads((assets/'geography.json').read_text(encoding='utf-8'))
    for record in metadata['globalTerrain']['files']:
        file=assets/record['file'];blob=bytearray(file.read_bytes());length=struct.unpack_from('<I',blob)[0];header=json.loads(blob[4:4+length]);start=4+(length+3)//4*4;count=header['vertexCount']
        # Rebuild from the protected seed directions, never repeatedly round a prior bake.
        original=(ROOT/'sim/rocket-space-mission-lab/assets'/record['file']).read_bytes()
        original_length=struct.unpack_from('<I',original)[0];original_start=4+(original_length+3)//4*4
        positions=np.frombuffer(original,'<f4',count*3,original_start).reshape(-1,3).astype(float)
        unit=positions/np.linalg.norm(positions,axis=1)[:,None]
        h,lon,lat=sample(*unit.T)
        positions=(unit*(1+h[:,None]/R)).astype('<f4')
        blob[start:start+count*12]=positions.tobytes()
        # Quantized positions are the color key across coarse/fine borders.
        quant=positions.astype(float);quant/=np.linalg.norm(quant,axis=1)[:,None]
        h,lon,lat=sample(*quant.T)
        rgba=np.column_stack((np.rint(paint(quant[:,0]*R,quant[:,2]*R,lat,h,lon)*255).astype('u1'),np.full(count,255,'u1')))
        color_start=start+count*12;index=start+count*16;blob[color_start:index]=rgba.tobytes()
        faces=np.frombuffer(blob,'<u4',header['indexCount'],index).reshape(-1,3).copy()
        p=positions[faces].astype(float)
        orientation=np.einsum('ij,ij->i',np.cross(p[:,1]-p[:,0],p[:,2]-p[:,0]),p[:,0])
        assert np.all(orientation!=0), 'No collapsed relief triangles'
        faces[orientation<0]=faces[orientation<0][:,[0,2,1]]
        blob[index:]=faces.tobytes()
        if file.read_bytes()!=blob:file.write_bytes(blob)
        header.update(maxReliefMetres=9000,illustrative=False)
        encoded=json.dumps(header,separators=(',',':')).encode();prefix=struct.pack('<I',len(encoded))+encoded+b' '*((-len(encoded))%4)
        blob=bytearray(prefix)+blob[start:];color_start=len(prefix)+count*12;index=len(prefix)+count*16
        if file.read_bytes()!=blob:file.write_bytes(blob)
        record.update(bytes=len(blob),sha256=hashlib.sha256(blob).hexdigest(),nonColorSha256=hashlib.sha256(blob[:color_start]+blob[index:]).hexdigest())
    surface=(target/'surface-data.js').read_bytes()
    metadata['surface'].update(localSize=257,bytes=len(surface),gzipBytes=len(gzip.compress(surface,mtime=0)),sha256=hashlib.sha256(surface).hexdigest(),globalMaxHeight=int(global_h.max()),localMaxHeight=int(local_h.max()))
    metadata['globalTerrain'].update(bytes=sum(r['bytes'] for r in metadata['globalTerrain']['files']),maxReliefMetres=9000,illustrative=False,worldRelief=world_meta)
    metadata['reliefModel']=dict(version=3,illustrative=False,globalIllustrative=False,localSpacingMetres=2*E/(F-1),detailFadeMetres=[175000,239500],features=['USGS-mountains','branching-valleys','coastal-plains'],forest='seeded-climate-value-noise-v3',source=source_meta,noDataFraction=invalid_fraction,fine=dict(size=F,decodedBytes=fine.nbytes,bytes=fine_file.stat().st_size,sha256=hashlib.sha256(fine_file.read_bytes()).hexdigest(),minimumMetres=float(fine_h.min()),maximumMetres=float(fine_h.max())))
    (assets/'geography.json').write_text(json.dumps(metadata,separators=(',',':'))+'\n',encoding='utf-8')
    # Region-wide continuous normals: 16-bit RG height, B woodland density, A land.
    tx=xx[::2,::2];tz=zz[::2,::2];tu=np.sqrt(1-(tx*tx+tz*tz)/(R*R))
    th,tlon,tlat=sample(tx.ravel()/R,tu.ravel(),tz.ravel()/R);th=th.reshape(tx.shape)
    packed_h=np.rint(th*10).astype('u2');density=forest(tx.ravel(),tz.ravel(),tlat,th.ravel(),tlon).reshape(tx.shape)
    Image.fromarray(np.dstack((packed_h//256,packed_h%256,np.rint(density*255),fine_land[::2,::2]*255)).astype('u1'),'RGBA').save(assets/'regional-surface.png',optimize=True)
    metadata['reliefModel']['surfaceTexture']=dict(size=2049,bytes=(assets/'regional-surface.png').stat().st_size,sha256=hashlib.sha256((assets/'regional-surface.png').read_bytes()).hexdigest(),gpuBytes=2049**2*4)
    (assets/'geography.json').write_text(json.dumps(metadata,separators=(',',':'))+'\n',encoding='utf-8')
    source=scratch/'terrain-source.json'
    source.write_text(json.dumps(dict(extent=E,groups=groups,shore=shore_local.tolist(),ridges=[],heights=local_h.tolist(),natural=True),separators=(',',':')),encoding='utf-8')
    subprocess.run(['node',str(HERE/'bake-terrain.mjs'),str(source),'--target',str(target)],cwd=ROOT,check=True)
    metadata=json.loads((assets/'geography.json').read_text(encoding='utf-8'));metadata['surface']['terrainSha256']=metadata['terrain']['sha256']
    (assets/'geography.json').write_text(json.dumps(metadata,separators=(',',':'))+'\n',encoding='utf-8')
    assert local_h[N//2,N//2]==0 and 1800<local_h.max()<5000
    print(json.dumps(dict(localSize=257,fineSize=F,localMax=float(fine_h.max()),surfaceBytes=len(surface),surfaceGzipBytes=metadata['surface']['gzipBytes'],terrain=metadata['terrain'])),flush=True)


if __name__=='__main__':main()
