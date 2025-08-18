// === Lyrics rotator ===
let lyricsData = [];
let currentIndex = 0;

async function fetchLyrics(){
  try{
    const res = await fetch('static/lyrics.json');
    const data = await res.json();
    lyricsData = shuffleArray(data);
    displayNextLyrics();
  }catch(err){
    console.error('Error fetching lyrics:', err);
  }
}

function displayNextLyrics(){
  if (!lyricsData.length) return;
  const entry = lyricsData[currentIndex];
  document.getElementById('lyrics-block')?.setAttribute('style','opacity:.2; transition:opacity .2s ease');
  const html = entry.lyrics.replace(/\n/g,'<br>');
  setTimeout(()=>{
    const blk = document.getElementById('lyrics-block');
    const info = document.getElementById('song-info');
    if(blk){ blk.innerHTML = html; blk.style.opacity = 1; }
    if(info){ info.textContent = `${entry.song} by ${entry.artist}`; }
  }, 160);
  currentIndex = (currentIndex + 1) % lyricsData.length;
}

function shuffleArray(a){
  for(let i=a.length-1; i>0; i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function handleButtonClick(e){
  e.preventDefault();
  displayNextLyrics();
  e.currentTarget.blur();
}

// === Project tabs (personal & school) ===
function showProject(projectId){
  const tabs = document.querySelectorAll('#projects .tab');
  const panels = document.querySelectorAll('#projects .project-content');
  panels.forEach(p => p.style.display='none');
  tabs.forEach(t => t.classList.remove('tab-active'));
  const active = document.querySelector(`#projects .tab[onclick="showProject('${projectId}')"]`);
  document.getElementById(projectId).style.display='block';
  active?.classList.add('tab-active');
  // A11y:
  tabs.forEach(t => { t.setAttribute('aria-selected', t.classList.contains('tab-active')); });
}

function showSchoolProject(projectId){
  const tabs = document.querySelectorAll('#school-projects .tab');
  const panels = document.querySelectorAll('#school-projects .school-project-content');
  panels.forEach(p => p.style.display='none');
  tabs.forEach(t => t.classList.remove('tab-active'));
  const active = document.querySelector(`#school-projects .tab[onclick="showSchoolProject('${projectId}')"]`);
  document.getElementById(projectId).style.display='block';
  active?.classList.add('tab-active');
  tabs.forEach(t => { t.setAttribute('aria-selected', t.classList.contains('tab-active')); });
}

// === Quotes ===
async function fetchQuote(){
  try{
    const res = await fetch('/api/quote');
    if(!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    if(data.quote && data.author){
      const el = document.getElementById('funnyQuote');
      if(el) el.innerHTML = `"${data.quote}" — ${data.author}`;
    }
  }catch(err){
    console.error('Quote error:', err);
    const el = document.getElementById('funnyQuote');
    if(el) el.textContent = "Couldn't load a quote.";
  }
}

// === Init on load ===
document.addEventListener('DOMContentLoaded', ()=>{
  // init lyrics & quote if those elements exist
  if(document.getElementById('lyrics-block')) fetchLyrics();
  fetchQuote();

  // default active tabs (if present)
  const firstProjTab = document.querySelector('#projects .tab');
  if(firstProjTab){
    const id = firstProjTab.getAttribute('onclick')?.split("'")[1];
    if(id) showProject(id);
  }
  const firstSchoolTab = document.querySelector('#school-projects .tab');
  if(firstSchoolTab){
    const id = firstSchoolTab.getAttribute('onclick')?.split("'")[1];
    if(id) showSchoolProject(id);
  }

  // Smooth focus ring management for mouse users
  document.body.addEventListener('mousedown', ()=> document.body.classList.add('using-mouse'));
  document.body.addEventListener('keydown', (e)=>{
    if(e.key === 'Tab') document.body.classList.remove('using-mouse');
  });
});
