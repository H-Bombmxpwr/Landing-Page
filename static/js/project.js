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
  const blk = document.getElementById('lyrics-block');
  const info = document.getElementById('song-info');
  
  // Smooth fade out
  if(blk) {
    blk.style.opacity = '0';
    blk.style.transform = 'translateY(10px)';
  }
  if(info) {
    info.style.opacity = '0';
  }
  
  const html = entry.lyrics.replace(/\n/g,'<br>');
  
  setTimeout(()=>{
    if(blk){ 
      blk.innerHTML = html; 
      blk.style.opacity = '1';
      blk.style.transform = 'translateY(0)';
    }
    if(info){ 
      info.textContent = `${entry.song} by ${entry.artist}`;
      info.style.opacity = '1';
    }
  }, 250);
  
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
  
  // Fade out current
  panels.forEach(p => {
    if(p.style.display === 'block') {
      p.style.opacity = '0';
      p.style.transform = 'translateY(10px)';
    }
  });
  
  setTimeout(() => {
    panels.forEach(p => p.style.display='none');
    tabs.forEach(t => t.classList.remove('tab-active'));
    
    const active = document.querySelector(`#projects .tab[onclick="showProject('${projectId}')"]`);
    const panel = document.getElementById(projectId);
    
    if(panel) {
      panel.style.display = 'block';
      panel.style.opacity = '0';
      panel.style.transform = 'translateY(10px)';
      
      // Trigger reflow and animate in
      requestAnimationFrame(() => {
        panel.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        panel.style.opacity = '1';
        panel.style.transform = 'translateY(0)';
      });
    }
    
    active?.classList.add('tab-active');
    tabs.forEach(t => { t.setAttribute('aria-selected', t.classList.contains('tab-active')); });
  }, 150);
}

function showSchoolProject(projectId){
  const tabs = document.querySelectorAll('#school-projects .tab');
  const panels = document.querySelectorAll('#school-projects .school-project-content');
  
  // Fade out current
  panels.forEach(p => {
    if(p.style.display === 'block') {
      p.style.opacity = '0';
      p.style.transform = 'translateY(10px)';
    }
  });
  
  setTimeout(() => {
    panels.forEach(p => p.style.display='none');
    tabs.forEach(t => t.classList.remove('tab-active'));
    
    const active = document.querySelector(`#school-projects .tab[onclick="showSchoolProject('${projectId}')"]`);
    const panel = document.getElementById(projectId);
    
    if(panel) {
      panel.style.display = 'block';
      panel.style.opacity = '0';
      panel.style.transform = 'translateY(10px)';
      
      requestAnimationFrame(() => {
        panel.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        panel.style.opacity = '1';
        panel.style.transform = 'translateY(0)';
      });
    }
    
    active?.classList.add('tab-active');
    tabs.forEach(t => { t.setAttribute('aria-selected', t.classList.contains('tab-active')); });
  }, 150);
}

// === Quotes ===
async function fetchQuote(){
  try{
    const res = await fetch('/api/quote');
    if(!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    if(data.quote && data.author){
      const el = document.getElementById('funnyQuote');
      if(el) {
        el.style.opacity = '0';
        setTimeout(() => {
          el.innerHTML = `"${data.quote}" — ${data.author}`;
          el.style.transition = 'opacity 0.5s ease';
          el.style.opacity = '1';
        }, 200);
      }
    }
  }catch(err){
    console.error('Quote error:', err);
    const el = document.getElementById('funnyQuote');
    if(el) el.textContent = "Couldn't load a quote.";
  }
}

// === Scroll-triggered animations ===
function initScrollAnimations() {
  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -50px 0px',
    threshold: 0.1
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
        // Optionally unobserve after animating
        // observer.unobserve(entry.target);
      }
    });
  }, observerOptions);
  
  // Observe elements with animation class
  document.querySelectorAll('.animate-on-scroll').forEach(el => {
    observer.observe(el);
  });
  
  // Add animation classes to sections
  document.querySelectorAll('section').forEach((section, index) => {
    section.style.animationDelay = `${index * 0.1}s`;
  });
}

