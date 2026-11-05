import { Transition, TargetAndTransition } from 'framer-motion';

// -----------------------------------------------------------------------------
// APPLE HUMAN INTERFACE GUIDELINES (HIG) - FLUID SPRING PHYSICS
// -----------------------------------------------------------------------------

/**
 * Apple Quick Snap: used for button presses, icon hops, small pills
 */
export const appleSpringQuick: Transition = {
  type: 'spring',
  mass: 0.8,
  stiffness: 260,
  damping: 25,
};

/**
 * Apple Modal & Sheet Expansion: used for bottom sheets, dialogs, fullscreen overlays
 */
export const appleSpringModal: Transition = {
  type: 'spring',
  mass: 1,
  stiffness: 180,
  damping: 24,
};

/**
 * Apple Dynamic Island: snappy organic expansion with subtle restitution
 */
export const appleSpringIsland: Transition = {
  type: 'spring',
  mass: 0.8,
  stiffness: 350,
  damping: 26,
};

/**
 * Apple Watch Odometer: rolling counter physics
 */
export const appleSpringOdometer: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 28,
};

/**
 * iOS Dialpad Tap Scale Feedback
 */
export const appleTapDialpad: TargetAndTransition = {
  scale: 0.92,
  filter: 'brightness(1.25)',
  transition: { duration: 0.08, ease: [0.2, 0, 0, 1] },
};

/**
 * iOS Button Tap Scale Feedback
 */
export const appleTapButton: TargetAndTransition = {
  scale: 0.96,
  transition: { duration: 0.1, ease: [0.2, 0, 0, 1] },
};

