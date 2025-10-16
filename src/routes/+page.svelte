<script lang="ts">
	//imports
	import Grid from '$lib/components/Grid.svelte';
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

	let maxUnlockedLevel: number = 0; //set to 0 for production, but nice to set to really high number for testing
	let completedLevels: boolean[] = [];
	let levelElements: HTMLElement[] = [];
	let congratulationsElement: HTMLElement;
	let levels: Level[] = [];

	onMount(async (): Promise<void> => {
		// Load levels from JSON file
		try {
			const response = await fetch('/levels.json');
			levels = await response.json();
			completedLevels = new Array(levels.length).fill(false);
		} catch (error) {
			console.error('Error loading levels:', error);
			levels = [];
			completedLevels = [];
		}
	});

	function handleLevelComplete(levelIndex: number): void {
		if (!completedLevels[levelIndex]) {
			completedLevels[levelIndex] = true;

			if (levelIndex + 1 < levels.length && levelIndex + 1 > maxUnlockedLevel) {
				maxUnlockedLevel = levelIndex + 1;

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
<div class="game-container">
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

	{#if completedLevels.every((completed) => completed)}
		<div class="congratulations" bind:this={congratulationsElement}>
			<h1>Congradulatis!</h1>
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
</style>
