"""Exact planar silhouette repair for two IFC layers with self-overlapping triangles.
Uses only source triangle coverage, clips it to the existing roof planes, preserves
holes, and triangulates a watertight thin extrusion; tolerance is one micrometre.
Called by extract_ifc.py, or python prepare_roof_profiles.py assets/ifc-geometry.json.gz.
"""
import gzip,json,math,pathlib,sys
from shapely.geometry import Polygon
from shapely import union_all,set_precision,constrained_delaunay_triangles
TARGETS={'0gv6PjQXoDfwbH4JDoU1x0','0gJejn2IvM$B2ENjGqnIAU'}
def prepare(archive):
 archive=pathlib.Path(archive);data=json.load(gzip.open(archive,'rt'));ridge=8.292172;peak=3.52983503;slope=math.tan(math.radians(15));center=data['sourceCenter'];out=[]
 roof=Polygon([(2,-2),(15,-2),(15,peak-slope*(15-ridge)),(ridge,peak),(2,peak-slope*(ridge-2))])
 for p in data['products']:
  if p['guid'] not in TARGETS:continue
  verts=[p['verts'][i:i+3] for i in range(0,len(p['verts']),3)];triangles=[]
  for i in range(0,len(p['faces']),3):
   tri=Polygon([(verts[j][0],verts[j][2]) for j in p['faces'][i:i+3]])
   if tri.area>1e-10:triangles.append(set_precision(tri,1e-6))
  original=union_all(triangles);shape=set_precision(original.intersection(roof),1e-6)
  assert shape.is_valid and not shape.is_empty
  polygons=list(shape.geoms) if shape.geom_type=='MultiPolygon' else [shape]
  y0,y1=p['bounds'][0][1],p['bounds'][1][1];meshverts=[];faces=[];index={}
  def idx(x,z,side):
   key=(round(x,6),round(z,6),side)
   if key not in index:index[key]=len(meshverts);meshverts.append([x-center[0],(y1 if side else y0)-center[1],z])
   return index[key]
  captris=0
  for polygon in polygons:
   for tri in constrained_delaunay_triangles(polygon).geoms:
    ring=list(tri.exterior.coords)[:-1]
    faces.extend([[idx(x,z,side) for x,z in (ring if side else ring[::-1])] for side in [0,1]]);captris+=2
   for ring in [polygon.exterior,*polygon.interiors]:
    pts=list(ring.coords)
    for (x0,z0),(x1,z1) in zip(pts,pts[1:]):faces.append([idx(x0,z0,0),idx(x1,z1,0),idx(x1,z1,1),idx(x0,z0,1)])
  out.append({'guid':p['guid'],'vertices':meshverts,'faces':faces,'sourceProjectedAreaM2':original.area,'clippedProjectedAreaM2':shape.area,'retainedHoleCount':sum(len(p.interiors) for p in polygons),'toleranceM':1e-6,'reason':'Two IFC source CSG layers have overlapping/nonmanifold faces. Rebuilt only their exact projected triangle coverage clipped to the same roof planes, preserving contour holes, extruded to their original layer thickness.','capTriangles':captris})
 path=archive.parent/'roof-profile-repairs.json';path.write_text(json.dumps({'sourceSha256':data['sourceSha256'],'profiles':out},ensure_ascii=False,indent=2));print('Planar source profiles',[(x['guid'],len(x['vertices']),len(x['faces']),x['retainedHoleCount']) for x in out]);return path
if __name__=='__main__':prepare(sys.argv[1])
