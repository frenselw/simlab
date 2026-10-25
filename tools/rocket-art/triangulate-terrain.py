"""Constrained coast triangulation using the installed SciPy, offline only."""
import json,sys
import numpy as np
from scipy.spatial import Delaunay

def inside(points,ring):
    ring=np.asarray(ring);x,z=points[:,0],points[:,1];result=np.zeros(len(points),bool)
    for a,b in zip(ring,np.roll(ring,-1,axis=0)):
        if abs(b[1]-a[1])<1e-12:continue
        result^=((a[1]>z)!=(b[1]>z))&(x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])
    return result

def triangulate(requests):
    meshes=[]
    for request in requests:
        vertices=[];faces=[];box=request['box'];step=request['limit'];precision=request.get('precision',4)
        for rings in request['polygons']:
            boundary=[np.asarray(r,dtype=float) for r in rings]
            x=np.arange(box[0]+step/2,box[1],step);z=np.arange(box[2]+step/2,box[3],step)
            xx,zz=np.meshgrid(x,z);grid=np.column_stack((xx.ravel(),zz.ravel()))
            if request.get('localDense',True):
                x=np.arange(max(box[0]+500,-8000),min(box[1],8001),500);z=np.arange(max(box[2]+500,-8000),min(box[3],8001),500)
                xx,zz=np.meshgrid(x,z);grid=np.vstack((grid,np.column_stack((xx.ravel(),zz.ravel()))))
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
