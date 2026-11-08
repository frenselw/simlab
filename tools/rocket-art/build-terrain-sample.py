"""Bake a bounded real-DEM preview; never writes the existing flight terrain."""
from pathlib import Path
import hashlib, importlib.util, json, struct
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, map_coordinates
from scipy.spatial import Delaunay
from scipy.stats import qmc

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
SOURCE=HERE/'sources/explorer-terrain-sample'
OUT=ROOT/'sim/rocket-side-booster-lab/assets/terrain-sample'
SPAN=40000.;N=513;STEP=SPAN/(N-1)
spec=importlib.util.spec_from_file_location('art',HERE/'generate.py')
art=importlib.util.module_from_spec(spec);spec.loader.exec_module(art)


def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    source=json.loads((SOURCE/'source.json').read_text(encoding='utf-8'))
    blob=(SOURCE/'usgs-santa-ynez-dem.tif').read_bytes()
    assert hashlib.sha256(blob).hexdigest()==source['sha256']
    image=Image.open(SOURCE/'usgs-santa-ynez-dem.tif')
    assert image.mode=='F' and image.size==(1536,1536)
    keys=image.tag_v2[34735];entries={keys[i]:keys[i+3] for i in range(4,len(keys),4)}
    assert entries[2048]==4326 and entries[1025]==1, 'Geographic WGS84, pixel-is-area raster'
    dx,dy,_=image.tag_v2[33550];_,_,_,west,north,_=image.tag_v2[33922]
    x,z=np.meshgrid(np.linspace(-SPAN/2,SPAN/2,N),np.linspace(SPAN/2,-SPAN/2,N))
    lon,lat=art.local_to_geo(x+28000,z)
    coords=[(north-lat)/dy-.5,(lon-west)/dx-.5]
    assert min(float(q.min()) for q in coords)>=0 and max(float(q.max()) for q in coords)<1535
    raw=np.asarray(image).astype(float)
    assert np.isfinite(raw).all() and raw.min()>-100 and raw.max()<3500
    field=map_coordinates(raw,coords,order=1,mode='nearest')
    # A small fixed physical filter removes export noise while retaining branching ridges.
    field=gaussian_filter(field,.65)
    heights=np.rint(field*10).astype('<u2')
    field=heights.astype(float)/10
    dz,ex=np.gradient(gaussian_filter(field,1),-STEP,STEP)
    slope=np.hypot(ex,dz)
    rng=np.random.default_rng(731)
    def noise(sigma):
        a=gaussian_filter(rng.normal(size=(N,N)),sigma)
        return np.clip(.5+a/max(a.std(),1e-8)*.18,0,1)
    moisture=.68*noise(19)+.32*noise(5)
    valley=np.clip((gaussian_filter(field,9)-field)/90,0,1)
    forest=np.clip(.12+.8*moisture+.25*valley-.65*smooth(.25,.75,slope)-.2*smooth(1250,1700,field),0,1)
    color=np.zeros((N,N,3))+[.34,.36,.22]
    weight=smooth(.20,.65,forest)*.78
    color=color*(1-weight[:,:,None])+np.array([.075,.17,.09])*weight[:,:,None]
    rock=smooth(.45,1.05,slope)*.5
    color=color*(1-rock[:,:,None])+np.array([.36,.34,.29])*rock[:,:,None]
    color*=.94+.12*noise(2)[:,:,None]
    # Continuous fragment lighting prevents coarse triangle interpolation from drawing false facets.
    packed_height=np.dstack((heights//256,heights%256,np.full_like(heights,255))).astype('u1')
    Image.fromarray(packed_height,'RGB').save(OUT/'heights.png',optimize=True)
    decoded=np.asarray(Image.open(OUT/'heights.png')).astype('u2')
    assert np.array_equal(decoded[:,:,0]*256+decoded[:,:,1],heights)
    painted=np.asarray(Image.fromarray(np.rint(np.clip(color,0,1)*255).astype('u1'),'RGB').resize((1024,1024),Image.Resampling.BICUBIC)).astype(float)
    crown_noise=gaussian_filter(rng.normal(size=(1024,1024)),.75)
    crown_noise=np.clip(crown_noise/max(crown_noise.std(),1e-8),-2,2)
    density_large=np.asarray(Image.fromarray(forest.astype('f4'),'F').resize((1024,1024),Image.Resampling.BILINEAR))
    painted*=1+crown_noise[:,:,None]*.055*density_large[:,:,None]
    Image.fromarray(np.rint(np.clip(painted,0,255)).astype('u1'),'RGB').save(OUT/'albedo.webp',lossless=True,method=6)
    def sample(a,points):
        coords=[(SPAN/2-points[:,1])/STEP,(points[:,0]+SPAN/2)/STEP]
        if a.ndim==2:return map_coordinates(a,coords,order=1,mode='nearest')
        return np.column_stack([map_coordinates(a[:,:,k],coords,order=1,mode='nearest') for k in range(a.shape[2])])
    boundary=[]
    for a in np.linspace(-SPAN/2,SPAN/2,81):boundary.extend([[a,-SPAN/2],[a,SPAN/2],[-SPAN/2,a],[SPAN/2,a]])
    initial=qmc.PoissonDisk(2,radius=.037,seed=731).fill_space()*SPAN-SPAN/2
    candidates=qmc.Sobol(2,scramble=True,seed=19).random_base2(16)*SPAN-SPAN/2
    candidate_h=sample(field,candidates)
    buffers=[heights.tobytes(),np.rint(forest*255).astype('u1').tobytes()]
    padding=(-sum(map(len,buffers)))%4;buffers.append(b'\0'*padding)
    offset=sum(map(len,buffers));levels=[]
    for tolerance,limit in [(55,2600),(22,7000),(8,17000)]:
        points=np.unique(np.vstack((boundary,initial)),axis=0)
        for iteration in range(20):
            tri=Delaunay(points);h=sample(field,points);simplex=tri.find_simplex(candidates)
            assert np.all(simplex>=0)
            bary=np.einsum('ijk,ik->ij',tri.transform[simplex,:2,:],candidates-tri.transform[simplex,2,:])
            weights=np.column_stack((bary,1-bary.sum(axis=1)))
            error=np.abs(np.sum(h[tri.simplices[simplex]]*weights,axis=1)-candidate_h)
            order=np.argsort(-error);_,first=np.unique(simplex[order],return_index=True)
            chosen=order[first];chosen=chosen[error[chosen]>tolerance]
            chosen=chosen[np.argsort(-error[chosen])][:min(1200,limit-len(points))]
            if not len(chosen):break
            points=np.vstack((points,candidates[chosen]))
        tri=Delaunay(points);h=sample(field,points)
        normal=np.column_stack((-sample(ex,points),np.ones(len(points)),-sample(dz,points)))
        normal/=np.linalg.norm(normal,axis=1)[:,None]
        attributes=np.column_stack((points[:,0],h,points[:,1],normal,sample(color,points))).astype('<f4')
        faces=tri.simplices[:,[0,2,1]].astype('<u4')
        probe=qmc.Sobol(2,scramble=True,seed=881).random_base2(14)*SPAN-SPAN/2
        cell=tri.find_simplex(probe);w=np.einsum('ijk,ik->ij',tri.transform[cell,:2,:],probe-tri.transform[cell,2,:]);w=np.column_stack((w,1-w.sum(axis=1)))
        deviation=np.abs(np.sum(h[tri.simplices[cell]]*w,axis=1)-sample(field,probe))
        levels.append(dict(offset=offset,vertices=len(points),indices=faces.size,targetErrorMetres=tolerance,triangles=len(faces),error95Metres=round(float(np.quantile(deviation,.95)),3),maximumProbeErrorMetres=round(float(deviation.max()),3)))
        for b in [attributes.tobytes(),faces.tobytes()]:buffers.append(b);offset+=len(b)
    # Medium woodland stands have no row/column lattice; near trees use the same density field.
    candidates=qmc.PoissonDisk(2,radius=.023,seed=547).fill_space()*SPAN-SPAN/2
    density=sample(forest,candidates);keep=rng.random(len(candidates))<density*.9
    candidates=candidates[keep];density=density[keep]
    order=rng.permutation(len(candidates));candidates=candidates[order][:512]
    h=sample(field,candidates);sx=sample(ex,candidates);sz=sample(dz,candidates)
    width=rng.uniform(35,70,len(candidates));height=rng.uniform(14,22,len(candidates))
    stands=np.column_stack((candidates[:,0],h,candidates[:,1],sx,sz,width,height,rng.random(len(candidates)))).astype('<f4')
    stand_offset=offset;buffers.append(stands.tobytes())
    header=dict(version=1,spanMetres=SPAN,gridSize=N,spacingMetres=STEP,heightScale=.1,heightBytes=heights.nbytes,densityBytes=N*N,levels=levels,standsOffset=stand_offset,stands=len(stands),centerLocalMetres=[28000,0],centerGeographic=[float(lon[N//2,N//2]),float(lat[N//2,N//2])],minimumMetres=float(field.min()),maximumMetres=float(field.max()),illustrativeVegetation=True)
    encoded=json.dumps(header,separators=(',',':')).encode();prefix=struct.pack('<I',len(encoded))+encoded+b' '*((-len(encoded))%4)
    output=prefix+b''.join(buffers);(OUT/'sample.bin').write_bytes(output)
    textures={name:dict(bytes=(OUT/name).stat().st_size,sha256=hashlib.sha256((OUT/name).read_bytes()).hexdigest()) for name in ['heights.png','albedo.webp']}
    metadata=dict(version=1,source=source['provider'],sourceHash=source['sha256'],sourceRequest=source['requestUrl'],sourceType=source['sourceType'],license=source['license'],file='sample.bin',bytes=len(output),sha256=hashlib.sha256(output).hexdigest(),textures=textures,header=header,sourceExtents=source['export']['extent'],note='40km real terrain sample only; vegetation is illustrative; flight terrain unchanged')
    (OUT/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8')
    assert len(output)<4*1024*1024 and header['maximumMetres']<3500
    print(json.dumps(dict(bytes=len(output),heightRange=[header['minimumMetres'],header['maximumMetres']],levels=levels,stands=len(stands))))


if __name__=='__main__':main()
