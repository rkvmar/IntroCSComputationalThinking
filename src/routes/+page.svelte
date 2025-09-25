<script lang="ts">
	import Grid from '$lib/components/Grid.svelte';
	import { onMount } from 'svelte';
	import { confetti } from '@tsparticles/confetti';

	let maxUnlockedLevel = 0;
	let completedLevels: boolean[] = [];
	let levelElements: HTMLElement[] = [];
	let congratulationsElement: HTMLElement;

	const levels = [
		{
			title: 'no way',
			contents: [
				[0, 0, 0, 0, 0],
				[0, 0, 2, 0, 0],
				[0, 0, 0, 0, 0],
				[0, 0, 0, 0, 0],
				[0, 0, 1, 0, 0]
			],
			allowedCommands: ['f']
		},
		{
			title: 'no way 2',
			contents: [
				[0, 0, 0, 0, 0],
				[0, 0, 0, 0, 2],
				[0, 0, 0, 0, 0],
				[0, 0, 0, 0, 0],
				[0, 0, 1, 0, 0]
			],
			allowedCommands: ['f', 'r']
		}
	];

	onMount(() => {
		completedLevels = new Array(levels.length).fill(false);
	});

	function handleLevelComplete(levelIndex: number) {
		if (!completedLevels[levelIndex]) {
			completedLevels[levelIndex] = true;

			// Unlock next level if it exists and isn't already unlocked
			if (levelIndex + 1 < levels.length && levelIndex + 1 > maxUnlockedLevel) {
				maxUnlockedLevel = levelIndex + 1;

				// Scroll to next level after a short delay
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

			// Check if all levels are now completed
			setTimeout(() => {
				if (completedLevels.every((completed) => completed)) {
					triggerFinalConfetti();
					// Scroll to congratulations after confetti starts
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

	function triggerFinalConfetti() {
		// Epic confetti for completing all levels
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

<div class="game-container">
	{#each levels as level, index}
		{#if index <= maxUnlockedLevel}
			<div class="level-wrapper" bind:this={levelElements[index]}>
				<Grid
					title={level.title}
					id={index}
					contents={level.contents}
					allowedCommands={level.allowedCommands}
					on:levelComplete={() => handleLevelComplete(index)}
				/>
			</div>
		{/if}
	{/each}

	{#if completedLevels.every((completed) => completed)}
		<div class="congratulations" bind:this={congratulationsElement}>
			<h1>Congratulatis!</h1>
		</div>
	{/if}
</div>

<style>
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

	.congratulations p {
		font-size: 1.2em;
		opacity: 0.9;
	}
</style>
