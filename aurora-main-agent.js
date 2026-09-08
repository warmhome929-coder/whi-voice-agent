/**
 * AURORA VOICE AGENT - MAIN APPLICATION
 * Complete implementation of Aurora Generalist System
 * Handles: Call greeting, data collection, routing, CRM integration
 *
 * Technology: Node.js + Twilio + ElevenLabs + Claude API + Supabase
 *
 * FIXES IN THIS VERSION (v3):
 *  - SPEED: The two Claude calls per turn (data extraction + reply
 *    generation) now run in PARALLEL instead of one after another,
 *    roughly halving the "hesitation" delay.
 *  - REAL ELEVENLABS VOICE, SAFELY: ElevenLabs audio is now properly
 *    hosted at a real URL on this same server (Twilio's <Play> needs a
 *    real fetchable URL, not an inline data: URI - inline never
 *    actually worked). Aurora tries ElevenLabs first (with a timeout),
 *    and only falls back to Twilio's own voice if ElevenLabs is too
 *    slow or fails - so the nicer voice plays when possible, but a
 *    slow/broken ElevenLabs can never break the call again.
 *  - NO WORD CLIPPING: a brief pause is added before Aurora starts
 *    speaking each turn, so the first word ("Aurora", "Warm Home")
 *    doesn't get cut off at the start of the audio.
 *  - (carried over from v2) Call memory across the whole call (keyed by
 *    CallSid), no spoken-aloud emoji, short natural phone-style replies.
 */

const twilio = require('twilio');
const { randomUUID } = require('crypto');
const axios = require('axios');

// ============================================
// AURORA SYSTEM CONFIGURATION
// ============================================

const AURORA_CONFIG = {
  // Twilio Configuration
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneFrom: process.env.TWILIO_PHONE_FROM || '+15043215552'
  },

  // Voice Configuration
  voice: {
    elevenlabs: {
      apiKey: process.env.ELEVENLABS_API_KEY,
      voiceId: 'EXAVITQu4vr4xnSDxMaL', // Bella - professional, confident, natural
      modelId: 'eleven_turbo_v2_5',
      stability: 0.5,
      similarityBoost: 0.75,
      // If ElevenLabs hasn't responded within this long, fall back to Twilio's voice
      // rather than make the caller wait in silence.
      timeoutMs: 3500
    },
    twilioFallback: {
      // Used only if ElevenLabs times out or errors.
      // Polly neural voice pronounces names far more reliably than the generic 'woman' voice.
      voice: 'Polly.Joanna-Neural'
    }
  },

  // Claude API Configuration
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-5',
    maxTokens: 300 // Keep phone replies short - long responses feel unnatural spoken aloud
  },

  // Supabase Configuration
  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY
  },

  // Aurora Persona
  aurora: {
    name: 'Aurora',
    alternateNames: ['Grace', 'Angel', 'Hope'],
    tone: 'Professional, warm, articulate, and empathetic',
    delivery: 'Patient vocal delivery with deliberate pacing to build trust'
  }
};

