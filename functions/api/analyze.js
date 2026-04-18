const PROMPTS = {
  childhood: {
    title: "Childhood Context Decoder",
    prompt: (date, place, extra) => `Using global events, cultural shifts, and generational psychology, outline the most common childhood experiences for people born on ${date} in ${place}. ${extra ? 'Additional context: ' + extra + '.' : ''} Focus on shared influences, formative environments, and how these shaped mindset, behavior, and early identity. Be specific about historical events that affected this exact region and time. Write 400-500 words.`
  },
  personality: {
    title: "Personality Evolution Map",
    prompt: (date, place, extra) => `Using ${date} as a reference point for someone born in ${place}, ${extra ? 'with this context: ' + extra + '. ' : ''}describe the personality traits and worldviews they likely developed over time. Compare these patterns with people born earlier and later to highlight what uniquely defines this generation's thinking, values, and motivations. Write 400-500 words.`
  },
  career: {
    title: "Career Compass",
    prompt: (date, place, extra) => `Based on the economic conditions, cultural trends, and technological landscape for someone born on ${date} in ${place}, ${extra ? 'additional context: ' + extra + '. ' : ''}suggest career paths or industries they may be naturally aligned with. Explain how these roles connect to generational strengths, work preferences, and long-term fulfillment. Write 400-500 words.`
  },
  relationships: {
    title: "Relationship Pattern Scan",
    prompt: (date, place, extra) => `Analyze the relationship tendencies commonly associated with people born on ${date} in ${place}. ${extra ? 'Context: ' + extra + '.' : ''} Focus on evidence-based behavioral and psychological patterns, including communication style, attachment tendencies, conflict responses, and growth opportunities. Avoid astrology entirely. Write 400-500 words.`
  },
  money: {
    title: "Money Mindset Matrix",
    prompt: (date, place, extra) => `Considering economic cycles and generational shifts, explain how someone born on ${date} in ${place} ${extra ? '(' + extra + ') ' : ''}is likely to approach money, risk, saving, and long-term wealth building. Highlight common strengths, blind spots, and mindset patterns that shape financial decisions. Write 400-500 words.`
  },
  struggles: {
    title: "Hidden Struggle Finder",
    prompt: (date, place, extra) => `From a psychological perspective, identify potential blind spots shaped by the generational timeline for someone born on ${date} in ${place}. ${extra ? 'Additional context: ' + extra + '.' : ''} Explain how these blind spots tend to show up in daily life and provide practical strategies to overcome them and convert them into advantages. Write 400-500 words.`
  },
  roadmap: {
    title: "Life Roadmap",
    prompt: (date, place, extra) => `Map out the major opportunities, challenges, and growth phases someone born on ${date} in ${place} ${extra ? '(' + extra + ') ' : ''}is likely to encounter across life stages. Present this as a clear roadmap with key lessons, priorities, and decisions to focus on at each major decade/phase of life. Write 500-600 words.`
  }
};

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
    const { birthDate, birthPlace, section, extraInfo, language } = await request.json();

    if (!birthDate || !birthPlace || !section) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const promptConfig = PROMPTS[section];
    if (!promptConfig) {
      return new Response(JSON.stringify({ error: 'Invalid section' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const systemPrompt = `You are an expert in generational psychology, sociology, and behavioral economics. You provide deep, evidence-based personal analysis using historical events, economic cycles, cultural shifts, and psychological research. You NEVER use astrology. Your analysis is practical, insightful, and empathetic. Write in a warm but professional tone.${language === 'ru' ? ' Respond entirely in Russian.' : ''}`;

    const userPrompt = promptConfig.prompt(birthDate, birthPlace, extraInfo);

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
