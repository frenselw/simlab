(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./model.js'):root.CentripetalSourceModel,node?require('./notation.js'):root.CentripetalSourceNotation);
  if(node)module.exports=api;if(root)root.CentripetalSourceScene=api;
})(typeof window==='undefined'?globalThis:window,function(M,N){
  'use strict';
  const phase=t=>((t%1)+1)%1;
  const line=(x1,y1,x2,y2,color='#8a9ca8',width=2,extra='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ${extra}/>`;
  const circle=(x,y,r,fill,extra='')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
  const label=(x,y,value,extra='')=>`<text x="${x}" y="${y}" fill="#344b5c" font-size="14" ${extra}>${value}</text>`;
  const ball=(x,y,r=15)=>`<g data-object="ball">${circle(x,y,r,'#e29430','stroke="#a76723" stroke-width="2"')}${circle(x-r*.3,y-r*.35,r*.3,'#ffdc8b')}</g>`;
  function centerMarker(x,y,s,dx=8,dy=7,color='#334155'){
    return `<g class="circle-center" aria-label="圓心 O">${circle(x,y,Math.max(2.5,Math.min(4,3.5*s)),'#334155','stroke="#fff" stroke-width="1"')}${N.svg('O','圓心 O',{x:x+dx*s,y:y+dy*s},Math.max(14,Math.min(20,18*s)),color)}</g>`;
  }
  const earth=(x,y,r=19)=>`<g data-object="earth" transform="translate(${x} ${y}) scale(${r/20})">${circle(0,0,20,'#267eaf','stroke="#b0e5f6" stroke-width="2"')}<path d="M-12-14 -3-17 1-11 -4-6 -1 0 -7 4 -9 13 -15 8 -16-2Z M8-13 15-8 18 0 12 3 8 14 3 10 5 2 1-5Z" fill="#8cc293"/>${circle(-7,-9,5,'#ffffff33')}</g>`;
  function car(x,y,rotation=0,scale=1){
    return `<g data-object="car" transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})"><ellipse cx="0" cy="-1" rx="36" ry="4" fill="#192f4226"/><path d="M-34-9 -32-23 -19-26 -10-38 11-38 23-25 34-21 36-8Z" fill="#197e89" stroke="#155865" stroke-width="2"/><path d="M-15-26 -7-35 9-35 18-26Z" fill="#b9e2e4"/><path d="M3-35V-26 M-19-22H19 M1-22V-12" stroke="#155865" stroke-width="2"/><rect x="29" y="-20" width="7" height="5" rx="2" fill="#ffdd83"/><rect x="-34" y="-20" width="4" height="5" rx="1" fill="#ef927c"/>${[-22,23].map(cx=>circle(cx,-8,9,'#263c4c')+circle(cx,-8,4,'#d6e0e5')).join('')}</g>`;
  }
  function carPose(page,w,h,t){
    const u=2*phase(t)-1,span=w*.78,depth=Math.min(h*.29,w*.19),base=page===3?h*.72:h*.45;
    const x=w*.11+span*phase(t),y=base+(page===3?-1:1)*depth*(1-u*u);
    const slope=(page===3?1:-1)*4*depth*u/span;
    return {x,y,rotation:Math.atan(slope)*180/Math.PI,base,depth,span};
  }
  function pendulumPose(cx,cy,r,a){
    const depth=Math.sin(a),scale=1/(1+.26*depth);
    return {x:cx+r*Math.cos(a)*scale,y:cy-r*.28*depth*scale,scale,depth};
  }
  function nextTarget(travel){return Math.abs(phase(travel)-.5)<.00001?travel:Math.floor(travel-.5)+1.5;}
  function duration(def,page){
    const p=M.physics(def,page).values;
    if(page===5)return 14;
    if(page===3||page===4)return 5;
    return Math.max(3,page===2?2*Math.PI/p.omega:2*Math.PI*p.r/p.v);
  }
  function scene(page,def,geo,t=0){
    const {w,h}=geo,cx=w/2,cy=h*.53,r=Math.max(18,Math.min(w*.33,h*.32)),s=Math.max(.5,Math.min(1.25,w/460,h/290));
    const a=M.poseAngle(def,page,Math.floor(phase(t)*10000))*Math.PI/1800,x=cx+r*Math.cos(a),y=cy-r*Math.sin(a),dark=page===5;
    let svg=`<rect width="${w}" height="${h}" rx="12" fill="${dark?'#172d46':'#f4f7f5'}"/>`;
    if(page===0){
      svg+=`<rect x="${w*.06}" y="${h*.13}" width="${w*.88}" height="${h*.76}" rx="18" fill="#dce8dd" stroke="#a7bcae" stroke-width="3"/><path d="M${w*.1},${h*.89} v${h*.05} H${w*.9} v-${h*.05}" fill="#afc5b7"/>`;
      svg+=circle(cx,cy,r,'none','stroke="#9cae9f" stroke-width="2" stroke-dasharray="5 6"');
      svg+=line(cx,cy,x,y,'#8d6f48',4*s)+circle(cx,cy,9*s,'#586b61')+centerMarker(cx,cy,s)+ball(x,y,17*s);
      svg+=label(w*.08,h*.11,'光滑桌面 · 俯視');
    }else if(page===1){
      svg+=circle(cx,cy+7*s,r+19*s,'#9aadb4')+circle(cx,cy,r+19*s,'#d6e8e9','stroke="#92b5b9" stroke-width="3"');
      for(let i=0;i<8;i++){const b=a+i*Math.PI/4;svg+=line(cx,cy,cx+(r+12*s)*Math.cos(b),cy-(r+12*s)*Math.sin(b),'#b2cfd1',2);}
      svg+=circle(cx,cy,r,'none','stroke="#7da8ad" stroke-dasharray="4 6"')+circle(cx,cy,10*s,'#5c8286')+centerMarker(cx,cy,s);
      svg+=`<g data-object="block" transform="translate(${x} ${y}) rotate(${-a*180/Math.PI})"><rect x="${-16*s}" y="${-12*s}" width="${32*s}" height="${25*s}" rx="4" fill="#d68b34" stroke="#9b6528" stroke-width="2"/><path d="M${-11*s},${-6*s} H${11*s}" stroke="#f7c876" stroke-width="3"/></g>`;
      svg+=label(w*.08,h*.11,'水平圓盤 · 俯視')+label(cx,h*.94,'物體與盤面一起轉動', 'text-anchor="middle"');
    }else if(page===2){
      const pivot=h*.18,orbitY=h*.68,p=pendulumPose(cx,orbitY,r,a),rx=r/Math.sqrt(1-.26**2),ry=r*.28/(1-.26**2),ellipseY=orbitY+.26*ry;
      svg+=line(w*.015,h*.88,w*.085,h*.88,'#627e88',8*s)+line(w*.045,h*.88,w*.045,h*.12,'#627e88',8*s,'data-support="post"')+line(w*.045,h*.12,cx+25*s,h*.12,'#627e88',8*s)+line(cx,h*.12,cx,pivot,'#627e88',5*s);
      svg+=`<path d="M${cx},${pivot} L${cx-rx},${ellipseY} A${rx},${ry} 0 0 0 ${cx+rx},${ellipseY} Z" fill="#b8d5cc33"/><ellipse cx="${cx}" cy="${ellipseY}" rx="${rx}" ry="${ry}" fill="#dce9e780"/>`;
      const front=`<path data-orbit="front" d="M${cx-rx},${ellipseY} A${rx},${ry} 0 0 0 ${cx+rx},${ellipseY}" fill="none" stroke="#7c9c98" stroke-width="2" stroke-dasharray="5 5"/>`;
      svg+=`<path data-orbit="back" d="M${cx-rx},${ellipseY} A${rx},${ry} 0 0 1 ${cx+rx},${ellipseY}" fill="none" stroke="#a9bcb8" stroke-width="1.5" stroke-dasharray="4 6"/>`+line(cx,pivot,cx,orbitY,'#9caeae',1.5,'stroke-dasharray="5 5"');
      const moving=`<g data-pendulum-scale="${p.scale}">${line(cx,pivot,p.x,p.y,'#927443',3*s*p.scale)}${ball(p.x,p.y,17*s*p.scale)}</g>`;
      svg+=p.depth>0?moving+front:front+moving;
      svg+=circle(cx,pivot,6*s,'#526d74')+centerMarker(cx,orbitY,s);
      svg+=label(w*.08,h*.08,'圓錐擺 · 立體示意')+label(cx+10*s,pivot+9*s,'懸點')+label(cx,h*.94,'小球沿水平圓周運動','text-anchor="middle"');
    }else if(page===3||page===4){
      const p=carPose(page,w,h,t),edge=p.base+(page===3?1:-1)*p.depth*((w/p.span)**2-1),control=2*(p.base+(page===3?-1:1)*p.depth)-edge;
      const path=`M0,${edge} Q${cx},${control} ${w},${edge}`;
      svg+=`<path d="M0,${h*.84} Q${w*.18},${h*.52} ${w*.42},${h*.87} Q${w*.7},${h*.66} ${w},${h*.86} V${h}H0Z" fill="#dfebe3"/>`;
      svg+=`<path d="${path} V${h} H0Z" fill="${page===3?'#d1dbe0':'#ceddcf'}"/>`;
      if(page===3)for(let i=1;i<7;i++){const px=w*.11+w*.78*i/7,u=2*i/7-1,py=p.base-p.depth*(1-u*u);svg+=line(px,py+9*s,px,h,'#aebfc6',5*s);}
      svg+=`<path data-road="surface" d="${path}" fill="none" stroke="#82969e" stroke-width="${16*s}"/><path d="${path}" fill="none" stroke="#f1e8c7" stroke-width="${2*s}" stroke-dasharray="${13*s} ${11*s}"/>`;
      svg+=car(p.x,p.y-8*s,p.rotation,s);
      const target=carPose(page,w,h,.5);svg+=line(cx,target.y+16*s,cx,target.y+31*s,'#a77e38',2)+label(cx,target.y+48*s,page===3?'橋頂':'最低點','text-anchor="middle"');
      svg+=label(w*.08,h*.11,page===3?'汽車駛過拱橋':'汽車駛過凹形路面');
    }else{
      for(let i=0;i<24;i++){const sx=((i*137+23)%997)/997*w,sy=((i*251+91)%991)/991*h;svg+=circle(sx,sy,i%3===0?1.4:.8,'#c0d4e4','opacity=".6"');}
      svg+=circle(cx,cy,r,'none','stroke="#67859d" stroke-width="1.5" stroke-dasharray="4 6"')+circle(cx,cy,33*s,'#efba4222')+circle(cx,cy,26*s,'#efba4233')+circle(cx,cy,20*s,'#f7c24d')+circle(cx-5*s,cy-5*s,10*s,'#ffe18b');
      svg+=earth(x,y,19*s)+centerMarker(cx,cy,s,29,-9,'#e5edf2')+`<text x="${cx}" y="${cy+43*s}" text-anchor="middle" fill="#e5edf2" font-size="14">太陽</text><text x="${w*.08}" y="${h*.11}" fill="#e5edf2" font-size="14">地球繞太陽 · 俯視</text>`;
    }
    return `<g data-scene="${M.CASES[page].id}">${svg}</g>`;
  }
  function backdrop(page,def,geo,pose){
    const {w,cx,cy,scale:s}=geo,inner=M.inward(def,page,pose),sign=inner==='E'?1:-1;
    let svg='';
    if(page<2){
      svg+=`<rect x="4" y="${cy+13*s}" width="${w-8}" height="${15*s}" rx="4" fill="#d6e4df"/>`;
      if(page===0)svg+=line(cx,cy,cx+sign*92*s,cy,'#9b8155',3)+circle(cx+sign*92*s,cy,5*s,'#6c827b')+ball(cx,cy,12*s);
      else svg+=`<rect x="${cx-15*s}" y="${cy-13*s}" width="${30*s}" height="${26*s}" rx="3" fill="#e0a04e" stroke="#af7a32" stroke-width="2"/>`;
      svg+=centerMarker(cx+sign*92*s,cy,s);
    }else if(page===2){
      const theta=M.physics(def,page).values.theta,px=cx+sign*84*s*Math.sin(theta),py=cy-84*s*Math.cos(theta);
      svg+=line(cx,cy,px,py,'#9b8155',3)+line(px,py,px,cy+8*s,'#a8b7b4',1.5,'stroke-dasharray="4 4"')+circle(px,py,5*s,'#6c827b')+ball(cx,cy,12*s)+label(px+sign*17*s,py-7*s,'懸點','text-anchor="middle"')+centerMarker(px,cy,s);
    }else if(page===3||page===4){
      const road=cy+21*s,edge=road+(page===3?1:-1)*30*s;
      svg+=`<path d="M4,${edge} Q${cx},${2*road-edge} ${w-4},${edge}" fill="none" stroke="#8c9fa6" stroke-width="8"/>`+car(cx,road-4*s,0,.6*s);
    }else{
      const a=M.physics(def,page,pose).forces[0][1]*Math.PI/1800,sx=cx+Math.cos(a)*81*s,sy=cy-Math.sin(a)*81*s;
      svg+=line(cx,cy,sx,sy,'#abbac8',1.5,'stroke-dasharray="4 4"')+circle(sx,sy,13*s,'#edb640')+label(sx+14*s,sy+4*s,'太陽')+earth(cx,cy,12*s)+centerMarker(sx,sy,s,17,-22);
    }
    return svg+circle(cx,cy,3.5,'#243e50');
  }
  const endpoint=(geo,a,length)=>({x:geo.cx+Math.cos(a*Math.PI/1800)*length,y:geo.cy-Math.sin(a*Math.PI/1800)*length});
  function arrowPath(geo,angle,length){
    const a=angle*Math.PI/1800,u={x:Math.cos(a),y:-Math.sin(a)},n={x:-u.y,y:u.x},end=endpoint(geo,angle,length),size=Math.min(1.4,Math.max(.8,geo.scale));
    const head=Math.min(14*size,length*.4),half=Math.min(6*size,length*.18),shaft=Math.min(1.8*size,half*.55),base={x:end.x-u.x*head,y:end.y-u.y*head};
    return [[geo.cx+n.x*shaft,geo.cy+n.y*shaft],[base.x+n.x*shaft,base.y+n.y*shaft],[base.x+n.x*half,base.y+n.y*half],[end.x,end.y],[base.x-n.x*half,base.y-n.y*half],[base.x-n.x*shaft,base.y-n.y*shaft],[geo.cx-n.x*shaft,geo.cy-n.y*shaft]].map((p,i)=>(i?'L':'M')+p.join(',')).join(' ')+' Z';
  }
  function labelPositions(entries,geo){
    const placed=[],overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
    const body={x:geo.cx-22*geo.scale,y:geo.cy-18*geo.scale,width:44*geo.scale,height:36*geo.scale};
    return entries.map(entry=>{
      const end=endpoint(geo,entry.angle,entry.length),a=entry.angle*Math.PI/1800,ux=Math.cos(a),uy=-Math.sin(a),options=[];
      for(const side of [1,-1])for(const gap of [19,33,48])for(const along of [8,-18]){
        const x=Math.max(4,Math.min(geo.w-entry.width-4,end.x-uy*gap*side+ux*along-entry.width/2));
        const y=Math.max(28,Math.min(geo.h-entry.height-5,end.y+ux*gap*side+uy*along-entry.height/2));
        const box={x,y,width:entry.width,height:entry.height};let penalty=gap+(overlap(box,body)?200:0)+placed.filter(other=>overlap(box,other)).length*500;
        for(const line of entries)for(let t=.25;t<=1;t+=.15){const p=endpoint(geo,line.angle,line.length*t);if(p.x>box.x-3&&p.x<box.x+box.width+3&&p.y>box.y-3&&p.y<box.y+box.height+3)penalty+=55;}
        options.push({box,penalty});
      }
      options.sort((a,b)=>a.penalty-b.penalty);placed.push(options[0].box);return {...entry,end,box:options[0].box};
    });
  }
  return Object.freeze({phase,car,carPose,pendulumPose,nextTarget,duration,scene,backdrop,arrowPath,labelPositions,endpoint});
});
