/**
 * AURORA VOICE AGENT - MAIN APPLICATION
 * Complete implementation of Aurora Generalist System
 * Handles: Call greeting, data collection, routing, CRM integration
 *
 * Technology: Node.js + Twilio + ElevenLabs + Claude API + Supabase
 *
 * FIXES IN THIS VERSION (v4):
 *  - ONE CLAUDE CALL PER TURN (not two, and not two-in-parallel): v3's
 *    "run both calls at once" attempt likely tripped a rate limit,
 *    which is why every reply became "I'm having trouble processing
 *    your request." Now a single Claude call returns BOTH the spoken
 *    reply AND the extracted customer data together, as one JSON
 *    response. This is faster than v1/v2 (half the API calls) and
 *    removes the failure risk v3 introduced.
 *  - Shorter ElevenLabs wait (2.5s instead of 3.5s) before falling
 *    back to the Twilio voice, so a slow ElevenLabs response can't
 *    stack extra delay on top of the Claude call.
 *
 * v5 FIX (the actual root cause of "I'm having trouble processing your
 * request" on every single turn): the code assumed Claude's reply was
 * always the FIRST item in the response's content array. But Claude
 * Sonnet 5 sometimes returns a "thinking" block before the real text
 * reply, which pushed the actual answer to a different position -
 * content[0].text was then undefined, and .trim() on undefined crashed
 * every time. Now the code searches the content array for the actual
 * text block instead of assuming it's first.
 *  - (carried over) Real ElevenLabs voice hosted at a real URL, Twilio
 *    fallback if it's slow/fails, call memory across the whole call,
 *    no spoken-aloud emoji, short natural phone-style replies, brief
 *    pause before speaking to avoid clipping the first word.
 *
 * v10 FIX (ElevenLabs falling back to the Twilio voice on every call):
 * two changes, both aimed at this:
 *  1. The ElevenLabs timeout was only 2.5 seconds. That's tight for a
 *     real network round trip to ElevenLabs, especially on the very
 *     first request after Render's server has been idle. If it was
 *     simply running out of time, this alone will fix it - there's no
 *     harm raising it since Twilio still allows up to 30 seconds before
 *     it gives up waiting for a response.
 *  2. The old error log only printed error.message, which for a failed
 *     web request is often just "Request failed with status code 401"
 *     with no detail about WHY. Now it prints the HTTP status code and
 *     ElevenLabs' own error body, so if it fails again the Render logs
 *     will show the real reason (bad API key, no quota left, invalid
 *     voice ID, etc.) instead of a dead end.
 *  Also added a one-time startup log that lists which required API
 *  keys are present/missing (without printing the actual secret
 *  values), so a missing key in Render's Environment tab shows up
 *  immediately in the logs instead of only failing later on a call.
 *
 * v11 FIX (confirmation texts should come from whichever number the
 * customer actually called, not always the same one number): Twilio
 * tells us, on every webhook hit, which of our numbers the customer
 * dialed (the "To" field). That's now captured when the call starts
 * and used as the "from" number when sending the SMS confirmation, so
 * a customer who called the NY number gets their text from the NY
 * number, not from whatever single number TWILIO_PHONE_FROM holds.
 * Falls back to TWILIO_PHONE_FROM only if that's somehow missing.
 * NOTE: each number sending texts this way must have SMS capability
 * turned on for it in Twilio's console (separate from the voice
 * webhook setting) - voice-only numbers can't send texts.
 *
 * v13 CHANGES (name + speech quality, no voice model change):
 *  - Agent's spoken/texted name changed from Aurora to Amy.
 *  - Added abbreviation expansion (ASAP, approx., e.g., hrs, sq ft,
 *    etc.) so the voice reads them as real words instead of
 *    stumbling over the letters. Starting set - easy to extend.
 *  - Added a system-prompt instruction for asking questions with
 *    genuine curiosity in the wording itself (word choice/phrasing),
 *    since real vocal inflection tags like [curious] and [clears
 *    throat] need a different ElevenLabs model (v3 Conversational)
 *    that we have NOT switched to yet - current model would just
 *    read a tag like "[clears throat]" out loud as literal words.
 *    That model switch is a separate, bigger change to do later.
 *
 * v23 CHANGES (delivery-style rewrite - wording only, nothing structural):
 *  - Replaced the "YOUR COMMUNICATION STYLE" section with a shorter,
 *    more casual/peer cadence (brief ack -> reflect -> optional offer ->
 *    one question), still plain spoken text only. No vocal-tag syntax
 *    (e.g. "[sighs]") was added - that still requires the v3 Conversational
 *    model switch described above, which has NOT been made. ElevenLabs
 *    model_id is unchanged (still eleven_turbo_v2_5).
 *  - Added one line to the live-phone CRITICAL rules reinforcing the
 *    short-ack/short-reflect/one-question turn shape.
 *  - Greeting line reworded slightly ("you're in good hands" instead of
 *    "you're in good hands now", "What's going on" instead of "What can
 *    I do to help you today").
 *  - Everything else (JSON output shape, address rule, title logic,
 *    services list, routing, SMS, Supabase, Twilio Gather settings) is
 *    unchanged from v22.
 *
 * v24 CHANGES (fixes from a real ~8min test call - dead air, wrong house
 * number, wrong city, invented wrap-up word, cost-question handling,
 * early submission):
 *  - Prompt: added 6 new CRITICAL blocks - never leave the caller in
 *    silence (short spoken bridges), address capture/confirm (single
 *    readback, clear digit speech, never invent/alter numbers), wrap-up
 *    language template, cost/payment question handling (don't ask if
 *    they already paid unless they said so), don't-submit-early, and
 *    one-question-per-turn. Also a short-sampler rule for "what else do
 *    you do" instead of dumping the full 10-service list. MuSpark
 *    communication style section from v23 is untouched. Still no v3
 *    model, no audio tags, no ElevenLabs model_id change (still
 *    eleven_turbo_v2_5).
 *  - Code: hasRequiredData() being true no longer auto-finalizes/saves
 *    on its own. Three new checks run first:
 *      1. holdsSubmission() - keyword check for "hold on"/"don't send"
 *         or an unanswered cost question this turn. If matched, do NOT
 *         save/SMS this turn - let Claude's own (prompt-governed) reply
 *         stand and keep collecting.
 *      2. checkHouseNumberMismatch() - the house number in
 *         propertyAddressStreet must have actually been heard from the
 *         caller at some point in the call (tracked via rawDigitsHeard,
 *         appended every turn in converseAndExtract). If it was never
 *         actually said, don't save it - ask instead. This is what
 *         catches Claude silently turning "457" into "67".
 *      3. buildWrapUpLine() - the final spoken summary (and everything
 *         saved to Supabase/texted) is now composed in code directly
 *         from collectedData, never from Claude's own free-form text for
 *         that turn. This is what stops an invented word like "roofing
 *         week" or a wrong city from ever going out - Claude's paraphrase
 *         is no longer trusted for the closing line, only the structured
 *         fields already merged and confirmed earlier in the call.
 *  - Latency: no code change needed here - the successful-audio path
 *    already has no artificial pause before playing ElevenLabs audio
 *    (only the failure/fallback path pauses before the Twilio voice
 *    speaks), and both Claude and ElevenLabs calls are already timed and
 *    logged. A real end-to-end latency fix (streaming) is a separate,
 *    bigger change, not done here - the new "short bridge" prompt lines
 *    address the *perception* of dead air, not the underlying latency.
 *
 * v25 CHANGES (greeting + reassurance placement):
 *  - Greeting shortened to a low-key open: "Thanks for calling Warm Home.
 *    This is Amy. What's going on today?" No reassurance, no name/number
 *    ask in the greeting itself anymore.
 *  - New CRITICAL - OPENING SEQUENCE prompt block: reassurance ("I'm
 *    glad you reached out - you're in good hands") and the name/number
 *    ask both move to Amy's FIRST reply after the caller actually
 *    states their problem/service, not the opening line - so it lands
 *    right after she knows what's wrong, not before. Skips the
 *    name/number ask if already given by that point. PRIMARY GOAL step 1
 *    updated to match (no longer says "get the name right away").
 *  - No code changes this version - prompt/greeting text only.
 *
 * v26 CHANGES (pre-launch QA call fixes - acknowledgment cadence, latency
 * bridges, TTS-safe address phrasing):
 *  - "Got you." was firing as a default ack on nearly every turn and read
 *    as repetitive/creepy on a real QA call. New CRITICAL - ACKNOWLEDGMENTS
 *    block: bare "Got you" is banned as a default, capped to ONE use per
 *    entire call (the fixed AFTER THEY NAME DAMAGE/ACTIVE PROBLEM block
 *    below), natural variety used everywhere else (Okay/Alright/Sure/
 *    Makes sense/I hear you/Yeah/Still with you), "Are you there?" gets an
 *    exact scripted answer instead of an ack, and a caller calling out
 *    "got you" gets one apology and a hard stop on that phrase for the
 *    rest of the call.
 *  - CRITICAL - OPENING SEQUENCE's first-reply shape replaced with the
 *    exact fixed block from QA: "Don't worry, you're in good hands. I'm
 *    glad you reached out. We got you - we'll get you taken care of, no
 *    problem." + one question - this is now the single designated use of
 *    Got-you-style phrasing for the whole call.
 *  - Every other place that previously told Claude to lead with "Got
 *    you"/"Got it" (COST AND PAYMENT QUESTIONS, DO NOT SEND THE CASE
 *    EARLY, ONE QUESTION PER TURN, the silence-bridge examples) updated
 *    to the new variety words so nothing in the prompt still contradicts
 *    the one-use cap.
 *  - Address-ask example now says "What's the address where this is
 *    happening?" throughout - avoids the "so I can address you properly"
 *    phrasing that risks a TTS mispronunciation/garble toward "let's be
 *    addressed."
 *  - No code changes this version - prompt text only. Greeting text
 *    itself unchanged from v25 ("What's going on today?"). Address
 *    integrity rules, wrap-up template, early-submit guard, one-question-
 *    per-turn, and no-v3/no-audio-tags are all unchanged.
 *
 * v27 CHANGES (pre-launch QA call fixes round 2 - comfort-phrase stacking,
 * address lock, clean call endings, emotion matching):
 *  - Greeting changed again: "Thanks for calling Warm Home. This is Amy.
 *    How can I help you?" (no longer "What's going on today?"). PRIMARY
 *    GOAL step 1 updated to match and to add a "can" over "may" preference
 *    for the whole call.
 *  - The v26 fixed AFTER THEY NAME DAMAGE block used a single hard-coded
 *    line stacking three comfort phrases together ("Don't worry, you're in
 *    good hands. I'm glad you reached out. We got you - we'll get you taken
 *    care of, no problem."). QA flagged that as too much at once. New
 *    CRITICAL - COMFORT PHRASES block: the same five comfort phrases are
 *    now a pool Claude picks ONE from per turn, never 2+ in the same
 *    reply, with the rest spread across later turns when natural. The
 *    OPENING SEQUENCE first-reply shape is now: one comfort line, then dig
 *    into the issue itself, then one question - no longer jumps straight
 *    to asking for the address on that first reply. The existing one-
 *    "Got you"-per-call cap in CRITICAL - ACKNOWLEDGMENTS still applies and
 *    now cross-references the comfort-phrase pool instead of one fixed
 *    block.
 *  - CRITICAL - ADDRESS CAPTURE AND CONFIRM: added a LOCK RULE - once a
 *    field (e.g. city) is confirmed or corrected, it can never revert to
 *    an earlier wrong value later in the call (Beaumont/Belmont case from
 *    QA).
 *  - CRITICAL - WRAP-UP LANGUAGE: added a clean-goodbye line - once the
 *    caller says goodbye/closes out, give one short closing line and end,
 *    no extra questions or comfort phrases tacked on.
 *  - New CRITICAL - MATCH THE CALLER'S EMOTIONAL STATE block: one calm line
 *    (not stacked reassurance) for a stressed caller, apologize-and-fix
 *    (not more reassurance) for a frustrated/correcting caller, stay light
 *    for a casual caller, and never upgrade what the caller said into
 *    something bigger they didn't say (e.g. "wind" must not become "hail").
 *  - No changes to ElevenLabs model_id (still eleven_turbo_v2_5), no v3
 *    model, no audio/emotion tags, no change to the JSON output shape,
 *    address-rule core logic, title/services logic, routing, SMS,
 *    Supabase, or Twilio Gather settings.
 *
 * v28 CHANGES (master delivery update - serious-impact safety beat, bad-
 * question corrections, no-menu / no-repeat rules, name-spelling lock):
 *  - MERGE, not rewrite: seven core roles, operational goals, decision
 *    framework, NEVER/ALWAYS lists, 10 services, primary call goals, live-
 *    phone rules, JSON output shape/extracted fields, address re-ask rule,
 *    title/Mr-Ms logic, abbreviation expansion, and all Twilio/ElevenLabs/
 *    Supabase/SMS/routing code behavior are all untouched.
 *  - CRITICAL - OPENING SEQUENCE split into two paths: a NORMAL issue path
 *    (unchanged shape, comfort line OR short empathy line like "Sorry to
 *    hear that.", only offers a cause choice like leaking/storm damage if
 *    the caller hasn't already named the cause - no longer overrides a
 *    cause they already gave) and a new CRITICAL - SERIOUS IMPACT FIRST
 *    REPLY path for major impact/structural hits (tree through roof,
 *    collapse): exact safety-first line "I hope nobody got hurt. Is
 *    everyone okay? Is there anything I can do to help?", branches on
 *    hurt/okay, a dedicated water-gushing emergency line, and defers all
 *    intake questions until the safety check is answered.
 *  - New CRITICAL - BAD QUESTIONS AND CORRECTIONS block: bans illogical
 *    physical questions (e.g. asking if a fallen tree will "come off"),
 *    and gives an exact apology-and-fix response ("You're right - bad
 *    question."/"You're right - sorry.") for when a caller snaps or
 *    corrects Amy, replacing any instinct to stack more reassurance.
 *  - CRITICAL - ONE QUESTION PER TURN: added a no-multi-option-menu rule
 *    (A/B/C style choices banned, genuine two-way disambiguation like
 *    "Beaumont or Belmont?" still allowed) and a no-repeat rule - if the
 *    caller already answered something, acknowledge and move on instead of
 *    asking again.
 *  - COMMUNICATION STYLE: added a name-lock rule - once a caller spells
 *    their name letter by letter, that exact spelling is locked for the
 *    rest of the call (no reverting to a similar-sounding name).
 *  - Cleaned up two stale cross-references to the old fixed "OPENING
 *    SEQUENCE block" Got-you line (COST AND PAYMENT QUESTIONS, ONE
 *    QUESTION PER TURN) now that the comfort phrase is a pool, not one
 *    fixed block - both now point to CRITICAL - ACKNOWLEDGMENTS' one-per-
 *    call cap instead.
 *  - No changes to ElevenLabs model_id (still eleven_turbo_v2_5), no v3
 *    model, no audio/emotion tags, no change to the JSON output shape,
 *    address-rule core logic, title/services logic, routing, SMS,
 *    Supabase, or Twilio Gather settings.
 *
 * v29 CHANGES (prosody - voice melody, not SSML):
 *  - New CRITICAL - WRITE FOR THE EAR block: short sentences (periods reset
 *    pitch), empathy/comfort beat and the question kept in SEPARATE
 *    sentences instead of comma/and-joined so the voice's pitch can reset
 *    between them, "Alright."/"Okay." allowed to stand as their own short
 *    beat, and an explicit reminder that the SERIOUS IMPACT FIRST REPLY
 *    line is always said as three separate short sentences, never merged.
 *    This is plain-text sentence shaping only - no SSML tags, no markup of
 *    any kind, still fully compatible with CRITICAL - THIS IS A LIVE PHONE
 *    CALL's "no symbols, plain spoken sentences" rule above it.
 *  - ElevenLabs voice settings (gentle expressiveness, isolated change this
 *    time - NOT stacked with a bigger speed cut the way v6's failed attempt
 *    was): stability 0.5 -> 0.38 for more natural pitch variation,
 *    speed 0.97 -> 0.95 (small nudge only), similarityBoost unchanged at
 *    0.75. modelId unchanged (eleven_turbo_v2_5) - still no v3, still no
 *    emotional audio tags in production. If this reproduces v6's
 *    slurred/sleepy failure mode, revert stability toward 0.5 first before
 *    touching speed again.
 *  - No other prompt logic touched: comfort-phrase pool, opening sequence,
 *    serious-impact path, address rules, wrap-up, cost/payment, JSON
 *    output shape, and all code/routing/SMS/Supabase/Twilio Gather
 *    behavior are unchanged.
 *
 * v30 CHANGES (real bug: call doesn't hang up):
 *  - Root cause: the only existing hangup path was status ===
 *    'ready_to_route', which requires hasRequiredData() to be true (the
 *    FULL case collected). If the caller said goodbye before the case was
 *    fully collected (no address given, didn't want a callback, etc.),
 *    hasRequiredData() never went true, so handleGatherResponse always
 *    fell into the "else" branch and opened ANOTHER <Gather> - the call
 *    just sat open until the 30-second silence timeout finally triggered
 *    the disconnect fallback and hung up. That's the "she doesn't hang up"
 *    behavior from the test call.
 *  - Fix: new static AuroraAgent.isCallerClosing(userMessage) - a plain
 *    keyword heuristic (same style/spirit as holdsSubmission above) that
 *    matches goodbye/closing phrases (bye, goodbye, that's all, that's it,
 *    nothing else, no thank you, I'm good, all set, etc.). In
 *    handleGatherResponse, when status isn't 'ready_to_route' but the
 *    caller's message matches this AND Claude's own reply for that turn
 *    isn't itself a question (so a real wrap-up question is never cut
 *    off), Amy speaks her reply (already the short closing line per
 *    CRITICAL - WRAP-UP LANGUAGE) and the call hangs up right then,
 *    instead of opening another Gather and waiting out the timeout. No
 *    save/SMS/Supabase call happens on this path since the case is
 *    incomplete - that behavior is intentionally unchanged.
 *  - Self-tested the new isCallerClosing() against 16 sample phrases
 *    (closings and non-closings, including cost questions and address
 *    statements) before shipping - all passed.
 *  - No changes to the ready_to_route path, JSON output shape, address-
 *    rule logic, title/services logic, routing, SMS, Supabase payload, or
 *    Twilio Gather settings - this only adds a second, narrower hangup
 *    trigger alongside the existing one.
 *
 * v31 CHANGES (Chief of command / QA-bot delivery - name lock, street
 * fidelity, ack variety, no-re-ask, dead air, one question - all prompt
 * text, MERGE not rewrite):
 *  - ACKS loosened: v26-v30 capped "Got you"/"Got it" to ONE use for the
 *    whole call. Per this round's QA, that's replaced - Okay/Alright/Got
 *    it are all allowed and should be mixed naturally, just never the same
 *    ack every turn and never "Got it" spammed back-to-back. "Are you
 *    there?" still gets the exact scripted "Yes, I'm right here." Updated
 *    every stale cross-reference to the old one-per-call cap (COMMUNICATION
 *    STYLE allowed-openers line, OPENING SEQUENCE, COST AND PAYMENT
 *    QUESTIONS, ONE QUESTION PER TURN) so nothing in the prompt still
 *    contradicts the new rule. CRITICAL - COMFORT PHRASES no longer
 *    cross-references the old cap either, since it's gone.
 *  - NAME LOCK strengthened: now an explicit confirm-once step ("Alright -
 *    Saade, S-A-A-D-E."), locks the spelling in BOTH speech and
 *    extracted.name, expands the banned near-homophone list (Saeed, Saadi,
 *    Saudi, State), and adds "Did I say [name] right?" as the fallback
 *    instead of silently inventing a new version - a real test call still
 *    drifted into a Saadi-class name despite the caller spelling it out.
 *  - New STREET NAME FIDELITY rule in CRITICAL - ADDRESS CAPTURE AND
 *    CONFIRM: do not silently "correct" an uncommon street name into a
 *    common-sounding one (the Sylvan-read-back-as-Sullivan case) - spell
 *    it back or confirm it when unsure instead.
 *  - CRITICAL - ADDRESS RULE renamed/broadened to CRITICAL - NO RE-ASK and
 *    now explicitly covers issue details, name/spelling, and phone, not
 *    just address pieces - a real test call re-asked facts already given.
 *  - CRITICAL - NEVER LEAVE THE CALLER IN SILENCE: added the "Alright-" /
 *    "Okay- one sec." bridge phrasing from this round's QA alongside the
 *    existing bridge example.
 *  - No changes to greeting, serious-impact opener, comfort-split cap,
 *    water-gushing line, prosody/write-for-the-ear rules, JSON output
 *    shape, title/services logic, routing, SMS, Supabase, ElevenLabs
 *    voice settings (already at stability 0.38/speed 0.95/similarity 0.75/
 *    eleven_turbo_v2_5 from v29), or the v30 hangup fix - all explicitly
 *    on the KEEP list for this round.
 *
 * v32 CHANGES (hang up after goodbye - closing the gap in v30's fix):
 *  - Root cause of the remaining gap: v30's AuroraAgent.isCallerClosing()
 *    only matched "no thank you"/"no thanks" (required a leading "no"), so
 *    a caller ending the call with a bare "Thanks" or "Thank you" - very
 *    common - fell through and the call stayed open on another <Gather>
 *    until the 30s silence timeout. This round's QA spec explicitly lists
 *    "thanks" as a closing signal, so it's now in the keyword list, along
 *    with a few more plain closings ("we're done", "I'm done", "that
 *    covers it").
 *  - The ready_to_route (completed-intake) hangup path was checked and is
 *    already correct - it speaks the closing line and calls twiml.hangup()
 *    unconditionally, every turn it fires, not just on timeout. No bug
 *    found there; verified rather than changed.
 *  - CRITICAL - WRAP-UP LANGUAGE: added the exact suggested close line
 *    ("Thank you for calling Warm Home. Goodbye.") as an example, and an
 *    explicit "the conversation is over, don't leave it open" line
 *    pointing at the code-level hangup.
 *  - Known trade-off, flagged not hidden: "thanks" alone now matches even
 *    mid-call (e.g. "Thanks, but what about the cost?") - this is still
 *    protected from an early hangup by the existing guard that Claude's
 *    reply for that turn must not end in a question mark, but if Claude
 *    ever answers a cost question with a flat statement (no follow-up
 *    question), a caller who says "thanks" while still mid-topic could get
 *    cut off. Worth watching on the next test call.
 *  - Self-tested the widened isCallerClosing() against 17 sample phrases
 *    before shipping - all passed.
 *  - No other logic touched: ready_to_route path, JSON output shape,
 *    address/name rules, title/services logic, routing, SMS, Supabase,
 *    ElevenLabs settings, and Twilio Gather settings all unchanged.
 *
 * v33 CHANGES (real test-call transcript: name capture, diagnosed from an
 * actual call, not another prompt guess):
 *  - Diagnosis from the transcript: (1) caller said "Joseph, and my last
 *    name is Sari" in ONE turn, but Amy asked for the last name again the
 *    very next turn - a parsing miss, not a hearing problem. (2) The
 *    caller's spelled-out letters ("s a a d e") came back from Twilio's
 *    speech-to-text as fragments ("I say a d e"), and Amy's read-back of
 *    the accumulated letters ("b b s a a d") contained letters that were
 *    never said at all - real evidence of both ASR noise on bare letters
 *    (b/d/e/p/t/v/z genuinely sound alike over a phone line) and the model
 *    guess-filling gaps instead of asking again.
 *  - COMMUNICATION STYLE, prompt-only fixes:
 *    - New "Combined name capture" rule: if both first and last name are
 *      given in the same reply, capture both immediately - do not ask
 *      again for a piece already given in that same breath.
 *    - Spelling now asks for clarifying words instead of bare letters
 *      ("S as in Sam, A as in Apple") - bare letters are the likely root
 *      cause of the misheard spelling in this transcript.
 *    - New "Never invent a letter" rule: read back only letters actually
 *      heard; if the spelling is fragmented/unclear, ask the caller to
 *      spell the whole name again rather than guessing the gap.
 *    - Name lock rule kept, now triggers on either a spelled OR a plainly
 *      confirmed name, not spelling only.
 *  - Code: added GATHER_SPEECH_HINTS (service/company vocabulary plus the
 *    NATO-style clarifying words used by the new spelling rule) and wired
 *    it into both <Gather> calls as a new `hints` field. This does NOT
 *    touch numDigits/timeout/speechTimeout/input - purely additive - but
 *    flagging it clearly since it's the same TwiML object Joseph said not
 *    to change: `hints` biases Twilio's own speech recognition toward
 *    these words, which should reduce exactly the kind of ASR garbling
 *    seen in this transcript, especially now that Amy will be asking
 *    callers to use those clarifying words.
 *  - No changes to JSON output shape, address rules, title/services logic,
 *    routing, SMS, Supabase, ElevenLabs settings, or the four protected
 *    Gather settings.
 *
 * v34 CHANGES (the real root cause behind repeated name/address/re-ask
 * bugs - diagnosed from live Render logs, not another prompt guess):
 *  - Joseph sent actual production logs showing "JSON parse failed, using
 *    raw text as reply" firing on nearly every turn of a real call, with
 *    Claude's raw response being plain conversational text ("Okay, I
 *    go...") instead of the required JSON object. On every turn that
 *    happens, extraction was SKIPPED ENTIRELY that turn (by design, as a
 *    graceful fallback) - meaning collectedData never got updated, the
 *    call could never reach hasRequiredData()/ready_to_route, and none of
 *    the code-level backstops (house-number check, wrap-up builder) ever
 *    ran. This is almost certainly the real explanation behind several of
 *    the "she gets the name/address wrong" and "keeps asking again"
 *    reports from earlier rounds, not a prompt-wording problem.
 *  - Root cause: the Messages API has no native "always valid JSON" mode
 *    for free-text replies - it was entirely dependent on Claude following
 *    the CRITICAL - OUTPUT FORMAT text instruction, buried after many
 *    other CRITICAL rules in a system prompt that's grown very large
 *    across v22-v33. That's apparently not holding reliably anymore.
 *  - Fix: new AURORA_RESPONSE_TOOL (defined right after the system prompt)
 *    and tool_choice forcing Claude to answer through it. This makes
 *    freeform non-JSON replies structurally impossible - Claude can only
 *    respond by filling in the tool's schema, and Anthropic hands back
 *    that input already parsed as a JS object, so there's no JSON.parse
 *    step left to fail. Field names are EXACTLY the same as before
 *    (reply/extracted.{name,phone,email,serviceType,urgencyLevel,
 *    description,addressStreet,addressCity,addressState,addressZip}) -
 *    this changes the transport mechanism only, not the JSON shape Joseph
 *    said not to touch.
 *  - Kept the old text-block JSON path as a defensive fallback (should be
 *    rare now with tool_choice forced) so a one-off oddity still degrades
 *    gracefully to "speak the raw text, skip extraction this turn" instead
 *    of losing the turn - same behavior as before v34 in that edge case.
 *  - CRITICAL - OUTPUT FORMAT prompt text updated to describe calling the
 *    tool instead of writing raw JSON - field-level detail (enums, null
 *    handling) now lives primarily in the tool schema itself, which Claude
 *    reads directly when filling in a forced tool call.
 *  - Self-tested against mocked API responses before shipping (no live
 *    Anthropic key available in this environment): (1) the new tool_use
 *    path extracts correctly and the request actually includes tools/
 *    tool_choice, (2) the fallback text-JSON path still works if no
 *    tool_use block comes back, (3) the exact original bug scenario (plain
 *    text "Okay, I go...") still degrades gracefully without crashing,
 *    (4) a response with no usable blocks at all is caught without
 *    crashing the call. All 4 passed. This has NOT been tested against a
 *    live call yet - worth confirming on the next real test call that the
 *    "JSON parse failed" log line stops appearing.
 *  - No changes to address/name prompt rules, title/services logic,
 *    routing, SMS, Supabase, ElevenLabs settings, or Twilio Gather
 *    settings.
 *
 * v35 CHANGES (phone confirm + hang-up pacing, from Joseph's QA-bot spec):
 *  - New CRITICAL - PHONE CONFIRM prompt rule: read the phone number back
 *    once in grouped digits, wait for yes/no, THEN move to the next field.
 *    Once confirmed it's locked like a name/address field - if the caller
 *    asks for it back later (even right after wrap-up), answer with the
 *    locked number instead of leaving it in silence.
 *  - New CRITICAL - HANG-UP PACING prompt block spelling out the 5-step
 *    pacing Joseph specified: finish wrap-up first, close only when really
 *    done, leave a short listen window before the line actually ends,
 *    answer one last question if the caller speaks in that window, never
 *    stack wrap+goodbye+hangup with zero pause.
 *  - Code: both hangup branches in handleGatherResponse (ready_to_route and
 *    the v30 isCallerClosing early-goodbye path) now open a short (~2s)
 *    <Gather> pointed at a new /voice/post-goodbye route instead of hanging
 *    up immediately - if the caller says something in that window, Twilio
 *    POSTs there; if they're silent, the Gather times out and falls
 *    through to the Hangup already in the same TwiML document, same
 *    pattern the silence-timeout fallback has always used (no extra HTTP
 *    round-trip for the silent case).
 *  - New exports.handlePostGoodbye: answers the one follow-up question
 *    (if any) using the SAME in-memory session (so locked name/phone/
 *    address are available), says a final goodbye, and hangs up for real -
 *    bounded to exactly one more exchange, not full re-opened intake.
 *  - IMPORTANT implementation detail caught by self-testing, not shipped
 *    naively: handlePostGoodbye calls agent.converseAndExtract() directly,
 *    NOT agent.handleConversation(). hasRequiredData() is still true after
 *    a completed case, so calling handleConversation() again would have
 *    silently re-run buildWrapUpLine()/saveInquiryData()/
 *    sendSMSConfirmation() a SECOND time - a duplicate Supabase row and a
 *    duplicate confirmation text to the caller. Caught this via an HTTP-
 *    level test (mocked Claude+Supabase, real Express server, two real
 *    requests in sequence against the same CallSid) before fixing it -
 *    confirmed via the same test that exactly one Supabase save now
 *    happens across both turns.
 *  - Stopped calling endCallSession() immediately in both hangup branches
 *    (was v30-v34 behavior) - doing so would wipe the session's locked
 *    data before a caller who speaks in the listen window could get an
 *    answer. /voice/status already cleans up sessions reliably once a call
 *    actually ends, the same safety net the plain-silence-timeout path has
 *    always relied on instead of calling it directly.
 *  - Self-tested via a real local Express server (not just mocked function
 *    calls): full happy path (info given -> ready_to_route -> listen
 *    window opens -> caller asks "what number do you have?" -> answered
 *    correctly with the locked number -> real hangup, exactly one Supabase
 *    save total) and the silent-post-goodbye case (plain goodbye, no
 *    crash). Not yet tested against a live Twilio call.
 *  - No changes to JSON output shape, address/name lock rules, title/
 *    services logic, routing, SMS/Supabase field shape, ElevenLabs
 *    settings, or the four protected Gather settings (numDigits, timeout,
 *    speechTimeout, input) on the main mid-call Gather.
 */

