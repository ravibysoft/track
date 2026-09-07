import Icon from "./Icon.jsx";

/**
 * The amount keypad. Replaces the system keyboard entirely: bigger targets, no
 * layout shift when it opens, and it can do arithmetic (250 + 80) the way Money
 * Manager's does — handy for splitting a bill or adding up a shop receipt.
 */
const KEYS = [
  ["1", "2", "3", "divide"],
  ["4", "5", "6", "multiply"],
  ["7", "8", "9", "minus"],
  [".", "0", "backspace", "plus"],
];

const OPERATOR_FOR = { divide: "/", multiply: "*", minus: "-", plus: "+" };

export default function Keypad({ onDigit, onDot, onOperator, onBackspace, activeOperator }) {
  const press = (key) => {
    if (key === "backspace") return onBackspace();
    if (key === ".") return onDot();
    if (OPERATOR_FOR[key]) return onOperator(OPERATOR_FOR[key]);
    return onDigit(key);
  };

  return (
    <div className="keypad" role="group" aria-label="Amount keypad">
      {KEYS.flat().map((key) => {
        const operator = OPERATOR_FOR[key];
        const isOperator = Boolean(operator);
        const isActive = isOperator && activeOperator === operator;
        return (
          <button
            key={key}
            type="button"
            className={`keypad__key${isOperator ? " keypad__key--op" : ""}${
              key === "backspace" ? " keypad__key--util" : ""
            }${isActive ? " is-active" : ""}`}
            onClick={() => press(key)}
            aria-label={ariaFor(key)}
            aria-pressed={isOperator ? isActive : undefined}
          >
            {isOperator || key === "backspace" ? <Icon name={key} /> : key}
          </button>
        );
      })}
    </div>
  );
}

function ariaFor(key) {
  switch (key) {
    case "divide":
      return "Divide";
    case "multiply":
      return "Multiply";
    case "minus":
      return "Subtract";
    case "plus":
      return "Add";
    case "backspace":
      return "Delete last digit";
    case ".":
      return "Decimal point";
    default:
      return key;
  }
}
