import { themeTokensCss } from "../theme/theme-tokens-css";

// Self-contained CSS for the server-rendered metrics page. Kept separate from
// the markup builder so the view module stays focused on structure.
export const metricsPageCss = `${themeTokensCss}
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "IBM Plex Sans", Inter, ui-sans-serif, system-ui, "Segoe UI", sans-serif;
        line-height: 1.5;
        color: var(--text);
        background: var(--body-bg);
        background-attachment: fixed;
      }
      a { color: inherit; }
      .topbar {
        display: flex; align-items: center; justify-content: space-between; gap: 1rem;
        padding: 0.9rem clamp(1rem, 5vw, 3rem);
        border-bottom: 1px solid var(--line);
        background: var(--topbar-bg);
        backdrop-filter: var(--topbar-backdrop);
        position: sticky; top: 0; z-index: 10;
      }
      .brand {
        font-weight: 800; letter-spacing: -0.03em; text-decoration: none;
        font-size: 1.05rem; display: flex; align-items: center; gap: 0.55rem; color: var(--text);
      }
      .brand .mark {
        width: 1.65rem; height: 1.65rem; border-radius: 9px;
        background: var(--mark-bg); display: grid; place-items: center;
        color: var(--mark-color); font-size: 1rem; box-shadow: var(--mark-shadow); flex: 0 0 auto;
      }
      .nav { display: flex; gap: 0.4rem; flex-wrap: wrap; }
      .nav a {
        border: 1px solid transparent; border-radius: 8px;
        padding: 0.4rem 0.8rem; text-decoration: none; color: var(--muted);
        font-size: 0.9rem; font-weight: 600;
      }
      .nav a:hover { color: var(--text); }
      .theme-form { display: inline; }
      .theme-btn {
        border: 1px solid var(--line); border-radius: 8px; background: transparent;
        color: var(--muted); font-size: 1rem; padding: 0.35rem 0.6rem; cursor: pointer;
      }
      .theme-btn:hover { color: var(--accent); border-color: var(--accent-border); }
      .page { width: min(1240px, calc(100% - 2rem)); margin: 0 auto; padding: 1.75rem 0 4rem; }
      .hero {
        display: flex; flex-wrap: wrap; align-items: flex-end; gap: 1rem; margin-bottom: 1.5rem;
      }
      .hero h1 { margin: 0.4rem 0 0; font-size: clamp(1.8rem, 4vw, 2.8rem); letter-spacing: -0.04em; }
      .hero p { margin: 0.5rem 0 0; color: var(--muted); max-width: 620px; }
      .pill {
        display: inline-flex; align-items: center; gap: 0.4rem; border-radius: 999px;
        padding: 0.25rem 0.7rem; background: var(--accent-soft); color: var(--accent);
        font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
      }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; }
      .card {
        position: relative; overflow: hidden;
        border: 1px solid var(--line); border-radius: 16px; background: var(--panel);
        padding: 1.1rem 1.2rem; box-shadow: var(--shadow);
      }
      .card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 4px; }
      .card h2 { margin: 0.15rem 0 0.85rem; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
      .card h3 { margin-top: 0; color: var(--text); }
      .metric { font-size: 2rem; font-weight: 800; letter-spacing: -0.04em; font-family: "IBM Plex Mono", ui-monospace, monospace; color: var(--text); }
      .muted { color: var(--muted); }
      .section { margin-top: 1rem; }
      .bar-list { display: grid; gap: 0.85rem; }
      .bar-row { display: grid; gap: 0.35rem; }
      .bar-label { display: flex; justify-content: space-between; gap: 1rem; font-weight: 700; font-size: 0.9rem; color: var(--text); }
      .bar-track { overflow: hidden; height: 0.85rem; border-radius: 999px; background: var(--line); }
      .bar-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--teal), var(--blue)); }
      .links { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1rem; }
      .button {
        border: 1px solid var(--line); border-radius: 10px; padding: 0.75rem 1rem;
        background: var(--panel); color: var(--text); font-weight: 800;
        text-decoration: none; font-size: 0.95rem;
      }
      .button:hover { border-color: var(--accent-border); color: var(--accent); }
      .bottom-nav { display: none; }
      @media (max-width: 640px) {
        .topbar .nav { display: none; }
        .topbar { padding-top: 0.6rem; padding-bottom: 0.6rem; }
        .bottom-nav {
          display: flex; justify-content: space-around; align-items: stretch;
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 20;
          background: var(--topbar-bg); backdrop-filter: var(--topbar-backdrop);
          border-top: 1px solid var(--line); padding-bottom: env(safe-area-inset-bottom);
        }
        .bottom-nav a {
          flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 0.2rem; min-height: 52px; padding: 0.4rem 0.25rem; text-decoration: none;
          color: var(--muted); font-size: 0.72rem; font-weight: 600;
          border-top: 2px solid transparent; white-space: nowrap;
        }
        .bottom-nav a span[aria-hidden] { font-size: 1.25rem; line-height: 1; }
        .bottom-nav a:hover { color: var(--text); }
        .bottom-nav a.active {
          color: var(--nav-active-color); border-top-color: var(--accent); background: var(--accent-soft);
        }
        .page { padding-bottom: 5rem; }
      }`;