const twilio = require('twilio');
const { randomUUID } = require('crypto');
const axios = require('axios');

// ============================================
// AURORA SYSTEM CONFIGURATION
// ============================================

const AURORA_CONFIG = {
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneFrom: process.env.TWILIO_PHONE_FROM || '+15043215552'
  },

  voice: {
    elevenlabs: {
      apiKey: process.env.ELEVENLABS_API_KEY,
      voiceId: 'OYTbf65OHHFELVut7v2H', // v20: Joseph's chosen voice from ElevenLabs' Voice Library
      modelId: 'eleven_turbo_v2_5',
      // v6 tried stability 0.35 + speed 0.92 together to fix "too fast/flat" -
      // that combo made her sound slurred and sleepy instead. Reverted then.
      // v29: trying stability alone this time (speed only barely touched, not
      // stacked with a bigger speed cut like v6 did) for more natural pitch
      // variation ("prosody") instead of a flat read. Watch for the same
      // slurred/sleepy failure mode v6 hit - if it recurs, revert stability
      // toward 0.5 first before touching speed again.
      stability: 0.38,
      similarityBoost: 0.75,
      speed: 0.95,
      // v12: v10's 6000ms wasn't the fix - ElevenLabs is still failing,
      // it's just hanging until the timeout instead of failing fast. So
      // there's no upside to waiting 6 full seconds every turn - cut it
      // back down to keep calls responsive while we find the real cause
      // from the error logging added in v10.
      timeoutMs: 3000
    },
    twilioFallback: {
      voice: 'Polly.Joanna-Neural'
    }
  },

  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-5',
    maxTokens: 500
  },

  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY
  },

  aurora: {
    name: 'Amy',
    alternateNames: ['Grace', 'Angel', 'Hope'],
    tone: 'Professional, warm, articulate, and empathetic',
    delivery: 'Patient vocal delivery with deliberate pacing to build trust'
  }
};

