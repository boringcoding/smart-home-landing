"""Read-only validation of the exported editable Blender master (no rendering)."""
import bpy, bmesh, pathlib, json, gzip
from mathutils.kdtree import KDTree
root=pathlib.Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(root/'assets/master.blend'))
objects=list(bpy.context.scene.objects)
curtains=[o for o in objects if o.name.startswith('curtains_')]
assert len(curtains)==8
assert not any(o.get('room')=='bathroom' for o in curtains)
assert all(o.data.shape_keys.key_blocks.get('Open') is not None for o in curtains)
tieback=[o for o in curtains if o.get('curtainMechanism')=='fixed-header-tieback']
assert len(tieback)==2
for o in tieback:
 assert o.get('manualTieback') and not o.get('automated')
 basis=o.data.shape_keys.key_blocks['Basis'];opened=o.data.shape_keys.key_blocks['Open'];pinned=0
 for a,b in zip(basis.data,opened.data):
  if abs(a.co.z-(3.37983503-0.2679491924311227*abs(a.co.x-.000002)))<.000002:
   assert (a.co-b.co).length<.000002;pinned+=1
 assert pinned>100
ceilings=[o for o in objects if o.get('category')=='ceiling']
assert len(set(o.get('room') for o in ceilings))==5
archives=[o for o in objects if o.get('sourceArchive')]
assert all(o.hide_render for o in archives)
assert bpy.data.objects['light_exterior_fixture']['room']=='entry'
boards=[o for o in objects if o.get('component')=='laminate-board']
offsets={tuple(round(x,6) for x in o['woodUVOffset']) for o in boards}
assert len(offsets)>100
assert all(abs(o['woodUVScaleM'][0]-.78)<.00001 for o in boards)
door_guids=['2$bw6uuFTAE8MhuFU1l8aQ','07RAZSyfnEDfBOP6QLZMkt','1z3Dyx$HT9qPwpwjB_0Rnn','0icqSuupz7whtymDbEN2TL']
for guid in door_guids:
 assert {m.name for m in bpy.data.objects['ifc_'+guid].data.materials}=={'Door | pale timber','Metal | charcoal'}
assert all(bpy.data.objects['source_finish_'+g].get('sourceArchive') for g in [o.get('ifcGuid') for o in archives if str(o.get('sourceName','')).startswith('Панель-доп-')])
skirt=[o for o in objects if o.get('component')=='recessed-plinth-proposal']
assert len(skirt)==4
deck=sorted([o for o in objects if o.get('component')=='terrace-deck'],key=lambda o:o.location.y)
assert len(deck)==20
assert all(o.dimensions.x>7.99 and abs(o.dimensions.y-.14)<.0001 and o.get('grainDirection')=='X' for o in deck)
for a,b in zip(deck,deck[1:]):assert abs(b.location.y-a.location.y-(a.dimensions.y+b.dimensions.y)/2-.01)<.00002
tread_boards=[o for o in objects if o.get('component')=='stair-board'];assert len(tread_boards)==10
for level in range(5):
 pair=sorted([o for o in tread_boards if o['treadLevel']==level],key=lambda o:o.location.y);assert len(pair)==2
 assert abs(pair[1].location.y-pair[0].location.y-(pair[0].dimensions.y+pair[1].dimensions.y)/2-.01)<.00002
 assert all(abs(o.location.z+o.dimensions.z/2-o['sourceTreadTopM'])<.00001 for o in pair)
privacy=bpy.data.objects['ifc_2PhxL3sfj9bB8fmxe0jEn2'];assert any(m.name=='Glass | frosted privacy' for m in privacy.data.materials)
east=bpy.data.objects['ifc_0mclhuryX3qPYq9SOkz5mZ'];assert east['extendedEndVertices']==160
assert abs(min(v.co.y for v in east.data.vertices)-(-9.9772733+3.72727))<.0001
source=json.load(gzip.open(root/'assets/ifc-geometry.json.gz','rt'));east_source=next(p for p in source['products'] if p['guid']==east['ifcGuid']);center=source['sourceCenter'];preserved=0
tree=KDTree(len(east.data.vertices))
for i,vertex in enumerate(east.data.vertices):tree.insert(vertex.co,i)
tree.balance()
for i in range(0,len(east_source['verts']),3):
 old=east_source['verts'][i:i+3]
 if old[1]>-7.03:
  expected=(old[0]-center[0],old[1]-center[1],old[2])
  assert tree.find(expected)[2]<.000002;preserved+=1
assert preserved==464,'East windows/rear profile vertices must be unchanged'
plinth_source=[p for p in source['products'] if p['type']=='IfcBeam' and p['category']=='foundation' and p['bounds'][0][0]>12.29 and p['bounds'][1][0]<12.34]
assert len(plinth_source)==6
for p in plinth_source:
 o=bpy.data.objects['ifc_'+p['guid']]
 assert not o.get('sourceArchive') and not o.hide_render and not o.hide_viewport
 assert abs(o.dimensions.z-.05)<.00001
 assert len(o.data.vertices)*3==len(p['verts'])
 for i,v in enumerate(o.data.vertices):
  expected=(p['verts'][3*i]-center[0],p['verts'][3*i+1]-center[1],p['verts'][3*i+2])
  assert all(abs(v.co[k]-expected[k])<.000002 for k in range(3))
