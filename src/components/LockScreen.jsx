import { useCallback, useEffect, useRef, useState } from "react";
import { PIN_LENGTH, cooldownLeft, verifyBiometric, verifyPin } from "../lib/lock.js";
import Icon from "./Icon.jsx";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "bio", "0", "back"];

/**
 * Covers the whole app until the PIN (or a fingerprint) is given.
 *
 * A keypad of its own rather than the phone keyboard: a PIN pad in the same
 * place every time is quicker to hit by thumb, and it keeps the digits off the
 * keyboard's suggestion strip.
 */
export default function LockScreen({ biometric, onUnlock }) {
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");
  const [shake, setShake] = useState(false);
  const [wait, setWait] = useState(() => cooldownLeft());
  const [forgot, setForgot] = useState(false);
  const checking = useRef(false);
  const asked = useRef(false);

  const tryBiometric = useCallback(async () => {
    if (await verifyBiometric()) onUnlock();
  }, [onUnlock]);

  /* Offer the fingerprint straight away — that is the whole point of turning
     it on — but only once, so cancelling it does not bring it straight back. */
  useEffect(() => {
    if (!biometric || asked.current) return;
    asked.current = true;
    tryBiometric();
  }, [biometric, tryBiometric]);

  /* The cool-down counts down on screen, so a locked-out person can see it end. */
  useEffect(() => {
    if (!wait) return undefined;
    const timer = setInterval(() => {
      const left = cooldownLeft();
      setWait(left);
      if (!left) setMessage("");
    }, 500);
    return () => clearInterval(timer);
  }, [wait]);

  const submit = async (value) => {
    checking.current = true;
    const result = await verifyPin(value);
    checking.current = false;
    if (result.ok) {
      onUnlock();
      return;
    }
    setPin("");
    setShake(true);
    setTimeout(() => setShake(false), 420);
    if (result.cooldown) {
      setWait(result.cooldown);
      setMessage("Too many wrong tries.");
    } else {
      setMessage(
        result.left === 1 ? "Wrong PIN — 1 try left before a short wait" : `Wrong PIN — ${result.left} tries left`,
      );
    }
  };

  const press = (key) => {
    if (wait || checking.current) return;
    if (key === "bio") {
      tryBiometric();
      return;
    }
    if (key === "back") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    const next = (pin + key).slice(0, PIN_LENGTH);
    setPin(next);
    setMessage("");
    if (next.length === PIN_LENGTH) submit(next);
  };

  /* A hardware keyboard works too — handy in the browser. */
  useEffect(() => {
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("back");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const seconds = Math.ceil(wait / 1000);

  return (
    <div className="lock" role="dialog" aria-modal="true" aria-label="Unlock Roz Kharcha">
      <div className="lock__top">
        <span className="lock__badge">
          <Icon name="lock" size={22} />
        </span>
        <h1 className="lock__title">Enter your PIN</h1>
        <p className="lock__msg" aria-live="polite">
          {wait ? `${message} Try again in ${seconds}s.` : message || " "}
        </p>
      </div>

      <div className={`lock__dots${shake ? " is-shaking" : ""}`} aria-label={`${pin.length} of ${PIN_LENGTH} digits entered`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} className={`lock__dot${i < pin.length ? " is-filled" : ""}`} />
        ))}
      </div>

      <div className="lock__pad">
        {KEYS.map((key) => {
          if (key === "bio" && !biometric) return <span key={key} />;
          return (
            <button
              key={key}
              type="button"
              className={`lock__key${key === "bio" || key === "back" ? " lock__key--tool" : ""}`}
              onClick={() => press(key)}
              disabled={!!wait}
              aria-label={key === "bio" ? "Use fingerprint" : key === "back" ? "Delete" : key}
            >
              {key === "bio" ? (
                <Icon name="fingerprint" size={26} />
              ) : key === "back" ? (
                <Icon name="backspace" size={24} />
              ) : (
                key
              )}
            </button>
          );
        })}
      </div>

      <button type="button" className="lock__forgot" onClick={() => setForgot((f) => !f)}>
        Forgot your PIN?
      </button>
      {/* There is no account to reset it from, so the honest answer is the only
          one — but the daily copies mean it is not the end of the data. */}
      {forgot && (
        <p className="lock__help">
          There&rsquo;s no account to reset it from. Clearing the app&rsquo;s data in
          Android settings removes the lock — and your entries with it. Your daily
          copies in <strong>Documents/ExpenseTracker</strong> stay, so you can restore
          them afterwards from the Backup tab.
        </p>
      )}
    </div>
  );
}
