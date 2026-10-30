'use strict';
const Q=require('./spec'),M=require('../circuit-workbench/circuit-model');
function solved(q,v){const d=Q.initial(q,v),point=(x,y)=>Q.transform(v,x,y),end=id=>{const [c,k]=id.split(':'),lamp=d.components.find(x=>x.id===c)?.type==='lamp';return v>=8&&lamp&&(((v-8)%2===1)!==(c==='L3'))?c+':'+(k==='a'?'b':'a'):id;},wire=(a,b,via=[])=>{M.connect(d,end(a),end(b),via.map(([x,y])=>point(x,y)),'free');d.wires.at(-1).length=1200;};
if(q<2){wire('B:a','S:a');wire('S:b','L1:a',[[40,440],[40,80]]);if(q===1)wire('L1:b','L2:a');wire(q===1?'L2:b':'L1:b','B:b',[[560,80],[560,440]]);}
else{d.junctions.push({id:'j1',...point(40,260)},{id:'j2',...point(560,260)});const bottom=q===4?'L3':'S';wire('B:a',bottom+':a');wire(bottom+':b','j1:p',[[40,440]]);wire('j1:p',q>=3?'S1:a':'L1:a',[[40,80]]);if(q>=3)wire('S1:b','L1:a');wire('j1:p','L2:a');wire('L1:b','j2:p',[[560,80]]);wire('L2:b','j2:p');wire('j2:p','B:b',[[560,440]]);}
return d;}
module.exports={solved};
