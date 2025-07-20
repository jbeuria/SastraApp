// supabase/functions/embed-query/index.ts
// This function will take text, send it to Hugging Face Inference API, and return its embedding.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const HF_API_TOKEN = Deno.env.get('HF_API_TOKEN');
const HF_INFERENCE_API_URL = 'https://api-inference.huggingface.co/models/intfloat/multilingual-e5-large';

serve(async (req) => {
  // --- Handle CORS (Preflight OPTIONS Request) ---
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204, // No Content
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:1420", // ALLOW YOUR TAURI APP'S ORIGIN
        "Access-Control-Allow-Methods": "POST, OPTIONS", // Allowed HTTP methods for this function
        "Access-Control-Allow-Headers": "Content-Type, Authorization", // Allowed headers
        "Access-Control-Max-Age": "86400", // Cache preflight response for 24 hours
      },
    });
  }

  // --- Handle Actual POST Request ---
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (!HF_API_TOKEN) {
    console.error("[Edge Function] Hugging Face API token not set in environment variables.");
    return new Response('Server configuration error: HF_API_TOKEN is missing.', { status: 500 });
  }

  const { text } = await req.json();
  if (!text || typeof text !== 'string') {
    return new Response('Missing or invalid "text" in request body.', { status: 400 });
  }

  const prefixedText = "query: " + text;
  console.log(`[Edge Function] Preparing to embed: "${prefixedText}"`);

  try {
    const hfResponse = await fetch(HF_INFERENCE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': "application/json",
        'Authorization': `Bearer ${HF_API_TOKEN}`,
      },
      body: JSON.stringify({
        inputs: prefixedText,
        options: {
            wait_for_model: true,
            use_cache: true
        }
      }),
    });

    if (!hfResponse.ok) {
      const errorBody = await hfResponse.text();
      console.error(`[Edge Function] Hugging Face API error response: ${hfResponse.status} - ${errorBody}`);
      return new Response(`Hugging Face API error: ${errorBody}`, { status: hfResponse.status });
    }

    let embeddings = await hfResponse.json();

    let embedding: number[];

    if (Array.isArray(embeddings) && typeof embeddings[0] === 'number' && embeddings.length === 1024) {
        embedding = embeddings;
    } else if (Array.isArray(embeddings) && Array.isArray(embeddings[0]) && embeddings[0].length === 1024) {
        embedding = embeddings[0];
    } else {
        console.error("[Edge Function] Invalid embedding format received from Hugging Face API, unexpected structure:", embeddings);
        return new Response('Invalid embedding format received from external API. Expected 1024D array.', { status: 500 });
    }

    const sumSq = embedding.reduce((sum, val) => sum + val * val, 0);
    const magnitude = Math.sqrt(sumSq);
    const normalizedEmbedding = magnitude === 0 ? embedding : embedding.map(val => val / magnitude);

    return new Response(
      JSON.stringify({ embedding: normalizedEmbedding }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "http://localhost:1420", // <--- ADDED: ALLOW YOUR TAURI APP'S ORIGIN
        }
      }
    );

  } catch (error) {
    console.error('[Edge Function] Failed to process embedding request due to an internal error:', error);
    return new Response(`Internal server error: ${error.message}`, { status: 500 });
  }
});