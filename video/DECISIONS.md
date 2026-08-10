# RecallGraph video decisions

## Voice

**Recommendation:** Microsoft Edge TTS `en-US-AndrewNeural` at `+5%` rate.

**Rationale:** A composed US English technical voice fits the incident-response story and the user's provider choice.

**Override:** Change `VOICE` or `RATE` in `video/generate-audio.sh`, then regenerate audio, durations, captions, and the manifest.

**Affected files:** `video/public/audio/*`, `video/MANIFEST.json`, `video/src/constants.ts`, `video/public/captions.json`.

## Runtime

**Recommendation:** Keep the main cut between 1:45 and 2:10.

**Rationale:** It clears the public under-three-minute requirement with room for upload processing and holds attention on the two strongest judge moments.

**Override:** Edit narration in `video/SCRIPT.md` and the matching `video/narration/*.txt` files, then regenerate timing.

**Affected files:** Narration, audio, captions, manifest, and scene duration constants.

## Motion

**Recommendation:** Use a neutral 24-frame crossfade and restrained screenshot drift.

**Rationale:** Receipt text and lineage state remain legible through every cut. The UI, not the transition, carries the proof.

**Override:** Change `CROSSFADE` in `video/src/constants.ts` and update the manifest duration.

**Affected files:** `video/src/constants.ts`, `video/src/MainVideo.tsx`, `video/MANIFEST.json`.

## Social clip

**Recommendation:** Use the revoked-source question and the approved mark in a 10-second vertical clip without narration.

**Rationale:** The hook is understandable muted and does not compress the full proof story into an unreadable mobile montage.

**Override:** Edit the social content constants and `video/src/SocialClip.tsx`.

**Affected files:** `video/src/constants.ts`, `video/src/SocialClip.tsx`.
