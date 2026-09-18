import { useState } from "react";
import { APP_NAME, cleanName } from "../lib/db.js";
import { CURRENCIES, formatMoney, parseAmount } from "../lib/money.js";
import Icon from "./Icon.jsx";

const BUDGETS = [10000, 20000, 30000, 50000];

/**
 * The first thing a new install shows: a name, a currency, a budget.
 *
 * Every step can be skipped, and so can the whole thing — setup that stands
 * between someone and the app they just opened is how apps get uninstalled. The
 * three answers are exactly the settings that change what Home says on day one;
 * everything else can wait until it is wanted.
 */
export default function WelcomeScreen({ onDone }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("₹");
  const [budgetText, setBudgetText] = useState("");

  const budget = parseAmount(budgetText) ?? 0;

  const finish = (withBudget = true) =>
    onDone({
      name: cleanName(name) ?? APP_NAME,
      currency,
      monthlyBudget: withBudget && budget > 0 ? budget : 0,
    });

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-label="Set up Roz Kharcha">
      <div className="welcome__progress" aria-hidden="true">
        <span className={`welcome__pip${step >= 0 ? " is-on" : ""}`} />
        <span className={`welcome__pip${step >= 1 ? " is-on" : ""}`} />
      </div>

      {step === 0 ? (
        <div className="welcome__step" key="you">
          <span className="welcome__badge">
            <Icon name="wallet" size={28} />
          </span>
          <h1 className="welcome__title">Welcome to Roz Kharcha</h1>
          <p className="welcome__lead">
            Track what you spend each day. Everything stays on this phone — no
            account, no internet.
          </p>

          <label className="welcome__field">
            <span className="field__label">What should we call you?</span>
            <input
              className="input"
              type="text"
              value={name}
              maxLength={24}
              enterKeyHint="next"
              placeholder="Your name (optional)"
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <div className="welcome__field">
            <span className="field__label">Your currency</span>
            <div className="welcome__currencies">
              {CURRENCIES.map((c) => (
                <button
                  key={c.symbol}
                  type="button"
                  className={`welcome__opt${currency === c.symbol ? " is-active" : ""}`}
                  aria-pressed={currency === c.symbol}
                  onClick={() => setCurrency(c.symbol)}
                  title={c.label}
                >
                  {c.symbol.trim()}
                </button>
              ))}
            </div>
          </div>

          <div className="welcome__actions">
            <button type="button" className="btn btn--primary btn--lg btn--block" onClick={() => setStep(1)}>
              Next
            </button>
            <button type="button" className="welcome__skip" onClick={() => finish(false)}>
              Skip setup
            </button>
          </div>
        </div>
      ) : (
        <div className="welcome__step" key="budget">
          <span className="welcome__badge">
            <Icon name="target" size={28} />
          </span>
          <h1 className="welcome__title">A monthly budget?</h1>
          <p className="welcome__lead">
            Home shows how much is left and warns you at 80%. You can change it — or
            set one later — in Settings.
          </p>

          <div className="amount-input">
            <span className="amount-input__symbol">{currency.trim()}</span>
            <input
              className="amount-input__field num"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={budgetText}
              maxLength={10}
              aria-label="Monthly budget"
              onChange={(e) => setBudgetText(e.target.value.replace(/[^0-9.]/g, ""))}
            />
          </div>

          <div className="welcome__presets">
            {BUDGETS.map((b) => (
              <button
                key={b}
                type="button"
                className={`welcome__opt welcome__opt--wide${budget === b ? " is-active" : ""}`}
                aria-pressed={budget === b}
                onClick={() => setBudgetText(String(b))}
              >
                {formatMoney(b, currency)}
              </button>
            ))}
          </div>

          <div className="welcome__actions">
            <button
              type="button"
              className="btn btn--primary btn--lg btn--block"
              onClick={() => finish(true)}
            >
              {budget > 0 ? "Start tracking" : "Start without a budget"}
            </button>
            <button type="button" className="welcome__skip" onClick={() => setStep(0)}>
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
