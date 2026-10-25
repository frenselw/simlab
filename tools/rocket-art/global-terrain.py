"""Bake illustrative globe land geometry; --prototype first, then the complete cells."""
from pathlib import Path
import argparse,hashlib,importlib.util,json,math,struct,time
import numpy as np
from PIL import Image,ImageDraw
from scipy.ndimage import distance_transform_edt,map_coordinates

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('rocket_art',HERE/'generate.py');art=importlib.util.module_from_spec(spec);spec.loader.exec_module(art)
spec=importlib.util.spec_from_file_location('terrain_tri',HERE/'triangulate-terrain.py');tri=importlib.util.module_from_spec(spec);spec.loader.exec_module(tri)
OUT=art.OUT/'global';BOUNDARY=.3;COAST_CUTS=set()
CHAINS=art.MOUNTAIN_CHAINS

def area(p):
    p=np.asarray(p);return np.sum(p[:,0]*np.roll(p[:,1],-1)-np.roll(p[:,0],-1)*p[:,1])/2

def clipped(ring,box):
    points=art.clip_ring(ring,*box)
    if len(points)<3:return []
    a=np.asarray(points);keep=np.r_[True,np.any(np.abs(np.diff(a,axis=0))>1e-8,axis=1)];a=a[keep]
    if len(a)>2 and np.linalg.norm(a[0]-a[-1])<1e-8:a=a[:-1]
    return a.tolist() if len(a)>=3 and abs(area(a))>1e-10 else []

