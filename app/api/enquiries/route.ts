import { env } from 'cloudflare:workers';
import { handleLeadRequest } from '../../../server/leads.mjs';
import { d1Store } from '../../../server/store.mjs';
export const dynamic='force-dynamic';
export const GET=(request:Request)=>handleLeadRequest(request,env,d1Store(env.DB));
export const POST=GET;
