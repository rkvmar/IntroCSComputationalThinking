<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { confetti } from '@tsparticles/confetti';

	export let title: string = '';
	export let id = 0;
	export let contents: number[][] = [
		[0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0]
	];
	export let allowedCommands: string[] = ['f', 'l', 'r'];
	let solved = false;
	const squareSize: string = '70px';
	let w: number = contents[0].length;
	let h: number = contents.length;
	class Marker {
		x: number;
		y: number;
		facing: number;
		constructor(x: number, y: number, facing: number) {
			this.x = x;
			this.y = y;
			this.facing = facing;
		}
	}

	// FIND PLAYER
	let player: Marker = new Marker(0, 0, 0);
	let goal: Marker = new Marker(1, 1, 0);
	let rotation: number = 0;
	let found: boolean = false;
	for (let i = 0; i < h && !found; i++) {
		for (let j = 0; j < w && !found; j++) {
			if (contents[i][j] == 1) {
				player.x = j;
				player.y = i;
				found = true;
			}
		}
	}
	found = false;
	// FIND GOAL
	for (let i = 0; i < h && !found; i++) {
		for (let j = 0; j < w && !found; j++) {
			if (contents[i][j] == 2) {
				goal.x = j;
				goal.y = i;
				found = true;
			}
		}
	}

	// Programming blocks
	type Command = 'forward' | 'turnLeft' | 'turnRight';
	let commands: Command[] = [];
	let isRunning: boolean = false;
	let hasRun: boolean = false;
	let currentExecutingIndex: number = -1;
	let draggedIndex: number | null = null;
	let dragOverIndex: number | null = null;

	const dispatch = createEventDispatcher();

	// Movement functions based on facing direction
	function moveForward(): void {
		let newX: number = player.x;
		let newY: number = player.y;

		switch (player.facing) {
			case 0:
				newY = Math.max(0, player.y - 1);
				break;
			case 1:
				newX = Math.min(w - 1, player.x + 1);
				break;
			case 2:
				newY = Math.min(h - 1, player.y + 1);
				break;
			case 3:
				newX = Math.max(0, player.x - 1);
				break;
		}

		player.x = newX;
		player.y = newY;
	}

	function turnLeft(): void {
		player.facing = (player.facing + 3) % 4;
		rotation -= 90;
	}

	function turnRight(): void {
		player.facing = (player.facing + 1) % 4;
		rotation += 90;
	}

	function addCommand(command: Command): void {
		commands = [...commands, command];
	}

	function removeCommand(index: number): void {
		commands = commands.filter((_, i) => i !== index);
	}

	function moveCommand(fromIndex: number, toIndex: number): void {
		const newCommands: Command[] = [...commands];
		const [movedItem] = newCommands.splice(fromIndex, 1);
		newCommands.splice(toIndex, 0, movedItem);
		commands = newCommands;
	}

	function handleDragStart(event: DragEvent, index: number): void {
		draggedIndex = index;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
		}
	}

	function handleDragOver(event: DragEvent, index: number): void {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
		dragOverIndex = index;
	}

	function handleDrop(event: DragEvent, index: number): void {
		event.preventDefault();
		if (draggedIndex !== null && draggedIndex !== index) {
			moveCommand(draggedIndex, index);
		}
		draggedIndex = null;
		dragOverIndex = null;
	}

	function handleDragEnd(): void {
		draggedIndex = null;
		dragOverIndex = null;
	}

	function handleDragLeave(): void {
		dragOverIndex = null;
	}

	function resetProgram(): void {
		hasRun = false;
		solved = false;
		let found: boolean = false;
		for (let i = 0; i < h && !found; i++) {
			for (let j = 0; j < w && !found; j++) {
				if (contents[i][j] == 1) {
					player.x = j;
					player.y = i;
					found = true;
				}
			}
		}
		if (!found) {
			player.x = 0;
			player.y = 0;
		}
		player.facing = 0;
		rotation = 0;
	}

	async function runProgram(): Promise<void> {
		if (isRunning || commands.length === 0) return;

		isRunning = true;

		for (let i = 0; i < commands.length; i++) {
			currentExecutingIndex = i;

			switch (commands[i]) {
				case 'forward':
					moveForward();
					break;
				case 'turnLeft':
					turnLeft();
					break;
				case 'turnRight':
					turnRight();
					break;
			}

			await new Promise((resolve) => setTimeout(resolve, 500));
		}

		currentExecutingIndex = -1;
		isRunning = false;
		checkWin();
		hasRun = true;
	}
	function checkWin() {
		if (player.x == goal.x && player.y == goal.y) {
			if (!solved) {
				solved = true;
				// Trigger confetti effect
				triggerConfetti();
				// Dispatch event when level is completed for the first time
				setTimeout(() => {
					dispatch('levelComplete');
				}, 500);
			}
		} else {
			solved = false;
		}
	}

	function triggerConfetti() {
		confetti({
			particleCount: 150,
			spread: 70,
			origin: { y: 0.6 }
		});

		// Additional confetti burst after a short delay
		setTimeout(() => {
			confetti({
				particleCount: 100,
				angle: 60,
				spread: 55,
				origin: { x: 0 }
			});
		}, 200);

		setTimeout(() => {
			confetti({
				particleCount: 100,
				angle: 120,
				spread: 55,
				origin: { x: 1 }
			});
		}, 400);
	}