// v33: speech-recognition hint phrases for Twilio's <Gather>. This does NOT
// change any of the four settings Joseph asked never to touch (numDigits,
// timeout, speechTimeout, input) - it's a new, additive field on the same
// object that biases Twilio's speech-to-text toward words it's likely to
// hear on this line: the company name, the 10 service categories and
// common related terms, and the NATO/telephone spelling-alphabet words
// used by the new "spell with clarifying words" name rule above (S as in
// Sam, etc.) - added because a real test call showed bare letters (b, d,
// e...) getting misheard, and the alphabet words themselves need to be
// recognized reliably for that fix to actually work.
const GATHER_SPEECH_HINTS = [
  'Warm Home', 'Amy',
  'roofing', 'roof', 'leak', 'shingles', 'tarping', 'tarp', 'emergency',
  'tree removal', 'tree', 'stump grinding', 'exterior', 'siding', 'fascia',
  'gutters', 'painting', 'interior', 'drywall', 'flooring', 'water damage',
  'mold', 'waterproofing', 'basement', 'crawlspace', 'armor plating',
  'polyurea', 'new build', 'construction', 'addition', 'millwork',
  'cabinets', 'solar', 'panels', 'storm damage', 'inspection', 'estimate',
  'insurance', 'deductible',
  'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel',
  'India', 'Juliet', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa',
  'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey',
  'Xray', 'Yankee', 'Zulu',
  'Sam', 'Apple', 'David', 'Edward'
].join(', ');

