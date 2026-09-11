import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader.js';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import '@babylonjs/loaders/glTF/glTFFileLoader.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';
import '@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_unlit.js';

// Every visible actor and building comes from a versioned external asset. The
// world data refers to semantic roles; art can be replaced without changing saves.
export class AssetLibrary {
 constructor(scene){this.scene=scene;this.cache=new Map();this.instances=0;}
 async container(path){
  if(!this.cache.has(path))this.cache.set(path,LoadAssetContainerAsync(`/TRPG/world/assets/${path}`,this.scene));
  return this.cache.get(path);
 }
 async spawn(path,{height=1,size,position=[0,0,0],rotation=0,parent,name='asset'}={}){
  const c=await this.container(path),entry=c.instantiateModelsToScene(n=>`${name}:${this.instances++}:${n}`,false,{doNotInstantiate:!path.startsWith('town/')});
  const pivot=new TransformNode(name,this.scene);for(const r of entry.rootNodes)r.parent=pivot;
  const bounds=pivot.getHierarchyBoundingVectors(true),extent=bounds.max.subtract(bounds.min);
  if(size)pivot.scaling=new Vector3(size[0]/Math.max(.01,extent.x),size[1]/Math.max(.01,extent.y),size[2]/Math.max(.01,extent.z));
  else pivot.scaling.setAll(height/Math.max(.01,extent.y));
  const center=bounds.min.add(bounds.max).scale(.5);const wrapper=new TransformNode(`${name}:placement`,this.scene);
  pivot.position=new Vector3(-center.x*pivot.scaling.x,-bounds.min.y*pivot.scaling.y,-center.z*pivot.scaling.z);pivot.parent=wrapper;
  wrapper.position=Vector3.FromArray(position);wrapper.rotation.y=rotation;wrapper.parent=parent||null;
  for(const m of wrapper.getChildMeshes()){m.receiveShadows=true;m.metadata={...(m.metadata||{}),asset:true};}
  const animations=entry.animationGroups;animations.forEach(a=>a.stop());let current;
  const play=(mode)=>{if(mode===current)return;const selected=animations.find(a=>a.name.endsWith(`:${mode}`))||animations.find(a=>a.name.includes(mode));if(!selected)return;animations.forEach(a=>a.stop());selected.start(!['die','attack-melee-right','interact-right'].includes(mode));current=mode;};
  play('idle');
  return {root:wrapper,meshes:wrapper.getChildMeshes(),play,dispose:()=>{animations.forEach(a=>a.dispose());wrapper.dispose();}};
 }
 dispose(){for(const promise of this.cache.values())promise.then(c=>c.dispose());this.cache.clear();}
}
