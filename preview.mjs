// Static preview matching GitHub Pages; no accounts or API.
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const types={'index.html':'text/html; charset=utf-8','styles.css':'text/css; charset=utf-8','studio.js':'text/javascript; charset=utf-8','logo.js':'text/javascript; charset=utf-8','brand.png':'image/png','Vazirmatn.woff2':'font/woff2','design-reference.html':'text/html; charset=utf-8'};
http.createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname;const file=path==='/'?'index.html':path.slice(1);if(!Object.hasOwn(types,file)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':types[file],'X-Content-Type-Options':'nosniff'});res.end(readFileSync(fileURLToPath(new URL(file,import.meta.url))));}).listen(3001,'127.0.0.1',()=>console.log('Static preview: http://localhost:3001'));
