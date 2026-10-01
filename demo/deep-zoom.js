const TILE=512, MB=1024*1024;
const TIERS=[
  {level:4,width:1614,height:2421,columns:4,rows:5},
  {level:3,width:3228,height:4842,columns:7,rows:10},
  {level:2,width:6455,height:9683,columns:13,rows:19},
  {level:1,width:12910,height:19365,columns:26,rows:38},
  {level:0,width:25820,height:38730,columns:51,rows:76},
];
const ASSET=(tier,x,y)=>`https://raw.githubusercontent.com/kvnloo/quackles-assets/main/blue/p0000000/gp/${tier.level}/${x}_${y}.webp`;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const cropFor=(zoom,cx,cy)=>{
  const width=1/zoom,height=1/zoom;
  const x=clamp(cx-width/2,0,1-width),y=clamp(cy-height/2,0,1-height);
  return {x,y,width,height,scale:zoom};
};
const tileAssets=(tier,crop,overscan=0)=>{
  const firstX=Math.max(0,Math.floor(crop.x*tier.width/TILE)-overscan);
  const lastX=Math.min(tier.columns-1,Math.ceil((crop.x+crop.width)*tier.width/TILE)-1+overscan);
  const firstY=Math.max(0,Math.floor(crop.y*tier.height/TILE)-overscan);
  const lastY=Math.min(tier.rows-1,Math.ceil((crop.y+crop.height)*tier.height/TILE)-1+overscan);
  const out=[];
  for(let y=firstY;y<=lastY;y++)for(let x=firstX;x<=lastX;x++){
    const sourceX=x*TILE,sourceY=y*TILE;
    const width=Math.min(TILE,tier.width-sourceX),height=Math.min(TILE,tier.height-sourceY);
    out.push({url:ASSET(tier,x,y),tier,x,y,sourceX,sourceY,width,height});
  }
  return out;
};
const centreFirst=(tasks,tier,crop)=>{
  const cx=(crop.x+crop.width/2)*tier.width,cy=(crop.y+crop.height/2)*tier.height;
  const x0=crop.x*tier.width,x1=(crop.x+crop.width)*tier.width,y0=crop.y*tier.height,y1=(crop.y+crop.height)*tier.height;
  return tasks.map(task=>({
    task,
    visible:task.sourceX<x1&&task.sourceX+task.width>x0&&task.sourceY<y1&&task.sourceY+task.height>y0,
    distance:Math.hypot(task.sourceX+task.width/2-cx,task.sourceY+task.height/2-cy)
  })).sort((a,b)=>a.visible===b.visible?a.distance-b.distance:(a.visible?-1:1));
};
const priority=(entry,i)=>(entry.visible?95:85)-Math.min(i,999)*.004;

class TileCache{
  constructor(budget=96*MB,maxActive=3){
    this.budget=budget;this.maxActive=maxActive;this.items=new Map();this.used=0;this.fetching=0;this.decoding=0;this.paused=false;this.pinned=new Set();
  }
  setPaused(v){this.paused=v;this.pump();}
  pin(urls){this.pinned=new Set(urls);}
  get(url){
    const r=this.items.get(url);
    if(r?.bitmap){r.touched=performance.now();return r.bitmap}
    return null;
  }
  request(task,p=0){
    let r=this.items.get(task.url);
    if(r){r.priority=Math.max(r.priority,p);this.pump();return r.promise;}
    let resolve,reject;
    const promise=new Promise((a,b)=>{resolve=a;reject=b});
    r={task,priority:p,stage:"queued",bitmap:null,blob:null,touched:performance.now(),resolve,reject,promise};
    this.items.set(task.url,r);this.pump();return promise;
  }
  pump(){
    queueMicrotask(()=>{
      const active=this.fetching+this.decoding;
      if(!this.paused){
        for(const r of [...this.items.values()].filter(x=>x.stage==="fetched").sort((a,b)=>b.priority-a.priority)){
          if(this.fetching+this.decoding>=this.maxActive)break;
          if(!this.room(r.task.width*r.task.height*4))continue;
          this.decode(r);
        }
      }
      for(const r of [...this.items.values()].filter(x=>x.stage==="queued").sort((a,b)=>b.priority-a.priority)){
        if(this.fetching+this.decoding>=this.maxActive)break;
        this.fetch(r);
      }
    });
  }
  async fetch(r){
    r.stage="fetching";this.fetching++;
    try{
      const res=await fetch(r.task.url,{cache:"force-cache"});
      if(!res.ok)throw new Error(`tile ${res.status}`);
      r.blob=await res.blob();r.stage="fetched";
    }catch(e){this.items.delete(r.task.url);r.reject(e)}
    finally{this.fetching--;this.pump();}
  }
  async decode(r){
    r.stage="decoding";this.decoding++;
    const bytes=r.task.width*r.task.height*4;
    try{
      const bmp=await createImageBitmap(r.blob);
      r.blob=null;r.bitmap=bmp;r.stage="ready";r.bytes=bytes;r.touched=performance.now();this.used+=bytes;r.resolve(bmp);
    }catch(e){this.items.delete(r.task.url);r.reject(e)}
    finally{this.decoding--;this.pump();}
  }
  room(bytes){
    const evict=[...this.items.entries()].filter(([url,r])=>r.bitmap&&!this.pinned.has(url)).sort((a,b)=>a[1].touched-b[1].touched);
    while(this.used+bytes>this.budget&&evict.length){
      const [url,r]=evict.shift();r.bitmap?.close?.();this.used-=r.bytes||0;this.items.delete(url);
    }
    return this.used+bytes<=this.budget;
  }
}

