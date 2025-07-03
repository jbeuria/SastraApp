<script>
	// @ts-nocheck
	import { onMount, onDestroy } from 'svelte';
	import VerseDisplay from '$lib/VerseDisplay.svelte';
	import TOC from '$lib/TOC.svelte';
	import SearchPane from '$lib/SearchPane.svelte';
	import {
		fetchOnlineToc,
		handleLogout,
		bulkDeleteNotesFromSupabase,
		deleteHighlightFromSupabase
	} from '$lib/supabase';
	import { settings, writeSettings } from '$lib/store.svelte';
	import { goto } from '$app/navigation';
	import { db } from '$lib/db.js';

	let { data } = $props();
	let sidebarEl;
	let toggleButtonEl;
	let isCollection = $state(false);
	let tocURL = $state('');
	let showNotePopup = $state(false);
	let windowWidth = $state(0);

	const state = $state({
		sidebarVisible: false,
		searchPaneVisible: false,
		settingsVisible: false,
		bookmarksVisible: false,
		notesListVisible: false,
		highlightsVisible: false,
		overlayActive: '',
		sidebarWidth: 300,
		isResizing: false,
		toc: [],
		uiHidden: false,
		bookmarks: [],
		allNotes: [],
		allHighlights: [],
		isSelectionMode: false,
		selectedNotes: new Set(),
		viewingNote: null
	});

	function handleSearchResultNavigation(event) {
		const { url } = event.detail;
		tocURL = url;
		isCollection = false;
		state.searchPaneVisible = false;
	}

	function toggleSearchPane() {
		state.searchPaneVisible = !state.searchPaneVisible;
	}

	function viewNote(note) {
		state.viewingNote = note;
		state.overlayActive = 'noteViewer';
	}

	function closeNoteViewer() {
		state.viewingNote = null;
		if (state.overlayActive === 'noteViewer') {
			state.overlayActive = '';
		}
	}

	function handleNoteSelection(noteUrl) {
		const newSelectedNotes = new Set(state.selectedNotes);
		if (newSelectedNotes.has(noteUrl)) {
			newSelectedNotes.delete(noteUrl);
		} else {
			newSelectedNotes.add(noteUrl);
		}
		state.selectedNotes = newSelectedNotes;
	}

	async function openHighlights() {
		const all = await db.highlights.getAll();
		state.allHighlights = all.sort((a, b) => b.timestamp - a.timestamp);
		state.highlightsVisible = true;
		state.overlayActive = 'highlights';
	}

	function navigateToHighlight(url) {
		tocURL = url;
		isCollection = false;
		closeModal('highlights');
	}

	async function deleteHighlightFromList(id) {
		await db.highlights.delete(id);
		try {
			await deleteHighlightFromSupabase({ id });
		} catch (e) {
			console.error('Failed to sync highlight deletion to server', e);
		}
		state.allHighlights = state.allHighlights.filter((h) => h.id !== id);
	}

	async function handleAuth() {
		if (data?.user) {
			await handleLogout();
			location.reload();
		} else {
			goto('/signin');
		}
	}

	const closeModal = (modalName) => {
		state[`${modalName}Visible`] = false;
		if (state.overlayActive === modalName) state.overlayActive = '';
	};

	async function openBookmarks() {
		state.bookmarks = await db.bookmarks.getAll();
		state.bookmarksVisible = true;
		state.overlayActive = 'bookmarks';
	}

	async function openNotesList() {
		state.allNotes = (await db.notes.getAll()).filter((n) => n.text?.trim());
		state.isSelectionMode = false;
		state.selectedNotes.clear();
		state.notesListVisible = true;
		state.overlayActive = 'notesList';
	}

	async function deleteBookmark(event, url) {
		event.stopPropagation();
		await db.bookmarks.delete(url);
		state.bookmarks = state.bookmarks.filter((b) => b.url !== url);
	}

	function navigateToBookmark(event, url) {
		event.preventDefault();
		tocURL = url;
		isCollection = false;
		closeModal('bookmarks');
	}

	function navigateToNote(url) {
		tocURL = url;
		isCollection = false;
		closeModal('notesList');
	}

	function toggleSelectionMode() {
		state.isSelectionMode = !state.isSelectionMode;
		if (!state.isSelectionMode) {
			state.selectedNotes.clear();
		}
	}

	async function deleteSelectedNotes() {
		const urlsToDelete = Array.from(state.selectedNotes);
		if (urlsToDelete.length === 0) return;

		if (confirm(`Are you sure you want to delete ${urlsToDelete.length} selected note(s)?`)) {
			await db.notes.bulkDelete(urlsToDelete);
			state.allNotes = state.allNotes.filter((n) => !urlsToDelete.includes(n.toc_url));
			try {
				await bulkDeleteNotesFromSupabase(urlsToDelete);
			} catch (e) {
				console.error('Failed to sync note deletion to the server.', e);
			}
			state.selectedNotes.clear();
			state.isSelectionMode = false;
		}
	}

	async function deleteAllNotes() {
		if (confirm('DANGER: This will delete ALL of your notes permanently. Are you absolutely sure?')) {
			const urlsToDelete = state.allNotes.map((note) => note.toc_url);
			if (urlsToDelete.length === 0) return;

			await db.notes.bulkDelete(urlsToDelete);
			state.allNotes = [];

			try {
				await bulkDeleteNotesFromSupabase(urlsToDelete);
			} catch (e) {
				console.error("Failed to sync 'delete all' to the server.", e);
			}

			state.selectedNotes.clear();
			state.isSelectionMode = false;
		}
	}

	async function handleSettingsChange() {
		await writeSettings();
		document.body.className = `theme-${settings.theme}`;
		if (settings.mode === 'ppt') {
			hideAll();
			closeModal('settings');
		}
	}

	function zoomIn() {
		if (settings.fontSize < 28) {
			settings.fontSize++;
			writeSettings();
		}
	}

	function zoomOut() {
		if (settings.fontSize > 12) {
			settings.fontSize--;
			writeSettings();
		}
	}

	const hideAll = () => {
		Object.assign(state, {
			uiHidden: true,
			sidebarVisible: false,
			searchPaneVisible: false,
			overlayActive: '',
			settingsVisible: false,
			bookmarksVisible: false,
			notesListVisible: false,
			highlightsVisible: false
		});
	};

	const expandUI = () => {
		state.uiHidden = false;
		if (settings.mode === 'ppt') {
			settings.mode = 'books';
		}
	};

	const handleOverlayClick = () => {
		closeModal('settings');
		closeModal('bookmarks');
		closeModal('notesList');
		closeModal('highlights');
		if (state.viewingNote) {
			closeNoteViewer();
		}
	};

	const handleKeydown = (e) => {
		if (e.key === 'Escape') {
			handleOverlayClick();
			if (state.sidebarVisible) state.sidebarVisible = false;
			if (state.searchPaneVisible) state.searchPaneVisible = false;
		}
	};

	const handleMouseDown = (e) => {
		state.isResizing = true;
		document.body.style.cursor = 'ew-resize';
	};
	const handleMouseMove = (e) => {
		if (state.isResizing) {
			const w = e.clientX;
			if (w > 200 && w < 600) state.sidebarWidth = w;
		}
	};
	const handleMouseUp = () => {
		if (state.isResizing) {
			state.isResizing = false;
			document.body.style.cursor = 'default';
		}
	};
	const handleClickOutside = (e) => {
		if (
			state.sidebarVisible &&
			sidebarEl &&
			!sidebarEl.contains(e.target) &&
			(!toggleButtonEl || !toggleButtonEl.contains(e.target))
		) {
			state.sidebarVisible = false;
		}
	};

	function handlePresentationEnd() {
		expandUI();
		state.sidebarVisible = true;
	}

	onMount(async () => {
		const handleResize = () => (windowWidth = window.innerWidth);
		window.addEventListener('resize', handleResize);
		handleResize();

		const allTocData = await fetchOnlineToc();
		settings.toc = Object.keys(allTocData).map((key, index) =>
			buildHierarchy(allTocData[key], index, key)
		);
		handleSettingsChange();
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
		document.addEventListener('click', handleClickOutside);
		window.addEventListener('keydown', handleKeydown);

		onDestroy(() => {
			window.removeEventListener('resize', handleResize);
		});
	});

	onDestroy(() => {
		document.removeEventListener('click', handleClickOutside);
		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('mouseup', handleMouseUp);
		window.removeEventListener('keydown', handleKeydown);
	});

	function buildHierarchy(data, id, code) {
		const root = {
			title: data.find((i) => i.url === '')?.title || 'Root',
			url: '',
			children: [],
			id,
			code
		};
		const map = { '': root };
		data.forEach(({ title, url }) => {
			if (!url) return;
			const path = url.split('/').filter(Boolean);
			let currentLevel = root.children;
			path.forEach((segment, i) => {
				const currentPath = path.slice(0, i + 1).join('/');
				let node = map[currentPath];
				if (!node) {
					node = {
						title: path.length - 1 === i ? title : segment.replace(/_/g, ' '),
						url: currentPath,
						children: [],
						id,
						code
					};
					map[currentPath] = node;
					currentLevel.push(node);
				} else if (path.length - 1 === i && title) {
					node.title = title;
				}
				currentLevel = node.children;
			});
		});
		return root;
	}
