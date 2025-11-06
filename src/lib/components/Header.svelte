

<script lang="ts">
    import { showDirectionalHelp } from '$lib/stores';

    function resetProgress(){
        if (typeof window === 'undefined') return;

        // ask for confirmation before clearing progress
        const confirmed = window.confirm('Are you sure??');
        if (!confirmed) return;

        window.localStorage.setItem('maxUnlockedLevel', '0'); //this is a string because local storage only takes strings
        // reload to reflect cleared progress in the UI
        if (window.location) {
            window.location.reload();
        }
    }

    function toggleDirectionalHelp() {
        showDirectionalHelp.update((v) => !v);
    }
</script>


<div class="header" >
    <h1 class="title">Computational Thinking Puzzles</h1>
    <button
        class="control-buttons reset"
        on:click={() => resetProgress()}>
        Reset All Progress
    </button>

    <button
        class="control-buttons help-toggle"
        on:click={() => toggleDirectionalHelp()}>
        {#if $showDirectionalHelp}
            Hide Left/Right Help
        {:else}
            Show Left/Right Help
        {/if}
    </button>
     
</div>



<style>
.header {
justify-content: center;
display: flex;
flex-direction: row;
align-items: center;
gap: 20px;
padding: 20px;
transition: background-color 0.3s ease;
border-bottom: 1px solid;
border-bottom-color: rgb(162, 162, 162);
}

.control-buttons {
    display: flex;
    gap: 10px;
    justify-content: center;
    padding: 12px 20px;
    border: 2px solid;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    font-size: 14px;
}

.reset {
    background-color: rgb(229, 73, 73);
    color: white; 
}

.title {
    font-weight: bold;
    color: rgb(0, 38, 109);
}

.line{
    background-color: grey;
}

</style>