const express=require('express');
const path=require('path');
const app=express();
app.use(express.json());
app.use(express.static(__dirname));
app.post('/api/chat',function(req,res){
const key=process.env.OPENROUTER_API_KEY;
if(!key){return res.json({content:'No API key'});}
const messages=req.body.messages||[];
const mode=req.body.mode||'chat';
const data=JSON.stringify({model:'meta-llama/llama-3.1-8b-instruct:free',messages:[{role:'system',content:'You are Nova AI, a helpful assistant.'}].concat(messages),max_tokens:1024});
const https=require('https');
const opts={hostname:'openrouter.ai',path:'/api/v1/chat/completions',method:'POST',headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}};
const r=https.request(opts,function(resp){let b='';resp.on('data',function(c){b+=c;});resp.on('end',function(){try{const j=JSON.parse(b);res.json({content:j.choices[0].message.content});}catch(e){res.json({content:'Error parsing response'});}});});
r.on('error',function(e){res.json({content:'Request failed'});});
r.write(data);
r.end();
});
app.get('*',function(req,res){res.sendFile(path.join(__dirname,'index.html'));});
app.listen(process.env.PORT||3000,'0.0.0.0',function(){console.log('Nova AI running');});
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     
