<script>
	// @ts-nocheck
	import { createEventDispatcher } from 'svelte';
	// import { searchBook } from '$lib/supabase';

	let { visible = $bindable(), bookCode = '' } = $props();

	const dispatch = createEventDispatcher();

	let searchQuery = $state('');
	let searchResults = $state([]);
	let isSearching = $state(false);

	async function performSearch() {
		if (!searchQuery.trim() || isSearching) return;

		isSearching = true;
		searchResults = []; 

		setTimeout(() => {
			isSearching = false;
		}, 1500);
	}

	function navigateToSearchResult(url) {
		dispatch('navigate', { url });
	}

	function closePane() {
		visible = false;
	}
</script>

<div class="search-pane {visible ? 'active' : ''}">
	<div class="search-pane-header">
		<h3>Search</h3>
		<button class="close-pane-btn" onclick={closePane}>&times;</button>
	</div>
	<div class="search-pane-body">
		<div class="search-box">
    <input
        type="text"
        placeholder="Search current book..."
        bind:value={searchQuery}
        onkeydown={(e) => {
            if (e.key === 'Enter') performSearch();
        }}
    />
    <button class="modal-button" onclick={performSearch} disabled={isSearching}>
        {#if isSearching}Searching...{:else}Search{/if}
    </button>
</div>
		<ul class="search-results-list">
			{#if isSearching}
				<p class="empty-list-message">Searching...</p>
			{:else if searchResults.length > 0}
				{#each searchResults as result (result.verse_url)}
					<li class="search-result-item" onclick={() => navigateToSearchResult(result.verse_url)}>
						<h4>{result.verse_url}</h4>
						<p>{@html result.snippet}</p>
					</li>
				{/each}
			{:else}
				<p class="empty-list-message">Type a query and press Enter to search.</p>
			{/if}
		</ul>
	</div>
</div>

<style>
	.search-pane {
		position: fixed;
		top: 0;
		right: 0;
		width: 350px;
		height: 100%;
		background-color: var(--pane-bg-color);
		border-left: 1px solid var(--border-color);
		z-index: 1010;
		transform: translateX(100%);
		transition: transform 0.3s ease-in-out;
		display: flex;
		flex-direction: column;
		box-shadow: -2px 0 15px rgba(0, 0, 0, 0.1);
	}

	.search-pane.active {
		transform: translateX(0);
	}

	.search-pane-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 1rem;
		border-bottom: 1px solid var(--border-color);
		height: 55px; /* Match top bar height */
		box-sizing: border-box;
		flex-shrink: 0;
	}

	.search-pane-header h3 {
		margin: 0;
	}

	.close-pane-btn {
		background: none;
		border: none;
		font-size: 2rem;
		color: var(--text-secondary-color);
		cursor: pointer;
	}

	.search-pane-body {
		padding: 1rem;
		overflow-y: auto;
		flex-grow: 1;
	}

	.search-box {
		padding: 0;
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.search-box input {
		width: 100%;
		padding: 0.5rem;
		background-color: var(--bg-color);
		color: var(--text-color);
		border: 1px solid var(--border-color);
	}

	.modal-button {
		background-color: var(--primary-color);
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 4px;
	}

	.search-results-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.search-result-item {
		padding: 1rem;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		margin-bottom: 0.75rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.search-result-item:hover {
		background-color: var(--toggle-hover-bg);
	}

	.search-result-item h4 {
		margin: 0 0 0.5rem 0;
		color: var(--primary-color);
	}

	.search-result-item p {
		margin: 0;
		font-size: 0.9rem;
		color: var(--text-secondary-color);
		line-height: 1.5;
	}

	.search-result-item mark {
		background-color: var(--secondary-color);
		color: var(--text-color);
		font-weight: bold;
	}
	.empty-list-message {
		text-align: center;
		color: var(--text-secondary-color);
		padding: 2rem;
	}
</style>