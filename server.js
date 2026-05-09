const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

app.post('/api/chat', async (req, res) => {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return res.status(500).json({ error: 'OpenRouter key missing' });

  const { messages = [], mode = 'chat', stream = false } = req.body;

  const systemPrompts = {
    chat: 'You are Nova AI, a helpful and friendly AI assistant.',
    code: 'You are Nova AI, an expert coding assistant. Always use code blocks.',
    write: 'You are Nova AI, a professional writing assistant.',
    analyze: 'You are Nova AI, a data analysis expert.',
    brainstorm: 'You are Nova AI, a creative brainstorming partner.',
    advice: 'You are Nova AI, a thoughtful advisor.',
    summarize: 'You are Nova AI, a summarization expert.',
    translate: 'You are Nova AI, a multilingual translation assistant.',
    image: 'You are Nova AI. Help users craft effective image generation prompts.',
    search: 'You are Nova AI. Answer questions clearly and helpfully.',
    research: 'You are Nova AI, a research assistant.',
  };

  const body = {
    model: 'anthropic/claude-3-haiku',
    stream,
    messages: [
      { role: 'system', content: systemPrompts[mode] || systemPrompts.chat },
      ...messages,
    ],
    max_tokens: 2048,
  };

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://nova-ai.app',
        'X-Title': 'Nova AI',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(500).json({ error: err.error?.message || 'AI error' });
    }

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) { res.end(); break; }
        res.write(decoder.decode(value));
      }
    } else {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      res.json({ content });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
  console.log('Nova AI running');
});
