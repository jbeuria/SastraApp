// /src/lib/store.svelte.js
// @ts-nocheck
import { browser } from '$app/environment';

const defaultSettings = {
	toc: [],
	fontSize: 18,
	mode: 'books',
	theme: 'light',
	vc: {
		showTranslation: true,
		showSynonyms: true,
		showDevanagari: true,
		showRoman: true,
		showPurport: true
	},
	id: null,
	code: null,
	availableVoices: [],
	selectedVoiceURI: null
};

function loadSettings() {
	if (browser) {
		const saved = localStorage.getItem('sastra-app-settings');
		if (saved) {
			const parsed = JSON.parse(saved);
			// EDITED: Add this line to always start in 'books' mode
			parsed.mode = 'books';

			delete parsed.availableVoices;
			delete parsed.toc;
			return { ...defaultSettings, ...parsed };
		}
	}
	return defaultSettings;
}

export let settings = $state(loadSettings());

export const writeSettings = async () => {
	if (browser) {
		const settingsToSave = { ...settings };
		delete settingsToSave.toc;
		delete settingsToSave.availableVoices;
		localStorage.setItem('sastra-app-settings', JSON.stringify(settingsToSave));
	}
};