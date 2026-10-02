/**
 * greetings.js
 *
 * Warm, varied opening lines Therapyxai uses to start every session.
 * The AI picks one at random so repeat users don't see the same opener.
 * Keep them short, non-clinical, and human-feeling.
 */

const GREETINGS = [
  "Hey, I'm glad you're here. What's on your mind today?",
  "Hi there 🌿 Take a breath, this is your space. How are you feeling?",
  "Hello! I'm here and I'm listening. What would you like to talk about?",
  "Hey! Good to see you. How's your heart doing today?",
  "Hi 😊 No rush at all. Whenever you're ready, tell me what's going on.",
  "Hello, friend. I'm all yours. What's been weighing on you lately?",
  "Hey there. This is a safe, judgment-free space. How are things?",
  "Hi! I'm Therapyxai, and I'm here for you. What brings you in today?",
  "Hello 🌸 I'm listening closely. Tell me, how are you really doing?",
  "Hey, welcome. Sometimes just talking helps. What's on your mind?",
];

/**
 * Returns a random greeting string.
 * @returns {string}
 */
export function pickGreeting() {
  return GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
}
