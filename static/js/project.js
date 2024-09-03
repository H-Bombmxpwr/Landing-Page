let lyricsData = []; // Array to hold lyrics data
let currentIndex = 0; // Keep track of the current index in the shuffled list

// Fetch lyrics from the JSON file and shuffle them
async function fetchLyrics() {
    try {
        const response = await fetch('static/lyrics.json'); // Adjust the path based on where your file is located
        const data = await response.json();
        lyricsData = shuffleArray(data); // Shuffle lyrics data when it's first fetched
        displayNextLyrics(); // Display the first lyrics
    } catch (error) {
        console.error('Error fetching lyrics:', error);
    }
}

// Display the next set of lyrics
function displayNextLyrics() {
    if (lyricsData.length === 0) return; // If no data, do nothing

    const lyricsEntry = lyricsData[currentIndex]; // Get the current lyrics entry
    const randomLyrics = lyricsEntry.lyrics.replace(/\n/g, '<br>'); // Format lyrics with line breaks
    const songTitle = lyricsEntry.song;
    const artistName = lyricsEntry.artist;

    // Update the blockquote with the random lyrics
    document.getElementById('lyrics-block').innerHTML = randomLyrics;

    // Update the song info with the song title and artist
    document.getElementById('song-info').innerHTML = `${songTitle} by ${artistName}`;

    // Increment the index, and reset if it exceeds the length
    currentIndex = (currentIndex + 1) % lyricsData.length;
}

// Shuffle array using the Fisher-Yates algorithm
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Handle button click to change lyrics
function handleButtonClick(event) {
    event.preventDefault(); // Prevents the default action of the link
    displayNextLyrics(); // Call the function to change lyrics
    event.currentTarget.blur(); // Remove focus from the button after clicking
}

// Initial fetch on page load
window.onload = fetchLyrics;

// Shows a specific project, hides others, and updates the tab's style
function showProject(projectId) {
    // Retrieve all project tabs and project contents
    var tabs = document.querySelectorAll('#projects .tab');
    var projects = document.querySelectorAll('#projects .project-content');
    
    // Hide all projects and remove the active class from all tabs
    for (var i = 0; i < projects.length; i++) {
        projects[i].style.display = 'none';
        tabs[i].classList.remove('tab-active');
    }

    // Show the selected project and add active class to the selected tab
    var activeTab = document.querySelector(`#projects .tab[onclick="showProject('${projectId}')"]`);
    document.getElementById(projectId).style.display = 'block';
    activeTab.classList.add('tab-active');
}

// Shows a specific school project, hides others, and updates the tab's style
function showSchoolProject(projectId) {
    // Retrieve all school project tabs and project contents
    var schoolTabs = document.querySelectorAll('#school-projects .tab');
    var schoolProjects = document.querySelectorAll('#school-projects .school-project-content');
    
    // Hide all school projects and remove the active class from all school tabs
    for (var i = 0; i < schoolProjects.length; i++) {
        schoolProjects[i].style.display = 'none';
        schoolTabs[i].classList.remove('tab-active');
    }

    // Show the selected school project and add active class to the selected tab
    var activeSchoolTab = document.querySelector(`#school-projects .tab[onclick="showSchoolProject('${projectId}')"]`);
    document.getElementById(projectId).style.display = 'block';
    activeSchoolTab.classList.add('tab-active');
}

// Event listener for DOM content loaded to set the initial active tab
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the first tab of personal projects as active
    var firstProjectTab = document.querySelector('#projects .tab');
    var firstProjectId = firstProjectTab.getAttribute('onclick').split('\'')[1];
    showProject(firstProjectId);
    
    // Initialize the first tab of academic projects as active
    var firstSchoolProjectTab = document.querySelector('#school-projects .tab');
    var firstSchoolProjectId = firstSchoolProjectTab.getAttribute('onclick').split('\'')[1];
    showSchoolProject(firstSchoolProjectId);
});

// Fetch a random quote from the quotable API
fetch('https://api.quotable.io/random')
  .then(response => response.json())
  .then(data => {
    console.log(data.content + " - " + data.author); // Logs the quote and the author to the console
    document.getElementById('funnyQuote').innerHTML = `"${data.content}" - ${data.author}`;
  })
  .catch(error => console.error('Error fetching the quote:', error));
