<script>
	// @ts-nocheck
	import { settings } from '$lib/store.svelte.js';
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import {
		fetchOnlineBookContent,
		syncNoteToSupabase,
		deleteHighlightFromSupabase
	} from '$lib/supabase';
	import { db } from '$lib/db.js';

	let {
		tocURL = $bindable(),
		isCollection = $bindable(),
		showNotePopup = $bindable(false)
	} = $props();

	const dispatch = createEventDispatcher();

	let isLoading = $state(true);
	let errorMessage = $state('');
	let selectedData = $state([]);
	let slides = $state([]);
	let noteText = $state('');
	let highlights = $state([]);
	let isBookmarked = $state(false);
	let currentTitle = $state('');
	let showKrishnaPopup = $state(false);
	let popupCoords = $state({ x: 0, y: 0 });
	let currentSelection = $state(null);
	let highlightToDelete = $state(null);
	let showPptSettings = $state(false);
	let windowSize = $state({ width: 0, height: 0 });
	let readingSection = $state(null);
	let isPaused = $state(false);

	function readSection(sectionName, text) {
		if (!('speechSynthesis' in window)) {
			alert('Sorry, your browser does not support text-to-speech.');
			return;
		}
		stopReading();
		setTimeout(() => {
			const cleanText = (text ?? '').replace(/<[^>]*>/g, ' ');
			const utterance = new SpeechSynthesisUtterance(cleanText);
			const voice = window.speechSynthesis.getVoices().find((v) => v.voiceURI === settings.selectedVoiceURI);
			if (voice) utterance.voice = voice;
			
			utterance.rate = 0.9;
			utterance.onstart = () => { readingSection = sectionName; isPaused = false; };
			utterance.onend = () => stopReading();
			utterance.onerror = () => stopReading();
			window.speechSynthesis.speak(utterance);
		}, 100);
	}

	function stopReading() {
		if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
		readingSection = null;
		isPaused = false;
	}
	
	function togglePauseResume() {
		if (window.speechSynthesis.speaking) {
			if (isPaused) window.speechSynthesis.resume();
			else window.speechSynthesis.pause();
			isPaused = !isPaused;
		}
	}

	function expandRangeToWordBoundaries(range) {
		const isWordChar = (char) => /[a-zA-Z0-9]/.test(char);
		if (range.startContainer.nodeType === Node.TEXT_NODE) {
			let offset = range.startOffset;
			while (offset > 0 && isWordChar(range.startContainer.textContent[offset - 1])) {
				offset--;
			}
			range.setStart(range.startContainer, offset);
		}
		if (range.endContainer.nodeType === Node.TEXT_NODE) {
			let offset = range.endOffset;
			while (offset < range.endContainer.textContent.length && isWordChar(range.endContainer.textContent[offset])) {
				offset++;
			}
			range.setEnd(range.endContainer, offset);
		}
		return range;
	}

	function handleContentClick(event) {
		if (event.target.closest('.action-bubble') || event.target.closest('.read-aloud-btn') || event.target.closest('.tts-controls')) {
			return;
		}
		if (event.target.tagName === 'MARK') {
			const highlightHtml = event.target.innerHTML;
			const clickedHighlight = highlights.find((h) => h.text === highlightHtml);
			if (clickedHighlight) {
				highlightToDelete = clickedHighlight;
				currentSelection = null;
				const rect = event.target.getBoundingClientRect();
				popupCoords = { x: rect.left + rect.width / 2, y: rect.top };
				showKrishnaPopup = true;
				return;
			}
		}
		setTimeout(() => {
			const selection = window.getSelection();
			if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
				let range = selection.getRangeAt(0);
				range = expandRangeToWordBoundaries(range);
				selection.removeAllRanges();
				selection.addRange(range);
				currentSelection = range;
				highlightToDelete = null;
				const rect = currentSelection.getBoundingClientRect();
				popupCoords = { x: rect.left + rect.width / 2, y: rect.top };
				showKrishnaPopup = true;
			} else {
				showKrishnaPopup = false;
			}
		}, 50);
	}

	async function createHighlight() {
		if (!currentSelection) return;
		const selectionFragment = currentSelection.cloneContents();
		const tempDiv = document.createElement('div');
		tempDiv.appendChild(selectionFragment);
		const highlightHtml = tempDiv.innerHTML;
		if (!highlightHtml || !highlightHtml.trim()) {
			window.getSelection().removeAllRanges();
			showKrishnaPopup = false;
			currentSelection = null;
			return;
		}
		const newHighlight = { toc_url: tocURL, text: highlightHtml, timestamp: Date.now() };
		const id = await db.highlights.add(newHighlight);
		highlights = [...highlights, { ...newHighlight, id }];
		window.getSelection().removeAllRanges();
		showKrishnaPopup = false;
		currentSelection = null;
	}

	async function deleteHighlight() {
		if (!highlightToDelete) return;
		await db.highlights.delete(highlightToDelete.id);
		if (highlightToDelete.id) {
			try {
				await deleteHighlightFromSupabase(highlightToDelete);
			} catch (e) {}
		}
		highlights = highlights.filter((h) => h.id !== highlightToDelete.id);
		showKrishnaPopup = false;
		highlightToDelete = null;
	}

	function applyHighlights(baseText) {
		let highlightedText = baseText ?? '';
		if (!highlights || highlights.length === 0) {
			return highlightedText;
		}
		highlights.forEach((h) => {
			if (h.text) {
				highlightedText = highlightedText.replaceAll(h.text, `<mark class="highlighted-text">${h.text}</mark>`);
			}
		});
		return highlightedText;
	}
	
	function handleVcToggle(key) {
		if (settings.vc[key] === true) {
			const checkedCount = Object.values(settings.vc).filter(Boolean).length;
			if (checkedCount <= 1) return;
		}
		settings.vc[key] = !settings.vc[key];
	}

	function chunkText(text, maxLength) {
		const safeText = text ?? '';
		if (safeText.length <= maxLength) return [safeText];
		const chunks = [];
		let remainingText = safeText;
		while (remainingText.length > 0) {
			let chunk = remainingText.substring(0, maxLength);
			let splitIndex = Math.max(chunk.lastIndexOf('. '), chunk.lastIndexOf('? '), chunk.lastIndexOf('! '));
			if (splitIndex > maxLength / 2) {
				chunk = remainingText.substring(0, splitIndex + 1);
			} else {
				splitIndex = chunk.lastIndexOf(' ');
				if (splitIndex !== -1 && splitIndex > maxLength / 2) {
					chunk = chunk.substring(0, splitIndex);
				}
			}
			chunks.push(chunk.trim());
			remainingText = remainingText.substring(chunk.length).trim();
		}
		return chunks;
	}
	
	$effect(() => {
		const mode = settings.mode;
		const data = selectedData;
		const vc = settings.vc;
		if (mode !== 'ppt' || !data || data.length === 0 || windowSize.width === 0) {
			slides = [];
			return;
		}
		const screenArea = windowSize.width * windowSize.height;
		const maxLength = Math.floor(Math.max(400, Math.min(screenArea * 0.0009, 1000)));
		const newSlides = [];
		for (const verse of data) {
			if (vc.showDevanagari && verse.text_devanagari) newSlides.push({ id: `${verse.id}-devanagari`, verse, type: 'devanagari', content: verse.text_devanagari });
			if (vc.showRoman && verse.text_roman) newSlides.push({ id: `${verse.id}-roman`, verse, type: 'roman', content: verse.text_roman });
			if (vc.showSynonyms && verse.eng_synonyms) newSlides.push({ id: `${verse.id}-synonyms`, verse, type: 'synonyms', content: verse.eng_synonyms });
			if (vc.showTranslation && verse.eng_translation) {
				chunkText(verse.eng_translation, maxLength).forEach((chunk, index) => newSlides.push({ id: `${verse.id}-translation-${index}`, verse, type: 'translation', content: chunk }));
			}
			if (vc.showPurport && verse.purport) {
				(verse.purport ?? '').split('\n').filter((p) => p.trim() !== '').forEach((p, pIndex) => {
					chunkText(p, maxLength).forEach((chunk, cIndex) => newSlides.push({ id: `${verse.id}-purport-${pIndex}-${cIndex}`, verse, type: 'purport', content: chunk }));
				});
			}
		}
		slides = newSlides;
		currentSlideIndex = 0;
	});

	$effect(async () => {
		stopReading();
		if (!tocURL) { isLoading = false; selectedData = []; return; }
		isLoading = true; errorMessage = ''; selectedData = [];
		try {
			let dataToProcess;
			const localContent = await db.content.get(tocURL);
			if (localContent && !isCollection) {
				dataToProcess = [localContent];
			} else {
				const onlineData = await fetchOnlineBookContent(settings.code, tocURL, isCollection);
				if (!Array.isArray(onlineData)) throw new Error('Fetched data is not an array.');
				if (isCollection) onlineData.sort((a, b) => parseInt(a.id.replace(/\D/g, '')) - parseInt(b.id.replace(/\D/g, '')));
				dataToProcess = onlineData;
				if (onlineData.length > 0) await db.content.bulkPut(onlineData);
			}
			selectedData = dataToProcess;
			currentTitle = dataToProcess[0]?.verse_url || tocURL;
			highlights = await db.highlights.where('toc_url', tocURL);
			await checkBookmarkStatus();
			const existingNote = await db.notes.get(tocURL);
			noteText = existingNote?.text ?? '';
		} catch (error) {
			console.error('CRITICAL ERROR during data load:', error);
			errorMessage = `Failed to load content. Error: ${error.message}`;
		} finally {
			isLoading = false;
		}
	});

	async function saveNote() {
		if (!tocURL) return;
		try {
			const noteData = { toc_url: tocURL, text: noteText, title: currentTitle || tocURL };
			await db.notes.put(noteData);
			await syncNoteToSupabase(tocURL, noteText);
		} catch (error) {
			console.error('Failed to save note:', error);
		} finally {
			showNotePopup = false;
		}
	}
	async function checkBookmarkStatus() {
		if (!tocURL) return;
		const bookmark = await db.bookmarks.get(tocURL);
		isBookmarked = !!bookmark;
	}
	async function toggleBookmark(event) {
		event.stopPropagation();
		if (!tocURL) return;
		try {
			const title = currentTitle || 'Bookmark';
			if (isBookmarked) {
				await db.bookmarks.delete(tocURL);
			} else {
				await db.bookmarks.put({ url: tocURL, title });
			}
			isBookmarked = !isBookmarked;
		} catch (e) {
			console.error('Failed to update bookmark:', e);
		}
	}

	const currentSlide = $derived(slides[currentSlideIndex]);
	const progress = $derived(slides.length > 0 ? ((currentSlideIndex + 1) / slides.length) * 100 : 0);

	function goToNextSlide() {
		if (currentSlideIndex < slides.length - 1) currentSlideIndex++; else dispatch('presentationEnded');
	}
	function goToPrevSlide() {
		if (currentSlideIndex > 0) currentSlideIndex--;
	}
	function handleKeydown(e) {
		if (settings.mode !== 'ppt') return;
		if (e.key === 'Escape') showPptSettings = false;
		if (slides.length > 0 && (e.key === 'ArrowRight' || e.key === ' ')) { e.preventDefault(); goToNextSlide(); }
		else if (slides.length > 0 && e.key === 'ArrowLeft') { e.preventDefault(); goToPrevSlide(); }
	}

	onMount(() => {
		const handleResize = () => { windowSize = { width: window.innerWidth, height: window.innerHeight }; };
		handleResize();
		window.addEventListener('resize', handleResize);
		window.addEventListener('keydown', handleKeydown);
		return () => { window.removeEventListener('resize', handleResize); window.removeEventListener('keydown', handleKeydown); };
	});

	onDestroy(() => {
		stopReading();
	});
