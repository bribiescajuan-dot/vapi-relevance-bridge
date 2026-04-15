import express from 'express';

const app = express();
app.use(express.json());

const REGION = 'bcbe5a';
const AUTH = '77bfc173-f9f4-4e2d-ab24-ccba367741de:sk-YTZmM2JhZWYtNzZkNy00NWJlLTkwNzgtNmQ3YjAwZjgwMjg5';
const AGENT_ID = '3f5009a7-11d1-43f3-8ad8-4c8702c19110';
const BASE_URL = `https://api-${REGION}.stack.tryrelevance.com/latest`;

const conversations = {};

app.post('/chat/completions', async (req, res) => {
  const messages = req.body.messages;
  const callId = req.body.call?.id || 'default';

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  const userText = lastUserMsg?.content || '';

  const payload = {
    message: { role: 'user', content: userText },
    agent_id: AGENT_ID,
  };
  if (conversations[callId]) {
    payload.conversation_id = conversations[callId];
  }

  const triggerRes = await fetch(`${BASE_URL}/agents/trigger`, {
    method: 'POST',
    headers: { 'Authorization': AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const job = await triggerRes.json();

  if (job.conversation_id) conversations[callId] = job.conversation_id;

  const studioId = job.job_info?.studio_id;
  const jobId = job.job_info?.job_id;

  let answer = 'Dame un momento...';
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const pollRes = await fetch(
      `${BASE_URL}/studios/${studioId}/async_poll/${jobId}`,
      { headers: { 'Authorization': AUTH } }
    );
    const status = await pollRes.json();
    const success = status.updates?.find(u => u.type === 'chain-success');
    if (success) {
      answer = success.output?.output?.answer
             || success.output?.answer
             || success.output?.output
             || 'Listo.';
      break;
    }
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.write(`data: ${JSON.stringify({
    choices: [{ delta: { content: answer }, finish_reason: null }]
  })}\n\n`);
  res.write(`data: ${JSON.stringify({
    choices: [{ delta: {}, finish_reason: 'stop' }]
  })}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
});

app.listen(3000, () => console.log('Puente corriendo en puerto 3000'));
