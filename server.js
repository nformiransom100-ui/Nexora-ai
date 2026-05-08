const express=require('express');const express = require('express');
const path = require('path');
const https = require('https');
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', function(req, res) {
  res.json({
    status: 'ok',
    openrouter: !!process.env.OPENROUTER_API_KEY,
    node: process.version
  });
});

// ── Chat endpoint ─────────────────────────────────────────────────────────────
app.post('/api/chat', function(req, res) {
  console.log('[Nova AI] POST /api/chat received');

  var key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.error('[Nova AI] ERROR: OPENROUTER_API_KEY is not set');
    return res.json({ content: 'API key missing. Please add OPENROUTER_API_KEY to Railway environment variables.' });
  }

  var messages = req.body.messages || [];
  var mode = req.body.mode || 'chat';

  console.log('[Nova AI] Mode:', mode, '| Messages:', messages.length);

  var systemPrompts = {
    chat:       'You are Nova AI, a helpful and friendly AI assistant.',
    code:       'You are Nova AI, an expert coding assistant. Always use code blocks with language tags.',
    write:      'You are Nova AI, a professional writing assistant.',
    analyze:    'You are Nova AI, a data analysis expert.',
    brainstorm: 'You are Nova AI, a creative brainstorming partner.',
    advice:     'You are Nova AI, a thoughtful and practical advisor.',
    summarize:  'You are Nova AI, a summarization expert. Be concise and clear.',
    translate:  'You are Nova AI, a multilingual translation assistant.',
    image:      'You are Nova AI. Help the user write effective image generation prompts.',
    search:     'You are Nova AI. Answer questions clearly and helpfully.',
    research:   'You are Nova AI, a research assistant. Provide structured, detailed answers.'
  };

  var allMessages = [
    { role: 'system', content: systemPrompts[mode] || systemPrompts.chat }
  ].concat(messages);

  var bodyData = JSON.stringify({
    model: 'meta-llama/llama-3.1-8b-instruct:free',
    messages: allMessages,
    max_tokens: 1024,
    temperature: 0.7
  });

  console.log('[Nova AI] Sending to OpenRouter, model: meta-llama/llama-3.1-8b-instruct:free');

  var options = {
    hostname: 'openrouter.ai',
    port: 443,
    path: '/api/v1/chat/completions',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyData),
      'HTTP-Referer': 'https://nova-ai.app',
      'X-Title': 'Nova AI'
    }
  };

  var responded = false;

  var request = https.request(options, function(response) {
    console.log('[Nova AI] OpenRouter status:', response.statusCode);
    var body = '';
    response.on('data', function(chunk) { body += chunk; });
    response.on('end', function() {
      if (responded) return;
      responded = true;
      console.log('[Nova AI] Raw response length:', body.length);
      try {
        var json = JSON.parse(body);
        // Check for API error
        if (json.error) {
          console.error('[Nova AI] API error:', json.error);
          var errMsg = json.error.message || JSON.stringify(json.error);
          return res.json({ content: 'AI error: ' + errMsg });
        }
        // Extract content
        var content = '';
        if (json.choices && json.choices[0] && json.choices[0].message) {
          content = json.choices[0].message.content || '';
        }
        if (!content) {
          console.warn('[Nova AI] Empty content in response:', JSON.stringify(json).slice(0, 200));
          return res.json({ content: 'The AI returned an empty response. Please try again.' });
        }
        console.log('[Nova AI] Success, content length:', content.length);
        res.json({ content: content });
      } catch (parseErr) {
        console.error('[Nova AI] JSON parse error:', parseErr.message);
        console.error('[Nova AI] Raw body:', body.slice(0, 300));
        res.json({ content: 'Failed to parse AI response. Please try again.' });
      }
    });
  });

  // Timeout after 30 seconds
  request.setTimeout(30000, function() {
    if (!responded) {
      responded = true;
      console.error('[Nova AI] Request timed out after 30s');
      request.destroy();
      res.json({ content: 'Request timed out. Please try again.' });
    }
  });

  request.on('error', function(err) {
    if (!responded) {
      responded = true;
      console.error('[Nova AI] HTTPS request error:', err.message);
      res.json({ content: 'Network error: ' + err.message });
    }
  });

  request.write(bodyData);
  request.end();
});

// ── Serve frontend ────────────────────────────────────────────────────────────
app.get('*', function(req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start server ──────────────────────────────────────────────────────────────
var PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', function() {
  console.log('Nova AI running on port ' + PORT);
  console.log('OPENROUTER_API_KEY set:', !!process.env.OPENROUTER_API_KEY);
});
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
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              
