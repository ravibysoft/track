import { Component } from "react";

/**
 * Without a boundary, one bad render unmounts the entire React tree and the app
 * becomes a blank white screen — no tab bar, no way back, nothing to tap. That is
 * the worst possible failure for an installed app whose only copy of the data
 * lives on the device: the entries are still safely on disk, but there is no UI
 * left to reach them.
 *
 * `scope="screen"` boundaries sit inside the tab host, so a broken screen loses
 * only itself and the tab bar still works. The one in main.jsx is the last resort.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[rozkharcha] render error", error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const perScreen = this.props.scope === "screen";
    return (
      <div className="screen crash">
        <span className="crash__mark">!</span>
        <h2 className="crash__title">
          {perScreen ? "This screen didn’t load" : "Something went wrong"}
        </h2>
        <p className="crash__body">
          Your entries are safe on this device — nothing was lost.
          {perScreen ? " Try again, or switch to another tab." : " Reloading usually clears it."}
        </p>

        <div className="crash__actions">
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--lg"
            onClick={() => window.location.reload()}
          >
            Reload app
          </button>
        </div>

        {/* Kept visible on purpose: offline and with no crash reporting, this line
            is the only clue available when something has to be diagnosed. */}
        <pre className="crash__detail">{String(error?.message || error)}</pre>
      </div>
    );
  }
}
