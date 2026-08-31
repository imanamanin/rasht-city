import { createRoot } from "react-dom/client";
import RashtTimeline from "./RashtTimeline.jsx";
import "./timeline.css";

function mount() {
  const el = document.getElementById("rasht-timeline-root");
  if (!el || el.dataset.mounted === "1") return;
  el.dataset.mounted = "1";
  createRoot(el).render(<RashtTimeline />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}
