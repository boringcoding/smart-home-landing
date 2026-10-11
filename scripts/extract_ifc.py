#!/usr/bin/env python3
"""Read-only, serial IFC2X3 tessellation with openings; Python 3.13 + IfcOpenShell 0.9.0.
Usage: python extract_ifc.py SOURCE.ifc --output assets/ifc-geometry.json.gz
No source IFC data is modified. Origin/units and every source GUID are retained.
"""
import argparse, collections, gzip, hashlib, json, pathlib, platform, time
import ifcopenshell
import ifcopenshell.geom
import ifcopenshell.util.element
import ifcopenshell.util.unit

CENTER=[8.29217,-3.72727,0.0]
FACADE_PROXIES={'2D5BbWvjPEau_itFOOQ9x9':'west','2nc5hhqqn68924vVLi3j15':'north','0mclhuryX3qPYq9SOkz5mZ':'east','1$GYiiH852XxGiiSIx$$db':'south'}
WALL_FACADES={'3eMDnMx_z0gBrL2RMj3RjT':'west','2egOLontD1PgChqtxVWyWB':'east','3J5ZgD1jn26RvbFd$RsMKr':'south','1DDq5AE454Xu_X4ILzKp00':'north'}
def main():
 ap=argparse.ArgumentParser();ap.add_argument('source');ap.add_argument('--output',default='assets/ifc-geometry.json.gz');a=ap.parse_args()
 source=pathlib.Path(a.source).resolve();out=pathlib.Path(a.output).resolve();out.parent.mkdir(parents=True,exist_ok=True)
 sha=hashlib.sha256(source.read_bytes()).hexdigest();f=ifcopenshell.open(str(source));start=time.time()
 settings=ifcopenshell.geom.settings();settings.set(settings.USE_WORLD_COORDS,True);settings.set(settings.WELD_VERTICES,True)
 settings.set('mesher-linear-deflection',0.002);settings.set('mesher-angular-deflection',0.25)
 parents={}
 for rel in f.by_type('IfcRelAggregates'):
  for child in rel.RelatedObjects:parents[child.id()]=rel.RelatingObject
 def ancestors(p):
  seen=set()
  while p.id() not in seen:
   seen.add(p.id());yield p
   if p.id() not in parents:break
   p=parents[p.id()]
 def room_at(x,y):
  if y>-3.25:return 'bedroom_west' if x<8.3 else 'bedroom_east'
  if x<6.9:return 'bathroom' if y>-5.4 else 'entry'
  return 'living'
 products=[p for p in f.by_type('IfcProduct') if p.Representation and not p.is_a('IfcOpeningElement') and not p.is_a('IfcSite')]
 records=[];errors=[];axis_only=[]
 for n,p in enumerate(products):
  reps=[r.RepresentationIdentifier for r in p.Representation.Representations]
  if all(r in ('Axis','FootPrint') for r in reps):axis_only.append({'guid':p.GlobalId,'name':p.Name,'type':p.is_a()});continue
  try:sh=ifcopenshell.geom.create_shape(settings,p)
  except Exception as e:errors.append({'guid':p.GlobalId,'error':str(e)});continue
  g=sh.geometry;v=list(g.verts);fa=list(g.faces)
  if not fa:continue
  lo=[min(v[i::3]) for i in range(3)];hi=[max(v[i::3]) for i in range(3)];c=[(lo[i]+hi[i])/2 for i in range(3)]
  aa=list(ancestors(p));topwall=next((q for q in aa if q.is_a('IfcWall')),None);roof=any(q.is_a('IfcRoof') for q in aa)
  facade=None
  if p.GlobalId in FACADE_PROXIES:category='wall';facade=FACADE_PROXIES[p.GlobalId]
  elif roof:category='roof'
  elif topwall:category='wall';facade=WALL_FACADES.get(topwall.GlobalId,'interior')
  elif (p.Name or '')=='Дух.Ш' and (c[0]<4 or c[0]>12.6):category='roof'
  elif p.is_a('IfcSlab'):category='floor'
  elif p.is_a('IfcWindow'):category='window'
  elif p.is_a('IfcDoor'):category='door'
  elif hi[2]<0 or ('Ростверк' in (p.Name or '')):category='foundation'
  elif lo[2]>2.1 or p.is_a('IfcBeam') or (p.is_a('IfcColumn') and hi[2]>2):category='roof'
  else:category='furniture'
  if category in ('window','door'):
   if c[1]<-6.75:facade='south'
   elif c[0]>12:facade='east'
   elif c[0]<4.6:facade='west'
   else:facade='interior'
  mats=[]
  for m in g.materials:
   mats.append({'name':m.name,'color':[m.diffuse.r(),m.diffuse.g(),m.diffuse.b()],'transparency':float(m.transparency)})
  records.append({'guid':p.GlobalId,'stepId':p.id(),'name':p.Name or '', 'type':p.is_a(),'category':category,'facade':facade,'room':room_at(c[0],c[1]),'bounds':[lo,hi],'verts':v,'faces':fa,'materials':mats,'material_ids':list(g.material_ids)})
  if n%40==0:print(f'{n}/{len(products)} | {p.is_a()} {p.Name} | {len(fa)//3} triangles',flush=True)
 units=ifcopenshell.util.unit.calculate_unit_scale(f)
 data={'schemaVersion':'1.0','source':source.name,'sourceSha256':sha,'sourceCenter':CENTER,'coordinateContract':'IFC world metres; Blender=(x-8.29217,y+3.72727,z); glTF=(x-8.29217,z,-y-3.72727). No reflection or model scale change.','unitScaleToMetres':units,'products':records}
 with gzip.open(out,'wt',encoding='utf-8') as w:json.dump(data,w,separators=(',',':'),ensure_ascii=False)
 storeys=[]
 for s in f.by_type('IfcBuildingStorey'):
  elements=[q for r in s.ContainsElements for q in r.RelatedElements]
  storeys.append({'guid':s.GlobalId,'label':s.Name,'elevationM':s.Elevation*units,'directProducts':len(elements),'types':dict(collections.Counter(q.is_a() for q in elements))})
 audit={'source':source.name,'sha256':sha,'ifcSchema':f.schema,'software':{'python':platform.python_version(),'ifcopenshell':ifcopenshell.version},'unitScaleToMetres':units,'sourceTextureReferences':len(f.by_type('IfcSurfaceTexture')),'sourceSpaces':len(f.by_type('IfcSpace')),'storeys':storeys,'productsByType':dict(collections.Counter(p.is_a() for p in f.by_type('IfcProduct'))),'meshedProducts':len(records),'triangles':sum(len(p['faces'])//3 for p in records),'axisOnlyContainers':axis_only,'errors':errors,'elapsedSeconds':round(time.time()-start,2),'geometryArchive':str(out.name),'route':'IFC → IfcOpenShell 0.9.0 triangulation with openings → editable Blender → GLB','excludedFromVisualExport':['IfcSite terrain (separate source terrain extending to y=-31.98 m)','IfcOpeningElement void solids (openings are already applied)','axis-only aggregation containers (all solid child parts preserved)'],'limitations':['No PLN/PLA, plans, photographs, room schedule, equipment bill or existing website provided.','Room names are inferred from walls and existing furnishings; no IfcSpace in source.','Second storey label at 3 m represents upper/roof elements, not proof of a second occupied floor.','Added controls, fixtures, radiator, sensors, pipe and valve are design proposals, not as-built engineering.','All original geometry is preserved in the editable master except separate site/voids; web static meshes are joined by material and visibility category.']}
 from prepare_roof_profiles import prepare
 prepare(out)
 from prepare_interior_geometry import prepare as prepare_interior
 prepare_interior(out)
 audit_path=out.parents[1]/'docs'/'audit.json';audit_path.parent.mkdir(exist_ok=True);audit_path.write_text(json.dumps(audit,ensure_ascii=False,indent=2))
 print(json.dumps({k:audit[k] for k in ['meshedProducts','triangles','elapsedSeconds','errors']},ensure_ascii=False),flush=True)
if __name__=='__main__':main()
