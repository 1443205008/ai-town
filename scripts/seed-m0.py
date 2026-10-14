from pathlib import Path
import json,re,secrets
root=Path(__file__).resolve().parents[1]
def write(path,data):
 p=root/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
width,height=64,48
terrain=[2 if 26<x<36 and 19<y<28 else (3 if (x*7+y*11)%97==0 else 0) for y in range(height) for x in range(width)]
structures=[]
for n,(kind,name,x,y,w,h) in enumerate([
 ('TOWN_HALL','指挥帐篷',30,21,3,2),('WELL','简易井',35,23,2,2),('WAREHOUSE','公共仓库',26,22,3,2),('CLINIC','医务帐篷',31,17,2,2),('KITCHEN','临时炊事场',26,18,2,2),('TENT','居民帐篷',22,22,2,2),('TENT','居民帐篷',22,26,2,2),('WORKSHOP','工棚',35,18,3,2),('LOOKOUT','观测哨',39,27,1,1),('RUIN','古井遗址',45,14,2,2),('CARAVAN','商队停车点',39,21,3,2),('FARM','绿洲农田',29,27,3,2)]):
 structures.append(dict(id=f'building-{n+1}',type=kind,name=name,x=x,y=y,width=w,height=h,durability=100,operational=kind!='RUIN'))
names=[]
for line in (root/'AI 沙海小镇 — 完整项目计划 v2.0.md').read_text().splitlines():
 if re.match(r'^\| \d\d \|',line):
  cols=[s.strip() for s in line.split('|')[1:-1]];names.append(cols)
residents=[dict(id=f'resident-{i+1:03}',name=c[1],role=c[2],x=24+i%10,y=25+i//10,color=[0x3c685e,0x925845,0x597988,0x9e7b40][i%4],current_action='IDLE') for i,c in enumerate(names)]
nav=[0 if t==3 else 1 for t in terrain]
for b in structures:
 if b['type'] not in ('FARM','CARAVAN'):
  for y in range(b['y'],b['y']+b['height']):
   for x in range(b['x'],b['x']+b['width']):nav[y*width+x]=0
write('seed/maps/starter.json',dict(width=width,height=height,tileSize=64,terrain=terrain,elevation=[0]*(width*height),resource_nodes=[dict(x=35,y=23,type='WATER'),dict(x=27,y=30,type='STONE'),dict(x=25,y=29,type='WOOD')],roads=[],zoning=[],structures=structures,blueprints=[],navigation=nav,fog_of_war=[True]*(width*height)))
write('seed/scenarios/starter.json',dict(name='晨沙镇',seed=731, map='starter',resources=dict(cash=5000,water=120,food=110,stone=120,wood=80,tools=12),rules=dict(gameMinutesPerTick=.8,waterDaily=22,waterConsumption=28,foodDaily=14,foodConsumption=20,waterCapacity=200,housingCapacity=20),residents=residents))
if not (root/'.env').exists():
 (root/'.env').write_text('MAYOR_PASSWORD='+secrets.token_urlsafe(18)+'\nSESSION_SECRET='+secrets.token_urlsafe(40)+'\nDATABASE_URL=postgres://frontier:frontier_dev@127.0.0.1:54329/frontier_v2\nPORT=3100\nAPP_ORIGIN=http://localhost:5188\n')
 (root/'.env').chmod(0o600)
print('M0 Seed 已生成；本地 .env 已安全生成，未输出密码。')
