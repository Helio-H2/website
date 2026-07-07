/* -- Clock ------------------------------------ */
function tick() {
    const n = new Date();
    document.getElementById('t-time').textContent = n.toTimeString().slice(0, 8);
    document.getElementById('t-date').textContent = n.toLocaleDateString('it-IT');
}
tick(); setInterval(tick, 1000);

/* -- Boot sequence ---------------------------- */
const lines = ['b1', 'b2', 'b3', 'b4', 'b5'];
let step = 0;
function boot() {
    if (step >= 4) return;
    document.getElementById(lines[step]).classList.add('show');
    step++;
    if (step === 4) {
        const pb = document.getElementById('pbar');
        pb.style.display = 'block';
        setTimeout(() => { document.getElementById('pfill').style.width = '100%'; }, 80);
        setTimeout(() => {
            document.getElementById('b5').classList.add('show');
            setTimeout(showQI, 900);
        }, 1800);
        return;
    }
    setTimeout(boot, 380 + Math.random() * 200);
}
setTimeout(boot, 700);

/* -- Query interface --------------------------- */
function showQI() {
    const bootEl = document.getElementById('boot');
    bootEl.style.transition = 'opacity .4s';
    bootEl.style.opacity = '0';
    setTimeout(() => {
        bootEl.style.display = 'none';
        const qi = document.getElementById('qi');
        qi.style.display = 'block';
        typeText('BENVENUTO, COSA STAI CERCANDO?', () => {
            document.getElementById('qcur').style.display = 'none';
            document.getElementById('opts').classList.add('show');
        });
    }, 420);
}

function typeText(txt, cb) {
    const el = document.getElementById('qt'); let i = 0;
    (function t() {
        if (i < txt.length) { el.textContent = txt.slice(0, ++i); setTimeout(t, 48 + Math.random() * 28); }
        else setTimeout(cb, 280);
    })();
}

/* -- Option selection ------------------------- */
function pick(id) {
    const qi = document.getElementById('qi');
    qi.style.transition = 'opacity .25s'; qi.style.opacity = '0';
    setTimeout(() => {
        qi.style.display = 'none';
        const ra = document.getElementById('ra');
        document.querySelectorAll('.rsec').forEach(s => s.classList.remove('on'));
        document.getElementById('rs-' + id).classList.add('on');
        ra.classList.remove('anim');
        ra.style.display = 'block';
        void ra.offsetWidth; /* reflow to restart animation */
        ra.classList.add('anim');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 260);
}

/* -- Back ------------------------------------- */
function back() {
    const ra = document.getElementById('ra');
    ra.style.transition = 'opacity .25s'; ra.style.opacity = '0';
    setTimeout(() => {
        ra.style.display = 'none'; ra.style.opacity = '1'; ra.style.transition = '';
        const qi = document.getElementById('qi');
        qi.style.display = 'block'; qi.style.opacity = '0';
        qi.style.transition = 'opacity .3s';
        setTimeout(() => { qi.style.opacity = '1'; }, 40);
    }, 260);
}

/* -- Periodic brand glitch -------------------- */
setInterval(() => {
    const b = document.querySelector('.brand-name');
    b.classList.add('glitching');
    setTimeout(() => b.classList.remove('glitching'), 2900);
}, 9000);