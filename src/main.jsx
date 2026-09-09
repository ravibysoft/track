import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { setupServiceWorker } from "./pwa.js";
import { ExpenseProvider } from "./state/ExpenseProvider.jsx";
import "./styles/global.css";
import "./styles/parts.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <ExpenseProvider>
        <App />
      </ExpenseProvider>
    </ErrorBoundary>
  </StrictMode>,
);

setupServiceWorker();