def cell_polygons(groups,box):
    # Concave clipping can leave retraced cell-border bridges; node and cancel them.
    rings=[]
    for outer,inner,bounds in groups:
        if bounds[1]<box[0] or bounds[0]>box[1] or bounds[3]<box[2] or bounds[2]>box[3]:continue
        rings.extend(r for r in (clipped(p,box) for p in [outer]+inner) if r)
    cuts=[set() for _ in range(4)]
    def side(p,q):
        for j,(axis,b) in enumerate([(0,box[0]),(0,box[1]),(1,box[2]),(1,box[3])]):
            if abs(p[axis]-b)<1e-8 and abs(q[axis]-b)<1e-8:return j
        return -1
    for ring in rings:
        for p,q in zip(ring,ring[1:]+ring[:1]):
            j=side(p,q)
            if j>=0:cuts[j].update([round(p[1-j//2],8),round(q[1-j//2],8)])
    counts={}
    for ring in rings:
        for p,q in zip(ring,ring[1:]+ring[:1]):
            p=np.array(p);q=np.array(q);j=side(p,q);ts=[0.,1.]
            if j>=0:
                axis=1-j//2
                if abs(q[axis]-p[axis])<1e-12:continue
                ts.extend((v-p[axis])/(q[axis]-p[axis]) for v in cuts[j] if min(p[axis],q[axis])+1e-8<v<max(p[axis],q[axis])-1e-8)
            points=[tuple(np.round(p+(q-p)*t,8)) for t in sorted(ts)]
            for a,b in zip(points,points[1:]):
                if a==b:continue
                key=(min(a,b),max(a,b));counts[key]=counts.get(key,0)+(1 if a<b else -1)
    edges={(a,b) if n>0 else (b,a) for (a,b),n in counts.items() if n}
    outgoing={}
    for a,b in edges:outgoing.setdefault(a,set()).add(b)
    loops=[]
    while edges:
        start,nextp=next(iter(edges));ring=[start];a=start;b=nextp
        while True:
            edges.remove((a,b));outgoing[a].remove(b)
            if b==start:break
            ring.append(b);choices=outgoing.get(b,set())
            assert choices,('Closed geographic clip rings',box,b)
            if len(choices)==1:c=next(iter(choices))
            else:
                # Follow the clockwise land boundary at a touching coastal vertex.
                incoming=np.array(b)-a
                c=min(choices,key=lambda c:math.atan2(incoming[0]*(c[1]-b[1])-incoming[1]*(c[0]-b[0]),incoming@(np.array(c)-b)))
            a,b=b,c
        if len(ring)>=3 and abs(area(ring))>1e-9:loops.append(ring)
    outer=[r for r in loops if area(r)<0];holes=[r for r in loops if area(r)>0]
    return [(r,[h for h in holes if tri.inside(np.array(h[:1]),r)[0]]) for r in outer]


def simplify_open(a,tolerance):
    if len(a)<=2:return np.asarray(a).tolist()
    a=np.asarray(a);delta=a[-1]-a[0];t=np.clip(((a-a[0])@delta)/max(delta@delta,1e-20),0,1);d=np.linalg.norm(a-(a[0]+t[:,None]*delta),axis=1);i=int(np.argmax(d))
    if d[i]<=tolerance:return a[[0,-1]].tolist()
    return simplify_open(a[:i+1],tolerance)[:-1]+simplify_open(a[i:],tolerance)

def contour(ring,box,tolerance):
    a=np.asarray(ring);border=np.any(np.isclose(a[:,0,None],box[:2],atol=1e-8),axis=1)|np.any(np.isclose(a[:,1,None],box[2:],atol=1e-8),axis=1)
    pins=np.flatnonzero(border).tolist()
    if not pins:pins=[0,len(a)//2]
    elif len(pins)==1:pins.append((pins[0]+len(a)//2)%len(a));pins.sort()
    result=[]
    for i,start in enumerate(pins):
        end=pins[(i+1)%len(pins)];segment=a[start:end+1] if end>start else np.vstack((a[start:],a[:end+1]))
        reduced=simplify_open(segment,tolerance)
        for axis in (0,1):
            if abs(segment[0,axis]-segment[-1,axis])<1e-8 and any(abs(segment[0,axis]-b)<1e-8 for b in box[axis*2:axis*2+2]):
                distances=np.abs(segment[:,axis]-segment[0,axis]);peak=int(np.argmax(distances))
                if distances[peak]>1e-8 and len(reduced)==2:reduced=simplify_open(segment[:peak+1],tolerance)[:-1]+simplify_open(segment[peak:],tolerance)
        result.extend(reduced[:-1])
    if len(result)<3:return []
    out=[]
    for i,p in enumerate(result):
        q=result[(i+1)%len(result)];p=np.array(p);q=np.array(q);axis=-1
        for fixed in (0,1):
            if abs(p[fixed]-q[fixed])<1e-8 and any(abs(p[fixed]-b)<1e-8 for b in box[fixed*2:fixed*2+2]):axis=1-fixed;break
        ts=[0.]
        if axis>=0:
            lo,hi=sorted((p[axis],q[axis]))
            for n in range(math.ceil((lo+1e-8)/BOUNDARY),math.floor((hi-1e-8)/BOUNDARY)+1):ts.append((n*BOUNDARY-p[axis])/(q[axis]-p[axis]))
        else:
            count=max(1,math.ceil(np.linalg.norm(q-p)/max(.15,tolerance*2)))
            ts.extend(n/count for n in range(1,count))
        assert all(-1e-8<=t<=1+1e-8 for t in ts),(p,q,axis,min(ts),max(ts))
        for t in sorted(ts):
            v=p+(q-p)*t
            # Cell cuts carry sampled relief; actual coastline remains sea level.
            previous=np.array(result[i-1]);previous_border=any(abs(previous[k]-p[k])<1e-8 and any(abs(p[k]-b)<1e-8 for b in box[k*2:k*2+2]) for k in (0,1))
            out.append([round(float(v[0]),7),round(float(v[1]),7),None if axis>=0 and (t>0 or previous_border) else 0.])
    # The triangulator's coordinate key is four decimals; remove collapsed coastal edges.
    return [p for i,p in enumerate(out) if p[:2]!=out[i-1][:2]]

def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)

def vectors(lon,lat):
    lon,lat=np.radians(lon),np.radians(lat)
    v=np.column_stack((np.cos(lat)*np.cos(lon),np.sin(lat),np.cos(lat)*np.sin(lon)))
    return np.column_stack((v@art.EAST,v@art.UP,v@art.NORTH))

def field(points,shore):
    lon,lat=points.T;x,y,z=vectors(lon,lat).T
    n=art.noise(lon,lat,96);medium=art.noise(lon,lat,384)
    h=130+100*(n+.5)+140*(medium+.4);mount=np.zeros(len(lon))
    for chain,width in CHAINS:
        for a,b in zip(chain,chain[1:]):
            a=np.array(a);d=np.array(b)-a;t=np.clip(((points-a)@d)/(d@d),0,1);dist=np.linalg.norm(points-(a+t[:,None]*d),axis=1)
            mount=np.maximum(mount,np.exp(-(dist/width)**2)*(1800+950*np.sin((lon+lat)*.9)**2))
    h=np.clip(h+mount,15,3500)*smooth(0,30,shore)
    h*=np.where(y>0,smooth(240000,400000,np.maximum(np.abs(x),np.abs(z))*art.R),1)
    color=np.tile([.24,.37,.22],(len(lon),1));forest=np.clip(np.exp(-(lat/18)**2)*.65+np.exp(-((lat-58)/11)**2)*.5+medium*.15,0,.8)
    color=color*(1-forest[:,None])+np.array([.12,.28,.20])*forest[:,None]
    dry=np.zeros(len(lon))
    for cx,cy,sx,sy in [(14,23,31,10),(46,25,15,9),(82,43,24,10),(134,-25,19,10),(23,-23,10,9),(-112,36,15,10),(-68,-24,5,12)]:dry=np.maximum(dry,np.exp(-((lon-cx)/sx)**4-((lat-cy)/sy)**4))
    color=color*(1-dry[:,None]*.7)+np.array([.48,.43,.27])*dry[:,None]*.7
    cold=np.maximum(smooth(65,78,np.abs(lat)),smooth(1800,3400,h)*.7);color=color*(1-cold[:,None])+np.array([.76,.81,.72])*cold[:,None]
    beach=np.exp(-shore/8)*.4;color=color*(1-beach[:,None])+np.array([.50,.46,.30])*beach[:,None]
    color+=n[:,None]*.025
    return h,color

def build_mesh(polygons,box,limit,coast_tolerance,shore_field):
    rings=[]
    for outer,holes in polygons:
        o=contour(outer,box,coast_tolerance)
        if len(o)<3 or abs(area(o))<1e-12:o=contour(outer,box,0)
        if len(o)<3 or abs(area(o))<1e-12:continue
        hs=[contour(r,box,coast_tolerance) for r in holes];rings.append([o]+[r for r in hs if len(r)>=3])
    if not rings:return None
    try:mesh=tri.triangulate([{'box':box,'limit':limit,'localDense':False,'areaTolerance':.00002,'precision':7,'constraintIterations':18,'polygons':rings}])[0]
    except AssertionError:
        if coast_tolerance<.000001:raise
        return build_mesh(polygons,box,limit,coast_tolerance/4,shore_field)
    if not mesh['faces']:return None
    used=sorted({i for face in mesh['faces'] for i in face});remap={old:new for new,old in enumerate(used)};mesh['vertices']=[mesh['vertices'][i] for i in used];mesh['faces']=[[remap[i] for i in face] for face in mesh['faces']]
    v=np.array([[p[0],p[1]] for p in mesh['vertices']]);shore=map_coordinates(shore_field,[(90-v[:,1])*10,(v[:,0]+180)*10],order=1,mode='nearest')
    h,color=field(v,shore);oncoast=np.array([p[2]==0 for p in mesh['vertices']]);border=np.any(np.isclose(v[:,0,None],box[:2],atol=1e-7,rtol=0),axis=1)|np.any(np.isclose(v[:,1,None],box[2:],atol=1e-7,rtol=0),axis=1)
    h[oncoast&~border]=0;h[np.array([tuple(np.round(q,4)) in COAST_CUTS for q in v])]=0
    # Shared global field and canonical boundary points make every cell seam identical.
    unit=vectors(v[:,0],v[:,1]);positions=(unit*(1+h[:,None]/art.R)).astype('<f4')
    # Bake broad local slope lighting with deterministic neighbouring height samples.
    delta=.015
    neighbors=[]
    for axis in (0,1):
        samples=[]
        for sign in (-1,1):
            q=v.copy();q[:,axis]+=delta*sign;s=map_coordinates(shore_field,[(90-q[:,1])*10,(q[:,0]+180)*10],order=1,mode='nearest');samples.append(field(q,s)[0])
        neighbors.append((samples[1]-samples[0])/(2*delta*111200*(np.maximum(.1,np.cos(np.radians(v[:,1]))) if axis==0 else 1)))
    shade=np.clip(.82-neighbors[0]*8-neighbors[1]*6,.58,1.12);color=np.clip((color+art.noise(v[:,0],v[:,1],384)[:,None]*.03)*shade[:,None],0,1)
    colors=np.column_stack((np.rint(color*255).astype('u1'),np.full(len(v),255,'u1')))
    faces=np.array(mesh['faces'],dtype='<u4');p=positions[faces].astype(float);orientation=np.einsum('ij,ij->i',np.cross(p[:,1]-p[:,0],p[:,2]-p[:,0]),p.mean(axis=1));flip=orientation<0;faces[flip]=faces[flip][:,[0,2,1]]
    assert np.isfinite(positions).all() and np.max(h)<=3500 and np.min(h)>=0
    assert faces.max()<len(v) and np.all(np.abs(orientation)>1e-16),'Nondegenerate outward globe triangles'
    border=(np.isclose(v[:,0],box[0],rtol=0,atol=1e-7)|np.isclose(v[:,0],box[1],rtol=0,atol=1e-7)|np.isclose(v[:,1],box[2],rtol=0,atol=1e-7)|np.isclose(v[:,1],box[3],rtol=0,atol=1e-7))
    seam={tuple(q):tuple(pos) for q,pos in zip(v[border],positions[border])}
    return positions,colors,faces.reshape(-1),seam

def harmonize(mesh,all_seams):
    positions,colors,flat,seam=mesh
    if not seam:return mesh
    low=np.min(list(seam),axis=0);high=np.max(list(seam),axis=0)
    positions=list(positions);colors=list(colors);faces=flat.reshape(-1,3).tolist()
    position_coordinate={p:q for q,p in seam.items()};index_coordinate={i:position_coordinate[tuple(p)] for i,p in enumerate(positions) if tuple(p) in position_coordinate}
    for q,position in all_seams.items():
        if q in seam or not(low[0]<=q[0]<=high[0] and low[1]<=q[1]<=high[1]):continue
        found=None
        for f,face in enumerate(faces):
            for k in range(3):
                a,b=face[k],face[(k+1)%3]
                if a not in index_coordinate or b not in index_coordinate:continue
                x,y=index_coordinate[a],index_coordinate[b]
                axis=1 if x[0]==y[0]==q[0] else 0 if x[1]==y[1]==q[1] else -1
                if axis>=0 and min(x[axis],y[axis])+1e-8<q[axis]<max(x[axis],y[axis])-1e-8:found=(f,k,a,b,axis);break
            if found:break
        if found:
            f,k,a,b,axis=found;index=len(positions);positions.append(np.array(position,dtype='<f4'));t=(q[axis]-index_coordinate[a][axis])/(index_coordinate[b][axis]-index_coordinate[a][axis]);colors.append(np.rint(np.array(colors[a])*(1-t)+np.array(colors[b])*t).astype('u1'));c=faces[f][(k+2)%3];faces[f]=[a,index,c];faces.append([index,b,c]);seam[q]=position;index_coordinate[index]=q
    return np.array(positions,dtype='<f4'),np.array(colors,dtype='u1'),np.array(faces,dtype='<u4').reshape(-1),seam


def write_binary(path,cells,meshes,prototype):
    positions=[];colors=[];indices=[];base=0;index_count=0;output_cells=[]
    for cell,mesh in zip(cells,meshes):
        if mesh is None:continue
        p,c,i,_=mesh;metadata=dict(cell,firstIndex=index_count,indexCount=len(i));output_cells.append(metadata);positions.append(p);colors.append(c);indices.append(i+base);base+=len(p);index_count+=len(i)
    header={'version':1,'prototype':prototype,'vertexCount':base,'indexCount':index_count,'cells':output_cells,'radiusMetres':art.R,'maxReliefMetres':3500,'illustrative':True}
    data=json.dumps(header,separators=(',',':')).encode();prefix=struct.pack('<I',len(data))+data+b' '*((-len(data))%4)
    path.write_bytes(prefix+b''.join(p.tobytes() for p in positions)+b''.join(c.tobytes() for c in colors)+b''.join(i.astype('<u4').tobytes() for i in indices))
    return dict(file='global/'+path.name,bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),vertices=base,triangles=index_count//3,cells=len(output_cells))

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--prototype',action='store_true');args=parser.parse_args();start=time.monotonic();OUT.mkdir(exist_ok=True)
    shapes=art.load_shapes('ne_50m_land');outers=[];holes=[]
    for shape in shapes:
        for ring in shape:
            for a,b in zip(ring,ring[1:]):
                for axis in (0,1):
                    if abs(b[axis]-a[axis])<1e-12:continue
                    lo,hi=sorted((a[axis],b[axis]))
                    for border_value in range(math.ceil(lo/10)*10,math.floor(hi/10)*10+1,10):
                        t=(border_value-a[axis])/(b[axis]-a[axis]);COAST_CUTS.add(tuple(np.round(a+(b-a)*t,4)))
    for shape in shapes:
        for r in shape:
            r=r[:-1] if np.linalg.norm(r[0]-r[-1])<1e-8 else r
            (outers if area(r)<0 else holes).append(r)
    # Raster distance is offline only, and provides a single smooth field across all cells.
    image=Image.new('L',(3601,1801));draw=ImageDraw.Draw(image)
    for r in outers:draw.polygon([((x+180)*10,(90-y)*10) for x,y in r],fill=255)
    for r in holes:draw.polygon([((x+180)*10,(90-y)*10) for x,y in r],fill=0)
    shore=distance_transform_edt(np.asarray(image)>127)*11.12
    groups=[]
    for outer in outers:
        box=[outer[:,0].min(),outer[:,0].max(),outer[:,1].min(),outer[:,1].max()];groups.append((outer,[r for r in holes if box[0]<=r[0,0]<=box[1] and box[2]<=r[0,1]<=box[3] and tri.inside(r[:1],outer)[0]],box))
    cells=[];coarse=[];fine_records=[];fine_meshes=[];fine_cells=[];seams={};fine_count=0
    for row in range(18):
        for col in range(36):
            box=[-180+col*10,-170+col*10,-90+row*10,-80+row*10];polygons=cell_polygons(groups,box)
            if not polygons:continue
            center=vectors(np.array([(box[0]+box[1])/2]),np.array([(box[2]+box[3])/2]))[0];corners=vectors(np.array([box[0],box[1],box[1],box[0]]),np.array([box[2],box[2],box[3],box[3]]));radius=float(np.arccos(np.clip(corners@center,-1,1)).max())
            cell={'id':f'{col}-{row}','bounds':box,'center':center.tolist(),'angularRadius':radius,'file':f'cell-{col}-{row}.bin' if not args.prototype or (col==6 and row==12) else None}
            try:mesh=build_mesh(polygons,box,3.,.12,shore)
            except Exception as e:raise RuntimeError(f'Coarse {cell["id"]}: {e}') from e
            if mesh is None:continue
            for k,v in mesh[3].items():
                if k in seams:assert seams[k]==v,('Cell seam',k,seams[k],v)
                seams[k]=v
            cells.append(cell);coarse.append(mesh)
            if not args.prototype or (col==6 and row==12):
                try:fine=build_mesh(polygons,box,.2,.015,shore)
                except Exception as e:raise RuntimeError(f'Fine {cell["id"]}: {e}') from e
                # Boundary recovery is required to retain exactly the same cuts across LODs.
                fine_meshes.append(fine);fine_cells.append(cell);fine_count+=1
        print(f'Latitude row {row+1}/18: {len(cells)} land cells; {sum(len(m[0]) for m in coarse)} coarse vertices',flush=True)
    write_binary(OUT/'coarse.bin',cells,coarse,True)
    all_seams=dict(seams)
    for mesh in fine_meshes:
        for q,p in mesh[3].items():
            if q in all_seams:assert all_seams[q]==p,('Coarse/fine shared relief',q)
            all_seams[q]=p
    coarse=[harmonize(m,all_seams) for m in coarse]
    fine_meshes=[harmonize(m,all_seams) for m in fine_meshes]
    by_id={c['id']:m for c,m in zip(cells,coarse)}
    for cell,fine in zip(fine_cells,fine_meshes):
        assert by_id[cell['id']][3]==fine[3],('LOD border topology/relief',cell['id'],set(by_id[cell['id']][3])-set(fine[3]),set(fine[3])-set(by_id[cell['id']][3]))
        assert len(fine[2])//3<15000,('Fine tile triangle budget',cell['id'])
        fine_records.append(write_binary(OUT/cell['file'],[dict(cell,file=None)],[fine],args.prototype))
    coarse_record=write_binary(OUT/'coarse.bin',cells,coarse,args.prototype);records=[coarse_record]+fine_records
    assert coarse_record['vertices']<200000 and coarse_record['triangles']<100000,'Coarse budget'
    assert sum(r['bytes'] for r in records)<28000000,'Download budget'
    metadata={'version':1,'prototype':args.prototype,'directory':'global','coarse':'global/coarse.bin','cellDegrees':10,'boundaryStepDegrees':BOUNDARY,'fineStepDegrees':.2,'fineCells':fine_count,'landCells':len(cells),'maxReliefMetres':3500,'illustrative':True,'bytes':sum(r['bytes'] for r in records),'vertices':sum(r['vertices'] for r in records),'triangles':sum(r['triangles'] for r in records),'files':records,'seconds':round(time.monotonic()-start,2),'source':{'file':'ne_50m_land.zip','sha256':hashlib.sha256((art.SOURCE/'ne_50m_land.zip').read_bytes()).hexdigest()}}
    output=art.ROOT/'output/rocket/global-metadata.json';output.parent.mkdir(exist_ok=True,parents=True);output.write_text(json.dumps(metadata,separators=(',',':'))+'\n');print(json.dumps({k:v for k,v in metadata.items() if k!='files'}),flush=True)

if __name__=='__main__':main()