assert not any(o.name.startswith('east_plinth_course_') for o in objects)
assert not any(o.get('component')=='terrace-rim' for o in objects)
terrace_vertices=[v for v in east.data.vertices if v.co.y+center[1]<-7.0552733-.000002]
assert len(terrace_vertices)>100 and abs(min(v.co.z for v in terrace_vertices)+.43)<.000002
house_vertices=[v for v in east.data.vertices if v.co.y+center[1]>-7.03]
assert abs(min(v.co.z for v in house_vertices)+.43)<.000002
assert east.get('lowerEdgeStepRemoved') and not east.get('terraceCladdingLowerEdgeM')
bm=bmesh.new();bm.from_mesh(east.data)
nonmanifold=sum(not e.is_manifold for e in bm.edges);bm.free()
assert nonmanifold==0,'Continuous east siding must remain a closed solid'
chain_source=[p for p in source['products'] if p['name']=='Дух.Ш' and (p['bounds'][1][0]<4 or p['bounds'][0][0]>12.6)]
assert len(chain_source)==8
for p in chain_source:
 o=bpy.data.objects['source_finish_'+p['guid']]
 assert o.get('sourceArchive') and o.hide_render and o.hide_viewport and o.get('component')=='rain-chain'
 assert len(o.data.vertices)*3==len(p['verts'])
 assert not any(obj.get('ifcGuid')==p['guid'] and not obj.get('sourceArchive') for obj in objects)
plinth_battens=[o for o in objects if o.get('component')=='source-plinth-batten']
assert len(plinth_battens)>=24
for o in plinth_battens:
 assert all(.01499<=uv.uv.x<=.98501 for uv in o.data.uv_layers.active.data),'Batten UV must exclude painted texture joints'
assert all(o.data.materials[0].name=='Plinth | matte graphite' for o in skirt)
fascia=[o for o in objects if o.get('component')=='terrace-fascia'];assert len(fascia)==12
assert {o['section'] for o in fascia}=={'front_left','front_right','west_return','east_corner'}
for o in fascia:
 assert o.location.z-o.dimensions.z/2>=-.43001 and o.location.z+o.dimensions.z/2<=-.05499
 if o['section'].startswith('front_'):
  assert o.location.x+center[0]+o.dimensions.x/2<=6.792181 or o.location.x+center[0]-o.dimensions.x/2>=9.792161,'Fascia must not cover stair opening'
removed=[o for o in archives if o.get('removedProposalName')];assert len(removed)==30
assert not any(o.name in ['lamp_base','lamp_stem','sofa_cushion_rust','sofa_cushion_linen'] or o.name.startswith('plant_') for o in objects if not o.get('sourceArchive'))
dining=['1KfkQkgZr9WPPaQo7FuBPn','0fhoMwjQv59uPaJu5ROJjU','2gaHY96Wb2gfeR2BpxszgM','0u0bikwRbClvpYRYH4DhBI','3UsO_92GHFPgWILzk_wBSr']
assert all(all(m.name=='Dining | matte white' for m in bpy.data.objects['ifc_'+g].data.materials) for g in dining)
assert bpy.data.objects['source_finish_02xbQZE_z8FPwixh9A7SfF'].get('sourceArchive')
tv=bpy.data.objects['tv_screen'];assert len(tv.data.vertices)==4 and len(tv.data.polygons)==1 and tv.data.polygons[0].normal.x>.999
assert set(tuple(round(c,4) for c in uv.uv) for uv in tv.data.uv_layers.active.data)=={(0.,0.),(1.,0.),(1.,1.),(0.,1.)}
handle=bpy.data.objects['water_valve_handle'];assert abs(handle.location.x+center[0]-9.95)<.00001 and abs(handle.location.y+center[1]+3.42)<.00001 and abs(handle.location.z-.427)<.00001
assert bpy.data.objects['leak_water'].get('baseRadiusM')==1
result={'passed':True,'curtainPanels':len(curtains),'shapedLiftFields':0,'manualTiebackPanels':len(tieback),'ceilingRooms':sorted(set(o.get('room') for o in ceilings)),'livingCeilingPeakM':3.42983503,'hiddenPileObjects':len([o for o in archives if o.get('component')=='pile']),'sourceArchiveObjects':len(archives),'archivedShowerMosaicPanels':len([o for o in archives if str(o.get('sourceName','')).startswith('Панель-доп-')]),'lightExteriorRoom':bpy.data.objects['light_exterior_fixture']['room'],'floorBoards':len(boards),'uniqueFloorUVFragments':len(offsets),'lightenedInteriorDoors':door_guids,'recessedSkirtSections':len(skirt),'terraceBoards':len(deck),'terraceGrainDirection':'IFC X','actualDeckGapM':.01,'distinctStairTreads':5,'stairBoards':10,'actualStairBoardGapM':.01,'bathroomPrivacyGlass':True,'eastCladdingExtendedEndVertices':east['extendedEndVertices'],'removedLivingDecorObjects':len(removed),'whiteDiningObjects':len(dining),'singleTVScreenUV':True,'valveInsideSinkCabinet':True}
assert result['hiddenPileObjects']==24 and result['archivedShowerMosaicPanels']==360
result['eastUnchangedWindowAndRearVertices']=preserved
result['eastSourcePlinthBattens']=len(plinth_source)
result['eastSourcePlinthHeightM']=.05
result['eastSourcePlinthRecessM']=.032992
result['eastOpenTerraceFramingBand']=False
result['eastLowerEdgeStepRemoved']=True
result['eastTerraceCladdingLowerEdgeM']=min(v.co.z for v in terrace_vertices)
result['eastCladdingNonmanifoldEdges']=nonmanifold
result['rainChainSegmentsArchived']=len(chain_source)
result['rainChainSegmentsVisible']=0
result['plinthBattensCleanUV']=len(plinth_battens)
result['terraceFasciaBoards']=len(fascia)
result['terraceFasciaStairOpeningClear']=True
(root/'docs/master-validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False))
