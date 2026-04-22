function buildChallengePrompt(person1, person2, compatibilitySummary, conflictText, chatText) {
  let prompt = `Analyze a conflict between two people and provide resolution advice.

Person A: born ${person1.date} in ${person1.place}.${person1.extra ? ' Context: ' + person1.extra + '.' : ''}
Person B: born ${person2.date} in ${person2.place}.${person2.extra ? ' Context: ' + person2.extra + '.' : ''}
`;

  if (compatibilitySummary) {
    prompt += `\nCompatibility context (from prior analysis):\n${compatibilitySummary.slice(0, 4000)}\n`;
  }

  if (conflictText) {
    prompt += `\nConflict description:\n${conflictText}\n`;
  }

  if (chatText) {
    prompt += `\nChat history between them:\n${chatText.slice(0, 8000)}\n`;
  }

  prompt += `
If screenshots are attached, analyze them carefully as additional evidence of the conflict.

Structure your response as:
1. **What's happening** — objective description of the conflict situation.
2. **Why it's happening** — connect to both people's profiles, generational values, and communication patterns.
3. **Person A's perspective** — what they likely feel and why.
4. **Person B's perspective** — what they likely feel and why.
5. **How to respond** — specific, practical advice for navigating this situation.
6. **Next steps** — 3-5 actionable items to move forward.
7. **Best practices** — ongoing habits to prevent similar conflicts.

Be empathetic, specific, and practical. Never take sides. Use evidence from the profiles, chat history, and screenshots. Write 600-900 words.
IMPORTANT: You MUST respond in the same language as the system prompt instructs. If told to respond in Russian, your ENTIRE response must be in Russian, regardless of the language of the chat history or conflict description.`;

  return prompt;
}

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
    const { person1, person2, compatibilitySummary, conflictText, images, chatText, language } = await request.json();

    if (!person1?.date || !person1?.place || !person2?.date || !person2?.place || (!conflictText && !chatText && (!images || images.length === 0))) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const systemPrompt = `You are an expert in conflict resolution, generational psychology, and interpersonal communication. You analyze conflicts between people using their background context, behavioral patterns, and communication evidence. You are empathetic, balanced, and never take sides. Your tone is warm, honest, and constructive.${language === 'ru' ? ' Respond entirely in Russian.' : ''}`;

    const userPrompt = buildChallengePrompt(person1, person2, compatibilitySummary, conflictText, chatText);

    // Build multimodal content array
    const userContent = [{ type: 'text', text: userPrompt }];

    if (images && images.length > 0) {
      for (const img of images.slice(0, 3)) {
        userContent.push({
          type: 'image_url',
          image_url: { url: img }
        });
      }
    }

    const response = await fetch(env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.AI_MODEL_NAME || 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: 0.6,
        max_tokens: 3072,
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
