<script>
    // @ts-nocheck
    import { SvelteSet } from 'svelte/reactivity';
    import { settings } from './store.svelte.js';

    let {
        tocURL = $bindable(),
        isCollection = $bindable()
    } = $props();

    // Use a Set for efficient checking of open items
    let openItems = new SvelteSet();

    function toggleOpen(item) {
        // Toggle the presence of the item in the set
        openItems.has(item) ? openItems.delete(item) : openItems.add(item);

        // Logic to set the main content URL
        if (item.children.length === 0) {
            // It's a leaf node (a single page)
            tocURL = item.url;
            isCollection = false;
        } else if (item.children.every((el) => el.children.length === 0)) {
            // It's a direct parent of leaf nodes (a chapter/collection)
            tocURL = item.url;
            isCollection = true;
        }
        
        // Update global settings with the current book's info
        settings.id = item.id;
        settings.code = item.code;
    }
</script>

<!-- The theme class from the body will cascade down, so we don't need it here -->
<div class="container">
    <div class="toc">
        <!-- Render the top-level of the TOC -->
        {@render TOC(settings.toc)}
    </div>
</div>

<!-- This snippet is a recursive template for rendering TOC levels -->
{#snippet TOC(entries)}
    <ul class="toc-level">
        {#each entries as entry}
            <!-- Add an 'active' class if the item's URL matches the current one -->
            <li class:active={tocURL === entry.url && !isCollection}>
                <div class="toggle" on:click={() => toggleOpen(entry)} title={entry.title}>
                    <!-- Show a rotating bullet for items with children -->
                    {#if entry.children.length > 0}
                        <span class="bullet" class:open={openItems.has(entry)}>‣</span>
                    {:else}
                        <span class="bullet-placeholder"></span>
                    {/if}
                    <span class="title">{entry.title}</span>
                </div>
                <!-- If the item is open and has children, render its children recursively -->
                {#if openItems.has(entry) && entry.children.length > 0}
                    {@render TOC(entry.children)}
                {/if}
            </li>
        {/each}
    </ul>
{/snippet}

<style>
    /* CSS variables are inherited from the body tag via +page.svelte */
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
    .bullet, .bullet-placeholder {
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
