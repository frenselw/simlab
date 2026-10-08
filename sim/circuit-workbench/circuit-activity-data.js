(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CircuitActivityData=api;})(globalThis,function(){
'use strict';
const bytes=x=>new TextEncoder().encode(JSON.stringify(x)).length;
function keys(x,list){if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).length!==list.length||list.some(k=>!Object.hasOwn(x,k)))throw new Error('作答欄位無效');}
function pack(numbers){const b=new Uint8Array(numbers.length*8),v=new DataView(b.buffer);numbers.forEach((n,i)=>{if(!Number.isFinite(n))throw new Error('座標無效');v.setFloat64(i*8,n,true);});return typeof Buffer!=='undefined'?Buffer.from(b).toString('base64'):btoa(String.fromCharCode(...b));}
function unpack(text,max){if(typeof text!=='string'||text.length>Math.ceil(max*8/3)*4||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text))throw new Error('座標編碼無效');const b=typeof Buffer!=='undefined'?Uint8Array.from(Buffer.from(text,'base64')):Uint8Array.from(atob(text),c=>c.charCodeAt(0));if(b.length%8)throw new Error('座標長度無效');const v=new DataView(b.buffer,b.byteOffset,b.byteLength),n=Array.from({length:b.length/8},(_,i)=>v.getFloat64(i*8,true));if(n.length>max||pack(n)!==text)throw new Error('座標編碼無效');return n;}
function envelope(snapshot,activity,kind){keys(snapshot,kind==='review'?['version','activity','kind','answer','score','passed']:['version','activity','kind','answer']);if(snapshot.version!==1||snapshot.activity!==activity||snapshot.kind!==kind||bytes(snapshot)>4000||kind==='review'&&(!Number.isInteger(snapshot.score)||snapshot.score<0||snapshot.score>100||typeof snapshot.passed!=='boolean'))throw new Error('作答版本或容量無效');}
return {bytes,keys,pack,unpack,envelope};
});
