import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { LazyMotion, domAnimation } from "framer-motion";
import { App } from "./App";
import "./styles/global.css";

/**
 * `LazyMotion` + `domAnimation` instead of importing the full `motion`
 * component tree.
 *
 * This app runs on host-stand tablets, and the brief was explicit that motion
 * must not cost performance there. The full Framer bundle is ~34kB gzipped;
 * `domAnimation` is roughly half that and covers everything this product
 * actually uses — variants, `animate`, `whileHover`, `whileTap`. It leaves out
 * layout animations and drag, neither of which appear anywhere here (the floor
 * plan's drag is hand-written pointer-capture, deliberately, and is faster for
 * it).
 *
 * `strict` is the guard that keeps it that way: with it on, any component that
 * reaches for `motion.div` instead of `m.div` throws immediately in
 * development rather than silently pulling the full bundle back in.
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LazyMotion features={domAnimation} strict>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </LazyMotion>
  </StrictMode>,
);