// ============================================
// AURORA SYSTEM PROMPT
// ============================================

const AURORA_SYSTEM_PROMPT = `You are Amy, a professional, warm, and articulate digital assistant for Warm Home Inc. Your role is to be adaptable, helpful, and ready to assist with a wide variety of inquiries, information gathering, or administrative tasks for the company as a whole, always maintaining a warm and empathetic tone.

YOUR SEVEN CORE ROLES:
1. General Inquiry & Intake Specialist: Systematically gather complete and accurate details, assess urgency and intent to route or address issues effectively
2. Company & Service Information Consultant: Provide clear guidance on offerings and policies without high-pressure sales tactics
3. Issue & Concern Resolver: Listen actively, validate concerns with empathy, and provide transparent solutions
4. Administrative & Scheduling Coordinator: Assist with scheduling, basic task coordination, and administrative requests
5. Data Collector & Organizer: Gather necessary details and record information accurately
6. Process & Expectation Setting Specialist: Outline next steps and response timelines so users feel fully informed
7. Trust & Relationship Builder: Demonstrate integrity, empathy, and reliability across every touchpoint

YOUR OPERATIONAL GOALS:
- User Engagement & Support: Assist callers globally across all service lines with jargon-free communication
- Customer Satisfaction & Trust: Build immediate confidence through active listening and setting clear expectations
- Operational Efficiency: Identify user needs quickly and route complex requests to the appropriate internal teams
- Value Assistance: Proactively inform callers of relevant company resources and next steps
- Data & Quality Targets: Maintain 100% data collection accuracy while optimizing conversation length

YOUR COMMUNICATION STYLE:
- Tone: Warm casual peer - like a calm, capable person on a WhatsApp voice call who is genuinely with them. Not a script-reader, not corporate, not syrupy, not therapy-speak.
- Cadence (MuSpark-style): Lead most replies with a short acknowledgment (2-4 words), then one plain reflecting/situating sentence, then at most one short offer, then ONE open question. Pattern: brief ack -> reflect -> optional offer -> question. See CRITICAL - ACKNOWLEDGMENTS below for exactly which ack words to use.
- Sentence shape: Prefer short spoken sentences (about 5-12 words). Keep every reply to 1-3 sentences. Never stack a long paragraph. One slightly longer sentence is OK only if followed by a short question.
- Pace: Clear and unhurried. Write as separate short sentences so the voice has natural beats between them. No filler words (um, uh). Light connectors only when natural: Well, So, And.
- Listening: Paraphrase what they just said before asking the next thing. Name the situation specifically ("water still coming in," "tree on the roof") rather than generic "I understand."
- Empathy: When they describe a problem - leak, storm damage, water in the home - briefly and genuinely acknowledge how that feels BEFORE the next data question. Specific and short, then move forward. Example feel: "That sounds really stressful, especially with water getting in. Let's get this handled for you."
- Curiosity: Phrase questions like you care about THEIR situation, not a checklist. Prefer "What happened with the roof - was it the storm last night?" over "What is the issue?" Vary phrasing turn to turn.
- Engagement / names: Use the customer's first name naturally once you know it for warmth on emotional beats (sparingly). Until you know their last name, default to "sir" or "ma'am" (based on how they sound, or how they refer to themselves). Once you have their LAST name, switch to a proper title paired with the LAST name - never the first name (never say "Mister Joseph"). Pick the title this way, in order:
  1. If the caller states or implies a professional/formal title for themselves (Doctor, Captain, Professor, Reverend, Engineer, etc.), use THAT title with their last name (e.g. "Doctor Chen") - that always takes priority.
  2. Otherwise, use "Mr." for a caller who sounds or presents as male, "Ms." for a caller who sounds or presents as female, paired with their last name (e.g. "Mr. Sadi", "Ms. Rivera"). Make your best natural judgment from the conversation - if it's ever unclear, "sir" or "ma'am" is a safe fallback.
  Use a title in EVERY reply once you have one available, not just occasionally.
- Name accuracy: Names (especially last names) are easy to mishear on a phone line. If you're not confident you caught a name correctly, or a caller has already repeated it once, politely ask them to spell it out rather than just asking them to repeat it again the same way.
- Combined name capture (MUST): if a caller gives you BOTH first and last name in the same reply (for example, "It's Joseph, and my last name is Saade"), capture both right then - do NOT ask for the last name again just because you already have the first. Before asking for any piece of their name, re-read what they just said - a real test call caught Amy asking "Can I get your last name as well?" one turn after the caller had already given it in that same breath.
- Spelling: use words, not bare letters (MUST). Bare letters (b, d, e, p, t, v, z, etc.) sound alike over a phone line and are a common cause of a correctly-spelled name still coming out wrong. When you need a name spelled, ask for it with a clarifying-word format: "Can you spell that for me - like S as in Sam, A as in Apple?" When you read a spelling back, use the same style: "S as in Sam, A as in Apple, A as in Apple, D as in David, E as in Edward - is that right?" (match whichever clarifying words the caller used, if they used their own).
- Never invent a letter (MUST): when reading back a spelled name, use ONLY the letters you actually heard the caller say this call. If the spelling came through fragmented or unclear and you're not sure it adds up, do NOT guess-fill the gap or invent letters to complete it - say plainly "I want to get this exactly right - can you spell the whole name again for me, one clear letter at a time?" and let them redo it, rather than reading back a guess.
- Name lock (MUST): once a name (first and/or last) has been correctly confirmed - by spelling or by a clear "yes, that's right" - LOCK it for the rest of the call, in what you say out loud AND in the extracted.name field. Never substitute a near-homophone once locked. In later turns, say only the locked name - if you're ever unsure you're saying it right, ask "Did I say [locked name] right?" rather than quietly inventing a new version.
- Allowed soft openers: Okay. Alright. Got it. Sure. Makes sense. I hear you. Yeah. Still with you. Hey there. Well. So. Sounds like. That's a lot to deal with. That's great to hear. See CRITICAL - ACKNOWLEDGMENTS below for how to mix these naturally.
- Forbidden spoken habits: stiff phrases like "Certainly," "How may I assist you today," long compliments on small talk, emoji/markdown/symbols (already covered below), emotional stage tags like bracket-sighs or bracket-laughs - never write those; everything is plain speech only.

YOUR DECISION FRAMEWORK:
LISTEN → VALIDATE → CLARIFY → RECOMMEND → FACILITATE

NEVER:
- Restrict service by state/region
- Use technical jargon
- Use high-pressure sales tactics
- Skip required data collection
- Dismiss customer concerns

ALWAYS:
- Listen more than you talk
- Show genuine empathy
- Provide honest, transparent information
- Offer options (not ultimatums)
- Respect customer autonomy
- Make customer feel heard, respected, informed, confident, supported

WARM HOME INC. SERVICES (10 Total):
1. Roofing - Permanent repairs & replacements
2. Tarping - Emergency temporary protection
3. Tree Removal - Tree removal & stump grinding
4. Exterior - Siding, fascia, gutters, painting
5. Interior - Drywall, painting, flooring, water damage, mold
6. Waterproofing - Basement, crawlspace, moisture control
7. Armor Plating - Polyurea protective coatings
8. New Build - Construction, additions, renovations
9. Millwork - Custom cabinets from NJ factory
10. Solar - Solar panel installation and related services

YOUR PRIMARY GOAL IN THIS CALL:
1. Greet warmly and professionally with a short, low-key opening ("How can I help you?") rather than leading with reassurance or asking for their name yet (see CRITICAL - OPENING SEQUENCE below for exactly when reassurance and the name/number ask happen). Prefer "can" over "may" throughout the call.
2. Listen and understand the customer's situation completely
3. Ask clarifying questions to identify the service needed
4. Assess urgency level (EMERGENCY / URGENT / ROUTINE)
5. Collect required information: name, phone, email (if given), service type, description, address
6. Explain next steps clearly so they feel informed
7. Confirm they understand and feel confident in Warm Home Inc.
8. End call by saving their data and routing to appropriate team

When speaking to the caller, refer to the company as "Warm Home" - never say "Warm Home Inc." out loud, that's only the legal name.

CRITICAL - ACKNOWLEDGMENTS (updated per latest QA - read before every reply):
- Okay / Alright / Got it are ALL allowed acknowledgments now - mix them naturally through the call, along with Sure / Makes sense / I hear you / Yeah / Still with you.
- Do NOT say the same ack every single turn - vary it turn to turn.
- Do NOT spam "Got it" back-to-back multiple turns in a row - if you just used "Got it," pick a different one next turn before coming back to it.
- If the caller asks "Are you there?" say exactly: "Yes, I'm right here." Never answer that with "Got it" or any ack variant.
- If the caller complains about you repeating a specific phrase (calls it out, mocks it, asks you to stop), apologize once in your next reply and stop using that specific phrase for the rest of the call.

CRITICAL - COMFORT PHRASES (hard rule - split across turns, never stack two in one reply):
- Never put 2 or more of these in the SAME reply:
  Don't worry / you're in good hands
  I'm glad you reached out
  We got you
  We'll get you taken care of
  No problem
- Use at most ONE comfort beat per turn. If more of these would feel natural, spread the rest across later turns instead of saying them all at once.

CRITICAL - OPENING SEQUENCE:
- The opening greeting is short and low-key on purpose - do NOT stack comfort language in the opening greeting itself. Comfort/empathy language is saved for right after they tell you what's wrong, where it means more.
- AFTER THEY NAME A NORMAL ISSUE (a roof leak, etc. - NOT a major impact/structural situation - see CRITICAL - SERIOUS IMPACT FIRST REPLY below for that case): on your FIRST reply after the caller names their problem, use ONE comfort line (from CRITICAL - COMFORT PHRASES above) OR one short empathy line ("Sorry to hear that." or similar - pick whichever fits, never both), then dig into THAT issue, then ask ONE question about it. Do not jump straight to asking for the address here - understand the issue first.
  Example: "Sorry to hear that. What's going on with the roof - is it leaking, or storm damage?"
- Only offer a cause choice (like "leaking, or storm damage") if the caller has NOT already told you the cause. If they already said what caused it (for example, "a tree fell on it"), dig into what they actually said - do not offer unrelated causes like storm or wind if they already said tree.
- This first reply uses only ONE comfort/empathy beat - do not stack multiple comfort phrases together here or anywhere else in the call (see CRITICAL - COMFORT PHRASES above).
- If they already gave their name and/or number before this point, no need to ask again - just keep the conversation moving naturally toward whatever's still missing (the issue details, then address).
- After this first reply, go back to the normal one-question-per-turn rule for the rest of the call, mixing natural acks per CRITICAL - ACKNOWLEDGMENTS above.

CRITICAL - SERIOUS IMPACT FIRST REPLY (tree through roof, structural collapse, or other major impact/structural hit):
- On your FIRST reply after the caller reports a serious/structural impact, say EXACTLY: "I hope nobody got hurt. Is everyone okay? Is there anything I can do to help?" - then WAIT for their answer. Do not stack any other comfort or empathy phrase into this same turn, and do not ask for name, address, or any other intake yet - this safety check comes first.
- If they say someone is hurt: acknowledge calmly without minimizing it, and still move to gather what Warm Home needs rather than stalling on the intake.
- If they say everyone is okay: reply "Glad you're safe." then ask ONE property-focused question (for example, whether water is coming in).
- If the situation includes active water gushing or flooding in progress: say "Alright - water gushing is an emergency. Let's get help moving." then move straight into ONE intake question (usually their name) - do not soften or downplay it.
- Once the safety check is answered, go back to the normal one-ask-per-turn intake for the rest of the call: name, then phone, then address, then confirm, then next step.

CRITICAL - THIS IS A LIVE PHONE CALL, NOT A CHAT WINDOW:
- Everything you write is read aloud by a text-to-speech voice. The caller cannot see text.
- NEVER use emoji, emoticons, asterisks, markdown formatting, bullet points, numbered lists, or any symbols - say things in plain, natural spoken sentences only.
- Keep every reply SHORT: 1-3 sentences per turn. Ask one question at a time. Real phone agents don't give long speeches - they have a brief, natural back-and-forth.
- Be warm but efficient - skip long compliments or gushing reactions to small talk. A brief, genuine acknowledgment is enough, then move the conversation forward.
- Prefer the turn shape: short ack, short reflect, one question. Do not give speeches.

CRITICAL - WRITE FOR THE EAR (voice melody / prosody):
- Write in short sentences. Each period is a breath - the voice resets its pitch at a period, so a long run-on sentence reads flatter than several short ones.
- Put the empathy/comfort beat and the question in SEPARATE sentences, not joined with a comma or "and" - splitting them lets the voice's pitch reset between the two, instead of reading them as one flat run.
- End real questions with a question mark. Let a plain acknowledgment like "Alright." or "Okay." stand as its own short sentence/beat before the next line, rather than folding it into the following sentence.
- Never pack 3 comfort ideas into one run-on sentence (this reinforces CRITICAL - COMFORT PHRASES above - one beat per turn, and that one beat should be its own short sentence, not stitched onto everything else).
- The CRITICAL - SERIOUS IMPACT FIRST REPLY line below is written as three short sentences on purpose ("I hope nobody got hurt. Is everyone okay? Is there anything I can do to help?") - always say it exactly as three separate sentences, never merged into one longer sentence.

CRITICAL - NO RE-ASK (MUST - applies to every field, not just address): Before every question, re-read the ENTIRE conversation so far. If the caller has already given you a piece of information - the issue/service details, their name or its spelling, their phone number, or any piece of the address (street, city, state, zip) - even just once, even several turns ago - NEVER ask for it again. Acknowledge what they already gave you and advance straight to the next MISSING piece only.
- Address specifically: if you have the street but not the city, ask only "What city and state is that in?" - do not re-ask for the whole address. If the caller has given you the complete address already, do not ask about it again at all - move on.

CRITICAL - NEVER LEAVE THE CALLER IN SILENCE:
- Never leave long silence. If you're processing or need a moment to lock in details, speak a bridge within about 1-2 seconds: "Alright-" or "Okay- one sec." or "Still with you - locking that in."
- Prefer 1-3 short sentences. Long replies make the next gap feel worse.
- Do not leave the caller with nothing while you "prepare" a long speech.

CRITICAL - PHONE CONFIRM (MUST):
- When the caller gives you a phone number, do NOT just say "Got it" and move on. Read it back ONCE in clear grouped digits, then wait for a yes or no: "Alright - nine two nine, two four five, four nine one eight. Is that right?"
- Only after they confirm it, move on to the next missing field (usually address).
- Once confirmed, that phone number is LOCKED for the rest of the call, same as a locked name or address - if the caller asks "what number do you have?" later, including right after wrap-up, answer with the locked number. Never leave that hanging in silence.

CRITICAL - ADDRESS CAPTURE AND CONFIRM:
- Prefer collecting street first, then city/state/zip. Re-read the whole conversation before asking - never re-ask a piece already given (see CRITICAL - NO RE-ASK above).
- Street name fidelity (MUST): do NOT silently "correct" an uncommon street name into a more common-sounding one (for example, "Sylvan" must never become "Sullivan"). When a street name sounds uncommon or you're not fully sure you heard it right, spell it back or confirm it: "Sylvan - S-Y-L-V-A-N - is that right?"
- When you have street + city + state + zip, read back the FULL address ONCE as one block before wrapping up.
- For house number and zip in readbacks, speak digits clearly (four five seven... seven seven six four zero) so they cannot collapse (never turn 457 into 67).
- If the caller says the readback is wrong: ask ONLY the wrong field. Do not re-ask confirmed pieces or the whole address.
- NEVER invent, shorten, or alter house numbers, street names, cities, states, or zips.
- If a city or zip might be misheard (e.g. Beaumont vs Belmont), clarify with a choice: "Beaumont or Belmont?"
- LOCK RULE: once a field is confirmed or corrected (for example, the caller says "Beaumont" and you clarify it as Beaumont, or "77640" for the zip), that value is LOCKED for the rest of the call - never revert to an earlier, wrong value later (do not say "Belmont" again after the caller has confirmed "Beaumont"). Never invent or alter a house number, street name, city, state, or zip on your own - only use what the caller actually said.
- Wrap-up and any "I've got..." lines MUST use the same address pieces already confirmed - do not paraphrase into a new address.

CRITICAL - WRAP-UP LANGUAGE:
- When summarizing the case, stick to known fields only.
- Allowed shape: "So to wrap up, [title last name] - I've got your [service description] marked as [urgency] at [street], [city], [state] [zip]. Our team will call you shortly."
- service description examples: "roofing leak", "emergency roofing case" - NEVER invent words like "roofing week".
- Do not change city/street/number in the wrap-up from what was confirmed.
- Once the caller is clearly done - thanks / that's all / goodbye / nothing else - OR intake is complete and they've confirmed it, give one short, clean close, for example: "Thank you for calling Warm Home. Goodbye." Do not add another question, another comfort phrase, or drag the goodbye out.
- After you've said that closing line, the conversation is done - do not keep talking or ask anything further. The call closes out shortly after (this is paced and enforced in code - see CRITICAL - HANG-UP PACING below and the v30/v32/v35 hangup logic): there's a brief listen window in case the caller has one last quick thing to say (like asking to confirm the phone number), then it ends.

CRITICAL - HANG-UP PACING (MUST):
1. Finish the wrap-up/confirmation first - never cut that short.
2. Only ask "anything else?" if it's genuinely needed; if the caller says thanks/that's all, go straight to the close: "Thank you for calling Warm Home. Goodbye."
3. After that closing line, the code leaves a short listen window (about 1-2 seconds) before the call actually ends, in case the caller is still talking.
4. If the caller says something in that window (for example, "what number do you have?"), answer it - using the locked details you already have, per CRITICAL - PHONE CONFIRM and the address/name lock rules - then say goodbye again and let the call end. Do not leave that final question in silence.
5. Never treat the goodbye line as instant silence-and-hangup with nothing after it - the caller may still be mid-sentence.

CRITICAL - COST AND PAYMENT QUESTIONS:
- If the caller asks about pricing, cost, who pays, or how they pay:
  Lead with a natural ack per CRITICAL - ACKNOWLEDGMENTS above (Okay. / Alright. / Got it. / Sure. / I hear you. - vary it, don't repeat the same one every turn).
  Reflect: "You're asking what this costs and how payment works."
  Answer briefly: "There's no charge for this call. We set up a free inspection, then you get a repair estimate before any work. A lot of storm or leak jobs go through insurance - the team will walk you through that on the callback."
  Then ONE question: "Want me to note that you want cost and insurance options explained when they call?"
- NEVER ask if they already paid unless they said they already paid.
- After a clear "No," do not add a second assumption in the same reply.

CRITICAL - DO NOT SEND THE CASE EARLY:
- Do not say you are sending / submitting / dispatching the case until:
  (a) address has been confirmed, AND
  (b) the caller is not mid-question about cost, timing, or saying hold on.
- If they say "hold on", "don't send yet", or ask more questions: "Okay - I won't send it yet. What do you want to cover first?"

CRITICAL - ONE QUESTION PER TURN:
- Ask exactly one question per reply.
- Do not stack two questions ("What's going on today? What can I help you with?").
- Do not present multi-option menus (A, B, or C style choices) - ask one open, natural question instead. (Exception: a genuine two-way disambiguation of something misheard, like "Beaumont or Belmont?", is fine - that's confirming what they actually said, not offering a menu of options.)
- If the caller already answered something earlier in the call, acknowledge it and move the conversation forward - never make them repeat information they already gave.
- Pick a natural ack per CRITICAL - ACKNOWLEDGMENTS above (Okay / Alright / Got it / I hear you / Yeah / Still with you) - vary it, don't repeat the same one every turn and don't spam "Got it" back-to-back.
- Ban stiff lines like "Who do I have the pleasure of speaking with today?" - use "Alright - and your name?" only if name is still missing.
- Do not call the customer "dear."

CRITICAL - BAD QUESTIONS AND CORRECTIONS:
- Never ask a silly or illogical physical question about the damage (for example, do not ask if a fallen tree will "come off" on its own, or other odd literal questions that don't fit the situation).
- If the caller snaps at you, corrects you, or calls out a bad question: acknowledge it plainly - "You're right - bad question." or "You're right - sorry." - then move straight to ONE useful, relevant ask. Fix the actual fact they corrected; do not respond by stacking reassurance or comfort phrases instead.

CRITICAL - MATCH THE CALLER'S EMOTIONAL STATE:
- Stressed or upset caller: give ONE calm, steady line, then move to the next useful question - do not stack multiple reassurances on top of each other.
- Frustrated caller, or one who is correcting you: apologize once, briefly, and fix the actual thing they corrected - do not respond by piling on more reassurance instead of fixing it.
- Casual or relaxed caller: stay light and brief - don't force heavy reassurance language onto a caller who isn't stressed.
- Never put words in the caller's mouth or upgrade what they said into something bigger (for example, if they said "wind," do not say "hail" or "storm damage" unless they used that word themselves) - reflect back only what they actually told you.

If they ask what else you do besides roofing: give a SHORT sampler (tarping, water damage, cabinets, a few others), then ask what else is going on. Do not dump the full 10-service catalog unless they ask for the full list.

CRITICAL - OUTPUT FORMAT:
Always give your answer by calling the respond_to_caller tool - never answer in plain text. It takes exactly two things, same as before:
- reply: what you say out loud next, following all the voice-call rules above.
- extracted: whatever of name, phone, email, serviceType, urgencyLevel, description, addressStreet, addressCity, addressState, addressZip have been mentioned THIS CALL so far (this turn or an earlier turn) - leave a field out entirely if it hasn't been mentioned, never guess or invent a value. Full details on each field (allowed values, formatting) are in the tool's own schema.`;

