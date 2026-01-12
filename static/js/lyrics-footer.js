/**
 * Lyrics Footer System
 * Handles cycling lyrics display in the footer
 */

(() => {
    let lyricsData = [];
    let currentIndex = 0;
    let autoChangeTimer = null;
    const AUTO_CHANGE_INTERVAL = 45000; // 45 seconds

    /**
     * Fisher-Yates shuffle algorithm
     */
    function shuffleArray(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    /**
     * Fetch lyrics from the static JSON file
     */
    async function fetchLyrics() {
        try {
            const response = await fetch('/static/data/lyrics.json');
            if (!response.ok) throw new Error('Failed to fetch lyrics');
            const data = await response.json();
            lyricsData = shuffleArray(data);
            displayCurrentLyric();
            startAutoChange();
        } catch (error) {
            console.error('Error loading lyrics:', error);
            displayFallback();
        }
    }

    /**
     * Display the current lyric
     */
    function displayCurrentLyric() {
        const lyricsEl = document.getElementById('footer-lyrics');
        const songInfoEl = document.getElementById('footer-song-info');

        if (!lyricsEl || !songInfoEl || !lyricsData.length) return;

        const lyric = lyricsData[currentIndex];

        // Fade out
        lyricsEl.style.opacity = '0';
        songInfoEl.style.opacity = '0';
        lyricsEl.style.transform = 'translateY(10px)';

        setTimeout(() => {
            // Update content
            lyricsEl.innerHTML = lyric.lyrics.replace(/\n/g, '<br>');
            songInfoEl.textContent = `${lyric.song} — ${lyric.artist}`;

            // Fade in
            lyricsEl.style.opacity = '1';
            songInfoEl.style.opacity = '1';
            lyricsEl.style.transform = 'translateY(0)';
        }, 300);
    }

    /**
     * Display fallback message on error
     */
    function displayFallback() {
        const lyricsEl = document.getElementById('footer-lyrics');
        const songInfoEl = document.getElementById('footer-song-info');

        if (lyricsEl) lyricsEl.textContent = 'Music speaks what cannot be expressed.';
        if (songInfoEl) songInfoEl.textContent = '';
    }

    /**
     * Change to next lyric
     */
    function nextLyric() {
        if (!lyricsData.length) return;
        currentIndex = (currentIndex + 1) % lyricsData.length;
        displayCurrentLyric();
        resetAutoChange();
    }

    /**
     * Start auto-change timer
     */
    function startAutoChange() {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        autoChangeTimer = setInterval(() => {
            nextLyric();
        }, AUTO_CHANGE_INTERVAL);
    }

    /**
     * Reset auto-change timer (after manual change)
     */
    function resetAutoChange() {
        if (autoChangeTimer) {
            clearInterval(autoChangeTimer);
        }
        startAutoChange();
    }

    // Expose the change function globally
    window.changeFooterLyric = nextLyric;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fetchLyrics);
    } else {
        fetchLyrics();
    }
})();
