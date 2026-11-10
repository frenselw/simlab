import {Readable} from 'node:stream';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from './position-time-browser-regression.js';
import {terrainRelay} from '../sim/rocket-side-booster-lab/terrain-relay.mjs';

export function createTerrainServer(root,fetchData){
  const server=createServer(root);
  const [serveStatic]=server.listeners('request');
  server.removeListener('request',serveStatic);
  server.on('request',async(req,res)=>{
    const abort=new AbortController();res.on('close',()=>abort.abort());
    try{
      const request=new Request(new URL(req.url,'http://127.0.0.1'),{
        method:req.method,headers:req.headers,signal:abort.signal
      });
      const relayed=await terrainRelay(request,fetchData);
      if(!relayed)return serveStatic(req,res);
      res.writeHead(relayed.status,Object.fromEntries(relayed.headers));
      if(relayed.body)Readable.fromWeb(relayed.body).on('error',()=>res.destroy()).pipe(res);
      else res.end();
    }catch{
      if(!res.headersSent)res.writeHead(502);res.end();
    }
  });
  return server;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  const port=Number(process.argv[2]??8000),server=createTerrainServer(resolve('sim'));
  server.listen(port,'127.0.0.1',()=>console.log(`http://127.0.0.1:${server.address().port}/rocket-side-booster-lab/index.html`));
}
