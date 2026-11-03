import type { Variants } from "framer-motion";

// Landing content must be readable without JavaScript, in link previews and in
// full-page screenshots. The "hidden" state therefore never sets opacity: it
// only offsets position slightly, so content is visible in the server HTML and
// motion is an enhancement on top. MotionConfig reducedMotion="user" (see
// LandingMotion) drops the offset for people who ask for reduced motion.

export const revealGroup: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

export const revealItem: Variants = {
  hidden: { y: 16 },
  visible: { y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export const revealViewport = { once: true, margin: "-60px" } as const;
