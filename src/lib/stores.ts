import { writable } from 'svelte/store';

// Store for whether to show directional help (left/right markers).
// Default: false. Persisted to localStorage under key `showDirectionalHelp`.
const key = 'showDirectionalHelp';
const initial = typeof window !== 'undefined' && window.localStorage.getItem(key) === 'true';

export const showDirectionalHelp = writable<boolean>(initial ?? false);

if (typeof window !== 'undefined') {
    showDirectionalHelp.subscribe((v) => {
        try {
            window.localStorage.setItem(key, v ? 'true' : 'false');
        } catch (e) {
            // ignore
        }
    });
}
