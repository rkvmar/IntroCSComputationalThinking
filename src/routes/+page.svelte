<script lang="ts">
	//imports
	import Grid from '$lib/components/Grid.svelte';
	import Header from '$lib/components/Header.svelte';
	import Tf2Coconut from '$lib/components/TF2Coconut.svelte';
	import { onMount } from 'svelte';
	import { confetti } from '@tsparticles/confetti';

	// door interface
	interface Door {
		type: 'door';
		id: string;
		defaultCode: { condition: string; ifCommands: string[]; elseCommands: string[] };
		currentCode?: { condition: string; ifCommands: string[]; elseCommands: string[] };
		allowedConditions: string[];
		allowedActions: string[];
		conditionsEditable: boolean;
		actionsEditable: boolean;
		isOpen?: boolean;
	}

	// key interface
	interface Key {
		type: 'key';
		id: string;
		collected: boolean;
	}

	// level interface
	interface Level {
		title: string;
		contents: (number | Door | Key)[][];
		allowedCommands: string[];
		maxBlocks?: number;
	}

	function getMaxFromLocalStorage(): number {
		if (typeof window === 'undefined') return 0;
		const v = window.localStorage.getItem('maxUnlockedLevel');
		if (v !== null) {
			maxUnlockedLevel = Number(v);
			return maxUnlockedLevel;
		}
		maxUnlockedLevel = 0;
		return 0;
	}
	
	let maxUnlockedLevel: number = 0; //set to 0 for production, but nice to set to really high number for testing
	let completedLevels: boolean[] = [];
	let loadError: string | null = null;
	let levelElements: HTMLElement[] = [];
	let congratulationsElement: HTMLElement;
	let levels: Level[] = [];

async function loadLevels(): Promise<void> {
    // initialize maxUnlockedLevel from localStorage (if present)
    getMaxFromLocalStorage();

    // Load levels from JSON file
    try {
        loadError = null;
        const response = await fetch('/levels.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        levels = await response.json();
        completedLevels = new Array(levels.length).fill(false);
    } catch (error) {
        console.error('Error loading levels:', error);
        levels = [];
        completedLevels = [];
        loadError =  'Unknown error loading levels.json';
    }

    // If user has progressed past the first level, auto-scroll to bottom
    if (typeof window !== 'undefined') {
        const stored = Number(window.localStorage.getItem('maxUnlockedLevel') || '0');
        if (stored > 1) {
            setTimeout(() => {
                try {
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                } catch (e) {
                    // fallback
                    window.scrollTo(0, document.body.scrollHeight);
                }
            }, 120);
        }
    }
}

onMount(async (): Promise<void> => {
    await loadLevels();
});

function retryLoad() {
    // simple retry that re-invokes loadLevels
    loadLevels();
}

	function handleLevelComplete(levelIndex: number): void {
		if (!completedLevels[levelIndex]) {
			completedLevels[levelIndex] = true;

			if (levelIndex + 1 < levels.length && levelIndex + 1 > maxUnlockedLevel) {
				maxUnlockedLevel = levelIndex + 1;
				window.localStorage.setItem('maxUnlockedLevel', String(maxUnlockedLevel));
				console.log(localStorage.getItem('maxUnlockedLevel'))
				// silly jank scroll thingy
				setTimeout(() => {
					const nextLevelElement = levelElements[levelIndex + 1];
					if (nextLevelElement) {
						nextLevelElement.scrollIntoView({
							behavior: 'smooth',
							block: 'start',
							inline: 'nearest'
						});
					}
				}, 300);
			}

			// level completion check
			setTimeout(() => {
				if (completedLevels.every((completed) => completed)) {
					triggerFinalConfetti();
					//more jank scroll things
					setTimeout(() => {
						if (congratulationsElement) {
							congratulationsElement.scrollIntoView({
								behavior: 'smooth',
								block: 'center',
								inline: 'nearest'
							});
						}
					}, 500);
				}
			}, 1000);
		}
	}

	//MORE confetti
	function triggerFinalConfetti(): void {
		confetti({
			particleCount: 300,
			spread: 100,
			origin: { y: 0.5 },
			colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']
		});

		setTimeout(() => {
			confetti({
				particleCount: 200,
				angle: 45,
				spread: 80,
				origin: { x: 0, y: 0.8 }
			});
		}, 300);

		setTimeout(() => {
			confetti({
				particleCount: 200,
				angle: 135,
				spread: 80,
				origin: { x: 1, y: 0.8 }
			});
		}, 600);

		setTimeout(() => {
			confetti({
				particleCount: 400,
				spread: 120,
				origin: { y: 0.3 },
				gravity: 0.3,
				ticks: 200
			});
		}, 1000);
	}
</script>

<!-- all the html for the website -->
 <Header/>
<div class="game-container">
	{#if loadError}
		<div class="error-popup">
			<p>{loadError}</p>
			<button on:click={retryLoad}>Retry</button>
		</div>
	{/if}

	{#each levels as level, index}
		{#if index <= maxUnlockedLevel}
			<div class="level-wrapper" bind:this={levelElements[index]}>
				<Grid
					title={level.title}
					id={index}
					contents={level.contents}
					allowedCommands={level.allowedCommands}
					maxBlocks={level.maxBlocks}
					on:levelComplete={() => handleLevelComplete(index)}
				/>
			</div>
		{/if}
	{/each}

	{#if levels.length > 0 && completedLevels.length === levels.length && completedLevels.every((completed) => completed)}
		<div class="congratulations" bind:this={congratulationsElement}>
			<h1>done!</h1>
		</div>
	{/if}
</div>
<Tf2Coconut />

<!-- css works but like its mildly weird -->
<style lang="css">
	.game-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 40px;
		padding: 20px;
		min-height: 100vh;
	}

	.level-wrapper {
		width: 100%;
		max-width: 800px;
		scroll-margin-top: 20px;
	}

	.congratulations {
		text-align: center;
		padding: 40px;
		border-radius: 20px;
		background-color: #c1f2b3;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
	}

	.congratulations h1 {
		font-size: 2.5em;
		margin-bottom: 20px;
	}
		.error-popup {
		position: fixed;
		top: 20px;
		left: 50%;
		transform: translateX(-50%);
		background-color: #ffdddd;
		color: #a30000;
		border: 2px solid #ff5c5c;
		padding: 16px 24px;
		border-radius: 12px;
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
		z-index: 1000;
		display: flex;
		align-items: center;
		gap: 12px;
		font-weight: 500;
		animation: fadeIn 0.3s ease-in-out;
	}

	.error-popup button {
		background-color: #a30000;
		color: white;
		border: none;
		padding: 8px 14px;
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.error-popup button:hover {
		background-color: #c60000;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translate(-50%, -10px);
		}
		to {
			opacity: 1;
			transform: translate(-50%, 0);
		}
	}

</style>
