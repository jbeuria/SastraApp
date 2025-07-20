// @ts-nocheck
import { browser } from '$app/environment';

const defaultSettings = {
    toc: [],
    fontSize: 18,
    mode: 'books', // Default mode set to 'books'
    theme: 'light',
    vc: {
        showTranslation: true,
        showSynonyms: true,
        showDevanagari: true,
        showRoman: true,
        showPurport: true
    },
    // 'id' and 'code' are dynamic and not part of static default settings.
    availableVoices: [],
    selectedVoiceURI: null
};

function loadSettings() {
    if (browser) {
        const saved = localStorage.getItem('sastra-app-settings');
        if (saved) {
            const parsed = JSON.parse(saved);

            // Remove dynamic properties that should not be loaded from localStorage as part of settings
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
        // Do not save 'toc' or 'availableVoices' to localStorage as they are dynamically loaded
        delete settingsToSave.toc;
        delete settingsToSave.availableVoices;
        localStorage.setItem('sastra-app-settings', JSON.stringify(settingsToSave));
    }
};