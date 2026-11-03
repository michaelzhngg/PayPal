"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

// Honour the OS "reduce motion" setting for every landing animation.
export default function LandingMotion({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