// ============================================
// AURORA SYSTEM PROMPT - YOUR EXACT SPECIFICATION
// (+ voice-call ground rules added at the end)
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
- Be warm but efficient - skip long compliments or gushing reactions to small talk. A brief, genuine acknowledgment is enough, then move the conversation forward.`;

// ============================================
// SPEECH SANITIZATION - strip anything that
// would sound wrong or get read aloud literally
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
// Twilio's <Play> needs a real, fetchable HTTPS URL - it can't play an
// inline base64 data: URI. So we hold each generated clip in memory
// under a short-lived id and serve it back at /audio/:id.mp3.
// ============================================

const audioCache = new Map(); // id -> { buffer, expiresAt }
const AUDIO_TTL_MS = 2 * 60 * 1000; // 2 minutes is plenty - Twilio fetches it within seconds

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
// Keyed by Twilio's CallSid so Aurora remembers the conversation from
// pickup to hangup, instead of starting fresh on every single sentence.
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
// HELPER: speak text using ElevenLabs if it responds in time,
// otherwise fall back to Twilio's own voice. Never blocks longer
// than the configured timeout, never throws.
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

  // GREETING SCRIPT
  getGreetingScript() {
    return "Hello! Thank you for contacting Warm Home Inc. My name is Aurora. How may I assist you today?";
  }

  // GENERATE AURORA RESPONSE USING CLAUDE
  async generateResponse(userMessage) {
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

      let assistantMessage = sanitizeForSpeech(response.data.content[0].text);

      this.conversationHistory.push({ role: 'user', content: userMessage });
      this.conversationHistory.push({ role: 'assistant', content: assistantMessage });

      return assistantMessage;
    } catch (error) {
      console.error('Claude API Error:', error.response?.data || error.message);
      return "I apologize, I'm having trouble processing your request. Could you please try again?";
    }
  }

  // CONVERT TEXT TO SPEECH USING ELEVENLABS
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
    return response.data; // audio buffer
  }

  // DATA COLLECTION - CHECK IF ALL REQUIRED FIELDS COLLECTED
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

  // EXTRACT DATA FROM USER MESSAGE
  async extractDataFromMessage(userMessage) {
    const extractionPrompt = `Extract the following information from this customer message. Return as JSON with null for missing fields:
    {
      "name": "customer's name",
      "phone": "phone number format: XXX-XXX-XXXX",
      "email": "email address",
      "serviceType": "which service: roofing/tarping/tree/exterior/interior/waterproofing/armor/newbuild/millwork",
      "urgencyLevel": "EMERGENCY/URGENT/ROUTINE based on description",
      "description": "brief description of the issue",
      "address": "property address"
    }

    Customer message: "${userMessage}"

    Return ONLY valid JSON, no other text.`;

    try {
      const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: this.config.claude.model,
        max_tokens: 500,
        messages: [{ role: 'user', content: extractionPrompt }]
      }, {
        headers: {
          'x-api-key': this.config.claude.apiKey,
          'anthropic-version': '2023-06-01'
        }
      });

      let jsonText = response.data.content[0].text;
      jsonText = jsonText.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      const extracted = JSON.parse(jsonText);

      if (extracted.name) this.collectedData.callerName = extracted.name;
      if (extracted.phone) this.collectedData.callerPhone = extracted.phone;
      if (extracted.email) this.collectedData.callerEmail = extracted.email;
      if (extracted.serviceType) this.collectedData.serviceType = extracted.serviceType;
      if (extracted.urgencyLevel) this.collectedData.urgencyLevel = extracted.urgencyLevel;
      if (extracted.description) this.collectedData.issueDescription = extracted.description;
      if (extracted.address) this.collectedData.propertyAddress = extracted.address;

      return extracted;
    } catch (error) {
      console.error('Data extraction error:', error.response?.data || error.message);
      return {};
    }
  }

  // DETERMINE ROUTING DECISION
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

  // SAVE INQUIRY DATA TO SUPABASE
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

  // SEND SMS CONFIRMATION
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

  // MAIN CONVERSATION FLOW
  async handleConversation(userMessage) {
    // Run data extraction and reply generation IN PARALLEL instead of
    // one after another - this is the main latency fix.
    const [, response] = await Promise.all([
      this.extractDataFromMessage(userMessage),
      this.generateResponse(userMessage)
    ]);

    let finalResponse = response;
    if (!finalResponse || !finalResponse.trim()) {
      finalResponse = "I'm sorry, could you say that one more time for me?";
    }

    if (this.hasRequiredData()) {
      finalResponse += " I've got everything I need - our team will reach out within the timeframe I mentioned. Thank you for choosing Warm Home!";
      await this.saveInquiryData();
      await this.sendSMSConfirmation();
      return {
        response: finalResponse,
        status: 'ready_to_route',
        routing: await this.determineRouting()
      };
    }

    return {
      response: finalResponse,
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

// Clean up if Twilio tells us the call ended for any reason (hangup, no-answer, etc.)
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

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'Aurora Voice Agent LIVE',
    version: '3.0.0',
    timestamp: new Date().toISOString()
  });
});

// Serve temporarily-hosted ElevenLabs audio clips for Twilio's <Play> to fetch
app.get('/audio/:id.mp3', (req, res) => {
  const clip = audioCache.get(req.params.id);
  if (!clip) {
    res.status(404).send('Not found or expired');
    return;
  }
  res.type('audio/mpeg');
  res.send(clip.buffer);
});

// Voice webhook endpoints
app.post('/voice', exports.handleCall);
app.post('/voice/gather-response', exports.handleGatherResponse);
app.post('/voice/status', exports.handleCallStatus);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎤 Aurora Voice Agent running on port ${PORT}`);
  console.log(`📱 Ready to receive calls on all 8 phone numbers`);
  console.log(`🤖 Using Claude API + ElevenLabs voice (with Twilio fallback)`);
});

module.exports = { AuroraAgent, app };
