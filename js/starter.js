// starter.js — your plan, written as data. Only used when you tap
// "Load my starter habits" on an empty app, so edit it freely.
// Weekday numbers: 0 = Sun, 1 = Mon ... 6 = Sat.
// Got the Saturday morning shift? Edit the habit in the app and change Saturday's time.
// 'time' habits log when you did it: tap once when you're up, or set the time yourself.

const WAKE = { 1: '06:30', 2: '06:30', 3: '06:30', 4: '06:30', 5: '06:30', 6: '07:30', 0: '07:30' };

export const STARTER_HABITS = [
  { name: 'Wake up on time', emoji: '⏰', color: 'amber', type: 'time', schedule: { kind: 'daily' }, times: WAKE, weight: 3, difficulty: 3 },
  { name: 'Gym', emoji: '🏋️', color: 'red', type: 'check', schedule: { kind: 'weekly', perWeek: 4 }, weight: 3, difficulty: 3 },
  { name: 'Eat 3,300 kcal', emoji: '🍽️', color: 'green', type: 'amount', target: 3300, unit: 'kcal', schedule: { kind: 'daily' }, weight: 2, difficulty: 2 },
  { name: 'Protein shake', emoji: '🥤', color: 'blue', type: 'check', schedule: { kind: 'daily' }, weight: 1, difficulty: 1 },
  { name: 'Dishes after meals', emoji: '🧽', color: 'teal', type: 'count', target: 3, unit: 'meals', schedule: { kind: 'daily' }, weight: 1, difficulty: 2 },
  { name: '10-minute tidy', emoji: '🧹', color: 'violet', type: 'check', schedule: { kind: 'daily' }, weight: 1, difficulty: 1 },
];
