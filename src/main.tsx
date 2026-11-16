import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./app/App";
import "./app/styles.css";
import "./shared/viewTransition.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);

// 调试：?debug=1 时把布局尺寸写进 title，便于无头浏览器读取
if (new URLSearchParams(window.location.search).has("debug")) {
  window.setTimeout(() => {
    const main = document.querySelector("main");
    const wrap = main?.firstElementChild as HTMLElement | null;
    document.title = JSON.stringify({
      win: [window.innerWidth, window.innerHeight],
      doc: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      main: main ? [main.clientWidth, main.clientHeight, main.scrollHeight] : null,
      wrap: wrap ? [wrap.clientWidth, wrap.clientHeight] : null,
      aside: document.querySelector("aside")?.clientWidth ?? null,
    });
  }, 900);
}
