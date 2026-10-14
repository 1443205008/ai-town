<script setup lang="ts">
import {onMounted,onUnmounted,watch} from 'vue';
import Phaser from 'phaser';
import type {World} from '../../../packages/shared/src/types';
const props=defineProps<{world:World}>(),emit=defineEmits(['select','tile']);
let game:Phaser.Game,scene:Phaser.Scene,objects:Phaser.GameObjects.Container;
function draw(){if(!scene||!objects)return;objects.removeAll(true);const w=props.world,m=w.map,t=m.tileSize;
 const g=scene.add.graphics();objects.add(g);
 for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++){const n=m.terrain[y*m.width+x];g.fillStyle([0xd5ad68,0xc49858,0x728459,0x756b59,0x75b3af][n]??0xd5ad68);g.fillRect(x*t,y*t,t,t);g.lineStyle(1,0xbe985e,.24);g.strokeRect(x*t,y*t,t,t);if((x*17+y*13)%11===0){g.fillStyle(0xe5c487,.6);g.fillRect(x*t+12,y*t+26,18,3);}}
 for(const road of m.roads){g.fillStyle(0x9f8866);g.fillRect(road.x*t+8,road.y*t+8,t-16,t-16);}
 for(const z of m.zoning){g.fillStyle(z.zone==='PROTECTED'?0xb44c43:0x518975,.2);g.fillRect(z.x*t,z.y*t,t,t);}
 for(const b of m.blueprints.filter(b=>!['COMPLETED','CANCELLED'].includes(b.status))){g.fillStyle(b.status==='UNDER_CONSTRUCTION'?0xb18644:0x4baabb,.35);g.fillRect(b.x*t,b.y*t,b.width*t,b.height*t);g.lineStyle(2,0x356976);g.strokeRect(b.x*t,b.y*t,b.width*t,b.height*t);const j=w.projects.find(j=>j.blueprintId===b.id);if(j){const label=scene.add.text(b.x*t,b.y*t,`${Math.round(j.progress*100)}%`,{fontSize:'16px',color:'#203b35'});objects.add(label);}}
 const night=(w.gameTime%1440<360||w.gameTime%1440>=1140),weather=w.weather?.type;
 for(const b of m.structures){g.fillStyle(0x76503c);g.fillRect(b.x*t+4,b.y*t+14,b.width*t-8,b.height*t-18);g.fillStyle(b.type==='WELL'?0x4e8581:0xf4ddb0);g.fillTriangle(b.x*t,b.y*t+16,(b.x+b.width/2)*t,b.y*t-12,(b.x+b.width)*t,b.y*t+16);if(night){g.fillStyle(0xffd26e,.8);g.fillCircle((b.x+b.width/2)*t,(b.y+b.height/2)*t,5);g.fillStyle(0xffd26e,.1);g.fillCircle((b.x+b.width/2)*t,(b.y+b.height/2)*t,24);}const label=scene.add.text(b.x*t,b.y*t+b.height*t,b.name,{fontSize:'15px',color:'#42372b',backgroundColor:'#ead2a0'});objects.add(label);const hit=scene.add.zone(b.x*t,b.y*t,b.width*t,b.height*t).setOrigin(0).setInteractive();hit.on('pointerup',()=>emit('select',{kind:'building',data:b}));objects.add(hit);}
 for(const r of w.residents){g.fillStyle(r.color??0x385f62);g.fillRect(r.x*t+22,r.y*t+24,20,26);g.fillStyle(0xf6d5a4);g.fillRect(r.x*t+24,r.y*t+10,16,16);if(r.current_action&&['SOCIALIZE','DISCUSS','TALK'].includes(r.current_action)){const bubble=scene.add.text(r.x*t+30,r.y*t-7,'…',{fontSize:'12px',color:'#263f37',backgroundColor:'#fff8df',padding:{x:4,y:2}});objects.add(bubble);}const hit=scene.add.zone(r.x*t,r.y*t,t,t).setOrigin(0).setInteractive();hit.on('pointerup',()=>emit('select',{kind:'resident',data:r}));objects.add(hit);}
 if(night){g.fillStyle(0x13253b,.3);g.fillRect(0,0,m.width*t,m.height*t);}
 if(weather==='SANDSTORM'||weather==='HEATWAVE'){const dust=scene.add.graphics();dust.fillStyle(weather==='SANDSTORM'?0xd5bd91:.0,weather==='SANDSTORM'?.24:.12);dust.fillRect(0,0,m.width*t,m.height*t);for(let i=0;i<28;i++){const x=(i*173+Math.floor(w.gameTime/12)*19)%(m.width*t),y=(i*97+Math.floor(w.gameTime/12)*31)%(m.height*t);dust.fillStyle(weather==='SANDSTORM'?0xf3dfb6:0xd77e49,.55);dust.fillCircle(x,y,weather==='SANDSTORM'?2:3);}objects.add(dust);}
}
onMounted(()=>{class TownScene extends Phaser.Scene{create(){scene=this;objects=this.add.container();this.cameras.main.setBounds(0,0,props.world.map.width*64,props.world.map.height*64).setZoom(.55).centerOn(31*64,23*64);draw();this.input.on('pointermove',(p:Phaser.Input.Pointer)=>{if(p.isDown&&p.getDistance()>4){this.cameras.main.scrollX-=(p.x-p.prevPosition.x)/this.cameras.main.zoom;this.cameras.main.scrollY-=(p.y-p.prevPosition.y)/this.cameras.main.zoom;}});this.input.on('wheel',(_p:any,_o:any,_x:number,y:number)=>this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom-y*.001,.2,1.5)));this.input.on('pointerup',(p:Phaser.Input.Pointer)=>{if(p.getDistance()<5){const pos=p.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;emit('tile',{x:Math.floor(pos.x/64),y:Math.floor(pos.y/64)});}});}}
 game=new Phaser.Game({type:Phaser.AUTO,parent:'town-canvas',backgroundColor:'#d5ad68',pixelArt:true,scale:{mode:Phaser.Scale.RESIZE,width:'100%',height:'100%'},scene:TownScene});});
watch(()=>props.world.version,draw);onUnmounted(()=>game?.destroy(true));
</script>
<template><div id="town-canvas" aria-label="晨沙镇地图：拖动移动，滚轮缩放，点击查看"></div></template>
