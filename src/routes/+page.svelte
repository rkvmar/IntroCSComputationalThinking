<script lang="ts">
	import Grid from '$lib/components/Grid.svelte';
</script>

<Grid
	contents={[
		[0, 0, 0, 0, 0],
		[0, 0, 2, 0, 0],
		[0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0],
		[0, 0, 1, 0, 0]
	]}
	allowedCommands={['f']}
/>
