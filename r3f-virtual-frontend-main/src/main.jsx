import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { Provider } from "react-redux";
import { store } from "./redux/store";
import ErrorBoundary from "./components/ErrorBoundary";
import posthog from "posthog-js";

posthog.init(import.meta.env.VITE_POSTHOG_KEY ?? "", {
  api_host:        "https://app.posthog.com",
  person_profiles: "identified_only",
  capture_pageview: true,
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <App />
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>
);
