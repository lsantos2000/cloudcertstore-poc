const STORE_ORIGIN = 'https://cloudcertificationstore.com';
const CATALOG_PATHS = ['/collection/all','/collection/all?page=15','/collection/all?page=30','/collection/all?page=45','/collection/all?page=60','/collection/all?page=75'];
let catalogPromise;

const clean = (value='') => value
  .replace(/<script[\s\S]*?<\/script>/gi,' ')
  .replace(/<style[\s\S]*?<\/style>/gi,' ')
  .replace(/<[^>]+>/g,' ')
  .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ')
  .replace(/\s+/g,' ').trim();
const normalize = (value='') => clean(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const tokens = value => new Set(normalize(value).split(' ').filter(token => token.length > 1 && !['get','it','done','certified','practice','exam','questions','ebook','audiobook','new','for','the','and'].includes(token)));

function scoreCandidate(text, title, code){
  const candidateTokens=tokens(text), titleTokens=tokens(title);
  if(!candidateTokens.size || !titleTokens.size) return 0;
  let common=0; for(const token of candidateTokens) if(titleTokens.has(token)) common++;
  const union=new Set([...candidateTokens,...titleTokens]).size;
  let score=common/Math.max(1,union);
  const nText=normalize(text), nTitle=normalize(title), nCode=normalize(code);
  if(nCode && nText.includes(nCode)) score+=0.55;
  if(nText.includes(nTitle) || nTitle.includes(nText)) score+=0.35;
  return score;
}

function validStoreUrl(value){
  try{ const url=new URL(value,STORE_ORIGIN); return url.origin===STORE_ORIGIN ? url : null; }catch{return null;}
}

async function fetchText(url){
  const response=await fetch(url,{headers:{'User-Agent':'CloudCertificationStore-POC/1.0 (+https://cloudcertificationstore.com)','Accept':'text/html,application/xhtml+xml'}});
  if(!response.ok) throw new Error(`Upstream ${response.status}`);
  return response.text();
}

function extractProductLinks(html){
  const links=[];
  const regex=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for(const match of html.matchAll(regex)){
    const href=match[1]; if(!href.includes('/b/')) continue;
    links.push({url:new URL(href,STORE_ORIGIN).href,text:clean(match[2])});
  }
  return links;
}

function extractImage(html, baseUrl){
  const patterns=[
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /"image"\s*:\s*"(https?:\\?\/\\?\/[^"\\]+(?:\\.[^"\\]+)*)"/i,
    /<img[^>]+src=["'](https?:\/\/[^"']*(?:pe56d|payhip)[^"']+)["']/i
  ];
  for(const pattern of patterns){
    const match=html.match(pattern); if(match){
      const value=match[1].replace(/\\\//g,'/').replace(/&amp;/g,'&');
      try{return new URL(value,baseUrl).href;}catch{}
    }
  }
  return '';
}

async function getCatalogLinks(request,context){
  const cacheKey=new Request(new URL('/api/_catalog-index-v1',request.url).href);
  const cached=await caches.default.match(cacheKey);
  if(cached) return cached.json();
  catalogPromise ||= (async()=>{
    const results=await Promise.allSettled(CATALOG_PATHS.map(path=>fetchText(`${STORE_ORIGIN}${path}`)));
    const byUrl=new Map();
    for(const result of results){
      if(result.status!=='fulfilled') continue;
      for(const link of extractProductLinks(result.value)) if(!byUrl.has(link.url)) byUrl.set(link.url,link);
    }
    return [...byUrl.values()];
  })();
  const links=await catalogPromise;
  const response=Response.json(links,{headers:{'Cache-Control':'public, max-age=21600, s-maxage=21600'}});
  context.waitUntil(caches.default.put(cacheKey,response));
  return links;
}

async function findProduct(title,code,request,context){
  const links=await getCatalogLinks(request,context);
  let best={score:0,url:''};
  for(const link of links){
    const score=scoreCandidate(link.text,title,code);
    if(score>best.score) best={score,url:link.url};
  }
  return best.score>=0.34 ? best.url : '';
}

export async function onRequestGet(context){
  const {request}=context;
  const requestUrl=new URL(request.url);
  const cached=await caches.default.match(request);
  if(cached) return cached;
  const title=requestUrl.searchParams.get('title')||'';
  const code=requestUrl.searchParams.get('code')||'';
  const supplied=validStoreUrl(requestUrl.searchParams.get('url')||'');
  try{
    let productUrl=supplied?.href||'';
    if(!productUrl || productUrl.includes('/collection/')) productUrl=await findProduct(title,code,request,context) || productUrl || `${STORE_ORIGIN}/collection/all`;
    let imageUrl='';
    if(productUrl.includes('/b/')){
      const productHtml=await fetchText(productUrl);
      imageUrl=extractImage(productHtml,productUrl);
    }
    const body=JSON.stringify({productUrl,imageUrl,resolved:Boolean(productUrl.includes('/b/'))});
    const response=new Response(body,{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=86400, s-maxage=86400','X-Content-Type-Options':'nosniff'}});
    context.waitUntil(caches.default.put(request,response.clone()));
    return response;
  }catch(error){
    return Response.json({productUrl:supplied?.href||`${STORE_ORIGIN}/collection/all`,imageUrl:'',resolved:false,error:'Upstream catalog could not be resolved.'},{status:200,headers:{'Cache-Control':'public, max-age=300'}});
  }
}
