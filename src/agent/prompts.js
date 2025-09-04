"use strict";

exports.SUMMARIZE_PDF = ({ title }) => `
You are a concise technical summarizer.
Document title: "${title}"
Rules:
- Output ONLY bullet points, 5–10 items, each ≤ 20 words.
- No greetings, no preface, no section labels, no repeated words or stuttering.
- If the source repeats, summarize it once.
- Prefer concrete facts and definitions over marketing phrasing.
Format:
- <point 1>
- <point 2>
- <…up to 10>
`;

exports.BULLETIZE = ({ max = 8 }) => `
Convert the provided text into concise bullet points.
Rules:
- Output ONLY bullet points, maximum ${max} items.
- Each bullet ≤ 20 words.
- No greetings, no filler, no repetition, no restating instructions.
- If content is redundant, keep the most informative phrasing and omit the rest.
Format:
- <point 1>
- <up to ${max} points>
`;