"""Constrained coast triangulation using the installed SciPy, offline only."""
import json,sys
import numpy as np
from scipy.spatial import Delaunay
from scipy.ndimage import map_coordinates
from scipy.stats import qmc

def inside(points,ring):
    ring=np.asarray(ring);x,z=points[:,0],points[:,1];result=np.zeros(len(points),bool)
    for a,b in zip(ring,np.roll(ring,-1,axis=0)):
        if abs(b[1]-a[1])<1e-12:continue
        result^=((a[1]>z)!=(b[1]>z))&(x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])
    return result

def triangulate(requests):
    field=None
    if isinstance(requests,dict):
        field=np.asarray(requests['heights']);extent=requests['extent'];requests=requests['requests']
    def height(points):return map_coordinates(field,[(extent-points[:,1])/(2*extent)*(len(field)-1),(points[:,0]+extent)/(2*extent)*(len(field)-1)],order=1,mode='nearest')
    meshes=[]
    for request in requests:
        vertices=[];faces=[];box=request['box'];step=request['limit'];precision=request.get('precision',4)
        for rings in request['polygons']:
            boundary=[np.asarray(r,dtype=float) for r in rings]
            if field is not None:
                lower=np.array(box)[[0,2]];span=np.array(box)[[1,3]]-lower
                grid=qmc.PoissonDisk(2,radius=.11,seed=731).fill_space()*span+lower
                candidates=qmc.Sobol(2,scramble=True,seed=19).random_base2(13)*span+lower
                points=np.unique(np.vstack((np.vstack(boundary)[:,:2],grid,[[box[0],box[2]],[box[0],box[3]],[box[1],box[2]],[box[1],box[3]]])),axis=0)
                budget,tolerance={3000:(2200,25),6500:(900,70),14000:(380,180)}[step]
                for iteration in range(18):
                    tri=Delaunay(points);simplex=tri.find_simplex(candidates);assert np.all(simplex>=0)
                    bary=np.einsum('ijk,ik->ij',tri.transform[simplex,:2,:],candidates-tri.transform[simplex,2,:]);weights=np.column_stack((bary,1-bary.sum(axis=1)))
                    error=np.abs(np.sum(height(points)[tri.simplices[simplex]]*weights,axis=1)-height(candidates))
                    order=np.argsort(-error);_,first=np.unique(simplex[order],return_index=True);chosen=order[first];chosen=chosen[error[chosen]>tolerance];chosen=chosen[np.argsort(-error[chosen])][:max(0,min(300,budget-len(points)))]
                    if not len(chosen):break
                    points=np.vstack((points,candidates[chosen]))
                grid=points
            else:
                x=np.arange(box[0]+step/2,box[1],step);z=np.arange(box[2]+step/2,box[3],step)
                xx,zz=np.meshgrid(x,z);grid=np.column_stack((xx.ravel(),zz.ravel()))
            if request.get('localDense',True):
                x=np.arange(max(box[0]+500,-8000),min(box[1],8001),500);z=np.arange(max(box[2]+500,-8000),min(box[3],8001),500)
                xx,zz=np.meshgrid(x,z);grid=np.vstack((grid,np.column_stack((xx.ravel(),zz.ravel()))))
            if request.get('extra'):grid=np.vstack((grid,np.asarray(request['extra'])))
            valid=inside(grid,boundary[0])
            for ring in boundary[1:]:valid&=~inside(grid,ring)
            grid=grid[valid]
            points=np.vstack((np.vstack(boundary)[:,:2],grid));points=np.unique(np.round(points,precision),axis=0)
            if len(points)<3:continue
            for iteration in range(request.get('constraintIterations',12)):
                tri=Delaunay(points);edges=set()
                for t in tri.simplices:
                    for i in range(3):edges.add(tuple(sorted((int(t[i]),int(t[(i+1)%3])))))
                lookup={tuple(p):i for i,p in enumerate(points)};missing=[];new_boundary=[]
                for ring in boundary:
                    refined=[]
                    for a,b in zip(ring,np.roll(ring,-1,axis=0)):
                        refined.append(a)
                        ia=lookup[tuple(np.round(a[:2],precision))];ib=lookup[tuple(np.round(b[:2],precision))]
                        if ia!=ib and tuple(sorted((ia,ib))) not in edges:
                            q=(a+b)/2;refined.append(q);missing.append(q[:2])
                    new_boundary.append(np.asarray(refined))
                if not missing:break
                boundary=new_boundary;points=np.unique(np.round(np.vstack((points,missing)),precision),axis=0)
            else:raise AssertionError('Coast constraint recovery failed '+str(missing[:3]))
            centers=points[tri.simplices].mean(axis=1);keep=inside(centers,boundary[0])
            for ring in boundary[1:]:keep&=~inside(centers,ring)
            selected=points[tri.simplices[keep]]
            actual=np.abs(np.cross(selected[:,1]-selected[:,0],selected[:,2]-selected[:,0])).sum()/2
            def area(r):
                r=np.asarray(r)[:,:2];return abs(np.sum(r[:,0]*np.roll(r[:,1],-1)-np.roll(r[:,0],-1)*r[:,1]))/2
            expected=area(boundary[0])-sum(area(r) for r in boundary[1:])
            assert abs(actual-expected)<max(request.get('areaTolerance',1),expected*1e-7),'Coast topology must preserve land area'
            # Heights are sampled by the baker; shoreline vertices remain exactly at sea level.
            shore={tuple(np.round(p[:2],precision)):None if not np.isfinite(p[2]) else float(p[2]) for ring in boundary for p in ring}
            base=len(vertices);vertices.extend([[float(x),float(z),shore.get((x,z),None)] for x,z in points]);faces.extend((tri.simplices[keep]+base).tolist())
        meshes.append({'vertices':vertices,'faces':faces})
    return meshes


if __name__=='__main__':
    json.dump(triangulate(json.load(sys.stdin)),sys.stdout,separators=(',',':'))
