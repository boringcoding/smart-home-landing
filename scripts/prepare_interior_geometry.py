"""Prepare vertical 140 mm lining boards from exact projected IFC layers.
The 2 mm grooves are real gaps between 20 mm boards, with original openings kept.
Source IFC/archive remains unchanged. Run with the pinned Python 3.13 environment.
"""
import gzip,json,math,pathlib,sys
from shapely.geometry import Polygon,box
from shapely import union_all,set_precision,constrained_delaunay_triangles

def prepare(archive):
 archive=pathlib.Path(archive);data=json.load(gzip.open(archive,'rt'));center=data['sourceCenter'];results=[]
 for p in data['products']:
  if p['type']!='IfcBuildingElementPart' or p['name']!='Вагонка':continue
  lo,hi=p['bounds'];depth_axis=0 if hi[0]-lo[0]<hi[1]-lo[1] else 1;uaxis=1-depth_axis
  vs=[p['verts'][i:i+3] for i in range(0,len(p['verts']),3)];triangles=[]
  for i in range(0,len(p['faces']),3):
   tri=Polygon([(vs[j][uaxis],vs[j][2]) for j in p['faces'][i:i+3]])
   if tri.area>1e-10:triangles.append(set_precision(tri,1e-6))
  shape=union_all(triangles)
  # Reuse the existing 15-degree roof underside, avoiding the source CSG blades.
  if uaxis==0:
   ridge=8.292172;peak=3.52983503;slope=math.tan(math.radians(15))
   shape=shape.intersection(Polygon([(2,-2),(15,-2),(15,peak-slope*(15-ridge)),(ridge,peak),(2,peak-slope*(ridge-2))]))
  else:
   maxz=3.52983503-math.tan(math.radians(15))*max(abs(lo[0]-8.292172),abs(hi[0]-8.292172))
   shape=shape.intersection(box(-20,-2,20,maxz))
  verts=[];faces=[];index={};boards=0
  def idx(u,z,side):
   key=(round(u,6),round(z,6),side)
   if key not in index:
    co=[0,0,z];co[uaxis]=u-center[uaxis];co[depth_axis]=(hi if side else lo)[depth_axis]-center[depth_axis]
    index[key]=len(verts);verts.append(co)
   return index[key]
  start=math.floor(lo[uaxis]/.14)
  for n in range(start,math.ceil(hi[uaxis]/.14)):
   strip=shape.intersection(box(n*.14+.001,-2,(n+1)*.14-.001,5))
   if strip.is_empty:continue
   polygons=list(strip.geoms) if strip.geom_type in ('MultiPolygon','GeometryCollection') else [strip]
   for polygon in polygons:
    if polygon.geom_type!='Polygon' or polygon.area<1e-8:continue
    boards+=1
    for tri in constrained_delaunay_triangles(polygon).geoms:
     ring=list(tri.exterior.coords)[:-1]
     for side in [0,1]:faces.append([idx(u,z,side) for u,z in (ring if side else ring[::-1])])
    for ring in [polygon.exterior,*polygon.interiors]:
     pts=list(ring.coords)
     for (u0,z0),(u1,z1) in zip(pts,pts[1:]):faces.append([idx(u0,z0,0),idx(u1,z1,0),idx(u1,z1,1),idx(u0,z0,1)])
  results.append({'guid':p['guid'],'vertices':verts,'faces':faces,'boardSegments':boards,'pitchM':.14,'grooveM':.002,'originalThicknessM':hi[depth_axis]-lo[depth_axis],'planeAxis':depth_axis,'sourceProjectedAreaM2':shape.area})
 result={'sourceSha256':data['sourceSha256'],'method':'Exact projected source triangle union with openings, roof-envelope limit, 140 mm vertical strips with real 2 mm grooves, extrusion to original layer thickness','layers':results}
 path=archive.parent/'interior-lining-geometry.json';path.write_text(json.dumps(result,separators=(',',':')));print('Prepared lining layers',len(results),'board pieces',sum(p['boardSegments'] for p in results),'vertices',sum(len(p['vertices']) for p in results));return path
if __name__=='__main__':prepare(sys.argv[1])
