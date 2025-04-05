class WikiApp {
  constructor() {
    this.filesCache = [];
    this.initMarked();
    this.initEventListeners();
    this.loadTheme();
    this.loadInitialMD();
  }

  initMarked() {
    marked.setOptions({
      breaks: true,
      highlight: code => hljs.highlightAuto(code).value
    });
  }

  initEventListeners() {
    document.addEventListener('click', this.handleGlobalClick.bind(this));
    document.getElementById('searchInput').addEventListener('input', this.debounceSearch.bind(this));
    document.getElementById('menuToggle').addEventListener('click', this.toggleMenu);
    document.getElementById('themeToggle').addEventListener('click', this.toggleTheme.bind(this));
    document.querySelector('#fileMenu').addEventListener('click', this.handleNavClick.bind(this));
  }

  async loadInitialMD() {
    document.querySelectorAll('.sub-item.active').forEach(link => link.classList.remove('active'));
  
    const activeLink = document.querySelector('.sub-item[data-md]');
    if (activeLink) {
      activeLink.classList.add('active');
      await this.loadMD(activeLink.dataset.md);
      this.setupCollapsibleSections();
    }
  }
  

  handleGlobalClick(e) {
    if (!e.target.closest('.search-container')) {
      document.getElementById('searchResults').style.display = 'none';
    }
  }

  debounceSearch(e) {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.searchDocuments(e.target.value), 300);
  }

  toggleMenu() {
    document.getElementById('fileMenu').classList.toggle('open');
  }

  async loadMD(file) {
    try {
      const response = await fetch(`https://raw.githubusercontent.com/inpudiy/wiki/main/docs/${file}`);
      if (!response.ok) throw new Error(`Ошибка: ${response.status}`);
      
      const md = await response.text();
      document.getElementById('content').innerHTML = marked.parse(md);
      this.highlightCode();
      this.generateTOC();
      this.setupCollapsibleSections();
    } catch (err) {
      this.showError(file, err);
    }
  }

  highlightCode() {
    document.querySelectorAll('pre code').forEach(hljs.highlightElement);
  }

  generateTOC() {
    const tocContainer = document.getElementById('toc');
    const headings = document.querySelectorAll('#content h1, #content h2, #content h3');
    
    tocContainer.innerHTML = '<div class="section-title">Навигация</div>';
    
    headings.forEach(heading => {
      heading.id ||= heading.textContent.trim().toLowerCase().replace(/\s+/g, '-');
      const tocItem = this.createTOCItem(heading);
      tocContainer.appendChild(tocItem);
    });
  }

  createTOCItem(heading) {
    const tocItem = document.createElement('div');
    tocItem.className = 'toc-item';
    tocItem.style.marginLeft = `${parseInt(heading.tagName[1]) * 10 - 10}px`;
    tocItem.textContent = heading.textContent;
    tocItem.addEventListener('click', () => heading.scrollIntoView({ behavior: 'smooth' }));
    return tocItem;
  }

  handleNavClick(e) {
    const link = e.target.closest('.sub-item');
    if (!link) return;

    e.preventDefault();
    document.querySelectorAll('.sub-item').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    this.loadMD(link.dataset.md);
    
    if (window.innerWidth <= 768) {
      document.getElementById('fileMenu').classList.remove('open');
    }
  }

  async getFilesInDocs() {
    if (this.filesCache.length) return this.filesCache;
    
    try {
      const response = await fetch('https://api.github.com/repos/inpudiy/wiki/contents/docs');
      const data = await response.json();
      return this.filesCache = data.filter(item => item.name.endsWith('.md')).map(item => item.name);
    } catch (err) {
      console.error('Ошибка загрузки файлов:', err);
      return [];
    }
  }

  async searchDocuments(query) {
    const resultsContainer = document.getElementById('searchResults');
    query = query.trim().toLowerCase();
    
    if (!query) {
      resultsContainer.style.display = 'none';
      return;
    }

    const files = await this.getFilesInDocs();
    const results = await Promise.all(files.map(file => this.searchInFile(file, query)));
    
    resultsContainer.innerHTML = results.filter(Boolean).join('');
    resultsContainer.style.display = resultsContainer.innerHTML ? 'block' : 'none';
  }

  async searchInFile(file, query) {
    try {
      const response = await fetch(`https://raw.githubusercontent.com/inpudiy/wiki/main/docs/${file}`);
      const text = await response.text();
      const match = text.match(new RegExp(`(.{0,50}${query}.{0,50})`, 'i'));
      
      return match ? this.createResultItem(file, match[1], query) : null;
    } catch (err) {
      console.error('Ошибка поиска:', file, err);
      return null;
    }
  }

  createResultItem(file, text, query) {
    const highlighted = text.replace(new RegExp(query, 'gi'), m => `<mark>${m}</mark>`);
    return `
      <div class="search-result-item" data-file="${file}">
        <span class="result-filename">${file}</span>
        <span class="result-text">${highlighted}</span>
      </div>
    `;
  }

  showError(file, err) {
    console.error("Ошибка загрузки:", err);
    document.getElementById('content').innerHTML = `
      <div class="alert alert-danger">
        Документ не найден: ${file}
      </div>
    `;
  }

  toggleTheme() {
    const currentTheme = document.documentElement.dataset.theme;
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = newTheme;
    localStorage.setItem('wikiTheme', newTheme);
  }

  loadTheme() {
    const savedTheme = localStorage.getItem('wikiTheme') || 'dark';
    document.documentElement.dataset.theme = savedTheme;
  }

  setupCollapsibleSections() {
    const headings = document.querySelectorAll('#content h1, #content h2, #content h3');

    headings.forEach(heading => {
      if (heading.querySelector('.collapser')) return;
      const btn = document.createElement('button');
      btn.className = 'collapser';
      btn.innerHTML = '<i class="fas fa-chevron-up"></i>';
      btn.dataset.expanded = "true";
      btn.title = 'Свернуть/развернуть секцию';
      btn.addEventListener('click', () => this.toggleSection(heading, btn));
      heading.appendChild(btn);
    });
  }

  toggleSection(heading, btn) {
    const level = parseInt(heading.tagName.charAt(1));
    const isExpanded = btn.dataset.expanded === "true";
    let elem = heading.nextElementSibling;
    while (elem) {
      if (/H[1-6]/.test(elem.tagName)) {
        const currentLevel = parseInt(elem.tagName.charAt(1));
        if (currentLevel <= level) break;
      }
      elem.style.display = isExpanded ? 'none' : '';
      elem = elem.nextElementSibling;
    }
    if (isExpanded) {
      btn.dataset.expanded = "false";
      btn.innerHTML = '<i class="fas fa-chevron-down"></i>';
    } else {
      btn.dataset.expanded = "true";
      btn.innerHTML = '<i class="fas fa-chevron-up"></i>';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => new WikiApp());