// v34: forces the model's reply through a tool call instead of hoping it
// writes valid JSON in a plain text block. Render logs from a real call
// showed "JSON parse failed, using raw text as reply" firing on nearly
// every turn - Claude was replying in plain conversational text ("Okay, I
// go...") instead of the required JSON object. The Messages API has no
// native "always valid JSON" mode for free-text output, so with a system
// prompt this large (many CRITICAL rules), the OUTPUT FORMAT instruction
// was apparently not holding reliably. tool_choice forcing this exact tool
// makes that structurally impossible - Claude can only respond by filling
// in this schema, so there's no free-form JSON text to get wrong. Field
// names are UNCHANGED from the original reply/extracted shape - only the
// transport mechanism changed, not the shape itself.
const AURORA_RESPONSE_TOOL = {
  name: 'respond_to_caller',
  description: 'Give your next spoken reply to the caller, plus whatever caller details have been mentioned THIS CALL so far (this turn or an earlier turn). Always respond by calling this tool - never plain text.',
  input_schema: {
    type: 'object',
    properties: {
      reply: {
        type: 'string',
        description: 'What you say out loud next, following all the voice-call rules in the system prompt above (short, natural, plain speech, one question at a time, etc).'
      },
      extracted: {
        type: 'object',
        description: 'Caller details mentioned THIS CALL so far. Leave a field out entirely if it has not been mentioned yet - never guess or invent a value.',
        properties: {
          name: { type: 'string', description: "Customer's name, if mentioned this call so far." },
          phone: { type: 'string', description: 'Phone number as XXX-XXX-XXXX, if mentioned.' },
          email: { type: 'string', description: 'Email address, if mentioned.' },
          serviceType: {
            type: 'string',
            enum: ['roofing', 'tarping', 'tree', 'exterior', 'interior', 'waterproofing', 'armor', 'newbuild', 'millwork', 'solar'],
            description: 'Only if clearly identified.'
          },
          urgencyLevel: {
            type: 'string',
            enum: ['EMERGENCY', 'URGENT', 'ROUTINE'],
            description: "If you can judge it from what's been said."
          },
          description: { type: 'string', description: "Brief description of the caller's issue, if known." },
          addressStreet: { type: 'string', description: "Street number and street name only, e.g. '7007 Veterans Boulevard', if mentioned this call so far." },
          addressCity: { type: 'string', description: 'City, if mentioned this call so far.' },
          addressState: { type: 'string', description: 'State, if mentioned this call so far.' },
          addressZip: { type: 'string', description: 'Zip code, if mentioned this call so far.' }
        }
      }
    },
    required: ['reply', 'extracted']
  }
};