// === Smooth section transitions ===
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      const target = document.querySelector(targetId);
      
      if (target) {
        // Add a subtle highlight effect
        target.style.transition = 'box-shadow 0.3s ease';
        
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
        
        // Brief highlight
        setTimeout(() => {
          target.style.boxShadow = '0 0 0 2px var(--primary), 0 0 30px var(--ring)';
          setTimeout(() => {
            target.style.boxShadow = 'none';
          }, 800);
        }, 500);
      }
    });
  });
}

// === Button ripple effect ===
function initRippleEffects() {
  const buttons = document.querySelectorAll('.visit-button, .tab, button');
  
  buttons.forEach(button => {
    button.addEventListener('click', function(e) {
      // Remove any existing ripple
      const existingRipple = this.querySelector('.ripple');
      if (existingRipple) existingRipple.remove();
      
      // Create ripple
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      
      ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        background: rgba(255,255,255,0.3);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple-effect 0.6s ease-out;
        pointer-events: none;
      `;
      
      this.style.position = 'relative';
      this.style.overflow = 'hidden';
      this.appendChild(ripple);
      
      setTimeout(() => ripple.remove(), 600);
    });
  });
  
  // Add ripple keyframes if not exists
  if (!document.getElementById('ripple-styles')) {
    const style = document.createElement('style');
    style.id = 'ripple-styles';
    style.textContent = `
      @keyframes ripple-effect {
        to {
          transform: scale(4);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

// === Parallax on scroll (subtle) ===
function initParallax() {
  const parallaxElements = document.querySelectorAll('.about-image');
  
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return; // Skip for reduced motion preference
  }
  
  let ticking = false;
  
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        
        parallaxElements.forEach(el => {
          const rect = el.getBoundingClientRect();
          const centerY = rect.top + rect.height / 2;
          const viewportCenter = window.innerHeight / 2;
          const distance = (centerY - viewportCenter) / 20;
          
          el.style.transform = `translateY(${distance * 0.3}px)`;
        });
        
        ticking = false;
      });
      ticking = true;
    }
  });
}

// === Magnetic effect on social icons ===
function initMagneticEffect() {
  const icons = document.querySelectorAll('.icon-link');
  
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }
  
  icons.forEach(icon => {
    icon.addEventListener('mousemove', (e) => {
      const rect = icon.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      icon.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px) scale(1.1)`;
    });
    
    icon.addEventListener('mouseleave', () => {
      icon.style.transform = 'translate(0, 0) scale(1)';
    });
  });
}

// === Typing effect for lyrics (optional enhancement) ===
function typeWriter(element, text, speed = 30) {
  let i = 0;
  element.innerHTML = '';
  
  function type() {
    if (i < text.length) {
      if (text.substring(i, i + 4) === '<br>') {
        element.innerHTML += '<br>';
        i += 4;
      } else {
        element.innerHTML += text.charAt(i);
        i++;
      }
      setTimeout(type, speed);
    }
  }
  
  type();
}

// === Init on load ===
document.addEventListener('DOMContentLoaded', ()=>{
  // Add transition styles to lyrics elements
  const lyricsBlock = document.getElementById('lyrics-block');
  const songInfo = document.getElementById('song-info');
  
  if (lyricsBlock) {
    lyricsBlock.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  }
  if (songInfo) {
    songInfo.style.transition = 'opacity 0.3s ease';
  }
  
  // Init lyrics & quote
  if(document.getElementById('lyrics-block')) fetchLyrics();
  fetchQuote();

  // Default active tabs
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

  // Initialize enhancements
  initScrollAnimations();
  initSmoothScroll();
  initRippleEffects();
  initMagneticEffect();
  // initParallax(); // Uncomment for subtle parallax

  // Focus management
  document.body.addEventListener('mousedown', ()=> document.body.classList.add('using-mouse'));
  document.body.addEventListener('keydown', (e)=>{
    if(e.key === 'Tab') document.body.classList.remove('using-mouse');
  });
  
  // Add loaded class for any CSS hooks
  document.body.classList.add('page-loaded');
});

// === Page visibility handling ===
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // Refresh quote when user returns
    // fetchQuote();
  }
});