// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

// Replace with your actual Supabase project URL and anon key
const supabaseUrl = 'https://bhgzxsnbuhkzwaoiknuj.supabase.co';
const supabaseKey =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoZ3p4c25idWhrendhb2lrbnVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwNTU1NjAsImV4cCI6MjA1MTYzMTU2MH0.8bMvTq27K3njcenyeXJ3pbBuzVFaUtGAI-h13px0rDw';

export const supabase = createClient(supabaseUrl, supabaseKey, {
	auth: {
		persistSession: true
	}
});

// --- Authentication ---
export const handleLogin = async (email, password) => {
	const { user, error } = await supabase.auth.signInWithPassword({
		email,
		password
	});
	if (error) throw new Error(error.message);
	return user;
};

export const handleSignup = async (email, password, displayName) => {
	const { user, error } = await supabase.auth.signUp({
		email,
		password,
		options: {
			data: { display_name: displayName }
		}
	});
	if (error) throw new Error(error.message);
	return user;
};

export const handleGoogleSignIn = async () => {
	const { user, error } = await supabase.auth.signInWithOAuth({
		provider: 'google'
	});
	if (error) throw new Error(error.message);
	return user;
};

export const handleLogout = async () => {
	const { error } = await supabase.auth.signOut();
	if (error) throw new Error(error.message);
};

export async function getAuthInfo() {
	const {
		data: { session },
		error
	} = await supabase.auth.getSession();
	if (error) {
		console.error('Error fetching session:', error.message);
	}
	return {
		user: session?.user.user_metadata || null,
		role: session?.user.app_metadata?.role || null
	};
}

// --- Data Fetching ---
export const fetchOnlineToc = async () => {
	try {
		const { data, error } = await supabase.from('books').select('short_name,full_name,code');
		let toc = {};

		if (error) {
			console.error('Error fetching books list:', error);
			return [];
		} else {
			for (const b of data) {
				const toc_temp = await fetchAndReadZip(`toc_${b.code}.json.zip`);
				toc[b.code] = toc_temp;
			}
		}
		return toc ?? [];
	} catch (e) {
		console.log(e);
		return [];
	}
};

const fetchAndReadZip = async (fileName) => {
	try {
		const { data, error } = await supabase.storage.from('toc').download(fileName);
		if (error) throw new Error(`Error downloading file: ${error.message}`);

		const zip = await JSZip.loadAsync(await data.arrayBuffer());
		const jsonFileName = fileName.replace('.zip', '');
		const jsonContent = await zip.files[jsonFileName].async('string');

		return JSON.parse(jsonContent);
	} catch (err) {
		console.error('Error reading zip file:', err.message);
		return [];
	}
};

export const fetchOnlineBookContent = async (code, url, isCollection) => {
	try {
		if (isCollection) {
			const { data, error } = await supabase.from(code).select('*').like('verse_url', `${url}/%`);
			if (error) throw error;
			return data ?? [];
		} else {
			const { data, error } = await supabase.from(code).select('*').eq('verse_url', url);
			if (error) throw error;
			return data ?? [];
		}
	} catch (e) {
		console.log(e);
		return [];
	}
};

// --- User Data Sync (Highlights & Notes) ---
export async function syncHighlightToSupabase(highlight) {
	const { error } = await supabase.from('highlights').insert(highlight);
	if (error) console.error('Highlight sync error', error);
}

export async function fetchHighlightsFromSupabase(tocURL) {
	const { data, error } = await supabase.from('highlights').select('*').eq('toc_url', tocURL);
	if (error) {
		console.error('Error fetching highlights from Supabase:', error);
		return [];
	}
	return data;
}

export async function deleteHighlightFromSupabase(highlight) {
	if (!highlight || !highlight.id) {
		console.error('Cannot delete highlight without an ID.', highlight);
		return;
	}
	const { error } = await supabase.from('highlights').delete().match({ id: highlight.id });

	if (error) {
		console.error('Failed to delete highlight from Supabase:', error);
		throw error;
	}
}

export async function syncNoteToSupabase(tocURL, noteText) {
    // An upsert requires the user_id to be set, assuming RLS is on.
    // This is typically done via a default value or in an edge function.
    // For client-side, let's assume the table schema handles it.
	const { error } = await supabase.from('notes').upsert({ toc_url: tocURL, text: noteText });
	if (error) console.error('Note sync error', error);
}

export async function fetchNoteFromSupabase(tocURL) {
	const { data, error } = await supabase.from('notes').select('*').eq('toc_url', tocURL).single();
	if (error && error.code !== 'PGRST116') { // Ignore error for "no rows found"
        console.error(error);
    }
	return data;
}

export async function bulkDeleteNotesFromSupabase(urls) {
	if (!urls || urls.length === 0) return;
	const { error } = await supabase.from('notes').delete().in('toc_url', urls);

	if (error) {
		console.error('Failed to bulk delete notes from Supabase:', error);
		throw error;
	}
}