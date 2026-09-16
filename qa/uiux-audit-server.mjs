import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(), publicRoot=path.join(root,'public');
export const auditRequests=[];
const access=`export const getAccessContext=()=>window.SIMNICurrentAccess;
export const canAccess=feature=>window.SIMNIAccess?.canAccess(feature)===true;
export function assertFeature(feature){if(!canAccess(feature))throw new Error('MOCK_ACCESS_DENIED '+feature);}
export const assertLogicalPath=logical=>assertFeature(window.SIMNIAccessPolicy.featureForLogicalPath(logical));
export const establishAccessContext=async()=>window.SIMNICurrentAccess;`;
const client=`export const database={kind:'mock'};export const auth={currentUser:{uid:'uiux-superuser',getIdToken:async()=>'LOCAL_MOCK_ONLY'}};export const runtime={mode:'mock'};export const firebaseApp={};export const firebaseConfig={projectId:'admin-kelas-3a'};export function applyFirebaseRuntimeUI(){};`;
const routes={
 '/js/auth/auth.js':['file','qa/uiux-auth-mock.js'],
 '/js/auth/access-context.js':['text',access],
 '/js/database/firebase-client.js':['text',client],
 '/vendor/firebase/firebase-database.js':['file','qa/academic-mock-database.js'],
 '/vendor/firebase/firebase-auth.js':['text','export const onAuthStateChanged=()=>()=>{};'],
 '/qa/axe.js':['file','node_modules/axe-core/axe.min.js'],
};
export async function startAuditServer(){
 const server=createServer(async(req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  auditRequests.push({path:pathname,destination:req.headers['sec-fetch-dest']||'',time:Date.now()});
  try{
   let body;const route=routes[pathname];
   if(route)body=route[0]==='text'?Buffer.from(route[1]):await readFile(path.join(root,route[1]));
   else {const filename=path.resolve(publicRoot,'.'+(pathname==='/'?'/index.html':pathname));if(!filename.startsWith(publicRoot+path.sep))throw new Error('Boundary');body=await readFile(filename);}
   const type={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.svg':'image/svg+xml'}[path.extname(pathname==='/'?'index.html':pathname)]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':type,'Content-Length':body.length,'Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; media-src 'self' blob:; object-src 'none'"});res.end(body);
  }catch(e){res.writeHead(404);res.end('Audit resource unavailable');}
 });
 await new Promise(resolve=>server.listen(4197,'127.0.0.1',resolve));
 return {server,origin:'http://127.0.0.1:4197'};
}
