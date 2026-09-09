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
      // that combo made her sound slurred and sleepy instead. Reverting
      // stability to the reliable original value and only barely touching speed.
      stability: 0.5,
      similarityBoost: 0.75,
      speed: 0.97,
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
- Tone: Warm and genuinely caring, like a trusted advisor who actually feels for the person on the other end of the line - not a script-reader collecting fields.
- Pace: Patient, deliberate pacing - no awkward silences
- Language: Clear, jargon-free, accessible to all
- Engagement: Use the customer's first name naturally once you know it. Until you know their last name, default to "sir" or "ma'am" (based on how they sound, or how they refer to themselves). Once you have their LAST name, switch to a proper title paired with the LAST name - never the first name (never say "Mister Joseph"). Pick the title this way, in order:
  1. If the caller states or implies a professional/formal title for themselves (Doctor, Captain, Professor, Reverend, Engineer, etc.), use THAT title with their last name (e.g. "Doctor Chen") - that always takes priority.
  2. Otherwise, use "Mr." for a caller who sounds or presents as male, "Ms." for a caller who sounds or presents as female, paired with their last name (e.g. "Mr. Sadi", "Ms. Rivera"). Make your best natural judgment from the conversation - if it's ever unclear, "sir" or "ma'am" is a safe fallback.
  Use a title in EVERY reply once you have one available, not just occasionally.
- Emotional connection: When someone describes a problem - a leak, storm damage, water coming into their home - briefly and genuinely acknowledge how that feels before moving into the next question ("that sounds really stressful, especially with water getting in - let's get this handled for you"). Don't just extract information; make them feel heard and cared for at every step, the way a person who truly wants to help would.
- Curiosity: When you ask a question, phrase it like you're genuinely curious about their specific situation, not reading off a checklist. Prefer "What happened with the roof - was it the storm last night?" over a flat "What is the issue?" Vary your phrasing turn to turn rather than repeating the same question structure.
- Name accuracy: Names (especially last names) are easy to mishear on a phone line. If you're not confident you caught a name correctly, or a caller has already repeated it once, politely ask them to spell it out letter by letter rather than just asking them to repeat it again the same way.

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
1. Greet warmly and professionally, and get the caller's name right away, before asking about their issue
2. Listen and understand the customer's situation completely
3. Ask clarifying questions to identify the service needed
4. Assess urgency level (EMERGENCY / URGENT / ROUTINE)
5. Collect required information: name, phone, email (if given), service type, description, address
6. Explain next steps clearly so they feel informed
7. Confirm they understand and feel confident in Warm Home Inc.
8. End call by saving their data and routing to appropriate team

When speaking to the caller, refer to the company as "Warm Home" - never say "Warm Home Inc." out loud, that's only the legal name.

CRITICAL - THIS IS A LIVE PHONE CALL, NOT A CHAT WINDOW:
- Everything you write is read aloud by a text-to-speech voice. The caller cannot see text.
- NEVER use emoji, emoticons, asterisks, markdown formatting, bullet points, numbered lists, or any symbols - say things in plain, natural spoken sentences only.
- Keep every reply SHORT: 1-3 sentences per turn. Ask one question at a time. Real phone agents don't give long speeches - they have a brief, natural back-and-forth.
- Be warm but efficient - skip long compliments or gushing reactions to small talk. A brief, genuine acknowledgment is enough, then move the conversation forward.

CRITICAL - ADDRESS RULE: Before asking any address-related question, re-read the ENTIRE conversation so far. If the caller has already told you the street, the city, the state, or the zip code - even just once, even several turns ago - NEVER ask for that piece again. Only ask for the SPECIFIC piece you're still missing (for example, if you have the street but not the city, ask only "What city and state is that in?" - do not re-ask for the whole address). If the caller has given you the complete address already, do not ask about it again at all - move on.

CRITICAL - OUTPUT FORMAT:
You must respond with ONLY a single valid JSON object, nothing else - no text before or after it, no markdown code fences. The shape is exactly:
{
  "reply": "<what you say out loud next, following all the voice-call rules above>",
  "extracted": {
    "name": "<customer's name if mentioned this call so far, else null>",
    "phone": "<phone number as XXX-XXX-XXXX if mentioned, else null>",
    "email": "<email if mentioned, else null>",
    "serviceType": "<one of: roofing, tarping, tree, exterior, interior, waterproofing, armor, newbuild, millwork, solar - only if clearly identified, else null>",
    "urgencyLevel": "<EMERGENCY, URGENT, or ROUTINE if you can judge it from what's been said, else null>",
    "description": "<brief description of their issue if known, else null>",
    "addressStreet": "<street number and street name only, e.g. '7007 Veterans Boulevard', if mentioned this call so far (this turn or an earlier turn), else null>",
    "addressCity": "<city if mentioned this call so far, else null>",
    "addressState": "<state if mentioned this call so far, else null>",
    "addressZip": "<zip code if mentioned this call so far, else null>"
  }
}`;

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
    return "Thank you for calling Warm Home. I'm Amy. Who do I have the pleasure of speaking to? How can I help you?";
  }

  // SINGLE Claude call: returns the spoken reply AND updates collectedData
  // from the extracted fields in the same response. Replaces the old
  // two-call (generateResponse + extractDataFromMessage) approach.
  async converseAndExtract(userMessage) {
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
        messages: messages
      }, {
        headers: {
          'x-api-key': this.config.claude.apiKey,
          'anthropic-version': '2023-06-01'
        }
      });
      console.log(`⏱️ Claude response time: ${Date.now() - claudeStart}ms`);

      // Don't assume the reply is content[0] - Claude sometimes puts a
      // "thinking" block first. Find the actual text block instead.
      const textBlock = Array.isArray(response.data.content)
        ? response.data.content.find(block => block && block.type === 'text' && typeof block.text === 'string')
        : null;
      if (!textBlock) {
        const blockTypes = Array.isArray(response.data.content)
          ? response.data.content.map(b => b && b.type).join(', ')
          : typeof response.data.content;
        throw new Error(`No text block found in Claude response (block types: [${blockTypes}])`);
      }
      let raw = textBlock.text.trim();
      raw = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (parseError) {
        // Claude didn't return clean JSON this turn - fall back to using
        // whatever text it did produce as the spoken reply, and skip
        // extraction just for this turn rather than failing the call.
        console.error('JSON parse failed, using raw text as reply:', parseError.message);
        const fallbackReply = sanitizeForSpeech(raw);
        this.conversationHistory.push({ role: 'user', content: userMessage });
        this.conversationHistory.push({ role: 'assistant', content: fallbackReply });
        return fallbackReply || "I'm sorry, could you say that one more time for me?";
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
      response += " I've got everything I need - our team will reach out within the timeframe I mentioned. Thank you for choosing Warm Home!";
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
      action: '/voice/gather-response'
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
      twiml.hangup();
      endCallSession(callSid);
    } else {
      const gather = twiml.gather({
        numDigits: 0,
        timeout: 30,
        speechTimeout: 'auto',
        input: 'speech',
        action: '/voice/gather-response'
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
    version: '21.0.0',
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