</script>

<div class="container" class:solved>
	<h1 class="title">{title}</h1>
	<div class="grid-container">
		<div class="grid" style="--gridWidth: {w}; --gridHeight: {h}; --squareSize: {squareSize};">
			{#each Array(h) as _, row}
				{#each Array(w) as _, col}
					<div
						class="gridSquare"
						class:top-left={row === 0 && col === 0}
						class:top-right={row === 0 && col === w - 1}
						class:bottom-left={row === h - 1 && col === 0}
						class:bottom-right={row === h - 1 && col === w - 1}
						data-row={row}
						data-col={col}
					>
						<!-- <p>{contents[row][col]}</p> -->
					</div>
				{/each}
			{/each}
		</div>
		<div
			class="marker"
			style="--marker-x: {player.x}; --marker-y: {player.y}; --marker-color: #ff000055; transform: rotate({rotation}deg)"
		>
			<span class="direction-arrow">↑</span>
		</div>
		<div
			class="marker"
			style="--marker-x: {goal.x}; --marker-y: {goal.y}; --marker-color: #7e80ea55"
		></div>
	</div>

	<div class="programming-interface">
		<div class="command-blocks">
			<div class="block-row">
				{#if allowedCommands.includes('f')}
					<button
						class="command-block forward"
						on:click={() => addCommand('forward')}
						disabled={isRunning || hasRun}
					>
						Move Forward
					</button>
				{/if}
				{#if allowedCommands.includes('l')}
					<button
						class="command-block turn-left"
						on:click={() => addCommand('turnLeft')}
						disabled={isRunning || hasRun}
					>
						Turn Left
					</button>
				{/if}
				{#if allowedCommands.includes('r')}
					<button
						class="command-block turn-right"
						on:click={() => addCommand('turnRight')}
						disabled={isRunning || hasRun}
					>
						Turn Right
					</button>
				{/if}
			</div>
		</div>

		<div class="program-area">
			<h3>Program</h3>
			<div
				class="command-list"
				on:dragover={(e) => e.preventDefault()}
				on:drop={(e) => {
					const rect = e.currentTarget!.getBoundingClientRect();
					const y = e.clientY - rect.top;
					const items = e.currentTarget!.querySelectorAll('.draggable-command');
					let dropIndex: number = commands.length;

					for (let i = 0; i < items.length; i++) {
						const itemRect = items[i]!.getBoundingClientRect();
						const itemY = itemRect.top - rect.top + itemRect.height / 2;
						if (y < itemY) {
							dropIndex = i;
							break;
						}
					}

					if (draggedIndex !== null) {
						moveCommand(draggedIndex, dropIndex);
						draggedIndex = null;
						dragOverIndex = null;
					}
				}}
			>
				{#each commands as command, index}
					<div
						class="command-item draggable-command"
						class:dragging={draggedIndex === index}
						class:drag-over={dragOverIndex === index}
						class:executing={currentExecutingIndex === index}
						class:forward={command === 'forward'}
						class:turn-left={command === 'turnLeft'}
						class:turn-right={command === 'turnRight'}
						draggable="true"
						on:dragstart={(e) => handleDragStart(e, index)}
						on:dragover={(e) => handleDragOver(e, index)}
						on:drop={(e) => handleDrop(e, index)}
						on:dragend={handleDragEnd}
						on:dragleave={handleDragLeave}
					>
						<span class="drag-handle">⋮⋮</span>
						<span class="command-number">{index + 1}.</span>
						<span class="command-text">
							{#if command === 'forward'}
								Move Forward
							{:else if command === 'turnLeft'}
								Turn Left
							{:else if command === 'turnRight'}
								Turn Right
							{/if}
						</span>
						<button
							class="remove-btn"
							on:click={() => removeCommand(index)}
							disabled={isRunning || hasRun}
							title="Remove command"
							aria-label="Remove command"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								height="12px"
								viewBox="0 -960 960 960"
								width="12px"
								fill="white"
								><path
									d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"
								/></svg
							>
						</button>
					</div>
				{/each}
				{#if commands.length === 0}
					<div class="empty-program">No commands</div>
				{/if}
			</div>
		</div>

		<div class="control-buttons">
			{#if isRunning}
				<button class="control-btn disabled" disabled> Running... </button>
			{:else if hasRun}
				<button class="control-btn reset" on:click={resetProgram}> Reset </button>
			{:else}
				<button class="control-btn start" on:click={runProgram} disabled={commands.length === 0}>
					Start
				</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
		padding: 20px;
		background-color: #def1f4;
		border-radius: 25px;
		transition: background-color 0.3s ease;
	}
	.container.solved {
		background-color: #c1f2b3;
	}
	.grid-container {
		position: relative;
		display: inline-block;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(var(--gridWidth), var(--squareSize, 70px));
		grid-template-rows: repeat(var(--gridHeight), var(--squareSize, 70px));
		gap: 1px;
		width: fit-content;
		border-radius: 10px;
	}

	.gridSquare {
		width: var(--squareSize, 70px);
		height: var(--squareSize, 70px);
		background-color: #ffffff;
		border: 1px solid #ccc;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.gridSquare.top-left {
		border-top-left-radius: 8px;
	}

	.gridSquare.top-right {
		border-top-right-radius: 8px;
	}

	.gridSquare.bottom-left {
		border-bottom-left-radius: 8px;
	}

	.gridSquare.bottom-right {
		border-bottom-right-radius: 8px;
	}
	.marker {
		position: absolute;
		left: calc(var(--marker-x) * (var(--squareSize, 70px) + 1px));
		top: calc(var(--marker-y) * (var(--squareSize, 70px) + 1px));
		width: var(--squareSize, 70px);
		height: var(--squareSize, 70px);
		background-color: var(--marker-color);
		border: 1px solid #ccc;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		transition:
			left 0.3s ease,
			top 0.3s ease,
			transform 0.3s ease;
	}

	.direction-arrow {
		color: #fff;
		font-size: 24px;
		font-weight: bold;
		text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7);
	}

	.programming-interface {
		margin-top: 20px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 20px;
		width: 600px;
	}

	.program-area h3 {
		margin: 0 0 10px 0;
		color: #333;
	}

	.block-row {
		display: flex;
		justify-content: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.command-block {
		padding: 12px 20px;
		border: 2px solid;
		border-radius: 8px;
		font-weight: bold;
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 14px;
	}

	.command-block:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.command-block.forward {
		background-color: #4caf50;
		border-color: #45a049;
		color: white;
	}

	.command-block.forward:hover:not(:disabled) {
		background-color: #45a049;
	}

	.command-block.turn-left {
		background-color: #2196f3;
		border-color: #1976d2;
		color: white;
	}

	.command-block.turn-left:hover:not(:disabled) {
		background-color: #1976d2;
	}

	.command-block.turn-right {
		background-color: #ff9800;
		border-color: #f57c00;
		color: white;
	}

	.command-block.turn-right:hover:not(:disabled) {
		background-color: #f57c00;
	}

	.program-area {
		min-height: 120px;
	}

	.command-list {
		border: 2px dashed #ccc;
		border-radius: 8px;
		padding: 15px;
		min-height: 80px;
		background-color: #fafafa;
	}

	.command-item {
		padding: 10px;
		color: #333;
		font-weight: 500;
		background: white;
		border: 2px solid #e0e0e0;
		border-radius: 6px;
		margin: 5px 0;
		display: flex;
		align-items: center;
		gap: 4px;
		cursor: move;
		transition: all 0.2s ease;
		user-select: none;
	}

	.command-item.forward {
		background-color: #e8f5e8;
		border-color: #4caf50;
		color: #2e7d32;
	}

	.command-item.turn-left {
		background-color: #e3f2fd;
		border-color: #2196f3;
		color: #1565c0;
	}

	.command-item.turn-right {
		background-color: #fff3e0;
		border-color: #ff9800;
		color: #ef6c00;
	}

	.command-item.forward:hover {
		border-color: #388e3c;
	}

	.command-item.turn-left:hover {
		border-color: #1565c0;
	}

	.command-item.turn-right:hover {
		border-color: #e65100;
	}

	.command-item.executing {
		border-color: #ffc107 !important;
		background-color: #fff8e1 !important;
		box-shadow: 0 0 10px rgba(255, 193, 7, 0.5);
		transform: scale(1.02);
		color: #ffc107;
	}

	.command-item.dragging {
		opacity: 0.5;
	}

	.command-item.drag-over {
		border-color: #4caf50;
		background-color: #f8fff8;
	}

	.drag-handle {
		color: #999;
		font-weight: bold;
		cursor: move;
		padding: 0 4px;
	}

	.command-number {
		color: #666;
		font-weight: bold;
		min-width: 20px;
	}

	.command-text {
		flex: 1;
	}

	.remove-btn {
		background: #ff4444;
		color: white;
		border: none;
		border-radius: 50%;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		font-size: 12px;
		font-weight: bold;
		line-height: 1;
		transition: background-color 0.2s ease;
	}

	.remove-btn:hover:not(:disabled) {
		background: #ff0000;
	}

	.remove-btn:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.empty-program {
		color: #999;
		font-style: italic;
		text-align: center;
		padding: 20px;
	}

	.control-buttons {
		display: flex;
		gap: 10px;
		justify-content: center;
	}

	.control-btn {
		padding: 12px 24px;
		border: 2px solid;
		border-radius: 8px;
		font-weight: bold;
		cursor: pointer;
		transition: all 0.2s ease;
		min-width: 100px;
	}

	.control-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.control-btn.disabled {
		background-color: #e0e0e0;
		border-color: #bdbdbd;
		color: #757575;
	}

	.control-btn.start {
		background-color: #4caf50;
		border-color: #45a049;
		color: white;
	}

	.control-btn.start:hover:not(:disabled) {
		background-color: #45a049;
	}

	.control-btn.reset {
		background-color: #f44336;
		border-color: #d32f2f;
		color: white;
	}

	.control-btn.reset:hover:not(:disabled) {
		background-color: #d32f2f;
	}
</style>
