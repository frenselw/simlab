"""Pin an ETOPO derivative and build the explorer's bounded global height grid."""
from pathlib import Path
import argparse, gzip, hashlib, importlib.util, json
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt, gaussian_filter, map_coordinates

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
SOURCE=HERE/'sources/explorer-world-terrain'
OUT=ROOT/'sim/rocket-side-booster-lab/assets'
W,H=8193,4097
spec=importlib.util.spec_from_file_location('art',HERE/'generate.py')
art=importlib.util.module_from_spec(spec);spec.loader.exec_module(art)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path);args=parser.parse_args()
    SOURCE.mkdir(parents=True,exist_ok=True)
    if args.source:
        metadata=json.loads(args.source.with_name('download.json').read_text())
        with args.source.open('rb') as f:
            digest=hashlib.file_digest(f,'sha256').hexdigest()
        assert digest==metadata['sha256']
        Image.MAX_IMAGE_PIXELS=250000000 # The pinned NOAA raster has exactly 233,280,000 pixels.
        with Image.open(args.source) as image:
            assert image.mode=='F' and image.size==(21600,10800)
            keys=image.tag_v2[34735];keys={keys[i]:keys[i+3] for i in range(4,len(keys),4)}
            assert keys[2048]==4326 and keys[1025]==1
            small=np.asarray(image.resize((W-1,H-1),Image.Resampling.BILINEAR)).copy()
        assert np.isfinite(small).all() and small.min()>-12000 and small.max()<9000
        padded=np.column_stack((small[:,-1],small,small[:,0]))
        x,y=np.meshgrid(np.arange(W,dtype='f4')+.5,np.clip(np.arange(H,dtype='f4')-.5,0,H-2))
        heights=gaussian_filter(map_coordinates(padded,[y,x],order=1,mode='nearest'),.35,mode=['nearest','wrap'])
        del padded,small,x,y
        image=Image.new('L',(W,H));draw=ImageDraw.Draw(image);shapes=art.load_shapes('ne_50m_land')
        for outer in (True,False):
            for shape in shapes:
                for ring in shape:
                    area=np.sum(ring[:,0]*np.roll(ring[:,1],-1)-np.roll(ring[:,0],-1)*ring[:,1])/2
                    if (area<0)==outer:draw.polygon([((lon+180)/360*(W-1),(90-lat)/180*(H-1)) for lon,lat in ring],fill=255 if outer else 0)
        land=np.asarray(image)>127
        shore=distance_transform_edt(land);t=np.clip(shore/2,0,1);heights=np.maximum(0,heights)*(t*t*(3-2*t));heights[~land]=0
        packed=np.rint(heights).astype('<u2') | (land.astype('<u2')*32768)
        packed[:,-1]=packed[:,0];packed[0,:]=0;packed[-1,:]=int(np.median(packed[-1,:]))
        assert int((packed&32767).max())<9000
        Image.fromarray(packed).save(SOURCE/'height-land-8k.png',optimize=True)
        metadata.update(width=W,height=H,processing='Global point grid; bilinear area resampling, fixed 0.35-pixel filter, Natural Earth 50m coast; two-pixel coastal fade; sea and below-sea-level land at zero; 1m plus land bit.',derivativeSha256=hashlib.sha256((SOURCE/'height-land-8k.png').read_bytes()).hexdigest())
        (SOURCE/'source.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8')
    metadata=json.loads((SOURCE/'source.json').read_text())
    assert hashlib.sha256((SOURCE/'height-land-8k.png').read_bytes()).hexdigest()==metadata['derivativeSha256']
    grid=np.asarray(Image.open(SOURCE/'height-land-8k.png')).astype('<u2')
    assert grid.shape==(H,W) and np.array_equal(grid[:,0],grid[:,-1]) and np.ptp(grid[0])==np.ptp(grid[-1])==0
    encoded=grid.copy();encoded[:,1:]=np.subtract(grid[:,1:],grid[:,:-1],dtype='u2')
    assert np.array_equal(np.cumsum(encoded,axis=1,dtype='u8').astype('u2'),grid)
    blob=gzip.compress(encoded.tobytes(),compresslevel=9,mtime=0);assert len(blob)<25*1024*1024
    (OUT/'world-heights.bin.gz').write_bytes(blob)
    record=dict(width=W,height=H,codec='row-delta-u16-v1',file='assets/world-heights.bin.gz',bytes=len(blob),decodedBytes=grid.nbytes,decodedSha256=hashlib.sha256(grid.tobytes()).hexdigest(),sha256=hashlib.sha256(blob).hexdigest(),maxHeight=9000,maximumMetres=int((grid&32767).max()),source=metadata)
    (SOURCE/'runtime.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in record.items() if k!='source'}),flush=True)

if __name__=='__main__':main()
