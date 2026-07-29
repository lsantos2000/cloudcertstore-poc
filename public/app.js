const state = { books: [], provider: 'All', query: '' };
const grid = document.querySelector('#book-grid');
const template = document.querySelector('#book-card-template');
const filters = document.querySelector('#filters');
const search = document.querySelector('#search');
const count = document.querySelector('#results-count');
const empty = document.querySelector('#empty-state');
const clearButton = document.querySelector('#clear-filters');
const providerSummary = document.querySelector('#provider-summary');
const resolvedCache = new Map();

const normalize = (value='') => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

async function loadCatalog(){
  const response = await fetch('/data/books.json', { cache: 'force-cache' });
  if(!response.ok) throw new Error('Catalog could not be loaded.');
  state.books = await response.json();
  document.querySelector('#title-count').textContent = state.books.length;
  const params = new URLSearchParams(location.search);
  state.query = params.get('q') || '';
  const requestedProvider = params.get('provider');
  if (requestedProvider && state.books.some(book => book.provider === requestedProvider)) state.provider = requestedProvider;
  search.value = state.query;
  renderProviders();
  render();
  updateStructuredData();
}

function renderProviders(){
  const providerCounts = state.books.reduce((acc, book) => { acc[book.provider] = (acc[book.provider] || 0) + 1; return acc; }, {});
  const ordered = ['All', ...Object.keys(providerCounts)];
  filters.replaceChildren(...ordered.map(provider => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = provider === 'All' ? `All (${state.books.length})` : `${provider} (${providerCounts[provider]})`;
    button.className = state.provider === provider ? 'active' : '';
    button.addEventListener('click', () => {
      state.provider = provider;
      const url = new URL(location);
      if(provider === 'All') url.searchParams.delete('provider'); else url.searchParams.set('provider', provider);
      history.replaceState({}, '', url);
      renderProviders();
      render();
    });
    return button;
  }));
  providerSummary.replaceChildren(...Object.entries(providerCounts).map(([provider, n]) => {
    const span = document.createElement('span'); span.className = 'provider-pill'; span.textContent = `${provider} · ${n}`; return span;
  }));
}

function filteredBooks(){
  const q = normalize(state.query);
  return state.books.filter(book => {
    const providerMatch = state.provider === 'All' || book.provider === state.provider;
    const haystack = normalize(`${book.name} ${book.certification} ${book.description} ${book.code} ${book.provider}`);
    return providerMatch && (!q || haystack.includes(q));
  });
}

function render(){
  const visible = filteredBooks();
  count.textContent = `${visible.length} ${visible.length === 1 ? 'title' : 'titles'}`;
  clearButton.hidden = state.provider === 'All' && !state.query;
  empty.hidden = visible.length > 0;
  grid.replaceChildren(...visible.map(createCard));
  observeMissingCovers();
}

function createCard(book){
  const node = template.content.firstElementChild.cloneNode(true);
  node.dataset.id = book.id;
  node.querySelector('.book-provider').textContent = `${book.provider} · ${book.code}`;
  node.querySelector('h3').textContent = book.title;
  node.querySelector('.book-description').textContent = book.description;
  const placeholder = node.querySelector('.cover-placeholder');
  placeholder.querySelector('small').textContent = book.provider;
  placeholder.querySelector('strong').textContent = book.code;
  const image = node.querySelector('img');
  image.alt = `${book.title} book cover`;
  if(book.coverImage){
    image.src = book.coverImage;
    image.addEventListener('load', () => image.classList.add('loaded'), { once: true });
  } else {
    image.dataset.bookId = book.id;
  }
  const status = node.querySelector('.status-badge');
  if(book.status && book.status.toLowerCase() !== 'active') { status.textContent = book.status; status.classList.add('retired'); }
  const official = node.querySelector('.official-link');
  if(book.officialUrl) official.href = book.officialUrl; else official.remove();
  const coverLink = node.querySelector('.cover-link');
  const button = node.querySelector('.book-button');
  const productUrl = book.directLink || book.catalogUrl;
  coverLink.href = productUrl;
  button.href = productUrl;
  button.textContent = book.isBundle ? 'View bundle ↗' : 'View eBook ↗';
  return node;
}

let observer;
function observeMissingCovers(){
  observer?.disconnect();
  observer = new IntersectionObserver(entries => {
    for(const entry of entries){ if(entry.isIntersecting){ observer.unobserve(entry.target); resolveBook(entry.target.dataset.bookId); } }
  }, { rootMargin: '450px 0px' });
  document.querySelectorAll('img[data-book-id]').forEach(img => observer.observe(img));
}

async function resolveBook(id){
  const book = state.books.find(item => item.id === id);
  const card = document.querySelector(`.book-card[data-id="${CSS.escape(id)}"]`);
  if(!book || !card) return;
  try{
    let data = resolvedCache.get(id);
    if(!data){
      const params = new URLSearchParams({ title: book.name, code: book.code, provider: book.provider });
      if(book.directLink) params.set('url', book.directLink);
      const response = await fetch(`/api/resolve?${params}`);
      if(!response.ok) throw new Error('Cover unavailable');
      data = await response.json(); resolvedCache.set(id, data);
    }
    if(data.imageUrl){ const img = card.querySelector('img'); img.src = data.imageUrl; img.addEventListener('load', () => img.classList.add('loaded'), { once:true }); }
    if(data.productUrl){ card.querySelector('.cover-link').href = data.productUrl; const button = card.querySelector('.book-button'); button.href = data.productUrl; button.dataset.resolving = 'false'; button.textContent = book.isBundle ? 'View bundle ↗' : 'View eBook ↗'; }
  }catch(error){
    const button = card.querySelector('.book-button'); button.dataset.resolving = 'false'; button.textContent = book.isBundle ? 'View bundle ↗' : 'Browse catalog ↗';
  }
}

function updateStructuredData(){
  const data = { '@context':'https://schema.org', '@type':'ItemList', name:'Cloud Certification Store eBooks', numberOfItems:state.books.length, itemListElement:state.books.map((book,index)=>({ '@type':'ListItem', position:index+1, item:{ '@type':'Product', name:book.name, category:book.provider, description:book.description, url:book.directLink || book.catalogUrl, brand:{'@type':'Brand','name':'Get It Done Certified'} } })) };
  document.querySelector('#structured-data').textContent = JSON.stringify(data);
}

search.addEventListener('input', event => { state.query = event.target.value; const url = new URL(location); if(state.query) url.searchParams.set('q',state.query); else url.searchParams.delete('q'); history.replaceState({},'',url); render(); });
clearButton.addEventListener('click', () => { state.provider='All'; state.query=''; search.value=''; history.replaceState({},'',`${location.pathname}${location.hash}`); renderProviders(); render(); });
const menuButton = document.querySelector('.menu-button'); const mobileNav = document.querySelector('#mobile-nav');
menuButton.addEventListener('click',()=>{ const open=menuButton.getAttribute('aria-expanded')==='true'; menuButton.setAttribute('aria-expanded',String(!open)); mobileNav.hidden=open; });
mobileNav.addEventListener('click',()=>{ mobileNav.hidden=true; menuButton.setAttribute('aria-expanded','false'); });
loadCatalog().catch(error => { count.textContent=error.message; empty.hidden=false; });