</script>

<div class="layout" class:ppt-mode={settings.mode === 'ppt'}>
	{#if !state.uiHidden}
		<div class="top-bar-fixed">
			<div class="bar-content">
				<div class="bar-left">
					<button
						class="sidebar-toggle"
						bind:this={toggleButtonEl}
						onclick={() => (state.sidebarVisible = !state.sidebarVisible)}
					>
						☰<span class="label">TOC</span>
					</button>
				</div>
				<div class="bar-right">
					<button onclick={toggleSearchPane}>🔍<span class="label">Search</span></button>
					<button onclick={openBookmarks}>🔖<span class="label">Bookmarks</span></button>
					<button onclick={handleAuth}>
						{#if data.user}
							🔓<span class="label">Logout</span>
						{:else}
							🔐<span class="label">Login</span>
						{/if}
					</button>
					<button
						onclick={() => {
							state.settingsVisible = true;
							state.overlayActive = 'settings';
						}}
						>⚙️<span class="label">Settings</span></button
					>
				</div>
			</div>
		</div>
	{/if}

	<div class="content-area {state.uiHidden ? 'fullscreen' : 'with-bars'}">
		<div
			class="sidebar-offcanvas {state.sidebarVisible && !state.uiHidden ? 'active' : ''}"
			bind:this={sidebarEl}
			style="--sidebar-width: {state.sidebarWidth}px"
		>
			<div class="sidebar" style="width: {state.sidebarWidth}px">
				<TOC bind:isCollection bind:tocURL />
				<div class="resizer" onmousedown={handleMouseDown}></div>
			</div>
		</div>

		<div
			class="main-content"
			class:sidebar-pushed={state.sidebarVisible && windowWidth > 768 && !state.uiHidden}
			class:search-pushed={state.searchPaneVisible}
		>
			{#if tocURL && tocURL.length > 0}
				{#key tocURL}
					<VerseDisplay
						bind:tocURL
						bind:isCollection
						bind:showNotePopup
						on:presentationEnded={handlePresentationEnd}
					/>
				{/key}
			{:else}
				<div class="full-space">
					<img src="/sastra.png" alt="Sastra Logo" class="welcome-logo" />
				</div>
			{/if}
		</div>

		<SearchPane
			bind:visible={state.searchPaneVisible}
			bookCode={settings.code}
			on:navigate={handleSearchResultNavigation}
		/>
	</div>

	{#if !state.uiHidden}
		<div class="bottom-bar-fixed">
			<div class="bar-content">
				<div class="bar-left"></div>
				<div class="bar-center">
					<button onclick={hideAll}>🙈<span class="label">Hide UI</span></button>
					<button
						onclick={() => {
							if (tocURL) showNotePopup = true;
						}}
						title="Add/View Note for this page"
						disabled={!tocURL}
						>📝<span class="label">Page Note</span></button
					>
					<button onclick={openNotesList}>📚<span class="label">All Notes</span></button>
					<button onclick={openHighlights}>🖍️<span class="label">Highlights</span></button>
				</div>
				<div class="bar-right">
					<div class="zoom-controls">
						<button class="zoom-btn" onclick={zoomOut} title="Zoom Out">-</button>
						<span class="zoom-level">{Math.round((settings.fontSize / 16) * 100)}%</span>
						<button class="zoom-btn" onclick={zoomIn} title="Zoom In">+</button>
					</div>
				</div>
			</div>
		</div>
	{/if}

	{#if state.uiHidden}
		<button class="floating-button" onclick={expandUI}>📖</button>
	{/if}
</div>

<div
	class="overlay {state.overlayActive || state.viewingNote ? 'active' : ''}"
	onclick={handleOverlayClick}
></div>

<div class="modal-container {state.settingsVisible ? 'active' : ''}">
	<div class="modal-content">
		<div class="modal-header">
			<h2>Settings</h2>
		</div>
		<div class="setting-group-wrapper" onchange={handleSettingsChange}>
			<div class="setting-group">
				<h4>View Mode</h4>
				<div class="radio-group">
					<label>
						<input type="radio" bind:group={settings.mode} value="books" />
						<span>Book View</span>
					</label>
					<label>
						<input type="radio" bind:group={settings.mode} value="ppt" />
						<span>Presentation</span>
					</label>
				</div>
			</div>
			<div class="setting-group">
				<h4>Font Size</h4>
				<div class="slider-container">
					<span class="font-size-label">A</span>
					<input
						type="range"
						class="font-slider"
						min="12"
						max="28"
						step="1"
						bind:value={settings.fontSize}
					/>
					<span class="font-size-label large">A</span>
					<span class="font-size-value">{settings.fontSize}px</span>
				</div>
			</div>
			<div class="setting-group">
				<h4>Color Theme</h4>
				<div class="radio-group">
					<label>
						<input type="radio" bind:group={settings.theme} value="light" />
						<span>Light</span>
					</label>
					<label>
						<input type="radio" bind:group={settings.theme} value="dark" />
						<span>Dark</span>
					</label>
					<label>
						<input type="radio" bind:group={settings.theme} value="reading" />
						<span>Reading</span>
					</label>
				</div>
			</div>
		</div>
		<button class="close-btn" onclick={() => closeModal('settings')}>Close</button>
	</div>
</div>

<div class="modal-container {state.bookmarksVisible ? 'active' : ''}">
	<div class="modal-content">
		<div class="modal-header">
			<h2>Bookmarks</h2>
		</div>
		<ul class="list-container">
			{#each state.bookmarks as bookmark (bookmark.url)}
				<li class="bookmark-item">
					<a href="#" onclick={(e) => navigateToBookmark(e, bookmark.url)}>
						{bookmark.title || bookmark.url}
					</a>
					<button
						class="delete-item-btn"
						onclick={(e) => deleteBookmark(e, bookmark.url)}
						title="Delete bookmark"
					>
						&times;
					</button>
				</li>
			{:else}
				<p class="empty-list-message">You haven't bookmarked any pages yet.</p>
			{/each}
		</ul>
		<button class="close-btn" onclick={() => closeModal('bookmarks')}>Close</button>
	</div>
</div>

<div class="modal-container {state.notesListVisible ? 'active' : ''}">
	<div class="modal-content">
		<div class="modal-header">
			<h2>All Notes</h2>
			<div class="modal-actions">
				{#if !state.isSelectionMode && state.allNotes.length > 0}
					<button class="action-btn delete" onclick={deleteAllNotes} title="Delete all notes">
						Delete All
					</button>
				{/if}
				<button class="action-btn" onclick={toggleSelectionMode}>
					{#if state.isSelectionMode}Done{:else}Select{/if}
				</button>
				{#if state.isSelectionMode && state.selectedNotes.size > 0}
					<button class="action-btn delete" onclick={deleteSelectedNotes}>
						Delete ({state.selectedNotes.size})
					</button>
				{/if}
			</div>
		</div>
		<ul class="list-container">
			{#each state.allNotes as note (note.toc_url)}
				<li class="note-item">
					<div
						class="note-content-wrapper"
						onclick={() => {
							if (state.isSelectionMode) handleNoteSelection(note.toc_url);
							else navigateToNote(note.toc_url);
						}}
					>
						{#if state.isSelectionMode}
							<input
								type="checkbox"
								class="note-checkbox"
								checked={state.selectedNotes.has(note.toc_url)}
							/>
						{/if}
						<div class="note-link">
							<span class="note-title">{note.title || note.toc_url}</span>
							<p class="note-preview">{note.text}</p>
						</div>
					</div>
					<div class="note-item-actions">
						<button
							class="action-btn read-note-btn"
							onclick={(e) => {
								e.stopPropagation();
								viewNote(note);
							}}
						>
							Read
						</button>
					</div>
				</li>
			{:else}
				<p class="empty-list-message">You haven't saved any notes yet.</p>
			{/each}
		</ul>
		<button class="close-btn" onclick={() => closeModal('notesList')}>Close</button>
	</div>
</div>

<div class="modal-container {state.highlightsVisible ? 'active' : ''}">
	<div class="modal-content">
		<div class="modal-header">
			<h2>All Highlights</h2>
		</div>
		<ul class="list-container">
			{#each state.allHighlights as highlight (highlight.id)}
				<li class="highlight-item">
					<div
						class="highlight-content-wrapper"
						onclick={() => navigateToHighlight(highlight.toc_url)}
					>
						<p class="highlight-preview">{@html `“${highlight.text}”`}</p>
						<span class="highlight-location">From: {highlight.toc_url}</span>
					</div>
					<button
						class="delete-item-btn"
						onclick={(e) => {
							e.stopPropagation();
							deleteHighlightFromList(highlight.id);
						}}
						title="Delete highlight"
					>
						&times;
					</button>
				</li>
			{:else}
				<p class="empty-list-message">You haven't created any highlights yet.</p>
			{/each}
		</ul>
		<button class="close-btn" onclick={() => closeModal('highlights')}>Close</button>
	</div>
</div>

{#if state.viewingNote}
	<div class="modal-container active" onclick={(e) => e.stopPropagation()}>
		<div class="modal-content">
			<div class="modal-header">
				<h2>{state.viewingNote.title || 'Note'}</h2>
			</div>
			<div class="note-viewer-body">
				<p>{state.viewingNote.text}</p>
			</div>
			<button class="close-btn" onclick={closeNoteViewer}>Close</button>
		</div>
	</div>
{/if}


<style>
	:root {
		--primary-color: #4a90e2;
		--secondary-color: #50e3c2;
		--bar-height: 55px;
		--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
			Arial, sans-serif;
	}
	:global(body.theme-light) {
		--bg-color: #ffffff;
		--text-color: #2c3e50;
		--text-secondary-color: #7f8c8d;
		--border-color: #e0e0e0;
		--popup-bg: #ffffff;
		--popup-text: #2c3e50;
		--pane-bg-color: #f4f4f4;
		--toggle-hover-bg: #e9e9e9;
		--toggle-active-bg: #4a90e2;
		--toggle-active-text: #ffffff;
		--bullet-color: #7f8c8d;
	}
	:global(body.theme-dark) {
		--bg-color: #1a202c;
		--text-color: #ecf0f1;
		--text-secondary-color: #95a5a6;
		--border-color: #4a5568;
		--popup-bg: #2d3748;
		--popup-text: #ecf0f1;
		--pane-bg-color: #2d3748;
		--toggle-hover-bg: #3a475a;
		--toggle-active-bg: #50e3c2;
		--toggle-active-text: #1a202c;
		--bullet-color: #95a5a6;
	}
	:global(body.theme-reading) {
		--bg-color: #fdf6e3;
		--text-color: #584c36;
		--text-secondary-color: #837560;
		--border-color: #e0d8c7;
		--popup-bg: #f5ead8;
		--popup-text: #584c36;
		--pane-bg-color: #f5ead8;
		--toggle-hover-bg: #e9e1d1;
		--toggle-active-bg: #cb4b16;
		--toggle-active-text: #fdf6e3;
		--bullet-color: #837560;
	}
	:global(html, body) {
		margin: 0;
		padding: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
		font-family: var(--font-sans);
		background-color: var(--bg-color);
		color: var(--text-color);
		transition: background-color 0.3s, color 0.3s;
	}
	.layout {
		height: 100vh;
		width: 100vw;
		display: flex;
		flex-direction: column;
	}
	.top-bar-fixed,
	.bottom-bar-fixed {
		background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
		color: white;
		padding: 0 1rem;
		z-index: 1000;
		position: fixed;
		left: 0;
		right: 0;
		height: var(--bar-height);
		display: flex;
		align-items: center;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
	}
	.top-bar-fixed {
		top: 0;
	}
	.bottom-bar-fixed {
		bottom: 0;
	}
	.bar-content {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.bar-left,
	.bar-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.bar-center {
		display: flex;
		gap: 2rem;
		justify-content: center;
	}
	.zoom-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background-color: rgba(0, 0, 0, 0.1);
		padding: 4px 8px;
		border-radius: 20px;
	}
	.zoom-level {
		font-size: 0.8rem;
		font-weight: 600;
		color: white;
		min-width: 40px;
		text-align: center;
		user-select: none;
	}
	.zoom-btn {
		background-color: rgba(255, 255, 255, 0.2);
		color: white;
		border: none;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		font-size: 1.5rem;
		font-weight: bold;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		line-height: 1;
		cursor: pointer;
		transition: background-color 0.2s;
	}
	.zoom-btn:hover {
		background-color: rgba(255, 255, 255, 0.4);
		transform: none;
	}
	button {
		background: transparent;
		color: white;
		border: none;
		padding: 0.2rem;
		font-size: 1.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		cursor: pointer;
		transition: transform 0.2s, opacity 0.2s;
		user-select: none;
	}
	button:hover {
		transform: translateY(-2px);
	}
	button:disabled {
		cursor: not-allowed;
		opacity: 0.6;
		transform: none;
	}
	button .label {
		font-size: 0.65rem;
		margin-top: 2px;
		font-weight: 500;
	}
	@media (max-width: 600px) {
		button .label {
			display: none;
		}
	}
	.content-area {
		flex: 1;
		display: flex;
		overflow: hidden;
	}
	.content-area.with-bars {
		padding-top: var(--bar-height);
		padding-bottom: var(--bar-height);
	}
	.sidebar-offcanvas {
		position: fixed;
		left: calc(-1 * var(--sidebar-width, 300px));
		top: var(--bar-height);
		bottom: var(--bar-height);
		width: var(--sidebar-width, 300px);
		background: var(--pane-bg-color);
		border-right: 1px solid var(--border-color);
		transition: left 0.3s ease;
		z-index: 200;
		overflow: hidden;
		box-shadow: 2px 0 15px rgba(0, 0, 0, 0.1);
	}
	.sidebar-offcanvas.active {
		left: 0;
	}
	.sidebar {
		height: 100%;
		display: flex;
		flex-direction: column;
	}
	.resizer {
		width: 5px;
		cursor: ew-resize;
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
		z-index: 100;
	}
	.main-content {
		flex-grow: 1;
		overflow-y: auto;
		transition: margin-left 0.3s ease, margin-right 0.3s ease-in-out;
	}
	.main-content.sidebar-pushed {
		margin-left: var(--sidebar-width, 300px);
	}
	.main-content.search-pushed {
		margin-right: 350px;
	}
	.full-space {
		height: 100%;
		width: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		background-color: var(--bg-color);
		transition: background-color 0.3s;
	}
	.welcome-logo {
		max-width: 2500px;
		height: auto;
		opacity: 0;
		animation: fadeInScaleUp 1.5s 0.2s ease-out forwards;
		filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));
	}
	@keyframes fadeInScaleUp {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 0.7;
			transform: scale(1);
		}
	}
	.floating-button {
		position: fixed;
		bottom: 20px;
		right: 20px;
		background: var(--primary-color);
		color: white;
		border: none;
		width: 50px;
		height: 50px;
		border-radius: 50%;
		font-size: 1.5rem;
		z-index: 2000;
		cursor: pointer;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	}
	.overlay {
		display: none;
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		z-index: 1050;
		backdrop-filter: blur(4px);
	}
	.overlay.active {
		display: block;
	}
	.modal-container {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%) scale(0.9);
		background: var(--popup-bg);
		color: var(--popup-text);
		border-radius: 15px;
		box-shadow: 0 15px 30px rgba(0, 0, 0, 0.2);
		z-index: 1100;
		width: clamp(320px, 90vw, 600px);
		opacity: 0;
		visibility: hidden;
		transition:
			opacity 0.3s,
			transform 0.3s,
			visibility 0.3s;
		display: flex;
		flex-direction: column;
		max-height: 85vh;
	}
	.modal-container.active {
		opacity: 1;
		visibility: visible;
		transform: translate(-50%, -50%) scale(1);
	}
	.modal-content {
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		overflow: hidden;
		flex-grow: 1;
	}
	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem 2rem 1rem;
		border-bottom: 1px solid var(--border-color);
		flex-shrink: 0;
	}
	.modal-header h2 {
		margin: 0;
	}
	.modal-actions {
		display: flex;
		gap: 0.5rem;
	}
	.action-btn {
		background: transparent;
		color: var(--primary-color);
		border: 1px solid var(--primary-color);
		padding: 0.4rem 0.8rem;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: 600;
	}
	.action-btn.delete {
		background-color: #e74c3c;
		border-color: #e74c3c;
		color: white;
	}
	.list-container {
		list-style: none;
		padding: 0.5rem 2rem 1rem;
		margin: 0;
		overflow-y: auto;
		flex-grow: 1;
	}
	.setting-group {
		margin-top: 0.5rem;
	}
	.setting-group h4 {
		margin: 0 0 0.75rem;
		color: var(--text-secondary-color);
		border-bottom: 1px solid var(--border-color);
		padding-bottom: 0.5rem;
	}
	.radio-group {
		display: flex;
		justify-content: center;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.radio-group label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		padding: 0.5rem 1rem;
		border-radius: 8px;
		transition: background-color 0.2s;
		border: 1px solid var(--border-color);
	}
	.radio-group label:has(input:checked) {
		background-color: var(--primary-color);
		color: white;
		border-color: var(--primary-color);
	}
	.radio-group input[type='radio'] {
		display: none;
	}
	.bookmark-item,
	.note-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		margin-bottom: 0.5rem;
		transition: background-color 0.2s;
	}
	.note-item:hover,
	.bookmark-item:hover {
		background-color: var(--toggle-hover-bg);
	}
	.bookmark-item a {
		flex-grow: 1;
		display: block;
		padding: 1rem;
		text-decoration: none;
		color: var(--text-color);
		cursor: pointer;
	}
	.note-content-wrapper {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-grow: 1;
		cursor: pointer;
		padding: 1rem;
	}
	.delete-item-btn {
		color: var(--text-secondary-color);
		font-size: 1.5rem;
		padding: 0.5rem 1rem;
		background: transparent;
		border: none;
		cursor: pointer;
	}
	.delete-item-btn:hover {
		color: #e74c3c;
		transform: none;
	}
	.note-checkbox {
		width: 18px;
		height: 18px;
		accent-color: var(--primary-color);
		margin-right: 1rem;
	}
	.note-link {
		flex-grow: 1;
		text-decoration: none;
	}
	.note-title {
		font-weight: 600;
		color: var(--primary-color);
		display: block;
		margin-bottom: 0.5rem;
	}
	.note-preview {
		margin: 0;
		font-size: 0.9rem;
		color: var(--text-secondary-color);
		white-space: pre-wrap;
		word-break: break-word;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.empty-list-message {
		text-align: center;
		color: var(--text-secondary-color);
		padding: 2rem;
	}
	.close-btn {
		background: #eee;
		color: #555;
		border: 1px solid #ddd;
		padding: 0.7rem;
		font-size: 1rem;
		border-radius: 8px;
		cursor: pointer;
		transition:
			background-color 0.2s,
			color 0.2s;
		margin: 1rem 2rem;
		align-self: flex-end;
		flex-shrink: 0;
	}
	.close-btn:hover {
		background: var(--primary-color);
		color: white;
		border-color: var(--primary-color);
		transform: none;
	}
	.slider-container {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem 0;
	}
	.font-slider {
		flex-grow: 1;
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 8px;
		background: var(--border-color);
		border-radius: 5px;
		outline: none;
		opacity: 0.7;
		transition: opacity 0.2s;
	}
	.font-slider:hover {
		opacity: 1;
	}
	.font-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 20px;
		height: 20px;
		background: var(--primary-color);
		cursor: pointer;
		border-radius: 50%;
	}
	.font-slider::-moz-range-thumb {
		width: 20px;
		height: 20px;
		background: var(--primary-color);
		cursor: pointer;
		border-radius: 50%;
	}
	.font-size-label {
		font-size: 1rem;
		font-weight: bold;
		color: var(--text-secondary-color);
	}
	.font-size-label.large {
		font-size: 1.5rem;
	}
	.font-size-value {
		min-width: 45px;
		text-align: center;
		font-weight: 500;
		color: var(--text-color);
		background-color: var(--pane-bg-color);
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
		border: 1px solid var(--border-color);
	}
	.highlight-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		margin-bottom: 0.75rem;
		transition: background-color 0.2s;
	}
	.highlight-item:hover {
		background-color: var(--toggle-hover-bg);
	}
	.highlight-content-wrapper {
		flex-grow: 1;
		cursor: pointer;
		padding: 1rem;
	}
	.highlight-preview {
		margin: 0 0 0.5rem 0;
		font-style: italic;
		color: var(--text-color);
	}
	.highlight-preview mark {
		background-color: transparent;
		color: inherit;
	}
	.highlight-location {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text-secondary-color);
	}
	.note-item-actions {
		padding-right: 1rem;
		align-self: center;
	}
	.read-note-btn {
		padding: 0.3rem 0.6rem;
		font-size: 0.8rem;
	}
	.note-viewer-body {
		padding: 0.5rem 2rem 1rem;
		overflow-y: auto;
		flex-grow: 1;
		white-space: pre-wrap;
		line-height: 1.6;
	}
</style>