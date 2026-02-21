/**
 * GSAP animation utilities for Glyte landing page.
 * Usage: import in client components, call in useGSAP hooks.
 */

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

/**
 * Fade-in + slide-up animation triggered on scroll.
 */
export function scrollFadeIn(
  element: HTMLElement,
  options?: { delay?: number; y?: number; duration?: number; start?: string }
) {
  return gsap.from(element, {
    opacity: 0,
    y: options?.y ?? 30,
    duration: options?.duration ?? 0.6,
    ease: "power2.out",
    delay: options?.delay ?? 0,
    scrollTrigger: {
      trigger: element,
      start: options?.start ?? "top 85%",
    },
  });
}

/**
 * Stagger animation for a list of elements.
 */
export function scrollStagger(
  elements: HTMLElement[],
  trigger: HTMLElement,
  options?: { stagger?: number; y?: number; duration?: number }
) {
  return gsap.from(elements, {
    opacity: 0,
    y: options?.y ?? 60,
    duration: options?.duration ?? 0.7,
    ease: "power3.out",
    stagger: options?.stagger ?? 0.12,
    scrollTrigger: {
      trigger,
      start: "top 85%",
    },
  });
}

/**
 * Animated counter (e.g., GitHub stars).
 * Mutates element.textContent during animation.
 */
export function animatedCounter(
  element: HTMLElement,
  target: number,
  options?: { duration?: number; prefix?: string; suffix?: string }
) {
  const counter = { value: 0 };
  const prefix = options?.prefix ?? "";
  const suffix = options?.suffix ?? "";
  const fmt = new Intl.NumberFormat("en-US");

  return gsap.to(counter, {
    value: target,
    duration: options?.duration ?? 1.5,
    ease: "power1.inOut",
    snap: { value: 1 },
    onStart: () => {
      element.textContent = `${prefix}0${suffix}`;
    },
    onUpdate: () => {
      element.textContent = `${prefix}${fmt.format(Math.round(counter.value))}${suffix}`;
    },
    scrollTrigger: {
      trigger: element,
      start: "top 85%",
    },
  });
}
