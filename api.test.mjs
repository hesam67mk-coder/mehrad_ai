import {test,after,before} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {logoSVG} from './logo.js';
let child,dir,base;
before(async()=>{
  dir=await mkdtemp(join(tmpdir(),'mehrad-test-'));
  child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
  base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),10000);child.stdout.on('data',b=>{const m=b.toString().match(/http:\/\/localhost:(\d+)/);if(m){clearTimeout(timer);resolve(`http://127.0.0.1:${m[1]}`);}});child.on('error',reject);child.on('exit',code=>reject(Error(`Server exited: ${code}`)));});
});
after(async()=>{if(child&&!child.killed){const done=once(child,'exit');child.kill();await done;}if(dir)await rm(dir,{recursive:true,force:true});});
const post=(path,data,cookie,extra={})=>fetch(`${base}/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...extra},body:JSON.stringify(data)});
test('registration, authentication, persistence and account isolation',async()=>{
  const credentials={name:'Test User',email:'test@example.test',password:'unique-test-password-2026'};
  const registration=await post('register',credentials);assert.equal(registration.status,201);
  const cookie=registration.headers.get('set-cookie').split(';')[0];assert.match(registration.headers.get('set-cookie'),/HttpOnly/);assert.match(registration.headers.get('set-cookie'),/SameSite=Lax/);
  const registered=await registration.json();assert.equal(registered.user.email,credentials.email);assert.equal(registered.user.password,undefined);
  assert.equal((await post('register',credentials)).status,409);
  const session=await fetch(`${base}/api/session`,{headers:{Cookie:cookie}});assert.equal((await session.json()).user.email,credentials.email);
  assert.equal((await fetch(`${base}/api/projects`)).status,401);
  const project={name:'روشنا',description:'آزمایش ذخیرهٔ فارسی',style:'minimal',palette:'violet',variant:2};
  assert.equal((await post('projects',project,cookie)).status,201);
  assert.equal((await post('projects',{...project,palette:'invalid'},cookie)).status,400);
  assert.equal((await post('projects',project,cookie,{Origin:'https://untrusted.example'})).status,403);
  const list=await fetch(`${base}/api/projects`,{headers:{Cookie:cookie}});const saved=(await list.json()).projects;assert.equal(saved.length,1);assert.equal(saved[0].name,'روشنا');
  const second=await post('register',{...credentials,email:'second@example.test'});const secondCookie=second.headers.get('set-cookie').split(';')[0];
  assert.deepEqual((await (await fetch(`${base}/api/projects`,{headers:{Cookie:secondCookie}})).json()).projects,[]);
  assert.equal((await post('login',{email:credentials.email,password:'a-wrong-password'})).status,401);
  assert.equal((await post('logout',{},cookie)).status,200);
  assert.equal((await (await fetch(`${base}/api/session`,{headers:{Cookie:cookie}})).json()).user,null);
  const login=await post('login',credentials);assert.equal(login.status,200);const newCookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await (await fetch(`${base}/api/projects`,{headers:{Cookie:newCookie}})).json()).projects.length,1);
});
test('private files and unsupported requests cannot be served',async()=>{
  for(const path of ['/server.mjs','/package.json','/data/mehrad.sqlite','/.env','/assets/../server.mjs'])assert.equal((await fetch(base+path)).status,404);
  assert.equal((await fetch(base+'/api/register',{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'})).status,415);
  assert.equal((await fetch(base+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})).status,400);
  const home=await fetch(base);assert.equal(home.status,200);assert.match(home.headers.get('content-security-policy'),/object-src 'none'/);
  assert.equal((await fetch(base+'/Vazirmatn.woff2')).status,200);
});
test('SVG text cannot inject executable markup',()=>{
  const svg=logoSVG({name:'<script>alert("x")</script>',variant:0},true);
  assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('&lt;script&gt;'));assert.ok(!svg.includes('<rect width="512"'));
});
