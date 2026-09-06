/**
 * AURORA VOICE AGENT - MAIN APPLICATION
 * Complete implementation of Aurora Generalist System
 * Handles: Call greeting, data collection, routing, CRM integration
 * 
 * Technology: Node.js + Twilio + ElevenLabs + Claude API + Supabase
 */

const twilio = require('twilio');
const { Readable } = require('stream');
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
    provider: 'elevenlabs', // Options: elevenlabs, twilio
    elevenlabs: {
      apiKey: process.env.ELEVENLABS_API_KEY,
      voiceId: 'EXAVITQu4vr4xnSDxMaL', // Bella - professional, confident, natural
      modelId: 'eleven_turbo_v2_5',
      stability: 0.5,
      similarityBoost: 0.75
    },
    twilio: {
      voice: 'woman' // Fallback
    }
  },

  // Claude API Configuration
  claude: {
    apiKey: process.env.CLAUDE_API_KEY,
    model: 'claude-opus-4-1',
    maxTokens: 1024
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
8. End call by saving their data and routing to appropriate team`;

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
  async generateResponse(userMessage, role = null) {
    try {
      const messages = [
        ...this.conversationHistory,
        {
          role: 'user',
          content: userMessage
        }
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

      const assistantMessage = response.data.content[0].text;
      
      // Add to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage
      });
      this.conversationHistory.push({
        role: 'assistant',
        content: assistantMessage
      });

      return assistantMessage;
    } catch (error) {
      console.error('Claude API Error:', error);
      return "I apologize, I'm having trouble processing your request. Could you please try again?";
    }
  }

  // CONVERT TEXT TO SPEECH USING ELEVENLABS
  async textToSpeech(text) {
    try {
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

      return response.data; // Returns audio buffer
    } catch (error) {
      console.error('ElevenLabs TTS Error:', error);
      throw error;
    }
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
    // Use Claude to extract structured data
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
        messages: [{
          role: 'user',
          content: extractionPrompt
        }]
      }, {
        headers: {
          'x-api-key': this.config.claude.apiKey,
          'anthropic-version': '2023-06-01'
        }
      });

      const jsonText = response.data.content[0].text;
      const extracted = JSON.parse(jsonText);

      // Update collected data
      if (extracted.name) this.collectedData.callerName = extracted.name;
      if (extracted.phone) this.collectedData.callerPhone = extracted.phone;
      if (extracted.email) this.collectedData.callerEmail = extracted.email;
      if (extracted.serviceType) this.collectedData.serviceType = extracted.serviceType;
      if (extracted.urgencyLevel) this.collectedData.urgencyLevel = extracted.urgencyLevel;
      if (extracted.description) this.collectedData.issueDescription = extracted.description;
      if (extracted.address) this.collectedData.propertyAddress = extracted.address;

      return extracted;
    } catch (error) {
      console.error('Data extraction error:', error);
      return {};
    }
  }

  // DETERMINE ROUTING DECISION
  async determineRouting() {
    const urgency = this.collectedData.urgencyLevel;
    const service = this.collectedData.serviceType;

    if (urgency === 'EMERGENCY') {
      return {
        team: 'emergency_dispatch',
        priority: 'IMMEDIATE',
        responseTime: '2-4 hours'
      };
    } else if (urgency === 'URGENT') {
      return {
        team: 'urgent_queue',
        priority: 'HIGH',
        responseTime: '24-48 hours'
      };
    } else {
      return {
        team: `${service}_scheduling`,
        priority: 'NORMAL',
        responseTime: 'flexible'
      };
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
      console.error('Supabase save error:', error);
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
      console.error('SMS send error:', error);
    }
  }

  // MAIN CONVERSATION FLOW
  async handleConversation(userMessage) {
    // Step 1: Extract data from message
    await this.extractDataFromMessage(userMessage);

    // Step 2: Generate Aurora response using Claude
    let response = await this.generateResponse(userMessage);

    // Step 3: Check if we have all required data
    if (this.hasRequiredData()) {
      // Step 4: Add closing statement
      response += "\n\nI've gathered all the information I need. Let me confirm what we'll do next: Our team will contact you within the timeframe I mentioned. Thank you for choosing Warm Home Inc!";
      
      // Step 5: Save data and send SMS
      await this.saveInquiryData();
      await this.sendSMSConfirmation();
      
      return {
        response: response,
        status: 'ready_to_route',
        routing: await this.determineRouting()
      };
    }

    return {
      response: response,
      status: 'collecting_data',
      dataCollected: this.collectedData
    };
  }
}

// ============================================
// TWILIO WEBHOOK HANDLER
// ============================================

exports.handleCall = async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const agent = new AuroraAgent();

  try {
    // Play greeting
    const greeting = agent.getGreetingScript();
    
    // Instead of data URL, use Twilio's built-in say for now
    // (We'll improve this later with hosted audio)
    
    // Play and gather user response
    const gather = twiml.gather({
      numDigits: 0,
      timeout: 30,
      speechTimeout: 'auto',
      input: 'speech',
      action: '/voice/gather-response',
      hints: 'roofing, tarping, tree removal, water damage, emergency'
    });
    
    // Use Twilio's voice for greeting (simpler, more reliable)
    gather.say(greeting, { voice: 'woman' });

    res.type('text/xml');
    res.send(twiml.toString());
   
  } catch (error) {
    console.error('Call handling error:', error);
    twiml.say("We're experiencing technical difficulties. Please try again later.");
    res.type('text/xml');
    res.send(twiml.toString());
  }
};

exports.handleGatherResponse = async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const userMessage = req.body.SpeechResult || '';
  const agent = new AuroraAgent();

  try {
    // Process user message
    const result = await agent.handleConversation(userMessage);
    
    // Generate audio response
    const responseAudio = await agent.textToSpeech(result.response);
    const audioBase64 = responseAudio.toString('base64');
    const audioUrl = `data:audio/mpeg;base64,${audioBase64}`;

    // Check if conversation is complete
    if (result.status === 'ready_to_route') {
      twiml.play(audioUrl);
      twiml.say("Thank you for calling. Goodbye!");
      twiml.hangup();
    } else {
      // Continue gathering
      const gather = twiml.gather({
        numDigits: 0,
        timeout: 30,
        speechTimeout: 'auto',
        input: 'speech',
        action: '/voice/gather-response'
      });
      gather.play(audioUrl);
    }

    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Gather response error:', error);
    twiml.say("I apologize, I'm having difficulty. Please call back soon.");
    twiml.hangup();
    res.type('text/xml');
    res.send(twiml.toString());
  }
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
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Voice webhook endpoints
app.post('/voice', exports.handleCall);
app.post('/voice/gather-response', exports.handleGatherResponse);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎤 Aurora Voice Agent running on port ${PORT}`);
  console.log(`📱 Ready to receive calls on all 8 phone numbers`);
  console.log(`🤖 Using Claude API + ElevenLabs voice`);
});

module.exports = { AuroraAgent, app };
