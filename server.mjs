import http from 'node:http';
import {readFileSync, existsSync, mkdirSync, realpathSync} from 'node:fs';
import {resolve, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {DatabaseSync} from 'node:sqlite';
import {palettes} from './logo.js';
const scrypt=promisify(scryptCallback);
const root=fileURLToPath(new URL('.',import.meta.url));
const dataDir=resolve(process.env.DATA_DIR||resolve(root,'data'));
mkdirSync(dataDir,{recursive:true});
const db=new DatabaseSync(resolve(dataDir,'mehrad.sqlite'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,description TEXT NOT NULL,style TEXT NOT NULL,palette TEXT NOT NULL,variant INTEGER NOT NULL,createdAt TEXT NOT NULL);`);
const publicUser=u=>u?{id:u.id,name:u.name,email:u.email}:null;
const production=process.env.NODE_ENV==='production';
const rates=new Map();
const tokenHash=t=>createHash('sha256').update(t).digest('hex');
const cookieToken=req=>(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('mehrad_session='))?.slice(15)||'';
function sessionUser(req){const token=cookieToken(req);if(!/^[a-f0-9]{64}$/.test(token))return null;return db.prepare('SELECT users.* FROM sessions JOIN users ON sessions.user_id=users.id WHERE token=? AND expires>?').get(tokenHash(token),Date.now());}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function loginCookie(res,id){const token=randomBytes(32).toString('hex');db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(tokenHash(token),id,Date.now()+7*86400000);res.setHeader('Set-Cookie',`mehrad_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${production?'; Secure':''}`);}
function validString(value,min,max){return typeof value==='string'&&value.trim().length>=min&&value.length<=max;}
function limit(req,path){const key=`${req.socket.remoteAddress}:${path}`;const now=Date.now();let item=rates.get(key);if(!item||item.until<now){item={count:0,until:now+900000};rates.set(key,item);}item.count++;return item.count<=(path==='login'?30:10);}
const cleaner=setInterval(()=>{for(const [key,value]of rates)if(value.until<Date.now())rates.delete(key);},60000);cleaner.unref();
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>16384)throw Object.assign(Error('درخواست بیش از حد بزرگ است.'),{status:413});}try{const result=JSON.parse(text||'{}');if(!result||Array.isArray(result)||typeof result!=='object')throw Error();return result;}catch{throw Object.assign(Error('ساختار درخواست معتبر نیست.'),{status:400});}}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.svg':'image/svg+xml'};
export const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',`default-src 'self'; script-src 'self'${req.url?.split('?')[0]==='/design-reference.html'?" 'unsafe-inline'":''}; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' data: https://cdn.jsdelivr.net; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`);
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/api/')){
      const path=url.pathname.slice(5);
      if(!['GET','POST'].includes(req.method))return json(res,405,{error:'روش درخواست پشتیبانی نمی‌شود.'});
      if(req.method==='POST'){
        if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return json(res,415,{error:'فرمت JSON لازم است.'});
        const origin=req.headers.origin;
        if(origin){let expected;try{expected=new URL(origin);}catch{return json(res,403,{error:'مبدأ درخواست مجاز نیست.'});}if(expected.host!==req.headers.host||!['http:','https:'].includes(expected.protocol))return json(res,403,{error:'مبدأ درخواست مجاز نیست.'});}
        if(req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'درخواست از مبدأ دیگر مجاز نیست.'});
      }
      if(path==='health'&&req.method==='GET')return json(res,200,{ok:true});
      const user=sessionUser(req);
      if(path==='session'&&req.method==='GET')return json(res,200,{service:'mehrad-ai',user:publicUser(user)});
      if(['register','login'].includes(path)&&req.method==='POST'){
        if(!limit(req,path))return json(res,429,{error:'درخواست‌های زیادی ثبت شده. ۱۵ دقیقه دیگر تلاش کنید.'});
        const b=await body(req);if(!validString(b.email,3,254)||!/^\S+@\S+\.\S+$/.test(b.email)||!validString(b.password,10,128))return json(res,400,{error:'ایمیل معتبر و رمز ۱۰ تا ۱۲۸ کاراکتری وارد کنید.'});
        const email=b.email.trim().toLowerCase();
        if(path==='register'){
          if(!validString(b.name,1,80))return json(res,400,{error:'نام معتبر وارد کنید.'});
          if(db.prepare('SELECT id FROM users WHERE email=?').get(email))return json(res,409,{error:'این ایمیل قبلاً ثبت شده است.'});
          const salt=randomBytes(16).toString('hex');const hash=(await scrypt(b.password,salt,64)).toString('hex');const id=randomUUID();
          try{db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id,b.name.trim(),email,`${salt}:${hash}`);}catch(e){if(e.code?.includes('CONSTRAINT')||String(e.message).includes('UNIQUE'))return json(res,409,{error:'این ایمیل قبلاً ثبت شده است.'});throw e;}
          loginCookie(res,id);return json(res,201,{user:{id,name:b.name.trim(),email}});
        }
        const found=db.prepare('SELECT * FROM users WHERE email=?').get(email);const [salt,stored]=found?found.password.split(':'):['00000000000000000000000000000000','00'.repeat(64)];const hash=await scrypt(b.password,salt,64);
        if(!found||!timingSafeEqual(hash,Buffer.from(stored,'hex')))return json(res,401,{error:'ایمیل یا رمز عبور درست نیست.'});
        loginCookie(res,found.id);return json(res,200,{user:publicUser(found)});
      }
      if(path==='logout'&&req.method==='POST'){db.prepare('DELETE FROM sessions WHERE token=?').run(tokenHash(cookieToken(req)));res.setHeader('Set-Cookie',`mehrad_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${production?'; Secure':''}`);return json(res,200,{ok:true});}
      if(path==='projects'){
        if(!user)return json(res,401,{error:'ابتدا وارد حساب شوید.'});
        if(req.method==='GET')return json(res,200,{projects:db.prepare('SELECT id,name,description,style,palette,variant,createdAt FROM projects WHERE user_id=? ORDER BY createdAt DESC').all(user.id)});
        const b=await body(req);if(!validString(b.name,1,40)||typeof b.description!=='string'||b.description.length>800||!['minimal','bold','organic'].includes(b.style)||!Object.hasOwn(palettes,b.palette)||!Number.isInteger(b.variant)||b.variant<0||b.variant>3)return json(res,400,{error:'اطلاعات طرح معتبر نیست.'});
        if(db.prepare('SELECT COUNT(*) AS count FROM projects WHERE user_id=?').get(user.id).count>=100)return json(res,409,{error:'حداکثر ۱۰۰ طرح در نسخهٔ آزمایشی قابل ذخیره است.'});
        const id=randomUUID(),createdAt=new Date().toISOString();db.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?,?,?)').run(id,user.id,b.name.trim(),b.description,b.style,b.palette,b.variant,createdAt);
        return json(res,201,{project:{id,name:b.name.trim(),description:b.description,style:b.style,palette:b.palette,variant:b.variant,createdAt}});
      }
      return json(res,404,{error:'مسیر پیدا نشد.'});
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
    let path;try{path=decodeURIComponent(url.pathname);}catch{res.writeHead(400);return res.end();}
    const allowed=['/index.html','/styles.css','/studio.js','/logo.js','/brand.png','/Vazirmatn.woff2','/design-reference.html'];
    if(path==='/')path='/index.html';
    if(!allowed.includes(path)){res.writeHead(404);return res.end('Not found');}
    const file=resolve(root,`.${path}`);
    if(!file.startsWith(root)||!existsSync(file)||!realpathSync(file).startsWith(root)){res.writeHead(404);return res.end('Not found');}
    if(!mime[extname(file)]){res.writeHead(404);return res.end();}
    res.writeHead(200,{'Content-Type':mime[extname(file)],'Cache-Control':extname(file)==='.woff2'?'public, max-age=86400':'no-cache'});res.end(req.method==='HEAD'?undefined:readFileSync(file));
  }catch(error){if(!res.headersSent)json(res,error.status||500,{error:error.status?error.message:'خطای سرور؛ دوباره تلاش کنید.'});else res.end();}
});
const port=Number(process.env.PORT||3000);
server.listen(port,process.env.HOST||(production?'0.0.0.0':'127.0.0.1'),()=>console.log(`Mehrad AI running on http://localhost:${server.address().port}`));