</script>

<div
	class="verse-container"
	class:presentation-view={settings.mode === 'ppt'}
	style="--font-size: {settings.fontSize}px;"
	onclick={handleContentClick}
>
	{#if isLoading}
		<div class="status-message">Loading Content...</div>
	{:else if errorMessage}
		<div class="status-message error">{errorMessage}</div>
	{:else if settings.mode === 'ppt'}
		<div class="ppt-container">
			{#if slides.length > 0 && currentSlide}
				<div class="progress-bar-container">
					<div class="progress-bar" style="--progress-width: {progress}%"></div>
				</div>
				<header class="ppt-header">
					<div class="header-item verse-url-wrapper">
						<span class="verse-url">TEXT {currentSlide.verse.verse_url || 'N/A'}</span>
					</div>
					<div class="header-item ppt-header-actions">
						<button class="icon-btn" title="Display Settings" onclick={(e) => { e.stopPropagation(); showPptSettings = !showPptSettings; }}>
							<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" > <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.44,0.17-0.48,0.41L9.22,5.25C8.63,5.49,8.1,5.81,7.6,6.19L5.21,5.23C4.99,5.16,4.74,5.22,4.62,5.44L2.7,8.76 c-0.12,0.2-0.07,0.47,0.12,0.61L4.85,11c-0.05,0.3-0.07,0.62-0.07,0.94c0,0.33,0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.38,2.44 c0.04,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0-0.44,0.17-0.48-0.41l0.38-2.44c0.59-0.24,1.12-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.2,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"></path> </svg>
						</button>
						<button class="icon-btn" title="Bookmark" onclick={toggleBookmark}>
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" class:bookmarked={isBookmarked}> <path d="M5 21V3h14v18l-7-3-7 3z" /> </svg>
						</button>
					</div>
				</header>

				{#if showPptSettings}
					<div class="ppt-settings-panel" onclick={(e) => e.stopPropagation()} transition:fade>
						<h4>Presentation Content</h4>
						<label><input type="checkbox" checked={settings.vc.showDevanagari} onchange={() => handleVcToggle('showDevanagari')} /> Devanagari</label>
						<label><input type="checkbox" checked={settings.vc.showRoman} onchange={() => handleVcToggle('showRoman')} /> Roman Text</label>
						<label><input type="checkbox" checked={settings.vc.showSynonyms} onchange={() => handleVcToggle('showSynonyms')} /> Synonyms</label>
						<label><input type="checkbox" checked={settings.vc.showTranslation} onchange={() => handleVcToggle('showTranslation')} /> Translation</label>
						<label><input type="checkbox" checked={settings.vc.showPurport} onchange={() => handleVcToggle('showPurport')} /> Purport</label>
					</div>
				{/if}

				<div class="slide-content-wrapper">
					{#key currentSlide.id}
						<div class="slide-content" class:reading={readingSection === 'slide'}>
							{#if currentSlide.type === 'devanagari' || currentSlide.type === 'roman'}
								<section class="verse-text {currentSlide.type}-text">
									{@html applyHighlights(currentSlide.content)}
								</section>
							{:else}
								<section class="content-section">
									<h4>{currentSlide.type}</h4>
									<div class="longform-text">
										<p>{@html applyHighlights(currentSlide.content)}</p>
									</div>
								</section>
							{/if}
						</div>
					{/key}
				</div>

				<button class="nav-btn left" onclick={goToPrevSlide} disabled={currentSlideIndex === 0}>&#x2190;</button>
				<button class="nav-btn right" onclick={goToNextSlide}>
					{#if currentSlideIndex >= slides.length - 1}Finish{:else}&#x2192;{/if}
				</button>
				<footer class="ppt-footer">
					<span class="slide-counter">{currentSlideIndex + 1} / {slides.length}</span>
				</footer>
			{:else}
				<div class="status-message">
					<p style="font-size: 1.5em; margin-bottom: 0.5rem;">No Content to Display</p>
					<p class="status-subtitle">Click the settings icon <span class="settings-icon-inline">⚙️</span> to enable content.</p>
				</div>
			{/if}
		</div>
	{:else if selectedData.length > 0}
		<div class="scrollable-content">
			{#each selectedData as el (el.id)}
				<div class="verse-content">
					<header class="verse-header">
						<div class="verse-url-wrapper">
							<span class="verse-url">TEXT {el.verse_url || 'N/A'}</span>
						</div>
						<div class="header-actions">
							<button class="icon-btn" title="Bookmark" onclick={toggleBookmark}>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" class:bookmarked={isBookmarked}><path d="M5 21V3h14v18l-7-3-7 3z" /></svg>
							</button>
						</div>
					</header>

					{#if settings.vc.showDevanagari && el.text_devanagari}
						<section class="verse-text devanagari-text">
							{@html applyHighlights(el.text_devanagari)}
						</section>
					{/if}
					{#if settings.vc.showRoman && el.text_roman}
						<section class="verse-text roman-text">
							{@html applyHighlights(el.text_roman)}
						</section>
					{/if}
					
					{#if settings.vc.showSynonyms && el.eng_synonyms}
						<section class="content-section" class:reading={readingSection === 'synonyms'}>
							<div class="section-header">
								<h4>Synonyms</h4>
								<button class="icon-btn read-aloud-btn" title="Read Synonyms" onclick={(e) => { e.stopPropagation(); readSection('synonyms', el.eng_synonyms); }}>
									{#if readingSection === 'synonyms'}
										<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"></path></svg>
									{:else}
										<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"></path></svg>
									{/if}
								</button>
							</div>
							<p>{@html applyHighlights(el.eng_synonyms)}</p>
						</section>
					{/if}

					{#if settings.vc.showTranslation && el.eng_translation}
						<section class="content-section" class:reading={readingSection === 'translation'}>
							<div class="section-header">
								<h4>Translation</h4>
								<button class="icon-btn read-aloud-btn" title="Read Translation" onclick={(e) => { e.stopPropagation(); readSection('translation', el.eng_translation); }}>
									{#if readingSection === 'translation'}
										<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"></path></svg>
									{:else}
										<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"></path></svg>
									{/if}
								</button>
							</div>
							<p>{@html applyHighlights(el.eng_translation)}</p>
						</section>
					{/if}

					{#if settings.vc.showPurport && el.purport}
						<section class="content-section" class:reading={readingSection === 'purport'}>
							<div class="section-header">
								<h4>Purport</h4>
								<button class="icon-btn read-aloud-btn" title="Read Purport" onclick={(e) => { e.stopPropagation(); readSection('purport', el.purport); }}>
									{#if readingSection === 'purport'}
										<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"></path></svg>
									{:else}
										<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"></path></svg>
									{/if}
								</button>
							</div>
							<div class="purport-text">
								{@html applyHighlights(el.purport.replaceAll('\n', '<br>'))}
							</div>
						</section>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if readingSection}
	<div class="tts-controls" transition:fly={{ y: 20, duration: 300 }}>
		<button class="icon-btn" title={isPaused ? 'Resume' : 'Pause'} onclick={togglePauseResume}>
			{#if isPaused}
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>
			{/if}
		</button>
		<button class="icon-btn" title="Stop Reading" onclick={stopReading}>
			<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"></path></svg>
		</button>
	</div>
{/if}

{#if showKrishnaPopup}
	<div class="krishna-popup" style="left: {popupCoords.x}px; top: {popupCoords.y}px;" transition:fly={{ y: -10, duration: 300 }}>
		<img src="/krishna.png" alt="Highlight Action" class="krishna-image" />
		<div class="action-bubble">
			{#if currentSelection}
                <button onmousedown={createHighlight}>✨ Highlight</button>
            {:else if highlightToDelete}
                <button onmousedown={deleteHighlight}>🗑️ Delete</button>
            {/if}
		</div>
	</div>
{/if}

{#if showNotePopup && tocURL}
	<div class="note-popup-overlay" onclick={() => (showNotePopup = false)}>
		<div class="note-popup" onclick={(event) => event.stopPropagation()}>
			<h3>Note for {currentTitle}</h3>
			<textarea bind:value={noteText} placeholder="Your personal notes for this page..."></textarea>
			<div class="popup-actions">
				<button class="popup-btn cancel" onclick={() => (showNotePopup = false)}>Cancel</button>
				<button class="popup-btn save" onclick={saveNote}>Save Note</button>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(mark.highlighted-text) {
		background-color: #f7e772;
		color: #333;
		cursor: pointer;
	}
	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.section-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		border-bottom: 1px solid var(--border-color);
		padding-bottom: 0.5rem;
		margin-bottom: 1rem;
	}
	.section-header h4 {
		margin: 0;
		border-bottom: none;
		padding-bottom: 0;
	}
	.read-aloud-btn {
		font-size: 1.2rem;
		padding: 0;
		color: var(--text-secondary-color);
	}
	.read-aloud-btn:hover {
		color: var(--primary-color);
	}
	.content-section.reading {
		background-color: color-mix(in srgb, var(--primary-color) 10%, transparent);
		transition: background-color 0.3s;
		border-radius: 8px;
		padding-left: 1rem;
		padding-right: 1rem;
		margin-left: -1rem;
		margin-right: -1rem;
	}
	.tts-controls {
		position: fixed;
		bottom: calc(var(--bar-height, 55px) + 1rem);
		left: 50%;
		transform: translateX(-50%);
		background-color: var(--popup-bg, white);
		border: 1px solid var(--border-color);
		border-radius: 99px;
		box-shadow: 0 4px 12px rgba(0,0,0,0.2);
		display: flex;
		gap: 0.5rem;
		padding: 0.5rem;
		z-index: 1001;
	}
	.tts-controls .icon-btn {
		color: var(--text-color);
		background-color: var(--pane-bg-color);
		border-radius: 50%;
		width: 40px;
		height: 40px;
		display: grid;
		place-items: center;
	}
	.verse-url-wrapper {
		background: var(--pane-bg-color);
		padding: 0.25rem 1rem;
		border-radius: 99px;
		box-shadow: 0 2px 10px rgba(0,0,0,0.1);
	}
	
	@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Lora:ital,wght@0,400;1,400&display=swap');
	.verse-container {
		--sans-font: 'Inter', sans-serif;
		--serif-font: 'Lora', serif;
	}
	.presentation-view {
		overflow: hidden;
	}
	.ppt-container {
		width: 100%;
		height: 100%;
		display: grid;
		grid-template-rows: auto 1fr auto;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		justify-items: center;
		background-color: var(--bg-color);
		color: var(--text-color);
		position: relative;
	}
	:global(body.theme-dark) .ppt-container {
		background-image: radial-gradient(circle at center, #2d3748, #1a202c 120%);
	}
	.progress-bar-container {
		grid-column: 1 / -1;
		grid-row: 1 / 2;
		align-self: start;
		width: 100%;
		height: 4px;
		background-color: rgba(var(--text-color-rgb), 0.1);
	}
	.progress-bar {
		width: var(--progress-width, 0%);
		height: 100%;
		background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
		transition: width 0.3s ease;
	}
	.ppt-header {
		grid-column: 1 / -1;
		grid-row: 1 / 2;
		align-self: start;
		width: 100%;
		padding: 1rem clamp(1rem, 4vw, 2rem);
		display: flex;
		justify-content: space-between;
		align-items: center;
		z-index: 10;
		box-sizing: border-box;
	}
	.ppt-header-actions {
		gap: 0.5rem;
		display: flex;
		align-items: center;
		padding: 0.25rem 0.5rem;
	}
	.ppt-footer {
		grid-column: 1 / -1;
		grid-row: 3 / 4;
		align-self: end;
		z-index: 10;
		padding-bottom: 1rem;
	}
	.ppt-settings-panel {
		position: absolute;
		top: 70px;
		right: clamp(1rem, 4vw, 2rem);
		background: var(--popup-bg);
		color: var(--popup-text);
		border-radius: 8px;
		padding: 1rem;
		box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
		border: 1px solid var(--border-color);
		z-index: 100;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.ppt-settings-panel h4 {
		margin: 0 0 0.5rem 0;
		font-size: 1rem;
		font-family: var(--sans-font);
		border-bottom: 1px solid var(--border-color);
		padding-bottom: 0.5rem;
	}
	.ppt-settings-panel label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-family: var(--sans-font);
		font-size: 0.9rem;
	}
	.slide-content-wrapper {
		grid-column: 2 / 3;
		grid-row: 2 / 3;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		padding: 1rem;
		box-sizing: border-box;
	}
	.slide-content {
		width: 100%;
		max-height: 100%;
		overflow: hidden;
	}
	.presentation-view .verse-text {
		font-size: calc(var(--font-size) * 2.2);
		line-height: 1.6;
		text-align: center;
		margin-bottom: 0;
		font-family: var(--serif-font);
	}
	.presentation-view .devanagari-text {
		line-height: 1.7;
	}
	.presentation-view .roman-text {
		font-style: italic;
		color: var(--text-secondary-color);
	}
	.presentation-view .content-section {
		padding: 0 clamp(1rem, 4vw, 3rem);
	}
	.presentation-view .content-section h4 {
		text-align: center;
		font-size: clamp(0.9rem, 2vw, 1.1rem);
		font-weight: 400;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		color: var(--text-secondary-color);
		margin-bottom: 2rem;
		font-family: var(--sans-font);
	}
	.presentation-view .longform-text {
		font-family: var(--serif-font);
		font-size: var(--font-size);
		line-height: 1.75;
		text-align: justify;
		text-justify: inter-word;
	}
	.longform-text p::first-letter {
		font-size: 3em;
		float: left;
		line-height: 1;
		margin-right: 0.1em;
		color: var(--primary-color);
	}
	.nav-btn {
		position: static;
		grid-row: 2 / 3;
		background: transparent;
		color: var(--text-color);
		border: none;
		border-radius: 50%;
		width: 50px;
		height: 50px;
		font-size: 2rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
		z-index: 20;
		opacity: 0.4;
	}
	.nav-btn:disabled {
		opacity: 0.1;
		cursor: not-allowed;
	}
	.nav-btn:not(:disabled):hover {
		opacity: 1;
		background: rgba(var(--text-color-rgb), 0.05);
	}
	.nav-btn.left {
		grid-column: 1 / 2;
		justify-self: start;
		margin-left: clamp(0.5rem, 2vw, 1.5rem);
	}
	.nav-btn.right {
		grid-column: 3 / 4;
		justify-self: end;
		margin-right: clamp(0.5rem, 2vw, 1.5rem);
	}
	.slide-counter {
		font-family: var(--sans-font);
		font-size: 0.9rem;
		font-weight: 500;
		background: var(--pane-bg-color);
		padding: 0.25rem 0.75rem;
		border-radius: 99px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
		color: var(--text-secondary-color);
	}
	.scrollable-content {
		padding: 2rem 3rem;
		overflow-y: auto;
		flex-grow: 1;
	}
	@media (max-width: 768px) {
		.scrollable-content {
			padding: 1.5rem;
		}
	}
	.verse-content {
		max-width: 800px;
		margin: 0 auto;
	}
	.scrollable-content .verse-content {
		margin-bottom: 3rem;
	}
	.verse-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		border-bottom: 1px solid var(--border-color);
		padding-bottom: 1rem;
	}
	.verse-url {
		font-weight: bold;
		color: var(--text-secondary-color);
		font-family: var(--sans-font);
	}
	.icon-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.25rem;
		font-size: 1.5rem;
		color: var(--text-secondary-color);
		transition: color 0.2s, transform 0.2s;
	}
	.icon-btn:hover {
		color: var(--primary-color);
		transform: scale(1.1);
	}
	.icon-btn svg {
		display: block;
		fill: currentColor;
	}
	.icon-btn svg.bookmarked {
		color: var(--primary-color);
	}
	.verse-text {
		text-align: center;
		margin-bottom: 2rem;
		font-size: calc(var(--font-size) * 1.2);
	}
	.content-section {
		margin-bottom: 2rem;
	}
	.content-section h4 {
		font-family: var(--sans-font);
		font-size: 1rem;
		font-weight: 600;
		color: var(--primary-color);
	}
	.content-section p,
	.purport-text {
		text-align: justify;
		hyphens: auto;
		font-size: var(--font-size);
		line-height: 1.7;
	}
	.status-message {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		height: 100%;
		font-size: 1.2rem;
		color: var(--text-secondary-color);
		font-family: var(--sans-font);
		padding: 2rem;
		text-align: center;
	}
	.krishna-popup {
		position: fixed;
		transform: translate(-50%, -100%);
		z-index: 3000;
		display: flex;
		flex-direction: column;
		align-items: center;
		filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.25));
		padding-bottom: 12px;
		pointer-events: none;
	}
	.krishna-popup > * {
		pointer-events: all;
	}
	.krishna-image {
		width: 85px;
		height: auto;
		margin-bottom: -12px;
		pointer-events: none;
		user-select: none;
		filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.15));
	}
	.action-bubble {
		background: var(--popup-bg);
		border-radius: 8px;
		padding: 0.5rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
		position: relative;
	}
	.action-bubble::before {
		content: '';
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		width: 0;
		height: 0;
		border-left: 8px solid transparent;
		border-right: 8px solid transparent;
		border-bottom: 8px solid var(--popup-bg);
	}
	.action-bubble button {
		background-color: var(--primary-color);
		color: white;
		border: none;
		border-radius: 6px;
		padding: 0.5rem 1rem;
		font-weight: 500;
		font-size: 0.9rem;
		cursor: pointer;
		transition: background-color 0.2s, transform 0.2s;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.action-bubble button:hover {
		background-color: var(--secondary-color);
		transform: scale(1.05);
	}
	.note-popup-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 2000;
		backdrop-filter: blur(4px);
	}
	.note-popup {
		background: var(--popup-bg);
		color: var(--popup-text);
		padding: 1.5rem;
		border-radius: 12px;
		width: 90%;
		max-width: 600px;
		height: 60vh;
		box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.note-popup h3 {
		margin: 0;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--border-color);
		text-align: center;
		font-family: var(--sans-font);
		color: var(--primary-color);
		flex-shrink: 0;
	}
	.note-popup textarea {
		width: 100%;
		flex-grow: 1;
		min-height: 150px;
		padding: 1rem;
		font-size: 1rem;
		font-family: var(--sans-font);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		resize: none;
		background: var(--bg-color);
		color: var(--popup-text);
		line-height: 1.6;
		box-sizing: border-box;
	}
	.popup-actions {
		margin-top: auto;
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
		flex-shrink: 0;
	}
	.popup-btn {
		border: none;
		padding: 0.7rem 1.2rem;
		border-radius: 8px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}
	.popup-btn.cancel {
		background-color: transparent;
		border: 1px solid var(--border-color);
		color: var(--text-color);
	}
	.popup-btn.cancel:hover {
		background-color: var(--toggle-hover-bg);
	}
	.popup-btn.save {
		background-color: var(--primary-color);
		color: white;
	}
	.popup-btn.save:hover {
		opacity: 0.85;
	}
</style>