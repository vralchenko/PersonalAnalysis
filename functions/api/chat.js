export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let { messages, language } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing messages' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const systemPrompt = `You are a warm, empathetic coach helping someone navigate an interpersonal conflict. You have already provided an initial analysis. Now you are in an ongoing conversation. Be concise (150-300 words per reply unless asked for more). Help the user: understand the other person's perspective, draft messages/replies, plan next steps, or process their emotions. Stay balanced — never take sides. If asked to draft a message, provide a ready-to-send version.${language === 'ru' ? ' Respond entirely in Russian. Do not use any other languages — no English words, no characters from other scripts (Thai, Korean, Chinese, Japanese, etc.). Every word must be in Russian.' : ''}`;

    // Token budget: if total chars > 24000, keep system + first user + first assistant + last N pairs
    const totalChars = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
    if (totalChars > 24000 && messages.length > 4) {
      const firstUser = messages[0];
      const firstAssistant = messages[1];
      const remaining = messages.slice(2);
      // Keep last N pairs that fit
      let charBudget = 24000 - (firstUser.content?.length || 0) - (firstAssistant.content?.length || 0);
      let cutIndex = remaining.length;
      let runningChars = 0;
      for (let i = remaining.length - 1; i >= 0; i--) {
        runningChars += remaining[i].content?.length || 0;
        if (runningChars > charBudget) { cutIndex = i + 1; break; }
      }
      messages = [firstUser, firstAssistant, ...remaining.slice(cutIndex)];
    }

    // Prepend system message
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    const response = await fetch(env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.AI_MODEL_NAME || 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: apiMessages,
        temperature: 0.6,
        max_tokens: 2048,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: 'AI API error', details: err }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
