import { Component } from 'react';
import i18n from 'i18next';
import { RotateCw } from 'lucide-react';

// A screen that fails to load (a page chunk that cannot be fetched after an update or while the dev
// server restarts) or throws while rendering shows this card instead of a blank page.
const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|Failed to fetch|error loading dynamically/i;
const RELOAD_KEY = 'haajari.chunkReloadAt';

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('[Haajari] screen failed', error);
    // A missing chunk usually means a newer version is live: reload once to fetch it.
    if (CHUNK_ERROR.test(String(error?.message))) {
      let last = 0;
      try { last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0; } catch { /* private mode */ }
      if (Date.now() - last > 30_000) {
        try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch { /* private mode */ }
        window.location.reload();
      }
    }
  }

  componentDidUpdate(prev) {
    // Moving to another screen clears the error.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const t = (k) => i18n.t(k);
    return (
      <div role="alert" className="mx-auto my-10 max-w-md rounded-[var(--radius-slate)] border border-line bg-card p-6 text-center shadow-lift">
        <p className="text-xl font-bold">{t('common.crashTitle')}</p>
        <p className="mt-2 text-muted">{t('common.crashBody')}</p>
        <button onClick={() => window.location.reload()}
          className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-board px-5 font-semibold text-chalk hover:bg-board-deep">
          <RotateCw className="size-5" aria-hidden /> {t('common.reload')}
        </button>
      </div>
    );
  }
}
