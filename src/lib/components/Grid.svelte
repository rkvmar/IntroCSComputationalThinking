<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { confetti } from '@tsparticles/confetti';

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

	interface Key {
		type: 'key';
		id: string;
		collected: boolean;
	}

	export let title: string = '';
	export let id: number = 0;
	export let contents: (number | Door | Key)[][] = [
		[0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0]
	];
	export let allowedCommands: string[] = ['f', 'l', 'r'];
	export let maxBlocks: number | null = null;
	let solved: boolean = false;
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
	let collectedKeys: Set<string> = new Set();
	for (let i = 0; i < h && !found; i++) {
		for (let j = 0; j < w && !found; j++) {
			const cell = contents[i][j];
			if (cell == 1) {
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
			const cell = contents[i][j];
			if (cell == 2) {
				goal.x = j;
				goal.y = i;
				found = true;
			}
		}
	}

	// Programming blocks
	type Command = 'forward' | 'turnLeft' | 'turnRight' | 'loop';

	interface LoopCommand {
		type: 'loop';
		times: number;
		commands: ProgramCommand[];
	}

	type ProgramCommand = Command | LoopCommand;

	let commands: ProgramCommand[] = [];
	let isRunning: boolean = false;
	let hasRun: boolean = false;
	let currentExecutingIndex: number = -1;
	let currentExecutingPath: number[] = [];
	let draggedIndex: number | null = null;
	let dragOverIndex: number | null = null;
	let draggedFromLoop: number | null = null;
	let draggedLoopCommandIndex: number | null = null;
	let showLoopDialog: boolean = false;
	let loopTimes: number = 2;
	let editingLoopIndex: number | null = null;

	// Calculate total blocks used
	let totalBlocksUsed: number;
	$: totalBlocksUsed = calculateTotalBlocks(commands);

	function calculateTotalBlocks(commandList: ProgramCommand[]): number {
		let count = 0;
		for (const command of commandList) {
			if (typeof command === 'string') {
				count++;
			} else if (command.type === 'loop') {
				count++; // Loop block itself counts as 1
				count += command.commands.length; // Add commands inside loop
			}
		}
		return count;
	}

	// Declare variables for reactive statements
	let blocksRemaining: number | null;
	let isAtBlockLimit: boolean;
	$: blocksRemaining = maxBlocks && maxBlocks > 0 ? maxBlocks - totalBlocksUsed : null;
	$: isAtBlockLimit = maxBlocks !== null && maxBlocks > 0 && totalBlocksUsed >= maxBlocks;

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

		if (newX >= 0 && newX < w && newY >= 0 && newY < h) {
			const targetCell = contents[newY][newX];

			// Wall logic
			if (targetCell === 3) {
				return; // Wall is closed
			}

			// Door logic
			if (typeof targetCell === 'object' && targetCell.type === 'door') {
				const shouldOpen = executeDoorLogic(targetCell);
				if (!shouldOpen) {
					return; // Door is closed
				}
			}

			// Key logic
			if (typeof targetCell === 'object' && targetCell.type === 'key' && !targetCell.collected) {
				collectedKeys.add(targetCell.id);
				targetCell.collected = true;
				contents = contents; //cursed jank that fixes things for some reason sometimes
			}

			player.x = newX;
			player.y = newY;
			updateDoorStates();
		}
	}

	function turnLeft(): void {
		player.facing = (player.facing + 3) % 4;
		rotation -= 90;
	}

	function turnRight(): void {
		player.facing = (player.facing + 1) % 4;
		rotation += 90;
	}

	function addCommand(command: Command | 'loop'): void {
		if (isAtBlockLimit) return;

		if (command === 'loop') {
			showLoopDialog = true;
		} else {
			commands = [...commands, command];
		}
	}

	function addLoop(): void {
		if (editingLoopIndex !== null) {
			const newCommands = [...commands];
			const loop = newCommands[editingLoopIndex] as LoopCommand;
			loop.times = loopTimes;
			commands = newCommands;
			editingLoopIndex = null;
		} else {
			if (isAtBlockLimit) return;
			const newLoop: LoopCommand = {
				type: 'loop',
				times: loopTimes,
				commands: []
			};
			commands = [...commands, newLoop];
		}
		showLoopDialog = false;
		loopTimes = 2;
	}

	function editLoop(index: number): void {
		const loop = commands[index] as LoopCommand;
		loopTimes = loop.times;
		editingLoopIndex = index;
		showLoopDialog = true;
	}

	function removeCommandFromLoop(loopIndex: number, commandIndex: number): void {
		const newCommands = [...commands];
		const loop = newCommands[loopIndex] as LoopCommand;
		loop.commands = loop.commands.filter((_, i) => i !== commandIndex);
		commands = newCommands;
	}

	function removeCommand(index: number): void {
		commands = commands.filter((_, i) => i !== index);
	}

	function moveCommand(fromIndex: number, toIndex: number): void {
		const newCommands: ProgramCommand[] = [...commands];
		const [movedItem] = newCommands.splice(fromIndex, 1);
		newCommands.splice(toIndex, 0, movedItem);
		commands = newCommands;
	}

	function handleDragStart(
		event: DragEvent,
		index: number,
		fromLoop?: number,
		loopCommandIndex?: number
	): void {
		draggedIndex = index;
		draggedFromLoop = fromLoop ?? null;
		draggedLoopCommandIndex = loopCommandIndex ?? null;
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

	function handleDrop(event: DragEvent, index: number, toLoop?: number): void {
		event.preventDefault();

		if (draggedIndex !== null) {
			// Handle different drag scenarios
			if (draggedFromLoop !== null && draggedLoopCommandIndex !== null) {
				// Dragging from inside a loop
				if (toLoop !== undefined) {
					// Moving from one loop to another loop
					moveCommandBetweenLoops(draggedFromLoop, draggedLoopCommandIndex, toLoop);
				} else {
					// Moving from loop to main program
					moveCommandFromLoopToMain(draggedFromLoop, draggedLoopCommandIndex, index);
				}
			} else if (toLoop !== undefined) {
				// Moving from main program to a loop
				moveCommandFromMainToLoop(draggedIndex, toLoop);
			} else if (draggedIndex !== index) {
				// Normal move within main program
				moveCommand(draggedIndex, index);
			}
		}

		clearDragState();
	}

	function handleDragEnd(): void {
		clearDragState();
	}

	function handleDragLeave(): void {
		dragOverIndex = null;
	}

	function clearDragState(): void {
		draggedIndex = null;
		dragOverIndex = null;
		draggedFromLoop = null;
		draggedLoopCommandIndex = null;
	}

	function moveCommandFromLoopToMain(
		fromLoopIndex: number,
		commandIndex: number,
		toIndex: number
	): void {
		const newCommands = [...commands];
		const fromLoop = newCommands[fromLoopIndex] as LoopCommand;
		const [movedCommand] = fromLoop.commands.splice(commandIndex, 1);

		// Insert into main program
		newCommands.splice(toIndex, 0, movedCommand);
		commands = newCommands;
	}

	function moveCommandFromMainToLoop(fromIndex: number, toLoopIndex: number): void {
		const newCommands = [...commands];
		const [movedCommand] = newCommands.splice(fromIndex, 1) as Command[];

		// Adjust loop index if necessary
		const adjustedLoopIndex = fromIndex < toLoopIndex ? toLoopIndex - 1 : toLoopIndex;
		const toLoop = newCommands[adjustedLoopIndex] as LoopCommand;
		toLoop.commands.push(movedCommand);

		commands = newCommands;
	}

	function moveCommandBetweenLoops(
		fromLoopIndex: number,
		commandIndex: number,
		toLoopIndex: number
	): void {
		const newCommands = [...commands];
		const fromLoop = newCommands[fromLoopIndex] as LoopCommand;
		const toLoop = newCommands[toLoopIndex] as LoopCommand;

		const [movedCommand] = fromLoop.commands.splice(commandIndex, 1);
		toLoop.commands.push(movedCommand);

		commands = newCommands;
	}

	function moveCommandWithinLoop(loopIndex: number, fromIndex: number, toIndex: number): void {
		const newCommands = [...commands];
		const loop = newCommands[loopIndex] as LoopCommand;
		const [movedCommand] = loop.commands.splice(fromIndex, 1);
		loop.commands.splice(toIndex, 0, movedCommand);
		commands = newCommands;
	}

	function resetProgram(): void {
		isRunning = false; // Stop any running program
		hasRun = false;
		solved = false;
		let found: boolean = false;
		for (let i = 0; i < h && !found; i++) {
			for (let j = 0; j < w && !found; j++) {
				const cell = contents[i][j];
				if (cell == 1) {
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
		currentExecutingIndex = -1;
		currentExecutingPath = [];

		collectedKeys.clear();
		for (let i = 0; i < h; i++) {
			for (let j = 0; j < w; j++) {
				const cell = contents[i][j];
				if (typeof cell === 'object' && cell.type === 'key') {
					cell.collected = false;
				}
			}
		}
		contents = contents;
		updateDoorStates();
	}

	async function runProgram(): Promise<void> {
		if (isRunning || commands.length === 0) return;

		isRunning = true;
		await executeCommands(commands, []);
		currentExecutingIndex = -1;
		currentExecutingPath = [];

		// Only set hasRun to true if execution wasn't interrupted
		if (isRunning) {
			isRunning = false;
			checkWin();
			hasRun = true;
		}
		// If isRunning is false here, it means resetProgram was called and we shouldn't set hasRun
	}

	async function executeCommands(commandList: ProgramCommand[], path: number[]): Promise<void> {
		for (let i = 0; i < commandList.length; i++) {
			// Check if execution should stop
			if (!isRunning) return;

			const currentPath = [...path, i];
			currentExecutingIndex = i;
			currentExecutingPath = currentPath;

			const command = commandList[i];

			if (typeof command === 'string') {
				switch (command) {
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
			} else if (command.type === 'loop') {
				for (let loopIteration = 0; loopIteration < command.times; loopIteration++) {
					// Check if execution should stop during loop
					if (!isRunning) return;
					await executeCommands(command.commands, currentPath);
				}
			}
		}
	}
	function checkWin(): void {
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

	function triggerConfetti(): void {
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

	// Door functionality
	let selectedDoor: Door | null = null;
	let showDoorDialog = false;
	let doorCommands: string[] = [];

	// Reactive door states that update when player position changes
	let doorStates = new Map();

	function updateDoorStates() {
		const states = new Map();
		for (let i = 0; i < h; i++) {
			for (let j = 0; j < w; j++) {
				const cell = contents[i][j];
				if (typeof cell === 'object' && cell.type === 'door') {
					states.set(cell.id, executeDoorLogic(cell));
				}
			}
		}
		// Force reactivity for key collection
		collectedKeys = collectedKeys;
		doorStates = states;
	}

	// Update door states when player position changes
	$: if (player.x !== undefined && player.y !== undefined) {
		updateDoorStates();
	}

	function executeDoorLogic(door: Door): boolean {
		// Initialize currentCode if not set
		if (!door.currentCode) {
			door.currentCode = {
				condition: door.defaultCode.condition,
				ifCommands: [...door.defaultCode.ifCommands],
				elseCommands: [...door.defaultCode.elseCommands]
			};
		}

		// Execute the door's current code logic with fixed if/else structure
		if (!door.currentCode.ifCommands && !door.currentCode.elseCommands) {
			return true; // Default behavior: door is open
		}

		// Evaluate condition
		const doorPos = findDoorPosition(door);
		let conditionMet = false;

		if (door.currentCode.condition === 'always') {
			conditionMet = true;
		} else if (door.currentCode.condition === 'never') {
			conditionMet = false;
		} else if (door.currentCode.condition === 'has key') {
			// Check if player has collected any key
			conditionMet = collectedKeys.size > 0;
		} else if (door.currentCode.condition === 'does not have key') {
			// Check if player has NOT collected any key
			conditionMet = collectedKeys.size === 0;
		}

		// Execute appropriate commands based on condition
		const commandsToExecute = conditionMet
			? door.currentCode.ifCommands
			: door.currentCode.elseCommands;
		let shouldOpen = false;

		for (const command of commandsToExecute) {
			if (command === 'open') {
				shouldOpen = true;
			} else if (command === 'close') {
				shouldOpen = false;
			}
		}

		return shouldOpen;
	}

	function findDoorPosition(door: Door): { x: number; y: number } | null {
		for (let i = 0; i < h; i++) {
			for (let j = 0; j < w; j++) {
				const cell = contents[i][j];
				if (typeof cell === 'object' && cell.type === 'door' && cell.id === door.id) {
					return { x: j, y: i };
				}
			}
		}
		return null;
	}

	function resetDoorCodes() {
		// Reset all doors to their default code
		for (let i = 0; i < h; i++) {
			for (let j = 0; j < w; j++) {
				const cell = contents[i][j];
				if (typeof cell === 'object' && cell.type === 'door') {
					cell.currentCode = {
						condition: cell.defaultCode.condition,
						ifCommands: [...cell.defaultCode.ifCommands],
						elseCommands: [...cell.defaultCode.elseCommands]
					};
				}
			}
		}
	}

	function openDoorEditor(door: Door) {
		// Initialize currentCode if not set
		if (!door.currentCode) {
			door.currentCode = {
				condition: door.defaultCode.condition,
				ifCommands: [...door.defaultCode.ifCommands],
				elseCommands: [...door.defaultCode.elseCommands]
			};
		}
		selectedDoor = door;
		showDoorDialog = true;
	}

	function saveDoorCode() {
		showDoorDialog = false;
		selectedDoor = null;
		// Update door states after programming
		updateDoorStates();
	}

	function cancelDoorEdit() {
		showDoorDialog = false;
		selectedDoor = null;
	}

	function setCondition(condition: string) {
		if (selectedDoor && selectedDoor.currentCode) {
			selectedDoor.currentCode.condition = condition;
		}
	}

	function addCommandToIf(command: string) {
		if (selectedDoor && selectedDoor.currentCode) {
			selectedDoor.currentCode.ifCommands = [...selectedDoor.currentCode.ifCommands, command];
		}
	}

	function addCommandToElse(command: string) {
		if (selectedDoor && selectedDoor.currentCode) {
			selectedDoor.currentCode.elseCommands = [...selectedDoor.currentCode.elseCommands, command];
		}
	}

	function removeCommandFromIf(index: number) {
		if (selectedDoor && selectedDoor.currentCode) {
			selectedDoor.currentCode.ifCommands = selectedDoor.currentCode.ifCommands.filter(
				(_, i) => i !== index
			);
		}
	}

	function removeCommandFromElse(index: number) {
		if (selectedDoor && selectedDoor.currentCode) {
			selectedDoor.currentCode.elseCommands = selectedDoor.currentCode.elseCommands.filter(
				(_, i) => i !== index
			);
		}
	}

	function moveCommandWithinIf(fromIndex: number, toIndex: number) {
		if (selectedDoor && selectedDoor.currentCode) {
			const commands = [...selectedDoor.currentCode.ifCommands];
			const [movedCommand] = commands.splice(fromIndex, 1);
			commands.splice(toIndex, 0, movedCommand);
			selectedDoor.currentCode.ifCommands = commands;
		}
	}

	function moveCommandWithinElse(fromIndex: number, toIndex: number) {
		if (selectedDoor && selectedDoor.currentCode) {
			const commands = [...selectedDoor.currentCode.elseCommands];
			const [movedCommand] = commands.splice(fromIndex, 1);
			commands.splice(toIndex, 0, movedCommand);
			selectedDoor.currentCode.elseCommands = commands;
		}
	}

	function fullReset() {
		// Reset everything including door codes
		resetProgram();
		resetDoorCodes();
		updateDoorStates();
	}

	// Initialize door codes and states on mount
	onMount(() => {
		initializeDoorCodes();
		updateDoorStates();
	});

	function initializeDoorCodes() {
		for (let i = 0; i < h; i++) {
			for (let j = 0; j < w; j++) {
				const cell = contents[i][j];
				if (typeof cell === 'object' && cell.type === 'door') {
					if (!cell.currentCode) {
						cell.currentCode = {
							condition: cell.defaultCode.condition,
							ifCommands: [...cell.defaultCode.ifCommands],
							elseCommands: [...cell.defaultCode.elseCommands]
						};
					}
				}
			}
		}
	}
</script>

<div class="container" class:solved>
	<h1 class="title">{title}</h1>
	{#if maxBlocks !== null && maxBlocks > 0}
		<div class="block-counter" class:at-limit={isAtBlockLimit}>
			<span class="counter-label">Blocks:</span>
			<span class="counter-value">{totalBlocksUsed}/{maxBlocks}</span>
		</div>
	{/if}
	<div class="grid-container">
		<div class="grid" style="--gridWidth: {w}; --gridHeight: {h}; --squareSize: {squareSize};">
			{#each Array(h) as _, row}
				{#each Array(w) as _, col}
					<div
						class="gridSquare"
						class:wall={contents[row][col] === 3}
						class:door={typeof contents[row][col] === 'object' &&
							contents[row][col].type === 'door'}
						class:key={typeof contents[row][col] === 'object' &&
							contents[row][col].type === 'key' &&
							!contents[row][col].collected}
						class:top-left={row === 0 && col === 0}
						class:top-right={row === 0 && col === w - 1}
						class:bottom-left={row === h - 1 && col === 0}
						class:bottom-right={row === h - 1 && col === w - 1}
						data-row={row}
						data-col={col}
						on:click={() => {
							const cell = contents[row][col];
							if (typeof cell === 'object' && cell.type === 'door') {
								openDoorEditor(cell);
							}
						}}
					>
						{#if typeof contents[row][col] === 'object' && contents[row][col].type === 'door'}
							{@const door = contents[row][col]}
							<div class="door-icon" class:door-open={doorStates.get(door.id)}>
								<span style="color: white; font-size: 10px;">
									{doorStates.get(door.id) ? 'OPEN' : 'CLOSED'}
								</span>
							</div>
						{:else if typeof contents[row][col] === 'object' && contents[row][col].type === 'key' && !contents[row][col].collected}
							<div class="key-icon"></div>
						{/if}
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
						disabled={isRunning || hasRun || isAtBlockLimit}
					>
						Move Forward
					</button>
				{/if}
				{#if allowedCommands.includes('l')}
					<button
						class="command-block turn-left"
						on:click={() => addCommand('turnLeft')}
						disabled={isRunning || hasRun || isAtBlockLimit}
					>
						Turn Left
					</button>
				{/if}
				{#if allowedCommands.includes('r')}
					<button
						class="command-block turn-right"
						on:click={() => addCommand('turnRight')}
						disabled={isRunning || hasRun || isAtBlockLimit}
					>
						Turn Right
					</button>
				{/if}
				{#if allowedCommands.includes('loop')}
					<button
						class="command-block loop"
						on:click={() => addCommand('loop')}
						disabled={isRunning || hasRun || isAtBlockLimit}
					>
						Add Loop
					</button>
				{/if}
			</div>
		</div>

		<div class="program-area">
			<h3>Program</h3>
			<div
				class="command-list"
				on:dragover={(e: DragEvent) => e.preventDefault()}
				on:drop={(e: DragEvent) => {
					const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
					const y = e.clientY - rect.top;
					const items = (e.currentTarget as HTMLElement).querySelectorAll('.draggable-command');
					let dropIndex: number = commands.length;

					for (let i = 0; i < items.length; i++) {
						const itemRect = items[i]!.getBoundingClientRect();
						const itemY = itemRect.top - rect.top + itemRect.height / 2;
						if (y < itemY) {
							dropIndex = i;
							break;
						}
					}

					handleDrop(e, dropIndex);
				}}
			>
				{#each commands as command, index}
					{#if typeof command === 'string'}
						<div
							class="command-item draggable-command"
							class:dragging={draggedIndex === index}
							class:drag-over={dragOverIndex === index}
							class:executing={currentExecutingIndex === index && currentExecutingPath.length === 1}
							class:forward={command === 'forward'}
							class:turn-left={command === 'turnLeft'}
							class:turn-right={command === 'turnRight'}
							draggable="true"
							on:dragstart={(e: DragEvent) => handleDragStart(e, index)}
							on:dragover={(e: DragEvent) => handleDragOver(e, index)}
							on:drop={(e: DragEvent) => handleDrop(e, index)}
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
					{:else if command.type === 'loop'}
						<div
							class="loop-container draggable-command"
							class:dragging={draggedIndex === index}
							class:drag-over={dragOverIndex === index}
							class:executing={currentExecutingIndex === index && currentExecutingPath.length === 1}
							draggable="true"
							on:dragstart={(e: DragEvent) => handleDragStart(e, index)}
							on:dragover={(e: DragEvent) => handleDragOver(e, index)}
							on:drop={(e: DragEvent) => handleDrop(e, index)}
							on:dragend={handleDragEnd}
							on:dragleave={handleDragLeave}
						>
							<div class="loop-header">
								<span class="drag-handle">⋮⋮</span>
								<span class="command-number">{index + 1}.</span>
								<button
									class="loop-text-btn"
									on:click={() => editLoop(index)}
									disabled={isRunning || hasRun}
									title="Edit loop count"
									aria-label="Edit loop count"
								>
									Repeat {command.times} times:
								</button>
								<button
									class="remove-btn"
									on:click={() => removeCommand(index)}
									disabled={isRunning || hasRun}
									title="Remove loop"
									aria-label="Remove loop"
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
							<div class="loop-commands">
								<div
									class="loop-drop-zone"
									on:dragover={(e: DragEvent) => {
										e.preventDefault();
										e.stopPropagation();
									}}
									on:drop={(e: DragEvent) => {
										e.preventDefault();
										e.stopPropagation();
										handleDrop(e, 0, index);
									}}
								>
									{#if command.commands.length === 0}
										<div class="drop-zone-text">Drop commands here</div>
									{/if}
									{#each command.commands as loopCommand, loopIndex}
										<div
											class="command-item loop-command draggable-command"
											class:executing={currentExecutingPath[0] === index &&
												currentExecutingPath[1] === loopIndex}
											class:forward={loopCommand === 'forward'}
											class:turn-left={loopCommand === 'turnLeft'}
											class:turn-right={loopCommand === 'turnRight'}
											class:dragging={draggedFromLoop === index &&
												draggedLoopCommandIndex === loopIndex}
											draggable="true"
											on:dragstart={(e: DragEvent) => {
												e.stopPropagation();
												handleDragStart(e, index, index, loopIndex);
											}}
											on:dragover={(e: DragEvent) => {
												e.preventDefault();
												e.stopPropagation();
											}}
											on:drop={(e: DragEvent) => {
												e.preventDefault();
												e.stopPropagation();
												if (
													draggedFromLoop === index &&
													draggedLoopCommandIndex !== null &&
													draggedLoopCommandIndex !== loopIndex
												) {
													moveCommandWithinLoop(index, draggedLoopCommandIndex, loopIndex);
												} else if (draggedFromLoop !== index || draggedIndex !== null) {
													// Handle moving to this position in the loop
													if (draggedFromLoop !== null && draggedLoopCommandIndex !== null) {
														moveCommandBetweenLoops(
															draggedFromLoop,
															draggedLoopCommandIndex,
															index
														);
													} else if (draggedIndex !== null) {
														moveCommandFromMainToLoop(draggedIndex, index);
													}
												}
												clearDragState();
											}}
											on:dragend={(e: DragEvent) => {
												e.stopPropagation();
												handleDragEnd();
											}}
										>
											<span class="drag-handle">⋮⋮</span>
											<span class="command-number">{loopIndex + 1}.</span>
											<span class="command-text">
												{#if loopCommand === 'forward'}
													Move Forward
												{:else if loopCommand === 'turnLeft'}
													Turn Left
												{:else if loopCommand === 'turnRight'}
													Turn Right
												{/if}
											</span>
											<button
												class="remove-btn"
												on:click={() => removeCommandFromLoop(index, loopIndex)}
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
								</div>
							</div>
						</div>
					{/if}
				{/each}
				{#if commands.length === 0}
					<div class="empty-program">No commands</div>
				{/if}
			</div>
		</div>

		{#if showLoopDialog}
			<div class="modal-overlay" on:click={() => (showLoopDialog = false)}>
				<div class="modal" on:click|stopPropagation>
					<h3>{editingLoopIndex !== null ? 'Edit Loop' : 'Create Loop'}</h3>
					<p>How many times should this loop repeat?</p>
					<input type="number" bind:value={loopTimes} min="1" max="10" class="loop-input" />
					<div class="modal-buttons">
						<button
							class="modal-btn cancel"
							on:click={() => {
								showLoopDialog = false;
								editingLoopIndex = null;
							}}>Cancel</button
						>
						<button class="modal-btn confirm" on:click={addLoop}>
							{editingLoopIndex !== null ? 'Update Loop' : 'Create Loop'}
						</button>
					</div>
				</div>
			</div>
		{/if}

		{#if showDoorDialog && selectedDoor}
			<div class="modal-overlay" on:click={cancelDoorEdit}>
				<div class="modal door-modal" on:click|stopPropagation>
					<h3>Program Door</h3>
					<div class="door-commands">
						{#if selectedDoor.conditionsEditable || selectedDoor.actionsEditable}
							<div class="command-blocks">
								{#if selectedDoor.conditionsEditable}
									<div class="block-section">
										<h3>Conditions:</h3>
										<div class="block-row">
											{#each selectedDoor.allowedConditions as condition}
												<button
													class="command-block condition"
													draggable="true"
													on:dragstart={(e) => e.dataTransfer.setData('text/plain', condition)}
													on:click={() => setCondition(condition)}
												>
													{condition}
												</button>
											{/each}
										</div>
									</div>
								{/if}

								{#if selectedDoor.actionsEditable}
									<div class="block-section">
										<h3>Actions:</h3>
										<div class="block-row">
											{#each selectedDoor.allowedActions as action}
												<button
													class="command-block forward"
													draggable="true"
													on:dragstart={(e) => e.dataTransfer.setData('text/plain', action)}
													on:click={() => addCommandToIf(action)}
												>
													{action}
												</button>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						{/if}

						<div class="door-program">
							<div class="program-section">
								<div class="section-header">
									<span class="keyword">if</span>
								</div>
								<div
									class="condition-drop-zone"
									class:read-only={!selectedDoor.conditionsEditable}
									on:drop={(e) => {
										if (!selectedDoor.conditionsEditable) return;
										e.preventDefault();
										const condition = e.dataTransfer.getData('text/plain');
										if (selectedDoor.allowedConditions.includes(condition)) {
											setCondition(condition);
										}
									}}
									on:dragover={(e) => selectedDoor.conditionsEditable && e.preventDefault()}
								>
									{#if selectedDoor.currentCode?.condition}
										<div class="command-item full-width condition">
											<span class="command-number">1</span>
											<span class="command-text">{selectedDoor.currentCode.condition}</span>
											{#if selectedDoor.conditionsEditable}
												<button class="remove-btn" on:click={() => setCondition('')}>
													<svg width="12" height="12" viewBox="0 0 24 24" fill="none">
														<path
															stroke="currentColor"
															stroke-width="2"
															d="M6 6l12 12M18 6l-12 12"
														/>
													</svg>
												</button>
											{/if}
										</div>
									{:else if selectedDoor.conditionsEditable}
										<div class="empty-condition">Drop condition here</div>
									{/if}
								</div>
							</div>

							<div class="program-section">
								<div class="section-header">
									<span class="keyword">then</span>
								</div>
								<div
									class="command-drop-zone if-commands"
									class:read-only={!selectedDoor.actionsEditable}
									on:drop={(e) => {
										if (!selectedDoor.actionsEditable) return;
										e.preventDefault();
										const data = e.dataTransfer.getData('text/plain');
										try {
											const parsedData = JSON.parse(data);
											if (parsedData.fromBlock) {
												// Moving from another block
												if (parsedData.fromBlock === 'if') {
													removeCommandFromIf(parsedData.fromIndex);
												} else {
													removeCommandFromElse(parsedData.fromIndex);
												}
												addCommandToIf(parsedData.command);
											} else {
												// New command from palette
												addCommandToIf(data);
											}
										} catch {
											// Fallback for simple string data
											addCommandToIf(data);
										}
									}}
									on:dragover={(e) => selectedDoor.actionsEditable && e.preventDefault()}
								>
									{#if selectedDoor.currentCode?.ifCommands.length === 0}
										{#if selectedDoor.actionsEditable}
											<div class="empty-program">Drag commands here</div>
										{:else}
											<div class="empty-program">No commands</div>
										{/if}
									{:else}
										{#each selectedDoor.currentCode?.ifCommands || [] as command, index}
											<div
												class="command-item full-width {command === 'open'
													? 'forward'
													: 'turn-right'}"
												draggable={selectedDoor.actionsEditable}
												on:dragstart={(e) => {
													if (!selectedDoor.actionsEditable) return;
													e.dataTransfer.setData(
														'text/plain',
														JSON.stringify({ command, fromIndex: index, fromBlock: 'if' })
													);
												}}
											>
												{#if selectedDoor.actionsEditable}
													<span class="drag-handle">⋮⋮</span>
												{/if}
												<span class="command-number">{index + 1}</span>
												<span class="command-text">{command}</span>
												{#if selectedDoor.actionsEditable}
													<button class="remove-btn" on:click={() => removeCommandFromIf(index)}>
														<svg width="12" height="12" viewBox="0 0 24 24" fill="none">
															<path
																stroke="currentColor"
																stroke-width="2"
																d="M6 6l12 12M18 6l-12 12"
															/>
														</svg>
													</button>
												{/if}
											</div>
										{/each}
									{/if}
								</div>
							</div>

							<div class="program-section">
								<div class="section-header">
									<span class="keyword">else</span>
								</div>
								<div
									class="command-drop-zone else-commands"
									class:read-only={!selectedDoor.actionsEditable}
									on:drop={(e) => {
										if (!selectedDoor.actionsEditable) return;
										e.preventDefault();
										const data = e.dataTransfer.getData('text/plain');
										try {
											const parsedData = JSON.parse(data);
											if (parsedData.fromBlock) {
												// Moving from another block
												if (parsedData.fromBlock === 'if') {
													removeCommandFromIf(parsedData.fromIndex);
												} else {
													removeCommandFromElse(parsedData.fromIndex);
												}
												addCommandToElse(parsedData.command);
											} else {
												// New command from palette
												addCommandToElse(data);
											}
										} catch {
											// Fallback for simple string data
											addCommandToElse(data);
										}
									}}
									on:dragover={(e) => selectedDoor.actionsEditable && e.preventDefault()}
								>
									{#if selectedDoor.currentCode?.elseCommands.length === 0}
										{#if selectedDoor.actionsEditable}
											<div class="empty-program">Drag commands here</div>
										{:else}
											<div class="empty-program">No commands</div>
										{/if}
									{:else}
										{#each selectedDoor.currentCode?.elseCommands || [] as command, index}
											<div
												class="command-item full-width {command === 'open'
													? 'forward'
													: 'turn-right'}"
												draggable={selectedDoor.actionsEditable}
												on:dragstart={(e) => {
													if (!selectedDoor.actionsEditable) return;
													e.dataTransfer.setData(
														'text/plain',
														JSON.stringify({ command, fromIndex: index, fromBlock: 'else' })
													);
												}}
											>
												{#if selectedDoor.actionsEditable}
													<span class="drag-handle">⋮⋮</span>
												{/if}
												<span class="command-number">{index + 1}</span>
												<span class="command-text">{command}</span>
												{#if selectedDoor.actionsEditable}
													<button class="remove-btn" on:click={() => removeCommandFromElse(index)}>
														<svg width="12" height="12" viewBox="0 0 24 24" fill="none">
															<path
																stroke="currentColor"
																stroke-width="2"
																d="M6 6l12 12M18 6l-12 12"
															/>
														</svg>
													</button>
												{/if}
											</div>
										{/each}
									{/if}
								</div>
							</div>
						</div>
					</div>

					<div class="modal-buttons">
						<button class="modal-btn cancel" on:click={cancelDoorEdit}>
							{selectedDoor.conditionsEditable || selectedDoor.actionsEditable ? 'Cancel' : 'Close'}
						</button>
						{#if selectedDoor.conditionsEditable || selectedDoor.actionsEditable}
							<button class="modal-btn confirm" on:click={saveDoorCode}>Save</button>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<div class="control-buttons">
			{#if isRunning}
				<button class="control-btn reset" on:click={resetProgram}> Reset </button>
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

	.block-counter {
		background-color: rgba(255, 255, 255, 0.8);
		border: 2px solid #4caf50;
		border-radius: 12px;
		padding: 8px 16px;
		font-weight: bold;
		color: #2e7d32;
		margin-bottom: 10px;
		transition: all 0.3s ease;
	}

	.block-counter.at-limit {
		border-color: #f44336;
		background-color: #ffebee;
		color: #c62828;
	}

	.counter-label {
		margin-right: 4px;
	}

	.counter-value {
		font-size: 1.1em;
		margin-right: 8px;
	}

	.remaining {
		color: #666;
		font-size: 0.9em;
	}

	.limit-reached {
		color: #c62828;
		font-size: 0.9em;
		font-weight: bold;
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

	.gridSquare.wall {
		background-color: #333333;
		position: relative;
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

	.gridSquare.door {
		background-color: #8b4513;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		position: relative;
		transition: all 0.3s ease;
	}

	.gridSquare.door:hover {
		background-color: #a0522d;
	}

	.gridSquare.key {
		background-color: #ffd700;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}

	.key-icon {
		font-size: 1.2em;
		color: #444;
	}

	.door-icon {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		transition: all 0.3s ease;
		border: 3px solid #654321;
		box-sizing: border-box;
	}

	.door-icon.door-open {
		background-color: #66bb6a;
		border-color: #4caf50;
		box-shadow: inset 0 0 15px rgba(76, 175, 80, 0.6);
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

	.command-block.loop {
		background-color: #9c27b0;
		border-color: #7b1fa2;
		color: white;
	}

	.command-block.loop:hover:not(:disabled) {
		background-color: #7b1fa2;
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

	.loop-container {
		border: 2px solid #9c27b0;
		border-radius: 8px;
		margin: 5px 0;
		background: #f3e5f5;
		overflow: hidden;
	}

	.loop-container.executing {
		border-color: #ffc107;
		background-color: #fff8e1;
		box-shadow: 0 0 10px rgba(255, 193, 7, 0.5);
	}

	.loop-header {
		padding: 10px;
		background: #e1bee7;
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 600;
		color: #4a148c;
	}

	.loop-text-btn {
		flex: 1;
		background: none;
		border: none;
		text-align: left;
		font-weight: 600;
		color: #4a148c;
		cursor: pointer;
		padding: 2px 4px;
		border-radius: 3px;
		transition: background-color 0.2s ease;
	}

	.loop-text-btn:hover:not(:disabled) {
		background-color: rgba(255, 255, 255, 0.3);
	}

	.loop-text-btn:disabled {
		cursor: not-allowed;
		opacity: 0.7;
	}

	.loop-commands {
		padding: 10px;
		background: white;
	}

	.loop-command {
		padding: 8px;
		margin: 3px 0;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		font-size: 0.9em;
		cursor: move;
		display: flex;
		align-items: center;
		gap: 4px;
		transition: all 0.2s ease;
	}

	.loop-command.forward:hover {
		border-color: #388e3c;
	}

	.loop-command.turn-left:hover {
		border-color: #1565c0;
	}

	.loop-command.turn-right:hover {
		border-color: #e65100;
	}

	.loop-command.dragging {
		opacity: 0.5;
	}

	.loop-drop-zone {
		margin-top: 8px;
		padding: 12px;
		border: 2px dashed #9c27b0;
		border-radius: 6px;
		min-height: 40px;
		background-color: #fafafa;
		text-align: left;
	}

	.drop-zone-text {
		font-size: 0.9em;
		color: #9c27b0;
		font-style: italic;
		font-weight: 500;
	}

	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal {
		background: white;
		border-radius: 8px;
		padding: 20px;
		min-width: 300px;
		text-align: center;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
	}

	.modal h3 {
		margin: 0 0 10px 0;
		color: #333;
	}

	.modal p {
		margin: 0 0 15px 0;
		color: #666;
	}

	.loop-input {
		width: 60px;
		padding: 8px;
		border: 2px solid #ddd;
		border-radius: 4px;
		text-align: center;
		font-size: 16px;
		margin-bottom: 20px;
	}

	.modal-buttons {
		display: flex;
		gap: 10px;
		justify-content: center;
	}

	.modal-btn {
		padding: 10px 20px;
		border: none;
		border-radius: 4px;
		font-weight: bold;
		cursor: pointer;
	}

	.modal-btn.cancel {
		background: #f44336;
		color: white;
	}

	.modal-btn.confirm {
		background: #4caf50;
		color: white;
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

	/* Door-specific styles */
	.door-modal {
		width: 500px;
		max-height: 600px;
		overflow-y: auto;
	}

	.door-commands {
		margin: 20px 0;
	}

	.command-options {
		display: flex;
		gap: 10px;
		margin-bottom: 15px;
	}

	.command-group {
		margin-bottom: 15px;
	}

	.door-modal .block-row {
		padding-bottom: 20px;
	}

	.block-section {
		margin-bottom: 20px;
	}

	.block-section h3 {
		margin: 0 0 10px 0;
		color: #333;
		font-size: 16px;
	}

	.program-section {
		margin-bottom: 20px;
		border: 1px solid #dee2e6;
		border-radius: 8px;
		overflow: hidden;
	}

	.section-header {
		background-color: #f8f9fa;
		padding: 12px 16px;
		border-bottom: 1px solid #dee2e6;
	}

	.condition-drop-zone {
		min-height: 60px;
		border: 2px dashed #6c757d;
		border-radius: 8px;
		margin: 16px;
		padding: 12px;
		background-color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		box-sizing: border-box;
	}

	.condition-drop-zone:hover {
		border-color: #495057;
		background-color: #f8f9fa;
	}

	.condition-drop-zone.read-only {
		border-style: solid;
		background-color: #f8f9fa;
	}

	.condition-drop-zone.read-only:hover {
		background-color: #f8f9fa;
		border-color: #6c757d;
	}

	.command-drop-zone {
		min-height: 60px;
		margin: 16px;
		padding: 12px;
		background-color: white;
		box-sizing: border-box;
	}

	.command-item.full-width {
		width: calc(100% - 8px);
		margin-bottom: 4px;
		padding: 6px 10px;
		box-sizing: border-box;
	}

	.command-item.condition {
		background-color: #e3f2fd;
		color: #1976d2;
		border: 2px solid #1976d2;
	}

	.command-item.condition:hover {
		border-color: #0d47a1;
		background-color: #bbdefb;
	}

	.command-block.condition {
		background-color: #2196f3;
		border: 2px solid #1976d2;
		color: white;
	}

	.command-block.condition:hover:not(:disabled) {
		background-color: #1976d2;
	}

	.empty-condition {
		color: #6c757d;
		font-style: italic;
		text-align: center;
	}

	.keyword {
		color: #0066cc;
		font-weight: bold;
		font-size: 14px;
	}

	.condition-text {
		color: #cc6600;
		font-style: italic;
		font-size: 14px;
	}

	.if-commands {
		border: 2px dashed #28a745;
		min-height: 40px;
		border-radius: 8px;
	}

	.else-commands {
		border: 2px dashed #ffc107;
		border-radius: 8px;
	}

	.command-drop-zone:hover {
		background-color: #f8f9fa;
	}

	.if-commands:hover {
		border-color: #1e7e34;
		background-color: #f8fff8;
	}

	.else-commands:hover {
		border-color: #e0a800;
		background-color: #fffdf8;
	}

	.command-drop-zone.read-only {
		border-style: solid;
		background-color: #f8f9fa;
	}

	.command-drop-zone.read-only:hover {
		background-color: #f8f9fa;
	}

	.door-program h4 {
		margin: 0 0 10px 0;
		color: #333;
	}

	.empty-door-program {
		padding: 20px;
		text-align: center;
		color: #666;
		background-color: #f5f5f5;
		border-radius: 4px;
		font-style: italic;
	}
</style>
