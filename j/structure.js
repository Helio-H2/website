// Load header and footer dynamically from separate files
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load header
        const headerResponse = await fetch('s/header.html');
        const headerHTML = await headerResponse.text();
        const headerContainer = document.getElementById('header-container');
        if (headerContainer) {
            headerContainer.innerHTML = headerHTML;
            initializeHeader();
        }

        // Load footer
        const footerResponse = await fetch('s/footer.html');
        const footerHTML = await footerResponse.text();
        const footerContainer = document.getElementById('contatti');
        if (footerContainer) footerContainer.innerHTML = footerHTML;
        let year = document.getElementById('footer-year');
        if (year) {
            let anno = new Date().getFullYear();
            document.getElementById('footer-year').textContent = anno;
        }
    } catch (error) {
        console.error('Error loading components:', error);
    }
});

// faccio funzionare gli #anchor visto che ho il tag BASE
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', e => {
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
});

// Header scroll shadow
window.addEventListener('scroll', () => {
    const header = document.getElementById('header');
    if (header) header.classList.toggle('scrolled', window.scrollY > 10);
});

// Scroll reveal animation
document.addEventListener('DOMContentLoaded', () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
});

// Initialize header functionality
function initializeHeader() {
    const menuToggle = document.getElementById('menu-toggle');
    const mobileNav = document.getElementById('mobile-nav');

    if (menuToggle && mobileNav) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            mobileNav.classList.toggle('open');
        });

        // Close menu on link click
        mobileNav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mobileNav.classList.remove('open');
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#header') && mobileNav.classList.contains('open')) {
                mobileNav.classList.remove('open');
            }
        });
    }

    // Set active nav link based on current page
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (currentPath.includes(href) || (currentPath === './' && href === './')) {
            link.classList.add('active');
        }
    });
}

// Split Hero Interaction - Desktop only (>800px)
document.addEventListener('DOMContentLoaded', function () {
    const heroSplit = document.getElementById('heroSplit');
    const splitLeft = document.getElementById('splitLeft');
    const splitRight = document.getElementById('splitRight');
    const splitDivider = document.getElementById('splitDivider');
    const leftContent = document.getElementById('leftContent');
    const rightContent = document.getElementById('rightContent');
    const splitContent = document.getElementById('splitContent');

    if (!heroSplit) return;

    const isDesktop = window.innerWidth > 800;
    if (!isDesktop) return; // Skip everything on mobile

    const contentRevealThreshold = 0.275;
    const centerFadeStart = 0.05;
    const centerFadeEnd = 0.275;
    let splitPercentage = 50;

    function updateSplit(percentage) {
        splitPercentage = Math.max(0, Math.min(100, percentage));

        // Hide hint on first drag
        if (Math.abs(splitPercentage - 50) > 1) {
            const hint = document.querySelector('.hero-split-hint');
            if (hint) hint.style.display = 'none';
        }

        // Clip images on desktop
        splitLeft.style.clipPath = `inset(0 ${100 - splitPercentage}% 0 0)`;
        splitRight.style.clipPath = `inset(0 0 0 ${splitPercentage}%)`;

        // Position divider
        if (splitDivider) {
            splitDivider.style.left = splitPercentage + '%';
        }

        // Show/hide overlays based on reveal
        const revealThreshold = 0.3;
        if (splitPercentage > (100 - revealThreshold * 100)) {
            splitLeft.classList.add('revealed');
        } else {
            splitLeft.classList.remove('revealed');
        }

        if (splitPercentage < revealThreshold * 100) {
            splitRight.classList.add('revealed');
        } else {
            splitRight.classList.remove('revealed');
        }

        // Show/hide side content
        if (splitPercentage > (100 - contentRevealThreshold * 100)) {
            leftContent.classList.add('visible');
        } else {
            leftContent.classList.remove('visible');
        }

        if (splitPercentage < contentRevealThreshold * 100) {
            rightContent.classList.add('visible');
        } else {
            rightContent.classList.remove('visible');
        }

        // Fade center content
        let centerOpacity = 1;
        const maxDrag = Math.max(Math.abs(50 - splitPercentage), Math.abs(splitPercentage - 50));

        if (maxDrag > centerFadeStart * 100) {
          const fadeRange = (centerFadeEnd - centerFadeStart) * 100;
          const fadeProgress = Math.min(1, (maxDrag - centerFadeStart * 100) / fadeRange);
          centerOpacity = 1 - fadeProgress;
        }

        splitContent.style.opacity = centerOpacity;
        splitContent.style.pointerEvents = centerOpacity === 0 ? 'none' : 'auto';
    }

    // Drag interaction
    let isDragging = false;

    splitDivider.addEventListener('mousedown', () => {
        isDragging = true;
        document.body.style.cursor = 'ew-resize';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const rect = heroSplit.getBoundingClientRect();
        updateSplit((e.clientX - rect.left) / rect.width * 100);
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        document.body.style.cursor = 'auto';
    });

    splitDivider.addEventListener('touchstart', () => {
        isDragging = true;
    });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        const rect = heroSplit.getBoundingClientRect();
        updateSplit((touch.clientX - rect.left) / rect.width * 100);
    });

    document.addEventListener('touchend', () => {
        isDragging = false;
    });

    updateSplit(50);
});

// Parallax scroll effect (mobile only, <=800px)
document.addEventListener('DOMContentLoaded', function () {
    const splitLeft = document.getElementById('splitLeft');
    const splitRight = document.getElementById('splitRight');

    if (!splitLeft || !splitRight || window.innerWidth > 800) return; // Only on <=800px

    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        const parallaxShift = scrollY * 0.3; // Adjust speed (0.3 = 30% of scroll)

        // Background images shift while content stays fixed
        splitLeft.style.transform = `translateY(-${parallaxShift}px)`;
        splitRight.style.transform = `translateY(${parallaxShift}px)`;
    });
});

// ── LAZY-LOAD IMAGES & BACKGROUND IMAGES ────────────────────────────────
// Load images only when they enter the viewport
document.addEventListener('DOMContentLoaded', () => {
  // Lazy-load <img> tags with data-src attribute
  const lazyImages = document.querySelectorAll('img[data-src]');
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        observer.unobserve(img);
      }
    });
  }, { rootMargin: '50px' });

  lazyImages.forEach(img => imageObserver.observe(img));

  // Lazy-load background images with class 'lazy-bg'
  const lazyBgs = document.querySelectorAll('.lazy-bg[data-src]');
  const bgObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        el.style.backgroundImage = `url('${el.dataset.src}')`;
        el.classList.add('loaded');
        observer.unobserve(el);
      }
    });
  }, { rootMargin: '100px' });

  lazyBgs.forEach(el => bgObserver.observe(el));
});