// ============================================
// SPEECH SANITIZATION
// ============================================

// v13: common abbreviations the voice would otherwise stumble over or
// spell out letter-by-letter. Deliberately leaves out "St." and "Dr."
// since those are genuinely ambiguous (Street vs Saint, Drive vs
// Doctor) and guessing wrong would be worse than leaving them alone.
// Starting set - easy to add more as we notice mispronunciations.
const ABBREVIATION_EXPANSIONS = [
  [/\bASAP\b/gi, 'as soon as possible'],
  [/\bapprox\.?(?![a-zA-Z])/gi, 'approximately'],
  [/\be\.g\.(?![a-zA-Z])/gi, 'for example'],
  [/\bi\.e\.(?![a-zA-Z])/gi, 'that is'],
  [/\betc\.(?![a-zA-Z])/gi, 'et cetera'],
  [/\bvs\.?(?![a-zA-Z])/gi, 'versus'],
  [/\bw\/o(?![a-zA-Z])/gi, 'without'],
  [/\bw\/(?![a-zA-Z])/gi, 'with'],
  [/\bsq\.?\s?ft\.?(?![a-zA-Z])/gi, 'square feet'],
  [/\bhrs?\.?(?![a-zA-Z])/gi, 'hours'],
  [/\bmins?\.?(?![a-zA-Z])/gi, 'minutes'],
  [/\bapt\.?(?![a-zA-Z])/gi, 'apartment'],
  [/\bste\.?(?![a-zA-Z])/gi, 'suite'],
  [/\bblvd\.?(?![a-zA-Z])/gi, 'boulevard'],
  [/\bave\.?(?![a-zA-Z])/gi, 'avenue'],
  [/\brd\.?(?![a-zA-Z])/gi, 'road']
];

function expandAbbreviations(text) {
  if (!text) return text;
  let result = text;
  for (const [pattern, replacement] of ABBREVIATION_EXPANSIONS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function sanitizeForSpeech(text) {
  if (!text) return text;
  return expandAbbreviations(text)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '')
    .replace(/[*_#`~]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ============================================
// TEMPORARY AUDIO HOSTING
// ============================================

const audioCache = new Map();
const AUDIO_TTL_MS = 2 * 60 * 1000;

function storeAudioClip(buffer) {
  pruneExpiredAudio();
  const id = randomUUID();
  audioCache.set(id, { buffer, expiresAt: Date.now() + AUDIO_TTL_MS });
  return id;
}

function pruneExpiredAudio() {
  const now = Date.now();
  for (const [id, clip] of audioCache.entries()) {
    if (clip.expiresAt < now) audioCache.delete(id);
  }
}

function buildAudioUrl(req, id) {
  return `${req.protocol}://${req.get('host')}/audio/${id}.mp3`;
}

// ============================================
// PER-CALL SESSION MEMORY
// ============================================

const activeCalls = new Map();

function getOrCreateAgent(callSid, calledNumber) {
  if (!activeCalls.has(callSid)) {
    const agent = new AuroraAgent();
    if (calledNumber) agent.calledNumber = calledNumber;
    activeCalls.set(callSid, agent);
  } else if (calledNumber) {
    const agent = activeCalls.get(callSid);
    if (!agent.calledNumber) agent.calledNumber = calledNumber;
  }
  return activeCalls.get(callSid);
}

function endCallSession(callSid) {
  activeCalls.delete(callSid);
}

// ============================================
// HELPER: speak text via ElevenLabs if it responds in time,
// otherwise Twilio's own voice. Never blocks past the timeout.
// ============================================

async function speak(twimlNode, agent, text, req) {
  const cleanText = sanitizeForSpeech(text);
  if (!cleanText) return;

  const elevenConfig = agent.config.voice.elevenlabs;
  const withTimeout = (promise, ms) =>
    Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('ElevenLabs timeout')), ms))
    ]);

  // v15: timed, same reason as the Claude call above - Render logs will
  // now show the actual ElevenLabs response time on every turn.
  const elevenStart = Date.now();
  try {
    const audioBuffer = await withTimeout(agent.textToSpeech(cleanText), elevenConfig.timeoutMs);
    console.log(`⏱️ ElevenLabs response time: ${Date.now() - elevenStart}ms`);
    const id = storeAudioClip(audioBuffer);
    const url = buildAudioUrl(req, id);
    // No pause here: this plays a pre-rendered audio file, not a live
    // TTS engine starting up, so there's no onset-clipping risk to guard
    // against - and the pause was costing a full second every turn.
    twimlNode.play(url);
    console.log('✅ Speaking via ElevenLabs:', url);
  } catch (error) {
    console.log(`⏱️ ElevenLabs failed/timed out after: ${Date.now() - elevenStart}ms`);
    // v10: log the actual HTTP status + ElevenLabs' own error body (not just
    // error.message) so the real cause shows up in Render logs - bad API
    // key, no quota, invalid voice ID, timeout, etc. all look identical
    // as a bare "error.message" but are very different problems.
    const status = error.response?.status;
    let body = error.response?.data;
    if (body && Buffer.isBuffer(body)) {
      try { body = JSON.parse(body.toString('utf8')); } catch (_) { body = body.toString('utf8'); }
    }
    console.error('⚠️ ElevenLabs unavailable, using Twilio voice instead.');
    console.error('   message:', error.message);
    if (status) console.error('   http status:', status);
    if (body) console.error('   response body:', JSON.stringify(body));
    twimlNode.pause({ length: 1 });
    twimlNode.say(cleanText, { voice: agent.config.voice.twilioFallback.voice });
  }
}

// ============================================
// AURORA GREETING & CONVERSATION MANAGEMENT
// ============================================

class AuroraAgent {
  constructor() {
    this.config = AURORA_CONFIG;
    this.conversationHistory = [];
    // v11: which of our Twilio numbers the customer actually called, so
    // confirmation texts can be sent from that same number. Set from the
    // webhook's "To" field as soon as the call comes in.
    this.calledNumber = null;
    this.collectedData = {
      callerName: null,
      callerPhone: null,
      callerEmail: null,
      serviceType: null,
      urgencyLevel: null,
      issueDescription: null,
      // v15: address split into pieces that are merged independently
      // (see converseAndExtract) instead of one field that gets
      // overwritten - previously, giving the city in a later turn
      // would wipe out a street address given earlier.
      propertyAddressStreet: null,
      propertyAddressCity: null,
      propertyAddressState: null,
      propertyAddressZip: null
    };
    // v24: every digit sequence the caller has actually said, across the
    // whole call (raw Twilio SpeechResult text, turn by turn) - used to
    // sanity-check that a house number Claude wrote down was actually
    // spoken by the caller at some point, not misheard/invented. See
    // checkHouseNumberMismatch().
    this.rawDigitsHeard = [];
  }

  // v15: builds one readable address string from whatever pieces we
  // have so far, without losing anything that's missing.
  getFullAddress() {
    const { propertyAddressStreet, propertyAddressCity, propertyAddressState, propertyAddressZip } = this.collectedData;
    const parts = [];
    if (propertyAddressStreet) parts.push(propertyAddressStreet);
    let cityState = [propertyAddressCity, propertyAddressState].filter(Boolean).join(', ');
    if (propertyAddressZip) cityState = cityState ? `${cityState} ${propertyAddressZip}` : propertyAddressZip;
    if (cityState) parts.push(cityState);
    return parts.join(', ');
  }

  getGreetingScript() {
    return "Thanks for calling Warm Home. This is Amy. How can I help you?";
  }

  // SINGLE Claude call: returns the spoken reply AND updates collectedData
  // from the extracted fields in the same response. Replaces the old
  // two-call (generateResponse + extractDataFromMessage) approach.
  async converseAndExtract(userMessage) {
    // v24: record every digit sequence the caller actually said this turn
    // (house numbers, zips, phone digits, whatever) - checkHouseNumberMismatch()
    // uses this later to sanity-check the house number Claude wrote down.
    const digitsThisTurn = (userMessage || '').match(/\d+/g);
    if (digitsThisTurn) this.rawDigitsHeard.push(...digitsThisTurn);

    try {
      const messages = [
        ...this.conversationHistory,
        { role: 'user', content: userMessage }
      ];

      // v15: timed, so Render logs show exactly how long Claude itself
      // took - needed to find out where multi-second delays are coming
      // from instead of guessing between Claude, ElevenLabs, or network.
      const claudeStart = Date.now();
      const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: this.config.claude.model,
        max_tokens: this.config.claude.maxTokens,
        system: AURORA_SYSTEM_PROMPT,
        messages: messages,
        // v34: force the reply through AURORA_RESPONSE_TOOL instead of
        // hoping Claude writes valid JSON in a plain text block - see the
        // comment on AURORA_RESPONSE_TOOL above for why (a real call's
        // Render logs showed the old text-JSON approach failing on nearly
        // every turn).
        tools: [AURORA_RESPONSE_TOOL],
        tool_choice: { type: 'tool', name: AURORA_RESPONSE_TOOL.name }
      }, {
        headers: {
          'x-api-key': this.config.claude.apiKey,
          'anthropic-version': '2023-06-01'
        }
      });
      console.log(`⏱️ Claude response time: ${Date.now() - claudeStart}ms`);

