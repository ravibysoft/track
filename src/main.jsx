import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ExpenseProvider } from "./state/ExpenseProvider.jsx";
import "./styles/global.css";
import "./styles/parts.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ExpenseProvider>
      <App />
    </ExpenseProvider>
  </StrictMode>,
);
