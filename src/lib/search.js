// src/lib/search.js

// Import the Supabase client library and also the SupabaseClient type for JSDoc
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// --- Configuration ---
// IMPORTANT: For production, do NOT hardcode sensitive keys directly in frontend code.
// Consider securely fetching these from your Tauri Rust backend using `tauri::command`
// or using environment variables during your build process.
const SUPABASE_URL = "https://jgnjklnhkpxeaabfjdon.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnbmprbG5oa3B4ZWFhYmZqZG9uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTE4OTY2MywiZXhwIjoyMDY0NzY1NjYzfQ.L1cm3pDJgsnJk7j68uJo8mnDp-PmKLRQTEeyehbnrrs";
const TABLE_NAME = "Verses"; // Ensure this matches your table name exactly
const EMBEDDING_COLUMN_NAME = "e5_embeddings"; // Name of your vector column in Supabase (1024D for your case)

/**
 * @type {SupabaseClient | null}
 * This JSDoc comment tells VS Code's linter that 'supabase' can either be a SupabaseClient instance or null.
 * This helps resolve the "potentially null" warning.
 */
let supabase = null;
try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase client initialized successfully.");
} catch (e) {
    // Direct type assertion on 'e'
    /** @type {Error} */
    // @ts-ignore - Sometimes linters get too strict, this ignores the next line if it's a TS error
    const err = e; // Renamed to 'err' to avoid potential shadowing issues with other 'error' variables
    console.error(`Error initializing Supabase client: ${err.message}`);
    // In a real application, you might want to expose this error
    // to the UI or a global error handling system.
}

// --- JSDoc Type Definition for a Verse Document ---
/**
 * @typedef {object} VerseDocument
 * @property {number} id - The verse ID.
 * @property {string | null | undefined} eng_translation - English translation.
 * @property {string | null | undefined} purport - Purport text.
 * @property {string | null | undefined} text_devanagari - Devanagari text.
 * @property {string | null | undefined} text_roman - Roman text.
 * @property {string | null | undefined} verse_url - URL for the verse.
 * @property {number[] | null | undefined} [e5_embeddings] - The 1024D embedding array (optional as it might not always be selected).
 * @property {number | null | undefined} [similarity] - (Optional) Similarity score from vector search.
 */

// --- Helper Functions for Text Cleaning (replaces BeautifulSoup logic) ---

/**
 * Removes HTML tags and cleans up whitespace from text for embedding/display.
 * @param {string | null | undefined} text - The input text, potentially with HTML.
 * @returns {string} The cleaned text.
 */
function cleanTextForEmbedding(text) {
    if (text === null || text === undefined) {
        return "";
    }
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = String(text);
    const cleanedText = tempDiv.textContent || tempDiv.innerText || "";
    return cleanedText.replace(/\s+/g, ' ').trim();
}

/**
 * Removes HTML tags, converts to lowercase, and cleans up whitespace for keyword matching.
 * @param {string | null | undefined} text - The input text, potentially with HTML.
 * @returns {string} The cleaned, lowercase text.
 */
function cleanTextForKeywordMatch(text) {
    if (text === null || text === undefined) {
        return "";
    }
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = String(text);
    const cleanedText = tempDiv.textContent || tempDiv.innerText || "";
    return cleanedText.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Checks if any of the keywords are present in the relevant document columns.
 * @param {VerseDocument} documentRow - The database row object conforming to VerseDocument structure.
 * @param {string[]} keywords - An array of keywords to search for.
 * @returns {boolean} True if a match is found, False otherwise.
 */
function checkForKeywords(documentRow, keywords) {
    if (!keywords || keywords.length === 0) {
        return false;
    }

    const combinedDocText = [
        documentRow.eng_translation,
        documentRow.purport,
        documentRow.text_devanagari,
        documentRow.text_roman
    ].filter(Boolean)
     .join(" ");

    const cleanedCombinedDocText = cleanTextForKeywordMatch(combinedDocText);

    for (const keyword of keywords) {
        if (cleanedCombinedDocText.includes(keyword.toLowerCase())) {
            return true;
        }
    }
    return false;
}

// --- Query Embedding Generation (Crucial for your setup) ---
/**
 * Generates a 1024-dimensional embedding for the given query text.
 * THIS FUNCTION NEEDS TO BE IMPLEMENTED TO CALL A BACKEND SERVICE
 * (e.g., Supabase Edge Function, a dedicated Node.js/Python server, or Tauri Rust command)
 * that hosts or accesses the 'intfloat/multilingual-e5-large' model.
 *
 * @param {string} queryText - The text to embed.
 * @returns {Promise<number[]>} A promise that resolves to a 1024-dimensional array of numbers (the embedding).
 * @throws {Error} If the embedding cannot be generated or fetched.
 */
async function generateQueryEmbedding(queryText) {
    const prefixedQueryText = "query: " + queryText;

    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/embed-query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_KEY}`
            },
            body: JSON.stringify({ text: prefixedQueryText })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Backend embedding service responded with an error: ${response.status} ${response.statusText} - ${errorBody}`);
        }

        const data = await response.json();

        if (!data.embedding || !Array.isArray(data.embedding) || data.embedding.length !== 1024) {
            throw new Error(`Invalid embedding response from backend. Expected 1024D array, got: ${JSON.stringify(data)}`);
        }

        const sumSq = data.embedding.reduce(
            /** @param {number} acc @param {number} currentVal */
            (acc, currentVal) => acc + currentVal * currentVal,
            0
        );
        const magnitude = Math.sqrt(sumSq);
        if (magnitude === 0) {
            console.warn("Generated query embedding has zero norm. It might be invalid.");
            return data.embedding;
        }
        return data.embedding.map(
            /** @param {number} val */
            (val) => val / magnitude
        );

    } catch (e) {
        /** @type {Error} */
        // @ts-ignore - Ignore if TypeScript still complains, as we're handling it explicitly
        const err = e; // <-- RENAMED to 'err'
        console.error("Error in generateQueryEmbedding:", err); // Use 'err' here
        throw new Error(`Failed to generate query embedding: ${err.message}`); // Use 'err' here
    }
}


