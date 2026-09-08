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
      voiceId: 'EXAVITQu4vr4xnSDxMaL', // Bella - professional, confident, natural
      modelId: 'eleven_turbo_v2_5',
      stability: 0.5,
      similarityBoost: 0.75,
      timeoutMs: 2500 // give up and use Twilio's voice if ElevenLabs is slower than this
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
    name: 'Aurora',
    alternateNames: ['Grace', 'Angel', 'Hope'],
    tone: 'Professional, warm, articulate, and empathetic',
    delivery: 'Patient vocal delivery with deliberate pacing to build trust'
  }
};

// ============================================
// AURORA SYSTEM PROMPT
// ============================================

const AURORA_SYSTEM_PROMPT = `You are Aurora, a professional, warm, and articulate digital assistant for Warm Home Inc. Your role is to be adaptable, helpful, and ready to assist with a wide variety of inquiries, information gathering, or administrative tasks for the company as a whole, always maintaining a warm and empathetic tone.

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
- Tone: Professional yet warm, like a trusted advisor
- Pace: Patient, deliberate pacing - no awkward silences
- Language: Clear, jargon-free, accessible to all
- Engagement: Use customer names, ask clarifying questions, listen actively

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

WARM HOME INC. SERVICES (9 Total):
1. Roofing - Permanent repairs & replacements
2. Tarping - Emergency temporary protection
3. Tree Removal - Tree removal & stump grinding
4. Exterior - Siding, fascia, gutters, painting
5. Interior - Drywall, painting, flooring, water damage, mold
6. Waterproofing - Basement, crawlspace, moisture control
7. Armor Plating - Polyurea protective coatings
8. New Build - Construction, additions, renovations
9. Millwork - Custom cabinets from NJ factory

YOUR PRIMARY GOAL IN THIS CALL:
1. Greet warmly and professionally
2. Listen and understand the customer's situation completely
3. Ask clarifying questions to identify the service needed
4. Assess urgency level (EMERGENCY / URGENT / ROUTINE)
5. Collect required information: name, phone, email (if given), service type, description, address
6. Explain next steps clearly so they feel informed
7. Confirm they understand and feel confident in Warm Home Inc.
8. End call by saving their data and routing to appropriate team

CRITICAL - THIS IS A LIVE PHONE CALL, NOT A CHAT WINDOW:
- Everything you write is read aloud by a text-to-speech voice. The caller cannot see text.
- NEVER use emoji, emoticons, asterisks, markdown formatting, bullet points, numbered lists, or any symbols - say things in plain, natural spoken sentences only.
- Keep every reply SHORT: 1-3 sentences per turn. Ask one question at a time. Real phone agents don't give long speeches - they have a brief, natural back-and-forth.
- Be warm but efficient - skip long compliments or gushing reactions to small talk. A brief, genuine acknowledgment is enough, then move the conversation forward.

CRITICAL - OUTPUT FORMAT:
You must respond with ONLY a single valid JSON object, nothing else - no text before or after it, no markdown code fences. The shape is exactly:
{
  "reply": "<what you say out loud next, following all the voice-call rules above>",
  "extracted": {
    "name": "<customer's name if mentioned this call so far, else null>",
    "phone": "<phone number as XXX-XXX-XXXX if mentioned, else null>",
    "email": "<email if mentioned, else null>",
    "serviceType": "<one of: roofing, tarping, tree, exterior, interior, waterproofing, armor, newbuild, millwork - only if clearly identified, else null>",
    "urgencyLevel": "<EMERGENCY, URGENT, or ROUTINE if you can judge it from what's been said, else null>",
    "description": "<brief description of their issue if known, else null>",
    "address": "<property address if mentioned, else null>"
  }
}`;

// ============================================
// SPEECH SANITIZATION
// ============================================

function sanitizeForSpeech(text) {
  if (!text) return text;
  return text
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

function getOrCreateAgent(callSid) {
  if (!activeCalls.has(callSid)) {
    activeCalls.set(callSid, new AuroraAgent());
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

  try {
    const audioBuffer = await withTimeout(agent.textToSpeech(cleanText), elevenConfig.timeoutMs);
    const id = storeAudioClip(audioBuffer);
    const url = buildAudioUrl(req, id);
    twimlNode.pause({ length: 1 });
    twimlNode.play(url);
    console.log('✅ Speaking via ElevenLabs:', url);
  } catch (error) {
    console.error('⚠️ ElevenLabs unavailable, using Twilio voice instead:', error.message);
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
    this.collectedData = {
      callerName: null,
      callerPhone: null,
      callerEmail: null,
      serviceType: null,
      urgencyLevel: null,
      issueDescription: null,
      propertyAddress: null
    };
  }

  getGreetingScript() {
    return "Hello! Thank you for contacting Warm Home Inc. My name is Aurora. How may I assist you today?";
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
      if (ex.address) this.collectedData.propertyAddress = ex.address;

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
          similarity_boost: this.config.voice.elevenlabs.similarityBoost
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
      this.collectedData.propertyAddress
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
        property_address: this.collectedData.propertyAddress,
        timestamp: new Date().toISOString(),
        routing_team: (await this.determineRouting()).team,
        call_status: 'completed',
        agent_name: 'Aurora'
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
      const message = `Hi ${this.collectedData.callerName}! Thank you for calling Warm Home Inc. We received your ${this.collectedData.serviceType} inquiry. Our ${routing.team} team will contact you within ${routing.responseTime}. -Aurora`;

      await client.messages.create({
        body: message,
        from: this.config.twilio.phoneFrom,
        to: this.collectedData.callerPhone
      });
      console.log('SMS sent successfully');
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
  const agent = getOrCreateAgent(callSid);
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
  const agent = getOrCreateAgent(callSid);

  try {
    const result = await agent.handleConversation(userMessage);

    if (result.status === 'ready_to_route') {
      await speak(twiml, agent, result.response, req);
      twiml.say("Thank you for calling. Goodbye!", { voice: agent.config.voice.twilioFallback.voice });
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
    version: '5.0.0',
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎤 Aurora Voice Agent running on port ${PORT}`);
  console.log(`📱 Ready to receive calls on all 8 phone numbers`);
  console.log(`🤖 Using Claude API (single call/turn) + ElevenLabs voice (with Twilio fallback)`);
});

module.exports = { AuroraAgent, app };
