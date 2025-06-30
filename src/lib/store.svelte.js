// @ts-nocheck
import { browser } from '$app/environment';

// 1. Define the default settings for the app.
// This is used for first-time users or if settings can't be loaded.
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
	code: null
};

// 2. Create a function to load settings from the browser's localStorage.
function loadSettings() {
	// Only run this code in the browser, not on the server.
	if (browser) {
		const saved = localStorage.getItem('sastra-app-settings');
		if (saved) {
			// If settings are found, parse them and merge with defaults
			// to ensure all keys are present even after an update.
			return { ...defaultSettings, ...JSON.parse(saved) };
		}
	}
	// If in the server or no saved settings, return the defaults.
	return defaultSettings;
}

// 3. Initialize the reactive settings state by calling loadSettings().
export let settings = $state(loadSettings());

// 4. Create the function to write settings to localStorage.
// This function will be called by your +page.svelte component.
export const writeSettings = async () => {
	if (browser) {
        // We create a plain copy to save, ensuring we don't store the large 'toc' array.
		const settingsToSave = { ...settings };
        delete settingsToSave.toc;

		localStorage.setItem('sastra-app-settings', JSON.stringify(settingsToSave));
	}
};