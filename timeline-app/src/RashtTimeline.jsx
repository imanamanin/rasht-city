import { useEffect, useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { TIMELINE_EVENTS } from "./events.js";
import { useMediaQuery } from "./useMediaQuery.js";

function TimelineCard({ event, index, axis }) {
  const reduce = useReducedMotion();
  const isHorizontal = axis === "x";

  const initial = reduce
    ? false
    : isHorizontal
      ? { opacity: 0, y: 28, scale: 0.97 }
      : { opacity: 0, y: 36 };

  return (
    <motion.article
      className="rtl-card"
      initial={initial}
      whileInView={reduce ? undefined : { opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.35, margin: isHorizontal ? "0px -8% 0px -8%" : "-8% 0px" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: Math.min(index * 0.04, 0.2) }}
      whileHover={reduce ? undefined : { y: isHorizontal ? -6 : -4 }}
    >
      <div className="rtl-card-index" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </div>
      <div className="rtl-card-years">
        <span className="rtl-year-fa">{event.yearFa}</span>
        <span className="rtl-year-en" lang="en" dir="ltr">
          {event.yearEn}
        </span>
      </div>
      <span className="rtl-tag">{event.tag}</span>
      <h3 className="rtl-card-title">{event.title}</h3>
      <p className="rtl-card-summary">{event.summary}</p>
    </motion.article>
  );
}

function ParallaxLayer({ scrollProgress, reduce }) {
  const ySlow = useTransform(scrollProgress, [0, 1], reduce ? [0, 0] : [0, -120]);
  const yMid = useTransform(scrollProgress, [0, 1], reduce ? [0, 0] : [40, -80]);
  const xDrift = useTransform(scrollProgress, [0, 1], reduce ? [0, 0] : [0, 60]);
  const opacity = useTransform(scrollProgress, [0, 0.15, 0.85, 1], [0.35, 0.7, 0.7, 0.3]);

  return (
    <div className="rtl-parallax" aria-hidden="true">
      <motion.div className="rtl-orb rtl-orb-a" style={{ y: ySlow, opacity }} />
      <motion.div className="rtl-orb rtl-orb-b" style={{ y: yMid, x: xDrift, opacity }} />
      <motion.div className="rtl-grid-fade" style={{ opacity }} />
    </div>
  );
}

export default function RashtTimeline() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const reduce = useReducedMotion();
  const sectionRef = useRef(null);
  const trackRef = useRef(null);
  const axis = isMobile ? "y" : "x";

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const { scrollXProgress } = useScroll({
    container: trackRef,
    axis: "x",
  });

  useEffect(() => {
    if (isMobile) return undefined;
    const el = trackRef.current;
    if (!el) return undefined;
    const onWheel = (event) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      el.scrollBy({ left: -event.deltaY, behavior: "auto" });
      event.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [isMobile]);

  const progress = isMobile ? scrollYProgress : scrollXProgress;
  const lineScale = useTransform(progress, [0, 1], [0.08, 1]);

  return (
    <section
      ref={sectionRef}
      className={`rtl-root rtl-axis-${axis}`}
      aria-labelledby="rtl-title"
      dir="rtl"
    >
      <ParallaxLayer scrollProgress={scrollYProgress} reduce={reduce} />

      <header className="rtl-head">
        <p className="rtl-eyebrow">حافظهٔ شهری</p>
        <h2 id="rtl-title" className="rtl-title">
          خط زمان رشت
        </h2>
        <p className="rtl-sub">
          از بلدیه و نهضت جنگل تا کتابخانهٔ ملی — نقاط عطفی که چهرهٔ شهر را ساختند.
          {isMobile ? " به‌صورت عمودی ورق بزنید." : " افقی بکشید یا اسکرول کنید."}
        </p>
        <div className="rtl-progress" aria-hidden="true">
          <motion.span className="rtl-progress-fill" style={{ scaleX: lineScale }} />
        </div>
      </header>

      <div
        ref={trackRef}
        className="rtl-track"
        tabIndex={0}
        role="list"
        aria-label="رویدادهای کلیدی تاریخ رشت"
      >
        <div className="rtl-rail" aria-hidden="true" />
        {TIMELINE_EVENTS.map((event, index) => (
          <div key={event.id} className="rtl-item" role="listitem">
            <span className="rtl-node" aria-hidden="true" />
            <TimelineCard event={event} index={index} axis={axis} />
          </div>
        ))}
      </div>
    </section>
  );
}
