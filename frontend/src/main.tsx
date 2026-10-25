import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import { applyEffectsPreference } from "./hooks/useEffectsPreference";
import "./index.css";

applyEffectsPreference();

const root = document.getElementById("root");
if (!root) throw new Error("Falta el elemento #root");

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
