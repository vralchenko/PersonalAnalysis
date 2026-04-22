const DIMENSIONS = {
  love: {
    title: "Romantic Compatibility",
    framing: "romantic relationship and long-term partnership"
  },
  family: {
    title: "Family Compatibility",
    framing: "building or being in a family together (household values, parenting approach, day-to-day family dynamics)"
  },
  business: {
    title: "Business Partnership",
    framing: "co-founding or running a business together (vision alignment, complementary skills, decision-making, risk tolerance, financial mindset)"
  },
  work: {
    title: "Work Collaboration",
    framing: "working together as colleagues (communication style, work pace, conflict handling, professional values)"
  },
  friendship: {
    title: "Friendship Compatibility",
    framing: "long-term friendship (shared values, social energy, life-stage alignment, what each gives the other)"
  },
  overall: {
    title: "Overall Compatibility",
    framing: "general life-compatibility across multiple dimensions (love, family, work, friendship) — give a holistic picture"
  }
};

function buildPrompt(p1, p2, dimension) {
  const dim = DIMENSIONS[dimension];
  return `Compare two people on the dimension of ${dim.framing}.

Person A: born ${p1.date} in ${p1.place}.${p1.extra ? ' Context: ' + p1.extra + '.' : ''}
Person B: born ${p2.date} in ${p2.place}.${p2.extra ? ' Context: ' + p2.extra + '.' : ''}

Use generational psychology, sociology, and behavioral economics. Consider how the historical events, cultural environment, and economic conditions of each person's birth context shaped their values, communication style, expectations, and emotional patterns relevant to ${dim.framing}.

Structure your answer as:
1. **Where they align** — concrete strengths of this pairing.
2. **Where they may clash** — likely friction points and why.
3. **What each brings** — what Person A uniquely contributes, what Person B uniquely contributes.
4. **Practical advice** — 3-5 specific, actionable suggestions for making this work well.
5. **Overall fit** — a short honest summary (1-2 sentences).

Be specific, evidence-based, warm but professional. Never use astrology. Write 500-650 words.`;
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
    const { person1, person2, dimension, language } = await request.json();

    if (!person1?.date || !person1?.place || !person2?.date || !person2?.place || !dimension) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!DIMENSIONS[dimension]) {
      return new Response(JSON.stringify({ error: 'Invalid dimension' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const systemPrompt = `You are an expert in generational psychology, sociology, and behavioral economics. You analyze compatibility between two people using historical context, cultural environment, and evidence-based behavioral patterns. You NEVER use astrology. Your tone is warm, honest, practical, and empathetic.${language === 'ru' ? ' Respond entirely in Russian. Do not use any other languages — no English words, no characters from other scripts (Thai, Korean, Chinese, Japanese, etc.). Every word must be in Russian.' : ''}`;

    const userPrompt = buildPrompt(person1, person2, dimension);

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
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
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
