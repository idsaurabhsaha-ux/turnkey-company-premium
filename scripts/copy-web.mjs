import {cp,mkdir,rm} from 'node:fs/promises';
await rm('public',{recursive:true,force:true});
await mkdir('public',{recursive:true});
await cp('web','public',{recursive:true});
// The HTML is served by app/route.ts with security headers, not as an asset.
await rm('public/index.html');
