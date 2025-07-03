<script>
	// @ts-nocheck
	import { SvelteSet } from 'svelte/reactivity';
	import { settings } from './store.svelte.js';

	let { tocURL = $bindable(), isCollection = $bindable() } = $props();

	let openItems = new SvelteSet();

	// EDITED: Simplified and more robust logic for handling clicks
	function handleItemClick(item) {
		// 1. Always set the URL and determine if it's a collection
		tocURL = item.url;
		isCollection = item.children.length > 0;

		// 2. Also update the global book code
		settings.id = item.id;
		settings.code = item.code;

		// 3. Toggle the visual expansion for items that have children
		if (item.children.length > 0) {
			openItems.has(item) ? openItems.delete(item) : openItems.add(item);
		}
	}
</script>

<div class="container">
	<div class="toc">
		{@render TOC(settings.toc)}
	</div>
</div>

{#snippet TOC(entries)}
	<ul class="toc-level">
		{#each entries as entry}
			<li class:active={tocURL === entry.url && !isCollection}>
				<div class="toggle" onclick={() => handleItemClick(entry)} title={entry.title}>
					{#if entry.children.length > 0}
						<span class="bullet" class:open={openItems.has(entry)}>‣</span>
					{:else}
						<span class="bullet-placeholder"></span>
					{/if}
					<span class="title">{entry.title}</span>
				</div>

				{#if openItems.has(entry) && entry.children.length > 0}
					{@render TOC(entry.children)}
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

<style>
	.container {
		width: 100%;
		height: 100%;
		background-color: var(--pane-bg-color);
		color: var(--text-color);
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		transition: background-color 0.3s, color 0.3s;
	}
	.toc {
		height: 100%;
		overflow-y: auto;
		padding: 0.5rem;
	}
	.toc-level {
		list-style-type: none;
		padding-left: 1rem;
		border-left: 1px solid var(--border-color);
	}
	.toc > .toc-level {
		padding-left: 0;
		border-left: none;
	}
	li {
		margin: 0.1rem 0;
	}
	.toggle {
		display: flex;
		align-items: center;
		padding: 0.5rem 0.6rem;
		border-radius: 6px;
		cursor: pointer;
		transition: background-color 0.2s, color 0.2s;
		width: 100%;
		overflow: hidden;
	}
	.toggle:hover {
		background-color: var(--toggle-hover-bg);
	}
	li.active > .toggle {
		background-color: var(--toggle-active-bg);
		color: var(--toggle-active-text);
		font-weight: 600;
	}
	li.active > .toggle .bullet {
		color: var(--toggle-active-text);
	}
	.bullet,
	.bullet-placeholder {
		color: var(--bullet-color);
		font-size: 1rem;
		margin-right: 0.5rem;
		transition: transform 0.2s;
		flex-shrink: 0;
		width: 1em;
		display: inline-block;
		text-align: center;
	}
	.bullet.open {
		transform: rotate(90deg);
	}
	.title {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>