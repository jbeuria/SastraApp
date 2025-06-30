<script>
    import { onMount } from 'svelte';
    import VerseDisplay from '$lib/VerseDisplay.svelte';
    import TOC from '$lib/TOC.svelte';


    let sidebarVisible = false;
    let searchVisible = false;
    let overlayActive = '';
    let sidebarWidth = 250;
    let isResizing = false;
    let toc = [];
    let searchQuery = '';
    let results = [];
    let isCollection=$state(false)
    let tocURL=$state(null)

    const toggleSidebar = () => {
      sidebarVisible = !sidebarVisible;
      overlayActive = sidebarVisible && window.innerWidth <= 600 ? 'sidebar' : '';
    };
  
    const openSearch = () => {
      searchVisible = true;
      overlayActive = 'search';
    };
  
    const closeSearch = () => {
      searchVisible = false;
      if (overlayActive === 'search') overlayActive = '';
    };
  
    const performSearch = () => {
      results = [`Result for "${searchQuery}"`];
      closeSearch();
    };
  
    const handleSearchKey = (e) => {
      if (e.key === 'Enter') {
        performSearch();
      }
    };
  
    const closeSidebar = () => {
      sidebarVisible = false;
      if (overlayActive === 'sidebar') overlayActive = '';
    };
  
    const handleOverlayClick = () => {
      if (overlayActive === 'search') closeSearch();
      else if (overlayActive === 'sidebar') closeSidebar();
    };
  
    const setMode = (e) => console.log("Mode set to", e.target.value);
    const login = () => alert("Login clicked");
    const openSettings = () => alert("Settings clicked");
    const hideAll = () => alert("Hide All clicked");
    const openNotes = () => alert("Notes clicked");
    const openLast = () => alert("Last Opened clicked");
  
    const handleMouseDown = (e) => {
      if (window.innerWidth <= 600) return;
      isResizing = true;
      document.body.style.cursor = 'ew-resize';
    };
  
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = e.clientX;
      if (newWidth > 150 && newWidth < 500) sidebarWidth = newWidth;
    };
  
    const handleMouseUp = () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = 'default';
      }
    };
  
    const updateTOC = () => {
      toc = Array.from(document.querySelectorAll('.reader-content h1, .reader-content h2, .reader-content h3'))
        .map(el => ({ text: el.innerText, id: el.id }));
    };
  
    onMount(() => {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (overlayActive === 'search') closeSearch();
          else if (overlayActive === 'sidebar') closeSidebar();
        }
      });
    //   updateTOC();
    });
  </script>
  

  <div class="layout">
    <div class="sidebar-container" class:hidden={!sidebarVisible} style="width: {sidebarVisible ? sidebarWidth + 'px' : '0px'}">
      {#if sidebarVisible}
      <div class="sidebar">
        <TOC bind:isCollection={isCollection} bind:tocURL={tocURL} />
      </div>
      {/if}
    </div>
    <div class="resizer" on:mousedown={handleMouseDown}></div>
    <div class="main">
      <div class="top-bar">
        <div style="display: flex; gap: 8px; align-items: center;">
          <button on:click={toggleSidebar}><span>☰</span><small>Menu</small></button>
          <select on:change={setMode}>
            <option value="books">Books</option>
            <option value="ppt">PPT</option>
          </select>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button on:click={openSearch}><span>🔍</span><small>Search</small></button>
          <button on:click={login}><span>🔐</span><small>Login</small></button>
          <button on:click={openSettings}><span>⚙️</span><small>Settings</small></button>
        </div>
      </div>
      <div class="reader-content" style="flex: 1; padding: 16px; overflow: auto">
          <VerseDisplay bind:isCollection={isCollection} bind:tocURL={tocURL}/>
      </div>
      <div class="bottom-bar">
        <button on:click={hideAll}><span>🙈</span><small>Hide All</small></button>
        <button on:click={openNotes}><span>📝</span><small>Notes</small></button>
        <button on:click={openLast}><span>📂</span><small>Last Opened</small></button>
      </div>
    </div>
  </div>
  
  <div class="overlay" class:active={overlayActive} on:click={handleOverlayClick}></div>
  <div class="search-modal" class:active={searchVisible}>
    <div class="search-box">
      <input
        type="text"
        placeholder="Search..."
        bind:value={searchQuery}
        on:keydown={handleSearchKey}
        autofocus
      />
      <button class="search-button" on:click={performSearch}>🔍</button>
    </div>
  </div>
  
  
  <style>
    .layout {
      display: flex;
      height: 100vh;
      overflow: hidden;
    }
    .sidebar-container {
      transition: width 0.3s ease;
      overflow: hidden;
    }
    .sidebar {
      background: #f3f4f6;
      padding: 16px;
      border-right: 1px solid #e5e7eb;
      overflow-y: auto;
      height: 100%;
      width: 100%;
    }
    .sidebar.hidden {
      width: 0 !important;
      padding: 0;
      border: none;
    }
    .resizer {
      width: 5px;
      cursor: ew-resize;
      background: transparent;
    }
    @media (max-width: 600px) {
      .resizer {
        display: none;
      }
    }
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .top-bar, .bottom-bar {
        display: flex;
        justify-content: space-between;
        background: #c9daeb;
        padding: 10px 0;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        flex-wrap: wrap;
        gap: 8px;
        width: 100%;
    }
    .top-bar button, .bottom-bar button {
      background: transparent;
      color: #1f2937;
      border: none;
      padding: 4px;
      font-size: 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .top-bar button:hover, .bottom-bar button:hover {
      background: #e5e7eb;
      border-radius: 6px;
    }
    .top-bar small, .bottom-bar small {
      font-size: 10px;
    }
    @media (max-width: 500px) {
      .top-bar button small, .bottom-bar button small {
        display: none;
      }
      .top-bar button, .bottom-bar button {
        font-size: 18px;
      }
    }
    .overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.3);
        display: none;
        z-index: 10;
    }
    .overlay.active {
      display: block;
    }

    @media (max-width: 600px) {
        .sidebar-container {
            position: fixed;
            top: 0;
            left: 0;
            height: 100%;
            background: white;
            z-index: 30; /* Above overlay */
            box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
        }
    }

    .search-modal {
      position: fixed;
      top: 20%;
      left: 50%;
      transform: translateX(-50%);
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      display: none;
      z-index: 20;
      width: 90%;
      max-width: 480px;
    }
    .search-modal.active {
      display: block;
    }

    .search-box {
    display: flex;
    gap: 8px;
    align-items: center;
    }

    .search-box input[type="text"] {
    flex: 1;
    padding: 10px 14px;
    font-size: 16px;
    border: 1px solid #ccc;
    border-radius: 8px;
    }

    .search-button {
    /* background: #4f46e5; */
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 16px;
    font-size: 16px;
    cursor: pointer;
    }

    .search-button:hover {
    background: #6458e4;
    }

    select {
      padding: 6px;
      border-radius: 6px;
      border: 1px solid #ccc;
    }

  </style>
  