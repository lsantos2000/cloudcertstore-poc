export function onRequestGet(){return Response.json({status:'ok',service:'cloudcertstore-poc',timestamp:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}})}