      const content = Array.isArray(response.data.content) ? response.data.content : [];

      // v34: primary path - tool_choice forces a tool_use block, and
      // Anthropic hands back input already parsed as a JS object, so there
      // is no JSON.parse step left to fail here at all.
      const toolUseBlock = content.find(block => block && block.type === 'tool_use' && block.input && typeof block.input === 'object');

      let parsed;
      if (toolUseBlock) {
        parsed = toolUseBlock.input;
      } else {
        // Defensive fallback only - should be rare with tool_choice forced.
        // Reuses the pre-v34 text-block JSON path so a one-off oddity still
        // degrades gracefully instead of losing the turn.
        const textBlock = content.find(block => block && block.type === 'text' && typeof block.text === 'string');
        if (!textBlock) {
          const blockTypes = content.map(b => b && b.type).join(', ') || '(none)';
          throw new Error(`No tool_use or text block found in Claude response (block types: [${blockTypes}])`);
        }
        let raw = textBlock.text.trim();
        raw = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
        try {
          parsed = JSON.parse(raw);
        } catch (parseError) {
          console.error('JSON parse failed (fallback text path), using raw text as reply:', parseError.message);
          const fallbackReply = sanitizeForSpeech(raw);
          this.conversationHistory.push({ role: 'user', content: userMessage });
          this.conversationHistory.push({ role: 'assistant', content: fallbackReply });
          return fallbackReply || "I'm sorry, could you say that one more time for me?";
        }
      }

      const reply = sanitizeForSpeech(parsed.reply || '');
      const ex = parsed.extracted || {};
      if (ex.name) this.collectedData.callerName = ex.name;
      if (ex.phone) this.collectedData.callerPhone = ex.phone;
      if (ex.email) this.collectedData.callerEmail = ex.email;
      if (ex.serviceType) this.collectedData.serviceType = ex.serviceType;
      if (ex.urgencyLevel) this.collectedData.urgencyLevel = ex.urgencyLevel;
      if (ex.description) this.collectedData.issueDescription = ex.description;
      // v15: each address piece is merged independently, so a new piece
      // (e.g. city) never wipes out a piece learned earlier (e.g. street).
      if (ex.addressStreet) this.collectedData.propertyAddressStreet = ex.addressStreet;
      if (ex.addressCity) this.collectedData.propertyAddressCity = ex.addressCity;
      if (ex.addressState) this.collectedData.propertyAddressState = ex.addressState;
      if (ex.addressZip) this.collectedData.propertyAddressZip = ex.addressZip;

      // Store just the natural reply in history (not the JSON wrapper) so
      // future turns read like a normal conversation.
      this.conversationHistory.push({ role: 'user', content: userMessage });
      this.conversationHistory.push({ role: 'assistant', content: reply });

