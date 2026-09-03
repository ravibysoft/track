import { useState } from "react";
import Icon from "./Icon.jsx";

const DISMISS_KEY = "rozkharcha.installDismissed";

function alreadyDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    // Private browsing can throw on access — treat it as "not dismissed".
    return false;
  }
}

/**
 * Home-screen nudge to install the PWA. Shows only when the browser has actually
 * offered an install, and stays gone once dismissed.
 */
export default function InstallCard({ onInstall }) {
  const [hidden, setHidden] = useState(alreadyDismissed);

  if (hidden) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* nothing to remember it with — hide for this session only */
    }
    setHidden(true);
  };

  return (
    <div className="install-card card">
      <img className="install-card__icon" src="/icons/icon-192.png" alt="" width="44" height="44" />
      <div className="grow">
        <p className="install-card__title">Install Roz Kharcha</p>
        <p className="install-card__text">Add it to your home screen — opens instantly, works offline.</p>
      </div>
      <div className="install-card__actions">
        <button type="button" className="icon-btn" onClick={dismiss} aria-label="Not now">
          <Icon name="close" />
        </button>
        <button type="button" className="btn btn--primary install-card__cta" onClick={onInstall}>
          Install
        </button>
      </div>
    </div>
  );
}
