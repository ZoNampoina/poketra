export type Sealed={sealed:1;iv:string;data:string};
export type VaultMeta={version:1;salt:string;iterations:number;check:Sealed};
let key:CryptoKey|null=null;
export class VaultLocked extends Error{constructor(){super('Ton espace est verrouillé.');this.name='VaultLocked';}}
export function toBase64(bytes:Uint8Array):string{let result='';for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(result);}
export function fromBase64(s:string){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
async function derive(password:string,salt:string,iterations:number){const raw=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:fromBase64(salt),iterations,hash:'SHA-256'},raw,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
export async function seal(value:unknown,withKey=key):Promise<Sealed>{if(!withKey)throw new VaultLocked();const iv=crypto.getRandomValues(new Uint8Array(12)),data=await crypto.subtle.encrypt({name:'AES-GCM',iv},withKey,new TextEncoder().encode(JSON.stringify(value)));return{sealed:1,iv:toBase64(iv),data:toBase64(new Uint8Array(data))};}
export async function unseal(value:unknown,withKey=key):Promise<any>{if(!(value&&typeof value==='object'&&'sealed'in value))return value;if(!withKey)throw new VaultLocked();const v=value as Sealed;return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:fromBase64(v.iv)},withKey,fromBase64(v.data))));}
export async function newVault(password:string){if(password.length<8)throw new Error('Choisis un code ou mot de passe d’au moins huit caractères.');const salt=toBase64(crypto.getRandomValues(new Uint8Array(16))),iterations=600000,k=await derive(password,salt,iterations);return{key:k,meta:{version:1 as const,salt,iterations,check:await seal('poketra-vault-v1',k)}};}
export async function unlockVault(meta:VaultMeta,password:string){try{const k=await derive(password,meta.salt,meta.iterations);if(await unseal(meta.check,k)!=='poketra-vault-v1')throw new Error();key=k;}catch{throw new Error('Code incorrect. Tes données restent intactes.');}}
export function useVaultKey(k:CryptoKey){key=k;}
export function lockVault(){key=null;}
export function hasKey(){return !!key;}
