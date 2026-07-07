(() => {
    const SUPPORTED = new Set(['html', 'htm', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'rtf', 'csv', 'odt', 'ods', 'odp', 'json', 'xml']);
    const EMOJI = { html: '🌐', htm: '🌐', pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', ppt: '📑', pptx: '📑', txt: '🗒️', md: '🗒️', csv: '📋', json: '🔧', xml: '🔧', rtf: '📋', odt: '📝', ods: '📊', odp: '📑' };
    const typeClass = ext => ['html', 'htm', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv'].includes(ext) ? ext : 'default';

    let allFiles = [], query = '', activeExt = 'all', sortMode = 'name';

    const $ = id => document.getElementById(id);
    function esc(v) { return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    function extOf(n) { const d = n.lastIndexOf('.'); return d > -1 ? n.slice(d + 1).toLowerCase() : ''; }
    function hl(text, q) {
        if (!q) return esc(text);
        const i = text.toLowerCase().indexOf(q.toLowerCase());
        if (i === -1) return esc(text);
        return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
    }

    async function init() {
        try {
            const res = await fetch('t/keynote/files.json', { cache: 'no-store' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            const filesObj = data.files || {};

            const seen = new Set();
            allFiles = Object.entries(filesObj)
                .filter(([label, href]) => {
                    if (!label || !href || seen.has(label)) return false;
                    seen.add(label);
                    return SUPPORTED.has(extOf(href));
                })
                .map(([label, href]) => ({
                    name: href,
                    label: label,
                    desc: null,
                    ext: extOf(href),
                    href: href
                }));

            buildChips();
            render();
        } catch (e) {
            $('notice').classList.add('show');
            $('output').innerHTML = `<div class="state-msg">
        <div class="big">📂</div>
        <h2>files.json not found</h2>
        <p>Place a <code>files.json</code> next to <code>index.html</code> and list your files inside it.</p>
      </div>`;
        }
    }

    function buildChips() {
        const exts = [...new Set(allFiles.map(f => f.ext))].sort();
        const wrap = $('chips');
        wrap.innerHTML = '';
        const add = (val, label) => {
            const b = document.createElement('button');
            b.className = 'chip' + (val === activeExt ? ' active' : '');
            b.dataset.ext = val;
            b.textContent = label;
            b.addEventListener('click', () => {
                activeExt = val;
                wrap.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
                b.classList.add('active');
                render();
            });
            wrap.appendChild(b);
        };
        add('all', 'All');
        exts.forEach(e => add(e, e.toUpperCase()));
    }

    function render() {
        const q = query.trim().toLowerCase();
        let list = allFiles.filter(f =>
            (activeExt === 'all' || f.ext === activeExt) &&
            (!q || f.name.toLowerCase().includes(q) || (f.label && f.label.toLowerCase().includes(q)) || (f.desc && f.desc.toLowerCase().includes(q)))
        );

        if (sortMode === 'name') list.sort((a, b) => a.label.localeCompare(b.label));
        else if (sortMode === 'name-desc') list.sort((a, b) => b.label.localeCompare(a.label));
        else list.sort((a, b) => a.ext.localeCompare(b.ext) || a.label.localeCompare(b.label));

        $('statsCount').innerHTML = allFiles.length
            ? '<strong>' + list.length + '</strong> of <strong>' + allFiles.length + '</strong> file' + (allFiles.length === 1 ? '' : 's')
            : '';

        if (!list.length) {
            $('output').innerHTML = `<div class="state-msg">
        <div class="big">🔍</div>
        <h2>No results for "${esc(q)}"</h2>
        <p>Try a different search term or clear the type filter.</p>
      </div>`;
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'grid';

        list.forEach(f => {
            const tc = typeClass(f.ext);
            const a = document.createElement('a');
            a.href = f.href;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.className = 'card';
            a.innerHTML = `
        <div class="card-icon t-${tc}">${EMOJI[f.ext] || '📁'}</div>
        <div class="card-info">
          <div class="card-name">${hl(f.label, q)}<span style="color:var(--muted)">.${esc(f.ext)}</span></div>
          <div class="card-sub">${f.desc ? esc(f.desc) : esc(f.ext) + ' file'}</div>
        </div>
        <div class="card-badge t-${tc}">${esc(f.ext)}</div>`;
            grid.appendChild(a);
        });

        $('output').innerHTML = '';
        $('output').appendChild(grid);
    }

    $('searchInput').addEventListener('input', e => { query = e.target.value; render(); });
    $('sortSelect').addEventListener('change', e => { sortMode = e.target.value; render(); });

    init();
})();