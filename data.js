/* Populate your content here. Times are in seconds.
 * Add `speaker` to tag lines; value can be any string (e.g., "SPEAKER_00", "Agent", "Jeff").
 */
window.APP_DATA = {
  audioSrc: "39472_N_Darner_Dr_2.m4a",

  transcript: [
    { start: 0.00,  end: 3.20,  speaker: "SPEAKER_00", text: "Welcome to the session. Today we’ll cover the overview." },
    { start: 3.20,  end: 8.50,  speaker: "SPEAKER_01", text: "First, the problem statement and the constraints we’re working with." },
    { start: 8.50,  end: 14.10, speaker: "SPEAKER_00", text: "Then, a quick demonstration of the baseline approach." },
    { start: 14.10, end: 20.00, speaker: "SPEAKER_01", text: "We’ll close with Q&A and next steps." }
  ],

  /* Commentary can optionally include speakers too; omit `speaker` if not applicable. */
  commentary: [
    { start: 0.00,  end: 3.20, text: "Hook: sets expectations for the talk." },
    { start: 3.20,  end: 8.50, text: "Clarify constraints: time, data, API limits." },
    { start: 8.50,  end: 14.10,                   text: "Baseline demo; note tradeoffs and metrics." },
    { start: 14.10, end: 20.00,                   text: "Action items + resources." }
  ]
};
