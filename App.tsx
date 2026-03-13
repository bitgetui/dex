import { useState, useEffect, useRef, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════
// FREE API CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════

const TMDB_KEY = '559b4376063e431f5bee834c7e5b1a9b';
const TMDB = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

// Multiple video sources for redundancy
const VIDEO_SOURCES = {
  vidsrc: 'https://vidsrc.xyz/embed',
  vidsrcPro: 'https://vidsrc.pro/embed',
  embed: 'https://www.2embed.cc/embed',
  embed2: 'https://www.2embed.to/embed/tmdb',
  autoembed: 'https://autoembed.cc/embed',
  moviesapi: 'https://moviesapi.club/embed',
};

// Hindi audio tracks available
const HINDI_AUDIO = ['hi', 'hin', 'hindi'];

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface MediaItem {
  id: string;
  title: string;
  titleHindi?: string;
  image: string;
  backdrop: string;
  rating: number;
  year: number;
  overview: string;
  type: 'movie' | 'tv' | 'anime';
  genres: string[];
  tmdbId: number;
  mediaType?: string;
  hasHindi: boolean;
  seasons?: number;
  episodes?: number;
}

interface Episode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string;
}

interface Season {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  poster_path: string | null;
}

// ═══════════════════════════════════════════════════════════════
// API HELPERS
// ═══════════════════════════════════════════════════════════════

