export function trustedPushEndpoint(value:unknown):value is string {
  if(typeof value!=='string'||value.length>2048)return false;
  try {
    const u=new URL(value);
    return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&
      (['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(u.hostname)||
       u.hostname.endsWith('.push.services.mozilla.com')||u.hostname.endsWith('.push.apple.com')||u.hostname.endsWith('.notify.windows.com'));
  }catch{return false;}
}
export function validPushKeys(keys:unknown):keys is {auth:string;p256dh:string}{
  if(!keys||typeof keys!=='object')return false;
  const k=keys as Record<string,unknown>;
  return typeof k.auth==='string'&&/^[A-Za-z0-9_-]{22}$/.test(k.auth)&&typeof k.p256dh==='string'&&/^[A-Za-z0-9_-]{87}$/.test(k.p256dh);
}