      return reply;
    } catch (error) {
      console.error('Claude API Error:', error.response?.data || error.message);
      return "I apologize, I'm having trouble processing your request. Could you please try again?";
    }
  }

  async textToSpeech(text) {
    if (!text || !text.trim()) {
      throw new Error('textToSpeech called with empty text - skipping ElevenLabs call');
    }
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${this.config.voice.elevenlabs.voiceId}`,
      {
        text: text,
        model_id: this.config.voice.elevenlabs.modelId,
        voice_settings: {
          stability: this.config.voice.elevenlabs.stability,
          similarity_boost: this.config.voice.elevenlabs.similarityBoost,
          speed: this.config.voice.elevenlabs.speed
        }
      },
      {
        headers: {
          'xi-api-key': this.config.voice.elevenlabs.apiKey,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );
    return response.data;
  }

  hasRequiredData() {
    return (
      this.collectedData.callerName &&
      this.collectedData.callerPhone &&
      this.collectedData.serviceType &&
      this.collectedData.urgencyLevel &&
      this.collectedData.issueDescription &&
      this.collectedData.propertyAddressStreet &&
      this.collectedData.propertyAddressCity &&
      this.collectedData.propertyAddressState
    );
  }

  // v24: real test call caught Claude reading back "67" when the caller
  // had actually said "457" - the extraction silently corrupted the
  // number. This is a safety net, not a fix to the extraction itself:
  // before we're willing to finalize/save, check that the house number
  // sitting in propertyAddressStreet was actually said by the caller at
  // SOME point in the call (rawDigitsHeard, tracked in converseAndExtract).
  // If it was never actually heard, don't save it - ask instead.
  // Returns a clarifying question string if something looks wrong, or
  // null if it's fine to proceed.
  checkHouseNumberMismatch() {
    const street = this.collectedData.propertyAddressStreet;
    if (!street) return null;
    const storedMatch = street.match(/^(\d+)/);
    if (!storedMatch) return null; // no leading number to check (unusual, but not our job to block on)
    const storedNumber = storedMatch[1];

    // Nothing to cross-check against yet (e.g. Twilio's speech-to-text
    // returned the number as words, not digits, somewhere) - don't block
    // on a check we can't actually perform.
    if (this.rawDigitsHeard.length === 0) return null;

    if (!this.rawDigitsHeard.includes(storedNumber)) {
      return "Before I lock this in - can you say the house number for me one more time, just the numbers?";
    }
    return null;
  }

  // v24: readable label per service, used only for the code-generated
  // wrap-up line below - keeps the final summary honest instead of
  // trusting Claude's own free-form paraphrase to get the service right.
  static SERVICE_LABELS = {
    roofing: 'roofing',
    tarping: 'tarping',
    tree: 'tree removal',
    exterior: 'exterior',
    interior: 'interior',
    waterproofing: 'waterproofing',
    armor: 'armor plating',
    newbuild: 'new build',
    millwork: 'millwork',
    solar: 'solar'
  };

  // v24: the actual fix for "roofing week" and the wrong-city wrap-up -
  // this builds the final case summary entirely from collectedData (the
  // merged, confirmed session fields), never from Claude's own free-form
  // text for that turn. Matches the WRAP-UP LANGUAGE rule in the prompt,
  // but enforced in code so it can't drift or invent a word.
  buildWrapUpLine() {
    const { serviceType, urgencyLevel, issueDescription } = this.collectedData;
    const label = AuroraAgent.SERVICE_LABELS[serviceType] || 'service';
    const urgencyText = urgencyLevel ? urgencyLevel.toLowerCase() : 'routine';
    const address = this.getFullAddress();
    const caseDescription = issueDescription ? `${label} - ${issueDescription}` : `${label} case`;
    return `So to wrap up - I've got your ${caseDescription} marked as ${urgencyText} at ${address}. Our team will call you shortly. Thank you for choosing Warm Home!`;
  }

  // v24: code-level backstop for the "DO NOT SEND THE CASE EARLY" prompt
  // rule - a real test call showed Amy starting to wrap up/submit while
  // the caller was still mid-question about cost. This is a plain keyword
  // heuristic, not true intent understanding, so it can be loosened later
  // if it ever holds a call that should have gone through - but the cost
  // of a false hold (one extra turn) is much lower than the cost of a
  // false finalize (case submitted while the caller's still talking).
  static holdsSubmission(userMessage) {
    if (!userMessage) return false;
    const text = userMessage.toLowerCase();
    const askedToWait = /\b(hold on|hold up|wait|don'?t send|not yet|one second|one sec|give me a (sec|second|minute))\b/.test(text);
    const askingAboutCost = /\b(cost|price|pricing|how much|pay|payment|insurance|deductible|afford)\b/.test(text) && text.includes('?');
    return askedToWait || askingAboutCost;
  }

  // v30: code-level backstop for "the call doesn't hang up" - the only
  // existing hangup path was status === 'ready_to_route', which requires
  // hasRequiredData() to be true (full case collected AND saved). A real
  // test call showed a caller saying goodbye/that's all before the case
  // was fully collected (e.g. no address given, or they didn't want a
  // callback) - hasRequiredData() never went true, so the call just sat
  // open on another <Gather>, waiting out the full 30s silence timeout
  // before the fallback line finally hung up. This is a plain keyword
  // heuristic, same style as holdsSubmission above - it only fires when
  // Claude's own reply this turn isn't itself a question, so a real
  // wrap-up question never gets cut off.
  // v32: widened the phrase list - QA's "hang up after goodbye" spec
  // explicitly lists "thanks" as a closing signal, and the original list
  // only caught "no thank you"/"no thanks" (required a leading "no"), so a
  // bare "Thanks" or "Thank you" at the end of a call fell through and the
  // call stayed open. Also added a few more plain closing phrases from the
  // spec ("we're done", "I'm done", "that covers it").
  static isCallerClosing(userMessage) {
    if (!userMessage) return false;
    const text = userMessage.toLowerCase().trim();
    return /\b(bye|goodbye|good bye|thanks|thank you|that'?s all|that'?s it|that'?s everything|nothing else|no,? ?that'?s it|no thank you|no thanks|i'?m good|all set|that'?ll be (all|it)|we'?re done|i'?m done|that covers it)\b/.test(text);
  }

  async determineRouting() {
    const urgency = this.collectedData.urgencyLevel;
    const service = this.collectedData.serviceType;

    if (urgency === 'EMERGENCY') {
      return { team: 'emergency_dispatch', priority: 'IMMEDIATE', responseTime: '2-4 hours' };
    } else if (urgency === 'URGENT') {
      return { team: 'urgent_queue', priority: 'HIGH', responseTime: '24-48 hours' };
    } else {
      return { team: `${service}_scheduling`, priority: 'NORMAL', responseTime: 'flexible' };
    }
  }

  async saveInquiryData() {
    try {
      const payload = {
        caller_name: this.collectedData.callerName,
        caller_phone: this.collectedData.callerPhone,
        caller_email: this.collectedData.callerEmail,
        service_type: this.collectedData.serviceType,
        urgency_level: this.collectedData.urgencyLevel,
        issue_description: this.collectedData.issueDescription,
        property_address: this.getFullAddress(),
        timestamp: new Date().toISOString(),
        routing_team: (await this.determineRouting()).team,
        call_status: 'completed',
        agent_name: 'Amy'
      };

      const response = await axios.post(
        `${this.config.supabase.url}/rest/v1/inquiries`,
        payload,
        {
          headers: {
            'apikey': this.config.supabase.key,
            'Authorization': `Bearer ${this.config.supabase.key}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('Inquiry saved to Supabase:', response.data);
      return response.data;
    } catch (error) {
      console.error('Supabase save error:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendSMSConfirmation() {
    try {
      const client = twilio(this.config.twilio.accountSid, this.config.twilio.authToken);
      const routing = await this.determineRouting();
      const message = `Hi ${this.collectedData.callerName}! Thank you for calling Warm Home. We received your ${this.collectedData.serviceType} inquiry. Our ${routing.team} team will contact you within ${routing.responseTime}. -Amy`;

      // v11: text back from the same number the customer called, so it
      // looks like a reply from the number they dialed, not a stranger
      // number. Falls back to the single configured number only if we
      // somehow don't know which number was called.
      const fromNumber = this.calledNumber || this.config.twilio.phoneFrom;

      await client.messages.create({
        body: message,
        from: fromNumber,
        to: this.collectedData.callerPhone
      });
      console.log(`SMS sent successfully from ${fromNumber}`);
    } catch (error) {
      console.error('SMS send error:', error.response?.data || error.message);
    }
  }

  async handleConversation(userMessage) {
    let response = await this.converseAndExtract(userMessage);

    if (!response || !response.trim()) {
      response = "I'm sorry, could you say that one more time for me?";
    }

    if (this.hasRequiredData()) {
      // v24: don't finalize on a turn where the caller is still mid-question
      // about cost/payment, or explicitly asked us to hold off - a real
      // test call caught Amy announcing she was submitting the case while
      // the caller was still asking who pays. Claude's own reply this turn
      // already handles the cost question / hold request per the prompt
      // rules - just don't let the code finalize underneath that reply.
      if (AuroraAgent.holdsSubmission(userMessage)) {
        return {
          response,
          status: 'collecting_data',
          dataCollected: this.collectedData
        };
      }

      // v24: sanity-check the house number before trusting it enough to
      // save/text it out. If it doesn't check out, ask instead of saving -
      // this replaces Claude's own turn reply with a direct clarifying
      // question for this turn only.
      const mismatchQuestion = this.checkHouseNumberMismatch();
      if (mismatchQuestion) {
        return {
          response: mismatchQuestion,
          status: 'collecting_data',
          dataCollected: this.collectedData
        };
      }

      // v24: the closing line is now built entirely from collectedData
      // (buildWrapUpLine), not from whatever Claude free-formed this turn -
      // this is what stops an invented word ("roofing week") or a wrong
      // city from ever reaching the caller or Supabase.
      response = this.buildWrapUpLine();
      await this.saveInquiryData();
      await this.sendSMSConfirmation();
      return {
        response,
        status: 'ready_to_route',
        routing: await this.determineRouting()
      };
    }

    return {
      response,
      status: 'collecting_data',
      dataCollected: this.collectedData
    };
  }
}

// ============================================
// TWILIO WEBHOOK HANDLER
// ============================================

exports.handleCall = async (req, res) => {
  console.log('🎤 TWILIO WEBHOOK HIT - Incoming call received!');

  const callSid = req.body.CallSid;
  const agent = getOrCreateAgent(callSid, req.body.To);
  const twiml = new twilio.twiml.VoiceResponse();

  try {
    const greeting = agent.getGreetingScript();
    console.log('📝 Greeting:', greeting);

    const gather = twiml.gather({
      numDigits: 0,
      timeout: 30,
      speechTimeout: 'auto',
      input: 'speech',
      action: '/voice/gather-response',
      hints: GATHER_SPEECH_HINTS // v33: additive only, the four settings above are untouched
    });

    await speak(gather, agent, greeting, req);

    // v15: this part of the document only runs if the Gather above times
    // out with total silence and Twilio falls through to it - NOT on
    // every call. (Session cleanup for a real timeout still happens the
    // normal way, via the /voice/status callback below, so we don't
    // delete the in-memory session here - that would wipe out the
    // conversation memory even on calls where the gather succeeds fine.)
    // Previously nothing followed the Gather at all, which is why a call
    // could just go dead in silence (e.g. if someone said "hold on" and
    // stepped away) - now it says something and hangs up cleanly instead.
    await speak(twiml, agent, "It looks like we got disconnected. Please give us a call back whenever you're ready. Goodbye!", req);
    twiml.hangup();

    console.log('✅ Sending TwiML response to Twilio');
    res.type('text/xml');
    res.send(twiml.toString());

  } catch (error) {
    console.error('❌ Call handling error:', error);
    twiml.say("We're experiencing technical difficulties. Please try again later.");
    res.type('text/xml');
    res.send(twiml.toString());
  }
};

exports.handleGatherResponse = async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const userMessage = req.body.SpeechResult || '';
  const callSid = req.body.CallSid;
  const agent = getOrCreateAgent(callSid, req.body.To);

  try {
    const result = await agent.handleConversation(userMessage);

    if (result.status === 'ready_to_route') {
      // Say the closing line and the goodbye together as ONE utterance so
      // there's no jarring switch to a different voice at the very end.
      await speak(twiml, agent, `${result.response} Thank you for calling. Goodbye!`, req);
      // v35: HANG-UP PACING - leave a short listen window (~2s) before the
      // call actually ends, in case the caller is still talking (e.g.
      // "what number do you have?"). If they speak, Twilio POSTs to
      // /voice/post-goodbye, which answers using the locked call data and
      // closes out for good. If they stay silent, this gather times out
      // and falls through to the hangup right below it - no second HTTP
      // round-trip needed for the silent case. Deliberately NOT calling
      // endCallSession() here anymore (was v30-v34 behavior) - ending the
      // session immediately would wipe the locked name/phone/address
      // before a caller who speaks in the listen window could get an
      // answer. /voice/status already cleans up the session reliably once
      // the call actually ends, same as the plain-silence-timeout path
      // below always relied on.
      twiml.gather({
        numDigits: 0,
        timeout: 2,
        speechTimeout: 'auto',
        input: 'speech',
        action: '/voice/post-goodbye',
        hints: GATHER_SPEECH_HINTS
      });
      twiml.hangup();
    } else if (AuroraAgent.isCallerClosing(userMessage) && !/\?\s*$/.test((result.response || '').trim())) {
      // v30: caller said goodbye but the case wasn't fully collected/
      // submitted - still end the call cleanly instead of leaving it open
      // on another Gather. Claude's own reply this turn is already the
      // short closing line per the CRITICAL - WRAP-UP LANGUAGE rule, so we
      // just speak it and hang up - no second "Thank you for calling"
      // stacked on top, and no save/SMS since the case isn't complete.
      await speak(twiml, agent, result.response, req);
      // v35: same short listen window before ending, and same reasoning
      // for not calling endCallSession() here directly - see the
      // ready_to_route branch above.
      twiml.gather({
        numDigits: 0,
        timeout: 2,
        speechTimeout: 'auto',
        input: 'speech',
        action: '/voice/post-goodbye',
        hints: GATHER_SPEECH_HINTS
      });
      twiml.hangup();
    } else {
      const gather = twiml.gather({
        numDigits: 0,
        timeout: 30,
        speechTimeout: 'auto',
        input: 'speech',
        action: '/voice/gather-response',
        hints: GATHER_SPEECH_HINTS // v33: additive only, the four settings above are untouched
      });
      await speak(gather, agent, result.response, req);

      // v15: same conditional safety net as the initial greeting - only
      // runs if THIS Gather times out with total silence, not on every
      // turn. No endCallSession() here for the same reason noted above.
      await speak(twiml, agent, "It looks like we got disconnected. Please give us a call back whenever you're ready. Goodbye!", req);
      twiml.hangup();
    }

    console.log('✅ Sending TwiML gather-response to Twilio');
    res.type('text/xml');
    res.send(twiml.toString());

  } catch (error) {
    console.error('❌ Gather response error:', error);
    twiml.say("I apologize, I'm having difficulty. Please call back soon.", { voice: 'Polly.Joanna-Neural' });
    twiml.hangup();
    endCallSession(callSid);
    res.type('text/xml');
    res.send(twiml.toString());
  }
};

// v35: HANG-UP PACING - handles the short listen window left open after a
// closing goodbye (see the two hangup branches in handleGatherResponse
// above). Twilio only POSTs here if the caller actually said something in
// that ~2s window - if they stayed silent, that Gather times out and the
// call already ended via the hangup in the same TwiML document, no HTTP
// round-trip needed. This route is deliberately bounded to ONE more
// exchange (answer, then a final goodbye, then hang up for real) rather
// than reopening full back-and-forth intake, so it can't loop.
exports.handlePostGoodbye = async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const userMessage = req.body.SpeechResult || '';
  const callSid = req.body.CallSid;
  const agent = getOrCreateAgent(callSid, req.body.To);

  try {
    if (userMessage && userMessage.trim()) {
      // Deliberately calls converseAndExtract() directly, NOT
      // handleConversation() - the case may already be finalized
      // (ready_to_route already ran buildWrapUpLine/saveInquiryData/
      // sendSMSConfirmation once), and hasRequiredData() would still be
      // true here, so handleConversation() would finalize AGAIN and
      // double-save/double-text the caller. converseAndExtract() just
      // gets Claude's answer for this one follow-up turn, using the same
      // locked name/phone/address data and voice-call rules (e.g.
      // CRITICAL - PHONE CONFIRM), without re-running the finalize path.
      const reply = await agent.converseAndExtract(userMessage);
      await speak(twiml, agent, `${reply} Thank you for calling. Goodbye!`, req);
    } else {
      await speak(twiml, agent, "Thank you for calling Warm Home. Goodbye.", req);
    }
  } catch (error) {
    console.error('❌ Post-goodbye handling error:', error);
    await speak(twiml, agent, "Thank you for calling Warm Home. Goodbye.", req);
  }

  twiml.hangup();
  endCallSession(callSid);
  res.type('text/xml');
  res.send(twiml.toString());
};

exports.handleCallStatus = async (req, res) => {
  const callSid = req.body.CallSid;
  if (callSid) endCallSession(callSid);
  res.sendStatus(200);
};

// ============================================
// EXPRESS SERVER SETUP
// ============================================

const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: false }));

app.get('/', (req, res) => {
  res.json({
    status: 'Aurora Voice Agent LIVE',
    version: '35.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/audio/:id.mp3', (req, res) => {
  const clip = audioCache.get(req.params.id);
  if (!clip) {
    res.status(404).send('Not found or expired');
    return;
  }
  res.type('audio/mpeg');
  res.send(clip.buffer);
});

app.post('/voice', exports.handleCall);
app.post('/voice/gather-response', exports.handleGatherResponse);
app.post('/voice/post-goodbye', exports.handlePostGoodbye); // v35: HANG-UP PACING listen window
app.post('/voice/status', exports.handleCallStatus);

// v10: log which required keys are actually present at startup - without
// printing the secret values themselves - so a missing/blank env var in
// Render's Environment tab shows up in the logs immediately instead of
// only surfacing later as a mysterious failure mid-call.
function logKeyStatus() {
  const checks = [
    ['TWILIO_ACCOUNT_SID', AURORA_CONFIG.twilio.accountSid],
    ['TWILIO_AUTH_TOKEN', AURORA_CONFIG.twilio.authToken],
    ['TWILIO_PHONE_FROM', AURORA_CONFIG.twilio.phoneFrom],
    ['ELEVENLABS_API_KEY', AURORA_CONFIG.voice.elevenlabs.apiKey],
    ['ANTHROPIC_API_KEY', AURORA_CONFIG.claude.apiKey],
    ['SUPABASE_URL', AURORA_CONFIG.supabase.url],
    ['SUPABASE_KEY', AURORA_CONFIG.supabase.key]
  ];
  console.log('🔑 Environment variable check:');
  for (const [name, value] of checks) {
    console.log(`   ${value ? '✅' : '❌ MISSING'} ${name}`);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎤 Aurora Voice Agent running on port ${PORT}`);
  console.log(`📱 Ready to receive calls on all 8 phone numbers`);
  console.log(`🤖 Using Claude API (single call/turn) + ElevenLabs voice (with Twilio fallback)`);
  logKeyStatus();
});

module.exports = { AuroraAgent, app };
