'use strict';

const express = require('express');
const https   = require('https');
const path    = require('path');
const app     = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Static files
app.use(express.static(__dirname));

// ── System prompts ────────────────────────────────────────────────────────────
const PROMPTS = {
  chat:       'You are Nova AI, a helpful and friendly AI assistant.',
  code:       'You are Nova AI, an expert coding assistant. Always wrap code in fenced code blocks with the language tag.',
  write:      'You are Nova AI, a professional writing assistant. Help craft clear, compelling content.',
  analyze:    'You are Nova AI, a data analysis expert. Provide structured insights and clear explanations.',
  brainstorm: 'You are Nova AI, a creative brainstorming partner. Generate diverse, imaginative ideas.',
  advice:     'You are Nova AI, a thoughtful and practical advisor. Give balanced, actionable guidance.',
  summarize:  'You are Nova AI, a summarization expert. Be concise, accurate, and well-structured.',
  translate:  'You are Nova AI, a multilingual translation assistant. Preserve tone and nuance.',
  image:      'You are Nova AI. Help users craft vivid, detailed image generation prompts.',
  research:   'You are Nova AI, a research assistant. Provide structured, well-sourced answers.',
};

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', function (req, res) {
  res.json({
    status:     'ok',
    openrouter: !!process.env.OPENROUTER_API_KEY,
    flux:       !!process.env.FLUX_API_KEY,
    node:       process.version,
    uptime:     Math.floor(process.uptime()) + 's',
  });
});

// ── Chat endpoint ─────────────────────────────────────────────────────────────
app.post('/api/chat', function (req, res) {
  var key = process.env.OPENROUTER_API_KEY;

  if (!key) {
    console.warn('[Nova AI] OPENROUTER_API_KEY not set');
    return res.json({
      content: 'OpenRouter API key is missing. Please add OPENROUTER_API_KEY to your Railway environment variables.',
    });
  }

  var messages = Array.isArray(req.body.messages) ? req.body.messages : [];
  var mode     = req.body.mode || 'chat';
  var system   = PROMPTS[mode] || PROMPTS.chat;

  console.log('[Nova AI] /api/chat | mode=' + mode + ' | messages=' + messages.length);

  var payload = JSON.stringify({
    model:       'meta-llama/llama-3.1-8b-instruct:free',
    max_tokens:  1024,
    temperature: 0.7,
    messages:    [{ role: 'system', content: system }].concat(messages),
  });

  var options = {
    hostname: 'openrouter.ai',
    port:     443,
    path:     '/api/v1/chat/completions',
    method:   'POST',
    headers: {
      'Authorization':  'Bearer ' + key,
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'HTTP-Referer':   'https://nova-ai.app',
      'X-Title':        'Nova AI',
    },
  };

  var finished = false;

  function sendOnce(data) {
    if (finished) return;
    finished = true;
    res.json(data);
  }

  var request = https.request(options, function (response) {
    console.log('[Nova AI] OpenRouter status:', response.statusCode);
    var body = '';

    response.on('data', function (chunk) { body += chunk; });

    response.on('end', function () {
      try {
        var json = JSON.parse(body);

        if (json.error) {
          var msg = (json.error && json.error.message) ? json.error.message : JSON.stringify(json.error);
          console.error('[Nova AI] API error:', msg);
          return sendOnce({ content: 'AI error: ' + msg });
        }

        var content = '';
        if (json.choices && json.choices[0] && json.choices[0].message) {
          content = json.choices[0].message.content || '';
        }

        if (!content) {
          console.warn('[Nova AI] Empty content. Raw:', body.slice(0, 200));
          return sendOnce({ content: 'The AI returned an empty response. Please try again.' });
        }

        console.log('[Nova AI] Success | length:', content.length);
        sendOnce({ content: content });

      } catch (parseErr) {
        console.error('[Nova AI] JSON parse error:', parseErr.message);
        console.error('[Nova AI] Raw body:', body.slice(0, 300));
        sendOnce({ content: 'Failed to parse the AI response. Please try again.' });
      }
    });

    response.on('error', function (err) {
      console.error('[Nova AI] Response stream error:', err.message);
      sendOnce({ content: 'Response stream error: ' + err.message });
    });
  });

  // Timeout — 30 seconds
  request.setTimeout(30000, function () {
    console.error('[Nova AI] Request timed out');
    request.destroy();
    sendOnce({ content: 'The request timed out. Please try again.' });
  });

  request.on('error', function (err) {
    console.error('[Nova AI] HTTPS request error:', err.message);
    sendOnce({ content: 'Network error: ' + err.message });
  });

  request.write(payload);
  request.end();
});

