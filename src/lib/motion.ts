/** Reusable motion tokens — keep timing consistent across the product. */
export const ease = {
  out: [0.22, 1, 0.36, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
};

export const duration = { fast: 0.14, base: 0.24, slow: 0.52, cinematic: 0.9 };

export const spring = {
  snappy: { type: "spring" as const, stiffness: 420, damping: 32, mass: 0.7 },
  soft: { type: "spring" as const, stiffness: 160, damping: 22 },
  float: { type: "spring" as const, stiffness: 60, damping: 18 },
};

export const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: duration.slow, ease: ease.out } },
};

export const stagger = (step = 0.08, delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } },
});

export const viewportOnce = { once: true, amount: 0.3 } as const;
