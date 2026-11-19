export class ApiError extends Error{constructor(public status:number,message:string){super(message);}}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new ApiError(403,'Origine non autorisée.');if(request.headers.get('sec-fetch-site')==='cross-site')throw new ApiError(403,'Origine non autorisée.');}