// --- Main Search Function: Hybrid Semantic Search (using Supabase RPC) ---
/**
 * Performs a hybrid search combining semantic search with keyword boosting
 * by calling a Supabase PostgreSQL RPC function.
 *
 * @param {string} queryText - The user's search query.
 * @param {number} [matchThreshold=0.8] - The minimum similarity score for semantic match.
 * @param {number} [keywordBoost=0.1] - The boost value added to similarity for keyword matches.
 * @param {number} [searchLimit=50] - The maximum number of results to fetch from the database. // ADDED THIS PARAMETER AND DEFAULT
 * @returns {Promise<{results?: VerseDocument[], error?: string}>}
 * containing 'results' (an array of matched documents) or an 'error' message.
 */
export async function semanticSearchSupabaseRpc(queryText, matchThreshold = 0.8, keywordBoost = 0.1, searchLimit = 50) { // ADDED searchLimit
    console.log(`\n--- Performing Hybrid Semantic Search for query: '${queryText}' ---`);

    if (!supabase) {
        return { error: "Supabase client not initialized. Cannot perform search." };
    }

    let queryEmbedding;
    try {
        queryEmbedding = await generateQueryEmbedding(queryText);
        if (!queryEmbedding || queryEmbedding.length !== 1024 || queryEmbedding.every(val => val === 0)) {
            console.warn("Generated query embedding is invalid or zero-norm. Aborting search.");
            return { error: "Failed to generate a valid query embedding. Please check the embedding service." };
        }
    } catch (e) {
        /** @type {Error} */
        // @ts-ignore
        const err = e; // <-- RENAMED to 'err'
        console.error(`Error preparing query embedding: ${err.message}`); // Use 'err'
        return { error: `Failed to prepare query embedding: ${err.message}` }; // Use 'err'
    }

    const keywords = queryText.split(' ').filter(word => word.length > 2).map(word => word.toLowerCase());
    console.log(`Keywords extracted for boosting: ${keywords}`);

    /** @type {VerseDocument[]} */
    let rpcResults = [];
    try {
        const { data, error } = await supabase.rpc(
            'match_e5_documents',
            {
                query_embedding: queryEmbedding,
                match_threshold: matchThreshold,
                match_count: searchLimit // <-- UNCOMMENTED AND USED THE PARAMETER HERE!
            }
        );

        if (error) {
            throw error; // This 'error' is from Supabase response, which VS Code usually understands.
        }

        rpcResults = data || [];

        if (rpcResults.length === 0) {
            console.log(`No semantic results found from Supabase for your query with a similarity above ${matchThreshold}.`);
            return { results: [] };
        }

    } catch (e) {
        /** @type {Error} */
        // @ts-ignore
        const err = e; // <-- RENAMED to 'err'
        console.error(`Error during Supabase RPC call: ${err.message}`); // Use 'err'
        console.error("Please ensure the 'match_e5_documents' PostgreSQL function exists and is correctly configured in your Supabase project.");
        return { error: `Supabase RPC error: ${err.message}` }; // Use 'err'
    }

    const boostedResults = [];
    for (const result of rpcResults) {
        let currentSimilarity = result.similarity || 0.0;

        if (checkForKeywords(result, keywords)) {
            const boostedSimilarity = currentSimilarity + keywordBoost;
            result.similarity = Math.min(boostedSimilarity, 1.0);
        } else {
            result.similarity = currentSimilarity;
        }
        boostedResults.push(result);
    }

    boostedResults.sort(
        /**
         * @param {VerseDocument} a
         * @param {VerseDocument} b
         */
        (a, b) => (b.similarity || 0) - (a.similarity || 0)
    );

    console.log(`Successfully fetched and processed ${boostedResults.length} results from Supabase RPC.`);
    return { results: boostedResults };
}

// --- Utility Function: Fetch a single verse by ID ---
/**
 * Fetches all details for a single verse from Supabase by its ID.
 * @param {number} verseId - The ID of the verse to fetch.
 * @returns {Promise<{verse?: VerseDocument, error?: string}>}
 * containing 'verse' data or an 'error' message.
 */
export async function getVerseById(verseId) {
    console.log(`Fetching full details for verse ID: ${verseId}`);
    if (!supabase) {
        return { error: "Supabase client not initialized. Cannot fetch verse." };
    }
    try {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select("id, eng_translation, text_devanagari, text_roman, purport, verse_url")
            .eq('id', verseId)
            .limit(1);

        if (error) {
            throw error;
        }

        if (data && data.length > 0) {
            /** @type {VerseDocument} */
            const verseData = data[0];

            verseData.eng_translation = cleanTextForEmbedding(verseData.eng_translation);
            verseData.text_devanagari = cleanTextForEmbedding(verseData.text_devanagari);
            verseData.text_roman = cleanTextForEmbedding(verseData.text_roman);
            verseData.purport = cleanTextForEmbedding(verseData.purport);
            return { verse: verseData };
        } else {
            console.log(`No verse found with ID: ${verseId}`);
            return { error: `No verse found with ID: ${verseId}` };
        }
    } catch (e) {
        /** @type {Error} */
        // @ts-ignore
        const err = e; // <-- RENAMED to 'err'
        console.error(`Error fetching verse by ID: ${err.message}`); // Use 'err'
        return { error: `Failed to fetch verse by ID: ${err.message}` }; // Use 'err'
    }
}