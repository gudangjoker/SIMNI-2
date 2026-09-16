import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const hash = data => createHash('sha256').update(data).digest('hex');
const manifest = JSON.parse(await readFile('public/build-manifest.json','utf8'));
const pkg = JSON.parse(await readFile('package.json','utf8'));
if (manifest.version !== pkg.version || hash(JSON.stringify(manifest.files)) !== manifest.buildId) throw Error('Invalid build identity');
const actual = [];
async function walk(dir) { for(const item of await readdir(dir,{withFileTypes:true})) {
  const file=path.join(dir,item.name); if(item.isDirectory()) await walk(file); else actual.push(path.relative('public',file).replaceAll(path.sep,'/'));
} }
await walk('public');
if (actual.filter(f=>f!=='build-manifest.json').sort().join('\n') !== Object.keys(manifest.files).sort().join('\n')) throw Error('Hosting contains missing or unexpected files');
for(const [file,expected] of Object.entries(manifest.files)) {
  const built=await readFile('public/'+file);
  if(hash(built)!==expected) throw Error('Modified artifact: '+file);
  if(/^(?:chat|edge|qa|test-output)\/|firebase-messaging-sw|mock-adapter/.test(file)) throw Error('Forbidden Hosting asset: '+file);
  if(file.startsWith('vendor/')) continue;
  const source=await readFile(file.startsWith('templates/')?file.slice(10):file);
  const comparable=file==='index.html'?Buffer.from(built.toString().replace(/  <meta name="simni-edge-url" content="[^"]+">\n<\/head>/,'</head>')):built;
  if(hash(source)!==hash(comparable)) throw Error('Unbuilt source change: '+file);
}
console.log('VERIFIED '+manifest.version+' '+manifest.buildId+' ('+Object.keys(manifest.files).length+' files; no rebuild)');
