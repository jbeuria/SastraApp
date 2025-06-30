<script>
// @ts-nocheck

    // SearchBox.svelte
    import { onMount } from 'svelte';
    import { getfts,runFTSIndexing,runSearch } from '$lib/fts.js';
    import { settings } from './store.svelte';
    import { invoke} from "@tauri-apps/api/core";    
    import { listen } from '@tauri-apps/api/event';


    let {allSearches=$bindable()}=$props(); // Callback to pass search results to parent
    let searchQuery = $state("");
    let isFTSready = $state(true);
    let fts = null;
        
    // Initialize FTS
    async function initializeFTS() {
        try {
            fts = await getfts();
            isFTSready = true;
            console.log("FTS initialized");
        } catch (error) {
            console.error("Failed to initialize FTS:", error);
        }
    }


    let results = $state([]);

    async function handleSearch() {
        // results = []; // Clear previous results
        let results= await invoke("search", { query: searchQuery }); // Call Rust backend
    }

    listen("search-result", (event) => {
        results =  [...results, event.payload]; // Append new results

        console.log(searchQuery,results)
    });
    
    // Perform Search
    async function handleSearch2() {

        let query=searchQuery;
        console.log('query',searchQuery)

        if (!isFTSready || query.length < 3) return;
    
        const config = { prefix: true, fuzzy: 0.1, highlight: true };
        let newSearches = {};
        
        for (const book of settings.booksAvailable) {

            if (fts && fts[book.short_name]) {
                newSearches[book.short_name] = fts[book.short_name].search(query, config);
            }
        }
        
        let temp = await runSearch(query)
        newSearches[book.short_name] = temp;
        console.log(newSearches);
           
        allSearches={...newSearches};
    }
    
    onMount(async() => {

        // await runFTSIndexing();
        // initializeFTS();
    });
    </script>
    
    <!-- <ul>
        {#each results as result}
        {console.log('new update')}
        {$inspect(results)}
          <li>{result}</li>
        {/each}
    </ul> -->

    <div class="search-box">
        <input
            type="text"
            bind:value={searchQuery}
            placeholder={isFTSready ? "Search with FTS ..." : "FTS loading ..."}
            disabled= {!isFTSready}
            oninput={handleSearch}
        />
    </div>
    
    <style>
    .search-box input {
        width: 100%;
        flex: 1;
        padding: 0.5rem;
        border: 1px solid #ccc;
        border-radius: 5px;
    }
    </style>
    