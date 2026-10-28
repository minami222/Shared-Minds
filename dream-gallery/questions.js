// Fixed question banks, picked at random. Each item: question + neutral grey hint.
// Rules: no new facts, offer the range, hints are optional.

export const QUESTIONS = {
  // Step 1: always first
  opening: [
    { q: 'What happened in your dream?', hint: 'I remember…' }
  ],

  // Not used in the flow for now (kept for later)
  gap: [
    { q: 'Were you alone, or with someone?', hint: 'Alone, or with…' },
    { q: 'Did you know the place, or was it new?', hint: 'The place felt…' },
    { q: 'Day, night, or hard to tell?', hint: 'The time felt like…' },
    { q: 'How did it begin?', hint: 'It started with…' },
    { q: 'How did it end?', hint: 'The last thing I remember…' }
  ],

  // Step 2, left door: senses
  scene: [
    { q: 'What could you see around you?', hint: 'What I could see was…' },
    { q: 'What was the light like?', hint: 'The light was…' },
    { q: 'What could you hear?', hint: 'I could hear…' },
    { q: 'Is there one object you remember?', hint: 'There was…' },
    { q: 'Did things feel big, or small?', hint: 'Things felt…' }
  ],

  // Step 2, right door: feeling
  feeling: [
    { q: 'Calm, uneasy, or something else?', hint: 'It felt…' },
    { q: 'Did it feel heavy, or light?', hint: 'It felt…' },
    { q: 'Warm, or cold?', hint: 'It felt…' },
    { q: 'If the feeling were a colour, what would it be?', hint: 'A colour like…' },
    { q: 'Was there something you wanted?', hint: 'I wanted…' }
  ],

  // Step 3: design elements, for abstraction
  element: [
    { q: 'Were there sharp moments, or soft ones?', hint: 'The moments felt…' },
    { q: 'Did it feel open, or closed in?', hint: 'The space felt…' },
    { q: 'Was it bright, or dark?', hint: 'It was…' },
    { q: 'Smooth, or rough?', hint: 'It felt…' },
    { q: 'Still, or rushing?', hint: 'It moved…' }
  ]
};

// Random pick, avoiding the one currently shown (for "Ask another")
export function pickQuestion(type, current = null) {
  const pool = QUESTIONS[type].filter((item) => item !== current);
  const list = pool.length ? pool : QUESTIONS[type];
  return list[Math.floor(Math.random() * list.length)];
}