export class DeepZoom{
  constructor({canvas,status,loading}){
    this.canvas=canvas;this.ctx=canvas.getContext("2d",{alpha:false});this.status=status;this.loading=loading;
    this.cache=new TileCache();this.zoom=1;this.cx=.5;this.cy=.5;this.moving=false;this.idleTimer=null;this.drag=null;
    this.tier=TIERS[0];this.underlay=TIERS[0];this.baseReady=false;
    this.resize=()=>{const r=canvas.getBoundingClientRect();const dpr=Math.min(devicePixelRatio||1,3);canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));this.render();};
    new ResizeObserver(this.resize).observe(canvas);this.bind();
  }
  async init(){
    const full={x:0,y:0,width:1,height:1,scale:1};
    const base=tileAssets(TIERS[0],full,0);
    this.cache.pin(base.map(t=>t.url));
    await Promise.all(base.map(t=>this.cache.request(t,100).catch(()=>null)));
    this.baseReady=true;this.loading.hidden=true;this.render();
  }
  markMoving(){
    this.moving=true;this.cache.setPaused(true);clearTimeout(this.idleTimer);
    this.idleTimer=setTimeout(()=>{this.moving=false;this.cache.setPaused(false);this.plan();this.render();},110);
  }
  bind(){
    this.canvas.addEventListener("wheel",e=>{
      e.preventDefault();this.markMoving();
      const r=this.canvas.getBoundingClientRect(),px=clamp((e.clientX-r.left)/r.width,0,1),py=clamp((e.clientY-r.top)/r.height,0,1);
      const before=cropFor(this.zoom,this.cx,this.cy),sx=before.x+px*before.width,sy=before.y+py*before.height;
      const next=clamp(this.zoom*Math.exp(-clamp(e.deltaY,-180,180)*.00082),1,24);
      const nw=1/next,nh=1/next,nx=sx-px*nw,ny=sy-py*nh;
      this.zoom=next;this.cx=clamp(nx+nw/2,nw/2,1-nw/2);this.cy=clamp(ny+nh/2,nh/2,1-nh/2);
      this.plan();this.render();
    },{passive:false});
    this.canvas.addEventListener("pointerdown",e=>{this.canvas.setPointerCapture(e.pointerId);this.drag={x:e.clientX,y:e.clientY,cx:this.cx,cy:this.cy};this.markMoving();});
    this.canvas.addEventListener("pointermove",e=>{if(!this.drag)return;this.markMoving();const r=this.canvas.getBoundingClientRect(),w=1/this.zoom,h=1/this.zoom;this.cx=clamp(this.drag.cx-(e.clientX-this.drag.x)/r.width*w,w/2,1-w/2);this.cy=clamp(this.drag.cy-(e.clientY-this.drag.y)/r.height*h,h/2,1-h/2);this.plan();this.render();});
    const up=()=>{this.drag=null;this.markMoving()};this.canvas.addEventListener("pointerup",up);this.canvas.addEventListener("pointercancel",up);
    addEventListener("keydown",e=>{if(e.key==="0"){this.zoom=1;this.cx=this.cy=.5;this.markMoving();this.plan();this.render();}});
  }
  chooseTier(){
    const css=this.canvas.getBoundingClientRect().width||1,dpr=this.canvas.width/css;
    const desired=Math.ceil(css*dpr*this.zoom);
    return TIERS.find(t=>t.width>=desired)||TIERS.at(-1);
  }
  plan(){
    const crop=cropFor(this.zoom,this.cx,this.cy),tier=this.chooseTier(),idx=TIERS.indexOf(tier),under=TIERS[Math.max(0,idx-2)];
    this.tier=tier;this.underlay=under;
    const underEntries=centreFirst(tileAssets(under,crop,1),under,crop);
    underEntries.forEach((e,i)=>this.cache.request(e.task,88-i*.004).then(()=>this.render()).catch(()=>{}));
    const detailEntries=centreFirst(tileAssets(tier,crop,1),tier,crop);
    detailEntries.forEach((e,i)=>this.cache.request(e.task,priority(e,i)).then(()=>this.render()).catch(()=>{}));
  }
  drawTier(tier,crop){
    const tasks=tileAssets(tier,crop,0),cw=this.canvas.width,ch=this.canvas.height;
    const sx0=crop.x*tier.width,sy0=crop.y*tier.height,scaleX=cw/(crop.width*tier.width),scaleY=ch/(crop.height*tier.height);
    let drawn=0;
    for(const t of tasks){
      const bmp=this.cache.get(t.url);if(!bmp)continue;
      const x=Math.floor((t.sourceX-sx0)*scaleX),y=Math.floor((t.sourceY-sy0)*scaleY);
      const w=Math.ceil((t.sourceX+t.width-sx0)*scaleX)-x,h=Math.ceil((t.sourceY+t.height-sy0)*scaleY)-y;
      this.ctx.drawImage(bmp,x,y,w,h);drawn++;
    }
    return {drawn,total:tasks.length};
  }
  render(){
    if(!this.canvas.width||!this.baseReady)return;
    const crop=cropFor(this.zoom,this.cx,this.cy);
    this.ctx.fillStyle="#0000f2";this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
    this.ctx.imageSmoothingEnabled=true;this.ctx.imageSmoothingQuality=this.moving?"low":"high";
    const base=this.drawTier(TIERS[0],crop),under=this.underlay===TIERS[0]?base:this.drawTier(this.underlay,crop),detail=this.tier===this.underlay?under:this.drawTier(this.tier,crop);
    const mp=(this.tier.width*this.tier.height/1e6).toFixed(0);
    this.status.textContent=`${this.zoom.toFixed(2)}× · ${this.tier.width.toLocaleString()}×${this.tier.height.toLocaleString()} · ${mp} MP tier · ${detail.drawn}/${detail.total} sharp tiles`;
  }
}
export {TIERS};
