import { useEffect, useState } from "react";
import {
  PIN_LENGTH,
  biometricAvailable,
  clearLock,
  isValidPin,
  lockStatus,
  setBiometric,
  setPin,
  verifyPin,
} from "../lib/lock.js";
import Sheet from "./Sheet.jsx";

/**
 * Turn the lock on, change the PIN, add a fingerprint, or turn it off.
 *
 * Changing or removing the lock asks for the current PIN first. Without that,
 * the lock only stops people who do not think to open Settings — which is the
 * one screen anyone holding an unlocked phone would try.
 */
export default function LockSheet({ onClose, onToast }) {
  const [status, setStatus] = useState(lockStatus);
  // "idle" | "verify:change" | "verify:off" | "new" | "confirm"
  const [stage, setStage] = useState(status.on ? "idle" : "new");
  const [value, setValue] = useState("");
  const [first, setFirst] = useState("");
  const [error, setError] = useState("");
  const [bioReady, setBioReady] = useState(false);

  useEffect(() => {
    let alive = true;
    biometricAvailable().then((ok) => alive && setBioReady(ok));
    return () => {
      alive = false;
    };
  }, []);

  const refresh = () => setStatus(lockStatus());

  const step = async () => {
    setError("");
    if (!isValidPin(value)) {
      setError(`Enter ${PIN_LENGTH} digits.`);
      return;
    }

    if (stage === "verify:change" || stage === "verify:off") {
      const result = await verifyPin(value);
      setValue("");
      if (!result.ok) {
        setError(result.cooldown ? "Too many wrong tries — wait a moment." : "That isn't your current PIN.");
        return;
      }
      if (stage === "verify:off") {
        clearLock();
        refresh();
        onToast("App lock turned off");
        onClose();
        return;
      }
      setStage("new");
      return;
    }

    if (stage === "new") {
      setFirst(value);
      setValue("");
      setStage("confirm");
      return;
    }

    if (stage === "confirm") {
      if (value !== first) {
        setError("Those didn't match. Start again.");
        setValue("");
        setFirst("");
        setStage("new");
        return;
      }
      await setPin(value, { biometric: status.biometric });
      refresh();
      onToast(status.on ? "PIN changed" : "App lock on");
      setValue("");
      setStage("idle");
    }
  };

  const prompt = {
    "verify:change": "Enter your current PIN",
    "verify:off": "Enter your PIN to turn the lock off",
    new: status.on ? "Choose a new PIN" : `Choose a ${PIN_LENGTH}-digit PIN`,
    confirm: "Enter it once more",
  }[stage];

  return (
    <Sheet
      title="App lock"
      onClose={onClose}
      footer={
        stage === "idle"
          ? null
          : () => (
              <button
                type="button"
                className="btn btn--primary btn--lg btn--block"
                disabled={value.length !== PIN_LENGTH}
                onClick={step}
              >
                {stage === "confirm" ? "Set PIN" : "Continue"}
              </button>
            )
      }
    >
      {stage === "idle" ? (
        <div className="stack">
          <p className="sheet__note">
            Roz Kharcha asks for your PIN when it opens, and again after it has been in
            the background for a minute.
          </p>

          {bioReady && (
            <div className="setting-row">
              <span className="grow setting-row__text">
                <span className="setting-row__label">Unlock with fingerprint</span>
                <span className="setting-row__hint">Your PIN still works as a fallback</span>
              </span>
              <button
                type="button"
                className={`toggle${status.biometric ? " is-on" : ""}`}
                role="switch"
                aria-checked={status.biometric}
                aria-label="Unlock with fingerprint"
                onClick={() => {
                  setBiometric(!status.biometric);
                  refresh();
                }}
              >
                <span className="toggle__knob" />
              </button>
            </div>
          )}

          <button type="button" className="btn btn--ghost btn--block" onClick={() => setStage("verify:change")}>
            Change PIN
          </button>
          <button type="button" className="btn btn--danger btn--block" onClick={() => setStage("verify:off")}>
            Turn off app lock
          </button>
        </div>
      ) : (
        <>
          {!status.on && stage === "new" && (
            <p className="sheet__note">
              There&rsquo;s no account to recover a forgotten PIN from, so pick one you
              won&rsquo;t forget. Your daily backup copies are the safety net.
            </p>
          )}
          <label className="field">
            <span className="field__label">{prompt}</span>
            <input
              className="input pin-input num"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={PIN_LENGTH}
              value={value}
              autoFocus
              aria-label={prompt}
              onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && value.length === PIN_LENGTH) step();
              }}
            />
          </label>
          {error && <p className="pin-error" role="alert">{error}</p>}
        </>
      )}
    </Sheet>
  );
}