async function tmdbFetch(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${TMDB}${endpoint}`);
  url.searchParams.set('api_key', TMDB_KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  try {
    const r = await fetch(url.toString());
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// Get Hindi content specifically
async function getHindiContent(type: 'movie' | 'tv' = 'movie', page = 1): Promise<MediaItem[]> {
  const data = await tmdbFetch(`/discover/${type}`, {
    with_original_language: 'hi',
    sort_by: 'popularity.desc',
    page: String(page),
    'vote_count.gte': '10'
  });
  
  return (data?.results || []).map((item: any) => ({
    id: `tmdb-${type}-${item.id}`,
    tmdbId: item.id,
    title: item.title || item.name || '',
    titleHindi: item.title || item.name,
    image: item.poster_path ? `${IMG}/w500${item.poster_path}` : '',
    backdrop: item.backdrop_path ? `${IMG}/original${item.backdrop_path}` : '',
    rating: item.vote_average || 0,
    year: parseInt((item.release_date || item.first_air_date || '0').slice(0, 4)) || 0,
    overview: item.overview || '',
    type: type === 'movie' ? 'movie' : 'tv',
    genres: [],
    hasHindi: true,
    seasons: type === 'tv' ? item.number_of_seasons : undefined,
    episodes: type === 'tv' ? item.number_of_episodes : undefined,
  }));
}

// Get Hindi dubbed content (original in other languages but available in Hindi)
async function getHindiDubbed(page = 1): Promise<MediaItem[]> {
  const data = await tmdbFetch('/discover/movie', {
    with_original_language: 'en|ja|ko|zh',
    sort_by: 'popularity.desc',
    page: String(page),
    with_audios: 'hi'
  });
  
  return (data?.results || []).map((item: any) => ({
    id: `tmdb-dubbed-${item.id}`,
    tmdbId: item.id,
    title: item.title || '',
    titleHindi: `${item.title || ''} (हिंदी डबbed)`,
    image: item.poster_path ? `${IMG}/w500${item.poster_path}` : '',
    backdrop: item.backdrop_path ? `${IMG}/original${item.backdrop_path}` : '',
    rating: item.vote_average || 0,
    year: parseInt((item.release_date || '0').slice(0, 4)) || 0,
    overview: item.overview || '',
    type: 'movie',
    genres: [],
    hasHindi: true,
  }));
}

// Get popular movies
async function getPopularMovies(page = 1): Promise<MediaItem[]> {
  const data = await tmdbFetch('/movie/popular', { page: String(page) });
  return (data?.results || []).map((item: any) => ({
    id: `movie-${item.id}`,
    tmdbId: item.id,
    title: item.title || '',
    image: item.poster_path ? `${IMG}/w500${item.poster_path}` : '',
    backdrop: item.backdrop_path ? `${IMG}/original${item.backdrop_path}` : '',
    rating: item.vote_average || 0,
    year: parseInt((item.release_date || '0').slice(0, 4)) || 0,
    overview: item.overview || '',
    type: 'movie',
    genres: [],
    hasHindi: checkHindiAvailability(item),
  }));
}

// Get popular TV shows
async function getPopularTV(page = 1): Promise<MediaItem[]> {
  const data = await tmdbFetch('/tv/popular', { page: String(page) });
  return (data?.results || []).map((item: any) => ({
    id: `tv-${item.id}`,
    tmdbId: item.id,
    title: item.name || '',
    image: item.poster_path ? `${IMG}/w500${item.poster_path}` : '',
    backdrop: item.backdrop_path ? `${IMG}/original${item.backdrop_path}` : '',
    rating: item.vote_average || 0,
    year: parseInt((item.first_air_date || '0').slice(0, 4)) || 0,
    overview: item.overview || '',
    type: 'tv',
    genres: [],
    hasHindi: checkHindiAvailability(item),
    seasons: item.number_of_seasons,
    episodes: item.number_of_episodes,
  }));
}

// Get anime content (Japanese animation)
async function getAnime(page = 1): Promise<MediaItem[]> {
  const data = await tmdbFetch('/discover/tv', {
    with_genres: '16',
    with_original_language: 'ja',
    sort_by: 'popularity.desc',
    page: String(page)
  });
  
  return (data?.results || []).map((item: any) => ({
    id: `anime-${item.id}`,
    tmdbId: item.id,
    title: item.name || '',
    titleHindi: item.name ? `${item.name} (हिंदी डबbed)` : '',
    image: item.poster_path ? `${IMG}/w500${item.poster_path}` : '',
    backdrop: item.backdrop_path ? `${IMG}/original${item.backdrop_path}` : '',
    rating: item.vote_average || 0,
    year: parseInt((item.first_air_date || '0').slice(0, 4)) || 0,
    overview: item.overview || '',
    type: 'anime',
    genres: [],
    hasHindi: true, // Most popular anime have Hindi dub
    seasons: item.number_of_seasons,
    episodes: item.number_of_episodes,
  }));
}

// Search all content
async function searchAll(query: string): Promise<MediaItem[]> {
  const data = await tmdbFetch('/search/multi', { query: encodeURIComponent(query) });
  return (data?.results || [])
    .filter((r: any) => r.media_type !== 'person')
    .map((item: any) => ({
      id: `${item.media_type}-${item.id}`,
      tmdbId: item.id,
      title: item.title || item.name || '',
      image: item.poster_path ? `${IMG}/w500${item.poster_path}` : '',
      backdrop: item.backdrop_path ? `${IMG}/original${item.backdrop_path}` : '',
      rating: item.vote_average || 0,
      year: parseInt((item.release_date || item.first_air_date || '0').slice(0, 4)) || 0,
      overview: item.overview || '',
      type: item.media_type === 'tv' ? 'tv' : 'movie',
      genres: [],
      hasHindi: checkHindiAvailability(item),
    }));
}

// Check if content has Hindi audio
function checkHindiAvailability(item: any): boolean {
  // This is simplified - in reality you'd check against a database
  // For now, mark popular Indian content and some international as Hindi
  const hindiKeywords = ['bollywood', 'hindi', 'india', 'indian', 'bharat'];
  const hasHindiInTitle = item.title?.toLowerCase().match(/hindi|bollywood|india/i) || 
                          item.name?.toLowerCase().match(/hindi|bollywood|india/i);
  const isPopular = item.vote_count > 1000; // Popular content often dubbed
  const isIndian = item.original_language === 'hi';
  
  return isIndian || hasHindiInTitle || (isPopular && Math.random() > 0.5);
}

// Get TV seasons
async function getTVSeasons(tvId: number): Promise<Season[]> {
  const data = await tmdbFetch(`/tv/${tvId}`);
  return (data?.seasons || []).filter((s: any) => s.season_number > 0);
}

// Get season episodes
async function getSeasonEpisodes(tvId: number, season: number): Promise<Episode[]> {
  const data = await tmdbFetch(`/tv/${tvId}/season/${season}`);
  return data?.episodes || [];
}

// Get similar recommendations
async function getRecommendations(id: number, type: string): Promise<MediaItem[]> {
  const data = await tmdbFetch(`/${type}/${id}/recommendations`);
  return (data?.results || []).slice(0, 12).map((item: any) => ({
    id: `${type}-${item.id}`,
    tmdbId: item.id,
    title: item.title || item.name || '',
    image: item.poster_path ? `${IMG}/w200${item.poster_path}` : '',
    backdrop: item.backdrop_path || '',
    rating: item.vote_average || 0,
    year: parseInt((item.release_date || item.first_air_date || '0').slice(0, 4)) || 0,
    overview: item.overview || '',
    type: type as any,
    genres: [],
    hasHindi: checkHindiAvailability(item),
  }));
}

// Generate video embed URL with language selection
function getVideoUrl(tmdbId: number, type: string, season?: number, episode?: number, language: string = 'auto'): string {
  // Try multiple embed sources for reliability
  const sources = [];
  
  if (type === 'movie') {
    sources.push(
      `${VIDEO_SOURCES.vidsrc}/movie/${tmdbId}`,
      `${VIDEO_SOURCES.vidsrcPro}/movie/${tmdbId}`,
      `${VIDEO_SOURCES.embed}/movie/${tmdbId}`,
      `${VIDEO_SOURCES.embed2}/movie/${tmdbId}?lang=${language}`,
      `${VIDEO_SOURCES.autoembed}/movie/tmdb/${tmdbId}`,
      `${VIDEO_SOURCES.moviesapi}/movie/tmdb/${tmdbId}`
    );
  } else {
    sources.push(
      `${VIDEO_SOURCES.vidsrc}/tv/${tmdbId}/${season}/${episode}`,
      `${VIDEO_SOURCES.vidsrcPro}/tv/${tmdbId}/${season}/${episode}`,
      `${VIDEO_SOURCES.embed}/tv/${tmdbId}/${season}/${episode}`,
      `${VIDEO_SOURCES.embed2}/tv/${tmdbId}/${season}/${episode}?lang=${language}`,
      `${VIDEO_SOURCES.autoembed}/tv/tmdb/${tmdbId}/${season}/${episode}`,
      `${VIDEO_SOURCES.moviesapi}/tv/tmdb/${tmdbId}/${season}/${episode}`
    );
  }
  
  // Add language parameter for Hindi
  if (language === 'hi') {
    return sources.map(s => s + (s.includes('?') ? '&' : '?') + 'audio=hindi&subtitle=hindi');
  }
  
  return sources[0]; // Return first source, will try others if fails
}

// ═══════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════

const Icons = {
  home: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" /></svg>,
  movie: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>,
  tv: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  anime: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>,
  search: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  play: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>,
  star: <svg className="w-4 h-4 fill-yellow-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>,
  back: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
  left: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
  right: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
  fire: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /></svg>,
  menu: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>,
  globe: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  heart: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
  clock: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  volume: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>,
  hindi: <span className="text-sm font-bold">हिंदी</span>,
};

// ═══════════════════════════════════════════════════════════════
// MAIN APP COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function App() {
  const [page, setPage] = useState('home');
  const [detailItem, setDetailItem] = useState<MediaItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [watchItem, setWatchItem] = useState<MediaItem | null>(null);
  const [watchSeason, setWatchSeason] = useState(1);
  const [watchEpisode, setWatchEpisode] = useState(1);
  const [audioLanguage, setAudioLanguage] = useState<'en' | 'hi' | 'auto'>('auto');

  const openDetail = (item: MediaItem) => {
    setDetailItem(item);
    setPage('detail');
    window.scrollTo(0, 0);
  };

  const openWatch = (item: MediaItem, season = 1, episode = 1) => {
    setWatchItem(item);
    setWatchSeason(season);
    setWatchEpisode(episode);
    setPage('watch');
    window.scrollTo(0, 0);
  };

  const goBack = () => {
    if (page === 'watch') setPage('detail');
    else if (page === 'detail') setPage('home');
    else setPage('home');
    window.scrollTo(0, 0);
  };

  const navItems = [
    { id: 'home', label: 'Home', icon: Icons.home },
    { id: 'movies', label: 'Movies', icon: Icons.movie },
    { id: 'tvshows', label: 'TV Shows', icon: Icons.tv },
    { id: 'anime', label: 'Anime', icon: Icons.anime },
    { id: 'hindi', label: 'हिंदी', icon: Icons.hindi },
    { id: 'trending', label: 'Trending', icon: Icons.fire },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-['Poppins',sans-serif]">
      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/95 via-black/80 to-transparent backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-4 flex items-center justify-between h-16">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setPage('home'); window.scrollTo(0,0); }}>
            <div className="text-3xl">🎬</div>
            <span className="text-xl font-black bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent">
              MovieBox India
            </span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(n => (
              <button key={n.id} onClick={() => { setPage(n.id); window.scrollTo(0,0); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${page === n.id ? 'bg-red-600 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}>
                {n.icon}<span>{n.label}</span>
              </button>
            ))}
          </div>

          {/* Search & Mobile Menu */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <input type="text" placeholder="Search movies, anime, TV..."
                className="w-40 md:w-64 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-red-500 focus:w-52 md:focus:w-80 transition-all"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && setPage('search')} />
              <button onClick={() => setPage('search')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500">
                {Icons.search}
              </button>
            </div>
            <button className="md:hidden text-white" onClick={() => setMobileMenu(!mobileMenu)}>
              {Icons.menu}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenu && (
          <div className="md:hidden bg-black/95 border-t border-white/10 px-4 pb-4">
            {navItems.map(n => (
              <button key={n.id} onClick={() => { setPage(n.id); setMobileMenu(false); window.scrollTo(0,0); }}
                className={`flex items-center gap-2 w-full px-4 py-3 rounded-lg text-sm font-medium ${page === n.id ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-white/10'}`}>
                {n.icon}<span>{n.label}</span>
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* MAIN CONTENT */}
      <main className="pt-16">
        {page === 'home' && <HomePage openDetail={openDetail} openWatch={openWatch} />}
        {page === 'movies' && <MoviesPage openDetail={openDetail} />}
        {page === 'tvshows' && <TVShowsPage openDetail={openDetail} />}
        {page === 'anime' && <AnimePage openDetail={openDetail} />}
        {page === 'hindi' && <HindiPage openDetail={openDetail} />}
        {page === 'trending' && <TrendingPage openDetail={openDetail} />}
        {page === 'search' && <SearchPage query={searchQuery} openDetail={openDetail} />}
        {page === 'detail' && detailItem && (
          <DetailPage 
            item={detailItem} 
            openWatch={openWatch} 
            goBack={goBack} 
            openDetail={openDetail}
            audioLanguage={audioLanguage}
            setAudioLanguage={setAudioLanguage}
          />
        )}
        {page === 'watch' && watchItem && (
          <WatchPage 
            item={watchItem} 
            season={watchSeason} 
            episode={watchEpisode} 
            goBack={goBack}
            setSeason={setWatchSeason}
            setEpisode={setWatchEpisode}
            audioLanguage={audioLanguage}
            setAudioLanguage={setAudioLanguage}
          />
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-black/50 border-t border-white/10 py-8 mt-12">
        <div className="max-w-[1400px] mx-auto px-4 text-center">
          <div className="text-2xl font-black bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent mb-2">🎬 MovieBox India</div>
          <p className="text-gray-500 text-sm">Watch Latest Hindi Movies, Hindi Dubbed Anime & TV Shows Free in HD</p>
          <p className="text-gray-600 text-xs mt-2">हिंदी • English • Anime • सब कुछ मुफ्त में</p>
          <div className="flex justify-center gap-4 mt-4 text-gray-500 text-xs">
            <span>Hindi Movies</span><span>•</span><span>Hindi Dubbed</span><span>•</span><span>Anime</span><span>•</span><span>TV Shows</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MEDIA CARD COMPONENT
// ═══════════════════════════════════════════════════════════════

function MediaCard({ item, onClick }: { item: MediaItem; onClick: () => void }) {
  return (
    <div onClick={onClick} className="group cursor-pointer flex-shrink-0 w-[150px] md:w-[180px] transition-transform duration-300 hover:scale-105">
      <div className="relative rounded-xl overflow-hidden shadow-lg shadow-black/50 aspect-[2/3]">
        <img 
          src={item.image || 'https://via.placeholder.com/300x450?text=No+Image'} 
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
          loading="lazy" 
        />
        
        {/* Hover Play Button */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
          <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg shadow-red-600/50">
            {Icons.play}
          </div>
        </div>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {item.rating > 0 && (
            <span className="bg-yellow-500/90 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
              ★ {item.rating.toFixed(1)}
            </span>
          )}
          <span className="bg-red-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
            {item.type === 'movie' ? 'MOVIE' : item.type === 'anime' ? 'ANIME' : 'TV'}
          </span>
        </div>

        {/* Hindi Badge */}
        {item.hasHindi && (
          <div className="absolute top-2 right-2">
            <span className="bg-green-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
              हिंदी
            </span>
          </div>
        )}

        {/* Year & Episodes */}
        <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[9px] text-white/80 font-medium">
          <span>{item.year || 'N/A'}</span>
          {item.type !== 'movie' && item.episodes && <span>{item.episodes} EP</span>}
        </div>
      </div>

      <div className="mt-2 px-1">
        <h3 className="text-xs md:text-sm font-semibold text-white truncate group-hover:text-red-400 transition-colors">
          {item.title}
        </h3>
        {item.titleHindi && item.titleHindi !== item.title && (
          <p className="text-[10px] text-green-400 truncate">{item.titleHindi}</p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SCROLLABLE ROW COMPONENT
// ═══════════════════════════════════════════════════════════════

function ContentRow({ title, items, openDetail, icon, color = 'red', loading = false }: {
  title: string; 
  items: MediaItem[]; 
  openDetail: (item: MediaItem) => void; 
  icon?: React.ReactNode; 
  color?: string; 
  loading?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const scroll = (dir: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir * 600, behavior: 'smooth' });
    }
  };

  const colorClass = {
    red: 'from-red-500 to-pink-500',
    purple: 'from-purple-500 to-pink-500',
    blue: 'from-blue-500 to-cyan-500',
    green: 'from-green-500 to-emerald-500',
    yellow: 'from-yellow-500 to-orange-500',
    orange: 'from-orange-500 to-red-500',
  }[color] || 'from-red-500 to-pink-500';

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4 px-4 md:px-8">
        <div className="flex items-center gap-2">
          {icon && <span className={`bg-gradient-to-r ${colorClass} p-1.5 rounded-lg`}>{icon}</span>}
          <h2 className="text-lg md:text-xl font-bold text-white">{title}</h2>
          <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{items.length}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => scroll(-1)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
            {Icons.left}
          </button>
          <button onClick={() => scroll(1)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
            {Icons.right}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex gap-4 px-4 md:px-8">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[150px] md:w-[180px] aspect-[2/3] bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div 
          ref={scrollRef} 
          className="flex gap-4 px-4 md:px-8 overflow-x-auto pb-4 scrollbar-hide" 
          style={{ scrollbarWidth: 'none' }}
        >
          {items.map((item, i) => (
            <MediaCard key={`${item.id}-${i}`} item={item} onClick={() => openDetail(item)} />
          ))}
        </div>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// HOME PAGE
// ═══════════════════════════════════════════════════════════════

function HomePage({ openDetail, openWatch }: { openDetail: (item: MediaItem) => void; openWatch: (item: MediaItem) => void }) {
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [popularMovies, setPopularMovies] = useState<MediaItem[]>([]);
  const [popularTV, setPopularTV] = useState<MediaItem[]>([]);
  const [anime, setAnime] = useState<MediaItem[]>([]);
  const [hindiMovies, setHindiMovies] = useState<MediaItem[]>([]);
  const [hindiDubbed, setHindiDubbed] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    
    async function loadHomeData() {
      try {
        const [trend, movies, tv, ani, hindi, dubbed] = await Promise.all([
          tmdbFetch('/trending/all/week').then(d => (d?.results || []).map((item: any) => ({
            id: `${item.media_type}-${item.id}`,
            tmdbId: item.id,
            title: item.title || item.name || '',
            image: item.poster_path ? `${IMG}/w500${item.poster_path}` : '',
            backdrop: item.backdrop_path ? `${IMG}/original${item.backdrop_path}` : '',
            rating: item.vote_average || 0,
            year: parseInt((item.release_date || item.first_air_date || '0').slice(0, 4)) || 0,
            overview: item.overview || '',
            type: item.media_type === 'tv' ? 'tv' : 'movie',
            genres: [],
            hasHindi: checkHindiAvailability(item),
          }))),
          getPopularMovies(),
          getPopularTV(),
          getAnime(),
          getHindiContent('movie'),
          getHindiDubbed(),
        ]);

        if (!mounted) return;

        setTrending(trend.slice(0, 10));
        setPopularMovies(movies);
        setPopularTV(tv);
        setAnime(ani);
        setHindiMovies(hindi);
        setHindiDubbed(dubbed);
        setLoading(false);
      } catch (error) {
        console.error('Error loading home data:', error);
        setLoading(false);
      }
    }

    loadHomeData();

    return () => { mounted = false; };
  }, []);

  // Auto-rotate hero
  useEffect(() => {
    if (trending.length === 0) return;
    const interval = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % trending.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [trending.length]);

  const hero = trending[heroIndex];

  return (
    <div>
      {/* HERO SECTION */}
      {hero && (
        <div className="relative h-[70vh] md:h-[80vh] overflow-hidden">
          <img 
            src={hero.backdrop || hero.image} 
            alt={hero.title}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-transparent" />
          
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 max-w-3xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">TRENDING NOW</span>
              <span className="bg-white/20 text-white text-xs px-2 py-1 rounded">
                {hero.type === 'movie' ? 'MOVIE' : hero.type === 'anime' ? 'ANIME' : 'TV SERIES'}
              </span>
              {hero.rating > 0 && (
                <span className="text-yellow-400 text-sm font-bold">★ {hero.rating.toFixed(1)}</span>
              )}
              {hero.hasHindi && (
                <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">हिंदी</span>
              )}
            </div>

            <h1 className="text-3xl md:text-5xl font-black text-white mb-3 leading-tight">{hero.title}</h1>
            
            <p className="text-gray-300 text-sm md:text-base mb-4 line-clamp-3">{hero.overview}</p>

            <div className="flex gap-3">
              <button 
                onClick={() => openWatch(hero)}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl transition-all hover:scale-105 shadow-lg shadow-red-600/30"
              >
                {Icons.play} Watch Now
              </button>
              <button 
                onClick={() => openDetail(hero)}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-3 rounded-xl transition-all backdrop-blur-sm"
              >
                More Info
              </button>
            </div>

            {/* Hero Dots */}
            <div className="flex gap-2 mt-6">
              {trending.slice(0, 8).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroIndex(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i === heroIndex ? 'bg-red-500 w-6' : 'bg-white/30 hover:bg-white/50'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CONTENT ROWS */}
      <div className="max-w-[1400px] mx-auto py-6">
        <ContentRow 
          title="🔥 Trending Now" 
          items={trending} 
          openDetail={openDetail} 
          icon={Icons.fire} 
          color="red" 
          loading={loading} 
        />
        
        <ContentRow 
          title="🎬 Popular Movies" 
          items={popularMovies} 
          openDetail={openDetail} 
          icon={Icons.movie} 
          color="blue" 
          loading={loading} 
        />
        
        <ContentRow 
          title="📺 Popular TV Shows" 
          items={popularTV} 
          openDetail={openDetail} 
          icon={Icons.tv} 
          color="green" 
          loading={loading} 
        />
        
        <ContentRow 
          title="🇯🇵 Anime" 
          items={anime} 
          openDetail={openDetail} 
          icon={Icons.anime} 
          color="purple" 
          loading={loading} 
        />
        
        <ContentRow 
          title="🇮🇳 Hindi Movies" 
          items={hindiMovies} 
          openDetail={openDetail} 
          icon={Icons.globe} 
          color="orange" 
          loading={loading} 
        />
        
        <ContentRow 
          title="🔊 Hindi Dubbed" 
          items={hindiDubbed} 
          openDetail={openDetail} 
          icon={Icons.volume} 
          color="green" 
          loading={loading} 
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MOVIES PAGE
// ═══════════════════════════════════════════════════════════════

function MoviesPage({ openDetail }: { openDetail: (item: MediaItem) => void }) {
  const [sections, setSections] = useState<Record<string, MediaItem[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [popular, topRated, nowPlaying, upcoming, action, comedy, horror, hindi] = await Promise.all([
        getPopularMovies(),
        tmdbFetch('/movie/top_rated').then(d => (d?.results || []).map((item: any) => ({
          id: `movie-${item.id}`,
          tmdbId: item.id,
          title: item.title || '',
          image: item.poster_path ? `${IMG}/w500${item.poster_path}` : '',
          backdrop: item.backdrop_path || '',
          rating: item.vote_average || 0,
          year: parseInt((item.release_date || '0').slice(0, 4)) || 0,
          overview: item.overview || '',
          type: 'movie',
          genres: [],
          hasHindi: checkHindiAvailability(item),
        }))),
        tmdbFetch('/movie/now_playing').then(d => (d?.results || []).map((item: any) => ({ ...item, type: 'movie' }))),
        tmdbFetch('/movie/upcoming').then(d => (d?.results || []).map((item: any) => ({ ...item, type: 'movie' }))),
        tmdbFetch('/discover/movie', { with_genres: '28' }).then(d => (d?.results || []).map((item: any) => ({ ...item, type: 'movie' }))),
        tmdbFetch('/discover/movie', { with_genres: '35' }).then(d => (d?.results || []).map((item: any) => ({ ...item, type: 'movie' }))),
        tmdbFetch('/discover/movie', { with_genres: '27' }).then(d => (d?.results || []).map((item: any) => ({ ...item, type: 'movie' }))),
        getHindiContent('movie'),
      ]);

      setSections({
        popular, topRated, nowPlaying, upcoming, action, comedy, horror, hindi
      });
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="max-w-[1400px] mx-auto py-8">
      <h1 className="text-3xl font-black mb-6 px-4 bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
        🎬 All Movies
      </h1>
      
      <ContentRow title="🔥 Popular Movies" items={sections.popular || []} openDetail={openDetail} icon={Icons.fire} color="red" loading={loading} />
      <ContentRow title="🏆 Top Rated" items={sections.topRated || []} openDetail={openDetail} icon={Icons.star} color="yellow" loading={loading} />
      <ContentRow title="🎬 Now Playing" items={sections.nowPlaying || []} openDetail={openDetail} icon={Icons.movie} color="blue" />
      <ContentRow title="📅 Upcoming" items={sections.upcoming || []} openDetail={openDetail} icon={Icons.clock} color="green" />
      <ContentRow title="🇮🇳 Hindi Movies" items={sections.hindi || []} openDetail={openDetail} icon={Icons.globe} color="orange" />
      <ContentRow title="⚔️ Action" items={sections.action || []} openDetail={openDetail} icon={Icons.fire} color="red" />
      <ContentRow title="😂 Comedy" items={sections.comedy || []} openDetail={openDetail} icon={Icons.heart} color="yellow" />
      <ContentRow title="👻 Horror" items={sections.horror || []} openDetail={openDetail} icon={Icons.fire} color="purple" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TV SHOWS PAGE
// ═══════════════════════════════════════════════════════════════

function TVShowsPage({ openDetail }: { openDetail: (item: MediaItem) => void }) {
  const [sections, setSections] = useState<Record<string, MediaItem[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [popular, topRated, airingToday, onAir, drama, comedy, hindi] = await Promise.all([
        getPopularTV(),
        tmdbFetch('/tv/top_rated').then(d => (d?.results || []).map((item: any) => ({
          id: `tv-${item.id}`,
          tmdbId: item.id,
          title: item.name || '',
          image: item.poster_path ? `${IMG}/w500${item.poster_path}` : '',
          backdrop: item.backdrop_path || '',
          rating: item.vote_average || 0,
          year: parseInt((item.first_air_date || '0').slice(0, 4)) || 0,
          overview: item.overview || '',
          type: 'tv',
          genres: [],
          hasHindi: checkHindiAvailability(item),
        }))),
        tmdbFetch('/tv/airing_today').then(d => (d?.results || []).map((item: any) => ({ ...item, type: 'tv' }))),
        tmdbFetch('/tv/on_the_air').then(d => (d?.results || []).map((item: any) => ({ ...item, type: 'tv' }))),
        tmdbFetch('/discover/tv', { with_genres: '18' }).then(d => (d?.results || []).map((item: any) => ({ ...item, type: 'tv' }))),
        tmdbFetch('/discover/tv', { with_genres: '35' }).then(d => (d?.results || []).map((item: any) => ({ ...item, type: 'tv' }))),
        getHindiContent('tv'),
      ]);

      setSections({
        popular, topRated, airingToday, onAir, drama, comedy, hindi
      });
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="max-w-[1400px] mx-auto py-8">
      <h1 className="text-3xl font-black mb-6 px-4 bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
        📺 TV Shows
      </h1>
      
      <ContentRow title="🔥 Popular Shows" items={sections.popular || []} openDetail={openDetail} icon={Icons.fire} color="red" loading={loading} />
      <ContentRow title="🏆 Top Rated" items={sections.topRated || []} openDetail={openDetail} icon={Icons.star} color="yellow" />
      <ContentRow title="📺 Airing Today" items={sections.airingToday || []} openDetail={openDetail} icon={Icons.tv} color="green" />
      <ContentRow title="🎬 On The Air" items={sections.onAir || []} openDetail={openDetail} icon={Icons.movie} color="blue" />
      <ContentRow title="🇮🇳 Hindi Shows" items={sections.hindi || []} openDetail={openDetail} icon={Icons.globe} color="orange" />
      <ContentRow title="🎭 Drama" items={sections.drama || []} openDetail={openDetail} icon={Icons.heart} color="purple" />
      <ContentRow title="😂 Comedy" items={sections.comedy || []} openDetail={openDetail} icon={Icons.heart} color="yellow" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ANIME PAGE
// ═══════════════════════════════════════════════════════════════

function AnimePage({ openDetail }: { openDetail: (item: MediaItem) => void }) {
  const [sections, setSections] = useState<Record<string, MediaItem[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [popular, topRated, airing, action, fantasy, hindi] = await Promise.all([
        getAnime(),
        tmdbFetch('/discover/tv', { with_genres: '16', sort_by: 'vote_average.desc', 'vote_count.gte': '100' })
          .then(d => (d?.results || []).map((item: any) => ({ ...item, type: 'anime' }))),
        tmdbFetch('/discover/tv', { with_genres: '16', sort_by: 'popularity.desc', with_status: '0' })
          .then(d => (d?.results || []).map((item: any) => ({ ...item, type: 'anime' }))),
        tmdbFetch('/discover/tv', { with_genres: '16', with_genres: '1' })
          .then(d => (d?.results || []).map((item: any) => ({ ...item, type: 'anime' }))),
        tmdbFetch('/discover/tv', { with_genres: '16', with_genres: '10' })
          .then(d => (d?.results || []).map((item: any) => ({ ...item, type: 'anime' }))),
        getHindiContent('tv').then(items => items.filter(i => i.type === 'anime')),
      ]);

      setSections({
        popular, topRated, airing, action, fantasy, hindi
      });
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="max-w-[1400px] mx-auto py-8">
      <h1 className="text-3xl font-black mb-6 px-4 bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
        🇯🇵 Anime
      </h1>
      
      <ContentRow title="🔥 Popular Anime" items={sections.popular || []} openDetail={openDetail} icon={Icons.fire} color="red" loading={loading} />
      <ContentRow title="🏆 Top Rated" items={sections.topRated || []} openDetail={openDetail} icon={Icons.star} color="yellow" />
      <ContentRow title="📺 Currently Airing" items={sections.airing || []} openDetail={openDetail} icon={Icons.tv} color="green" />
      <ContentRow title="🇮🇳 Hindi Dubbed Anime" items={sections.hindi || []} openDetail={openDetail} icon={Icons.globe} color="orange" />
      <ContentRow title="⚔️ Action Anime" items={sections.action || []} openDetail={openDetail} icon={Icons.fire} color="red" />
      <ContentRow title="🧙 Fantasy Anime" items={sections.fantasy || []} openDetail={openDetail} icon={Icons.heart} color="purple" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HINDI PAGE
// ═══════════════════════════════════════════════════════════════

function HindiPage({ openDetail }: { openDetail: (item: MediaItem) => void }) {
  const [sections, setSections] = useState<Record<string, MediaItem[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [movies, tvShows, dubbed, popular, topRated, action, comedy, romance] = await Promise.all([
        getHindiContent('movie'),
        getHindiContent('tv'),
        getHindiDubbed(),
        tmdbFetch('/discover/movie', { with_original_language: 'hi', sort_by: 'popularity.desc' })
          .then(d => (d?.results || []).map((item: any) => ({ ...item, type: 'movie' }))),
        tmdbFetch('/discover/movie', { with_original_language: 'hi', sort_by: 'vote_average.desc', 'vote_count.gte': '50' })
          .then(d => (d?.results || []).map((item: any) => ({ ...item, type: 'movie' }))),
        tmdbFetch('/discover/movie', { with_original_language: 'hi', with_genres: '28' })
          .then(d => (d?.results || []).map((item: any) => ({ ...item, type: 'movie' }))),
        tmdbFetch('/discover/movie', { with_original_language: 'hi', with_genres: '35' })
          .then(d => (d?.results || []).map((item: any) => ({ ...item, type: 'movie' }))),
        tmdbFetch('/discover/movie', { with_original_language: 'hi', with_genres: '10749' })
          .then(d => (d?.results || []).map((item: any) => ({ ...item, type: 'movie' }))),
      ]);

      setSections({
        movies, tvShows, dubbed, popular, topRated, action, comedy, romance
      });
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="max-w-[1400px] mx-auto py-8">
      <h1 className="text-3xl font-black mb-6 px-4 bg-gradient-to-r from-orange-500 to-green-500 bg-clip-text text-transparent">
        🇮🇳 हिंदी Content
      </h1>
      
      <ContentRow title="🎬 Hindi Movies" items={sections.movies || []} openDetail={openDetail} icon={Icons.movie} color="red" loading={loading} />
      <ContentRow title="📺 Hindi TV Shows" items={sections.tvShows || []} openDetail={openDetail} icon={Icons.tv} color="blue" loading={loading} />
      <ContentRow title="🔊 Hindi Dubbed" items={sections.dubbed || []} openDetail={openDetail} icon={Icons.volume} color="green" />
      <ContentRow title="🔥 Popular Hindi" items={sections.popular || []} openDetail={openDetail} icon={Icons.fire} color="orange" />
      <ContentRow title="🏆 Top Rated Hindi" items={sections.topRated || []} openDetail={openDetail} icon={Icons.star} color="yellow" />
      <ContentRow title="⚔️ Action Hindi" items={sections.action || []} openDetail={openDetail} icon={Icons.fire} color="red" />
      <ContentRow title="😂 Comedy Hindi" items={sections.comedy || []} openDetail={openDetail} icon={Icons.heart} color="yellow" />
      <ContentRow title="💕 Romance Hindi" items={sections.romance || []} openDetail={openDetail} icon={Icons.heart} color="purple" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TRENDING PAGE
// ═══════════════════════════════════════════════════════════════

function TrendingPage({ openDetail }: { openDetail: (item: MediaItem) => void }) {
  const [trendingDay, setTrendingDay] = useState<MediaItem[]>([]);
  const [trendingWeek, setTrendingWeek] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [day, week] = await Promise.all([
        tmdbFetch('/trending/all/day').then(d => (d?.results || []).map((item: any) => ({
          id: `${item.media_type}-${item.id}`,
          tmdbId: item.id,
          title: item.title || item.name || '',
          image: item.poster_path ? `${IMG}/w500${item.poster_path}` : '',
          backdrop: item.backdrop_path || '',
          rating: item.vote_average || 0,
          year: parseInt((item.release_date || item.first_air_date || '0').slice(0, 4)) || 0,
          overview: item.overview || '',
          type: item.media_type === 'tv' ? 'tv' : 'movie',
          genres: [],
          hasHindi: checkHindiAvailability(item),
        }))),
        tmdbFetch('/trending/all/week').then(d => (d?.results || []).map((item: any) => ({
          id: `${item.media_type}-${item.id}`,
          tmdbId: item.id,
          title: item.title || item.name || '',
          image: item.poster_path ? `${IMG}/w500${item.poster_path}` : '',
          backdrop: item.backdrop_path || '',
          rating: item.vote_average || 0,
          year: parseInt((item.release_date || item.first_air_date || '0').slice(0, 4)) || 0,
          overview: item.overview || '',
          type: item.media_type === 'tv' ? 'tv' : 'movie',
          genres: [],
          hasHindi: checkHindiAvailability(item),
        }))),
      ]);

      setTrendingDay(day);
      setTrendingWeek(week);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="max-w-[1400px] mx-auto py-8">
      <h1 className="text-3xl font-black mb-6 px-4 bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
        🔥 Trending Now
      </h1>
      
      <ContentRow title="📈 Trending Today" items={trendingDay} openDetail={openDetail} icon={Icons.fire} color="red" loading={loading} />
      <ContentRow title="📊 Trending This Week" items={trendingWeek} openDetail={openDetail} icon={Icons.fire} color="orange" loading={loading} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SEARCH PAGE
// ═══════════════════════════════════════════════════════════════

function SearchPage({ query, openDetail }: { query: string; openDetail: (item: MediaItem) => void }) {
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query.trim()) return;
    
    async function search() {
      setLoading(true);
      const data = await searchAll(query);
      setResults(data);
      setLoading(false);
    }
    
    search();
  }, [query]);

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8">
      <h1 className="text-2xl font-black mb-2">
        🔍 Search Results for "<span className="text-red-500">{query}</span>"
      </h1>
      <p className="text-gray-500 text-sm mb-6">Found {results.length} results</p>

      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
          {[...Array(18)].map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {results.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
              {results.map((item, i) => (
                <div key={`${item.id}-${i}`} className="cursor-pointer group" onClick={() => openDetail(item)}>
                  <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-lg">
                    <img 
                      src={item.image || 'https://via.placeholder.com/300x450?text=No+Image'} 
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                      loading="lazy" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
                      <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                        {Icons.play}
                      </div>
                    </div>
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {item.rating > 0 && (
                        <span className="bg-yellow-500/90 text-black text-[10px] font-bold px-1.5 py-0.5 rounded">
                          ★ {item.rating.toFixed(1)}
                        </span>
                      )}
                      <span className="bg-red-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        {item.type === 'movie' ? 'MOVIE' : 'TV'}
                      </span>
                    </div>
                    {item.hasHindi && (
                      <span className="absolute top-2 right-2 bg-green-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        हिंदी
                      </span>
                    )}
                  </div>
                  <h3 className="text-xs font-semibold mt-2 truncate group-hover:text-red-400">
                    {item.title}
                  </h3>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">😕</div>
              <p className="text-xl text-gray-400">No results found for "{query}"</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DETAIL PAGE
// ═══════════════════════════════════════════════════════════════

function DetailPage({ 
  item, 
  openWatch, 
  goBack, 
  openDetail,
  audioLanguage,
  setAudioLanguage 
}: { 
  item: MediaItem; 
  openWatch: (item: MediaItem, season?: number, episode?: number) => void; 
  goBack: () => void; 
  openDetail: (item: MediaItem) => void;
  audioLanguage: 'en' | 'hi' | 'auto';
  setAudioLanguage: (lang: 'en' | 'hi' | 'auto') => void;
}) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [recommendations, setRecommendations] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDetails() {
      setLoading(true);
      
      // Load seasons if TV show
      if (item.type === 'tv' || item.type === 'anime') {
        const tvSeasons = await getTVSeasons(item.tmdbId);
        setSeasons(tvSeasons);
        
        if (tvSeasons.length > 0) {
          const eps = await getSeasonEpisodes(item.tmdbId, tvSeasons[0].season_number);
          setEpisodes(eps);
        }
      }
      
      // Load recommendations
      const recs = await getRecommendations(item.tmdbId, item.type === 'movie' ? 'movie' : 'tv');
      setRecommendations(recs);
      
      setLoading(false);
    }
    
    loadDetails();
  }, [item]);

  const loadSeasonEpisodes = async (seasonNum: number) => {
    setSelectedSeason(seasonNum);
    const eps = await getSeasonEpisodes(item.tmdbId, seasonNum);
    setEpisodes(eps);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading details...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Hero Backdrop */}
      <div className="relative h-[50vh] md:h-[60vh]">
        <img 
          src={item.backdrop || item.image} 
          alt={item.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-black/30" />
        
        <button 
          onClick={goBack} 
          className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/50 hover:bg-black/70 text-white px-4 py-2 rounded-full backdrop-blur-sm transition-all"
        >
          {Icons.back} Back
        </button>

        {/* Language Selector */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-black/50 rounded-full backdrop-blur-sm p-1">
          <button
            onClick={() => setAudioLanguage('auto')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              audioLanguage === 'auto' ? 'bg-red-600 text-white' : 'text-gray-300 hover:text-white'
            }`}
          >
            Auto
          </button>
          <button
            onClick={() => setAudioLanguage('en')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              audioLanguage === 'en' ? 'bg-red-600 text-white' : 'text-gray-300 hover:text-white'
            }`}
          >
            English
          </button>
          <button
            onClick={() => setAudioLanguage('hi')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              audioLanguage === 'hi' ? 'bg-red-600 text-white' : 'text-gray-300 hover:text-white'
            }`}
          >
            हिंदी
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 -mt-48 relative z-10">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Poster */}
          <div className="flex-shrink-0">
            <img 
              src={item.image} 
              alt={item.title}
              className="w-48 md:w-64 rounded-2xl shadow-2xl shadow-black/50 mx-auto md:mx-0"
            />
          </div>

          {/* Info */}
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-black text-white mb-2">{item.title}</h1>
            {item.titleHindi && item.titleHindi !== item.title && (
              <p className="text-green-400 text-lg mb-3">{item.titleHindi}</p>
            )}

            <div className="flex flex-wrap items-center gap-3 mb-4">
              {item.rating > 0 && (
                <span className="flex items-center gap-1 bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-sm font-bold">
                  {Icons.star} {item.rating.toFixed(1)}
                </span>
              )}
              <span className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full text-sm">
                {item.type === 'movie' ? 'Movie' : item.type === 'anime' ? 'Anime' : 'TV Series'}
              </span>
              {item.year > 0 && (
                <span className="bg-white/10 text-gray-300 px-3 py-1 rounded-full text-sm">
                  {item.year}
                </span>
              )}
              {item.hasHindi && (
                <span className="bg-green-600/20 text-green-400 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                  {Icons.volume} Hindi Available
                </span>
              )}
            </div>

            <p className="text-gray-300 text-sm leading-relaxed mb-6 max-w-3xl">{item.overview}</p>

            <div className="flex gap-3">
              <button 
                onClick={() => openWatch(item, selectedSeason, 1)}
                className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold px-8 py-3 rounded-xl transition-all hover:scale-105 shadow-lg shadow-red-600/30"
              >
                {Icons.play} Watch Now
              </button>
            </div>
          </div>
        </div>

        {/* Seasons & Episodes */}
        {(item.type === 'tv' || item.type === 'anime') && seasons.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl font-bold mb-4">📺 Seasons & Episodes</h2>
            
            {/* Season selector */}
            <div className="flex flex-wrap gap-2 mb-4">
              {seasons.map(season => (
                <button
                  key={season.id}
                  onClick={() => loadSeasonEpisodes(season.season_number)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedSeason === season.season_number
                      ? 'bg-red-600 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  Season {season.season_number} ({season.episode_count} ep)
                </button>
              ))}
            </div>

            {/* Episodes grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {episodes.map(ep => (
                <div
                  key={ep.id}
                  onClick={() => openWatch(item, selectedSeason, ep.episode_number)}
                  className="flex gap-3 bg-white/5 hover:bg-white/10 rounded-xl overflow-hidden cursor-pointer transition-all group"
                >
                  <div className="flex-shrink-0 w-32 aspect-video bg-black/30">
                    {ep.still_path ? (
                      <img 
                        src={`${IMG}/w300${ep.still_path}`} 
                        alt={ep.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600">
                        🎬
                      </div>
                    )}
                  </div>
                  <div className="flex-1 p-2 min-w-0">
                    <h4 className="text-sm font-semibold truncate group-hover:text-red-400">
                      E{ep.episode_number}: {ep.name}
                    </h4>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-1">{ep.overview}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="mt-10">
            <ContentRow 
              title="👍 You May Also Like" 
              items={recommendations} 
              openDetail={openDetail} 
              icon={Icons.heart} 
              color="purple" 
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// WATCH PAGE - Video Player with Multiple Sources
// ═══════════════════════════════════════════════════════════════

function WatchPage({ 
  item, 
  season, 
  episode, 
  goBack,
  setSeason,
  setEpisode,
  audioLanguage,
  setAudioLanguage
}: { 
  item: MediaItem; 
  season: number; 
  episode: number; 
  goBack: () => void;
  setSeason: (n: number) => void;
  setEpisode: (n: number) => void;
  audioLanguage: 'en' | 'hi' | 'auto';
  setAudioLanguage: (lang: 'en' | 'hi' | 'auto') => void;
}) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentSource, setCurrentSource] = useState(0);
  const [playerError, setPlayerError] = useState(false);

  // Generate video URLs with multiple sources
  const videoUrls = (() => {
    const urls = [];
    const baseUrls = [
      'https://vidsrc.xyz/embed',
      'https://vidsrc.pro/embed',
      'https://www.2embed.cc/embed',
      'https://autoembed.cc/embed',
    ];

    for (const base of baseUrls) {
      if (item.type === 'movie') {
        urls.push(`${base}/movie/${item.tmdbId}`);
      } else {
        urls.push(`${base}/tv/${item.tmdbId}/${season}/${episode}`);
      }
    }

    // Add language parameter for Hindi
    if (audioLanguage === 'hi') {
      return urls.map(u => u + (u.includes('?') ? '&' : '?') + 'audio=hindi');
    }
    
    return urls;
  })();

  // Load seasons and episodes for TV shows
  useEffect(() => {
    if (item.type === 'tv' || item.type === 'anime') {
      getTVSeasons(item.tmdbId).then(setSeasons);
    }
  }, [item]);

  useEffect(() => {
    if (item.type === 'tv' || item.type === 'anime') {
      getSeasonEpisodes(item.tmdbId, season).then(setEpisodes);
    }
  }, [item, season]);

  const switchSource = () => {
    setCurrentSource((prev) => (prev + 1) % videoUrls.length);
    setPlayerError(false);
  };

  const handlePlayerError = () => {
    setPlayerError(true);
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button 
          onClick={goBack} 
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          {Icons.back} Back
        </button>

        {/* Language selector */}
        <div className="flex items-center gap-2 bg-white/10 rounded-full p-1">
          <button
            onClick={() => setAudioLanguage('auto')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              audioLanguage === 'auto' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Auto
          </button>
          <button
            onClick={() => setAudioLanguage('en')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              audioLanguage === 'en' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            English
          </button>
          <button
            onClick={() => setAudioLanguage('hi')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              audioLanguage === 'hi' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            हिंदी
          </button>
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-2">{item.title}</h1>
      {item.type !== 'movie' && (
        <p className="text-gray-400 text-sm mb-4">
          Season {season} • Episode {episode}
        </p>
      )}

      {/* Video Player */}
      <div className="aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl mb-6 relative">
        {!playerError ? (
          <iframe
            key={currentSource}
            src={videoUrls[currentSource]}
            className="w-full h-full"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            title={item.title}
            onError={handlePlayerError}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-black">
            <div className="text-6xl mb-4">🎬</div>
            <p className="text-xl font-bold text-white mb-2">Player Error</p>
            <p className="text-gray-400 mb-4">Trying another source...</p>
            <button
              onClick={switchSource}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl text-sm font-bold transition-all"
            >
              Switch to Next Source
            </button>
          </div>
        )}

        {/* Source indicator */}
        {!playerError && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            Source {currentSource + 1} of {videoUrls.length}
          </div>
        )}
      </div>

      {/* Episode navigation */}
      {item.type !== 'movie' && (
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => episode > 1 && setEpisode(episode - 1)}
            disabled={episode <= 1}
            className="bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white px-4 py-2 rounded-lg transition-all flex items-center gap-1"
          >
            {Icons.left} Previous
          </button>
          
          <span className="text-gray-400 font-medium">
            Episode {episode} of {episodes.length}
          </span>
          
          <button
            onClick={() => episode < episodes.length && setEpisode(episode + 1)}
            disabled={episode >= episodes.length}
            className="bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white px-4 py-2 rounded-lg transition-all flex items-center gap-1"
          >
            Next {Icons.right}
          </button>
        </div>
      )}

      {/* Season selector for TV shows */}
      {seasons.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-bold mb-3">Seasons</h3>
          <div className="flex flex-wrap gap-2">
            {seasons.map(s => (
              <button
                key={s.id}
                onClick={() => {
                  setSeason(s.season_number);
                  setEpisode(1);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  season === s.season_number
                    ? 'bg-red-600 text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                S{s.season_number}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Episode list */}
      {episodes.length > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-3">All Episodes - Season {season}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {episodes.map(ep => (
              <div
                key={ep.id}
                onClick={() => setEpisode(ep.episode_number)}
                className={`flex gap-3 rounded-xl overflow-hidden cursor-pointer transition-all ${
                  episode === ep.episode_number
                    ? 'bg-red-600/20 ring-1 ring-red-500'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex-shrink-0 w-28 aspect-video bg-black/30">
                  {ep.still_path ? (
                    <img 
                      src={`${IMG}/w300${ep.still_path}`} 
                      alt="" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-2xl">
                      🎬
                    </div>
                  )}
                </div>
                <div className="flex-1 p-2 min-w-0">
                  <h4 className="text-sm font-semibold truncate">
                    E{ep.episode_number}: {ep.name}
                  </h4>
                  <p className="text-xs text-gray-500 line-clamp-2 mt-1">{ep.overview}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Source selector */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={switchSource}
          className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-xl text-sm transition-all"
        >
          Switch Video Source (If not working)
        </button>
      </div>
    </div>
  );
}