// ── Image generation endpoint ─────────────────────────────────────────────────
app.post('/api/generate-image', function (req, res) {
  var key = process.env.FLUX_API_KEY;

  if (!key) {
    console.warn('[Nova AI] FLUX_API_KEY not set');
    return res.json({ error: 'FLUX_API_KEY is missing. Add it to Railway environment variables.' });
  }

  var prompt = (req.body.prompt || '').trim();
  if (!prompt) return res.json({ error: 'Prompt is required.' });

  var enhanced = prompt + ', highly detailed, cinematic lighting, sharp focus, 4k, professional';
  console.log('[Nova AI] /api/generate-image | prompt:', enhanced.slice(0, 80));

  var payload = JSON.stringify({
    prompt:               enhanced,
    image_size:           'landscape_4_3',
    num_inference_steps:  4,
    num_images:           1,
    enable_safety_checker: true,
  });

  var options = {
    hostname: 'queue.fal.run',
    port:     443,
    path:     '/fal-ai/flux/schnell',
    method:   'POST',
    headers: {
      'Authorization':  'Key ' + key,
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  var finished = false;

  function sendOnce(data) {
    if (finished) return;
    finished = true;
    res.json(data);
  }

  var request = https.request(options, function (response) {
    console.log('[Nova AI] fal.ai status:', response.statusCode);
    var body = '';

    response.on('data', function (chunk) { body += chunk; });

    response.on('end', function () {
      try {
        var json = JSON.parse(body);

        // Direct image result
        if (json.images && json.images[0]) {
          var url = json.images[0].url || json.images[0];
          console.log('[Nova AI] Image ready (direct)');
          return sendOnce({ url: url, prompt: prompt });
        }

        // Queued — poll for result
        if (json.request_id) {
          console.log('[Nova AI] Queued, polling request_id:', json.request_id);
          return pollImage(key, json.request_id, prompt, sendOnce, 0);
        }

        // Error response
        var errMsg = json.detail || json.error || JSON.stringify(json);
        console.error('[Nova AI] fal.ai error:', errMsg);
        sendOnce({ error: 'Image generation failed: ' + errMsg });

      } catch (e) {
        console.error('[Nova AI] fal.ai parse error:', e.message);
        sendOnce({ error: 'Failed to parse image provider response.' });
      }
    });
  });

  request.setTimeout(20000, function () {
    request.destroy();
    sendOnce({ error: 'Image request timed out. Please try again.' });
  });

  request.on('error', function (err) {
    console.error('[Nova AI] Image HTTPS error:', err.message);
    sendOnce({ error: 'Network error: ' + err.message });
  });

  request.write(payload);
  request.end();
});

function pollImage(key, requestId, prompt, sendOnce, attempt) {
  if (attempt > 20) {
    return sendOnce({ error: 'Image generation timed out after polling. Please try again.' });
  }

  var delay = attempt < 4 ? 2500 : 3500;

  setTimeout(function () {
    var options = {
      hostname: 'queue.fal.run',
      port:     443,
      path:     '/fal-ai/flux/schnell/requests/' + requestId,
      method:   'GET',
      headers:  { 'Authorization': 'Key ' + key },
    };

    var req = https.request(options, function (resp) {
      var body = '';
      resp.on('data', function (c) { body += c; });
      resp.on('end', function () {
        try {
          var json = JSON.parse(body);
          console.log('[Nova AI] Poll attempt', attempt + 1, '| status:', json.status || '?');

          if (json.status === 'COMPLETED' || (json.images && json.images[0])) {
            var url = (json.output && json.output.images && json.output.images[0] && json.output.images[0].url)
                   || (json.images && json.images[0] && json.images[0].url)
                   || (json.images && json.images[0]);
            if (url) {
              console.log('[Nova AI] Image ready (polled)');
              return sendOnce({ url: url, prompt: prompt });
            }
          }

          if (json.status === 'FAILED') {
            return sendOnce({ error: 'Image generation failed on the provider side.' });
          }

          pollImage(key, requestId, prompt, sendOnce, attempt + 1);

        } catch (e) {
          pollImage(key, requestId, prompt, sendOnce, attempt + 1);
        }
      });
    });

    req.on('error', function () {
      pollImage(key, requestId, prompt, sendOnce, attempt + 1);
    });

    req.end();
  }, delay);
}

// ── Catch-all → serve index.html ──────────────────────────────────────────────
app.get('*', function (req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start server ──────────────────────────────────────────────────────────────
var PORT = parseInt(process.env.PORT, 10) || 3000;

app.listen(PORT, '0.0.0.0', function () {
  console.log('─────────────────────────────────────────');
  console.log('  Nova AI Server started on port ' + PORT);
  console.log('  OpenRouter key : ' + (process.env.OPENROUTER_API_KEY ? '✓ set' : '✗ missing'));
  console.log('  Flux key       : ' + (process.env.FLUX_API_KEY       ? '✓ set' : '✗ missing'));
  console.log('─────────────────────────────────────────');
});
