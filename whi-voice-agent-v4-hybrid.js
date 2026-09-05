/**
 * WHI Homes - Hybrid Voice Agent v4 (ELEVENLAB VERSION)
 * Tarping: 100% Autonomous + 8 Services: Basic Routing
 * 
 * VOICE: ElevenLabs Premium Voices
 * - Real sounding, professional, natural AI voices
 * - Multiple voice options available
 * - Professional quality, NOT robotic
 */

const express = require('express');
const twilio = require('twilio');
const { Anthropic } = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Initialize clients
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ElevenLabs API Key
const ELEVENLAB_API_KEY = process.env.ELEVENLAB_API_KEY;
const ELEVENLAB_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Bella - Professional, confident, sexy

// Agent personalities
const AGENT_NAMES = ['Aurora', 'Grace', 'Angel', 'Hope'];

// Tarping Knowledge Base (100% Complete)
const TARPING_KNOWLEDGE = {
  greeting: "It's a great day! Thank you for calling Warm Home. This is [NAME] speaking. How can I help you today?",
  services: ['tarping', 'emergency tarp', 'roof leak'],
  faq: {
    "can't afford": "Financing is available.",
    "how quickly": "We dispatch a crew as soon as an opening occurs and a slot becomes free.",
    "will tarp hold": "Tarps cover a larger area than the damage itself to ensure no water gets inside.",
    "insurance denied": "We can still proceed with installation while we help appeal the decision, or you can explore financing options.",
    "permanent repair": "An estimator will schedule a visit within 24 to 48 hours of tarping to provide an estimate for permanent repairs. The cost of the tarp is credited toward that repair.",
    "need to be home": "You do not need to be home during installation as long as we have access to the property.",
    "damage during install": "I completely understand your frustration, and I am so sorry this happened. Because we are a fully licensed and insured 5-star company, we stand by our work 100%. We take full responsibility and will send out our senior inspector within 24 hours to make this right at absolutely no cost to you.",
    "remove tarp": "The tarp is easily removed for insurance inspections.",
    "tarp repair": "We treat tarp failures as high-priority emergency dispatch. A crew will arrive within 12-24 hours. This is completely covered under our 30-day guarantee at no cost.",
    "warranty": "We offer a 30-day workmanship guarantee. Water damage from leaks is not covered under the guarantee, but workmanship is guaranteed."
  },
  afterHours: {
    weekday: { start: "17:00", end: "08:00" },
    weekend: "all_day",
    pricingMultiplier: 1.32
  },
  pricing: {
    standardMin: 2.24,
    standardMax: 3.81,
    afterHoursMin: 2.97,
    afterHoursMax: 5.06,
    unit: "per_sqft"
  }
};

// Other services basic info
const OTHER_SERVICES = {
  roofing: "Permanent roof repairs and replacements",
  tree_removal: "Tree removal and stump grinding",
  exterior: "Siding, fascia, gutters, and exterior work",
  interior: "Drywall, painting, flooring, and interior work",
  waterproofing: "Basement, crawlspace, and waterproofing",
  armor_plating: "Polyurea protective coatings",
  new_build: "New construction and building services",
  millwork: "Custom cabinets and millwork from NJ factory"
};

/**
 * Get TTS Audio from ElevenLabs
 */
async function getElevenLabAudio(text) {
  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLAB_VOICE_ID}`,
      {
        text: text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          use_speaker_boost: true
        }
      },
      {
        headers: {
          'xi-api-key': ELEVENLAB_API_KEY,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('ElevenLabs API error:', error);
    return null;
  }
}

/**
 * Main Webhook Handler - Receives Twilio calls
 */
app.post('/voice', async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const callSid = req.body.CallSid;
  const fromNumber = req.body.From;

  try {
    // Select random agent name
    const agentName = AGENT_NAMES[Math.floor(Math.random() * AGENT_NAMES.length)];
    
    // Create greeting
    const greeting = TARPING_KNOWLEDGE.greeting.replace('[NAME]', agentName);
    
    // Get TTS audio from ElevenLabs
    const audioBuffer = await getElevenLabAudio(greeting);
    
    if (audioBuffer) {
      // Play the audio
      twiml.play('data:audio/mpeg;base64,' + Buffer.from(audioBuffer).toString('base64'));
    } else {
      // Fallback if ElevenLabs fails
      twiml.say(greeting, { voice: 'woman', language: 'en-US' });
    }
    
    // Gather customer response
    const gather = twiml.gather({
      numDigits: 1,
      action: `/conversation?callSid=${callSid}&agentName=${agentName}&from=${fromNumber}`,
      method: 'POST',
      timeout: 15,
      speechTimeout: 'auto',
      speechModel: 'numbers_and_commands',
      enhanced: true
    });
    
    // Store conversation metadata
    await storeCallMetadata(callSid, agentName, fromNumber);
    
  } catch (error) {
    console.error('Error in /voice:', error);
    twiml.say('We encountered an error. Please call back later.');
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

/**
 * Conversation Handler - Processes customer input with Claude
 */
app.post('/conversation', async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const callSid = req.query.callSid;
  const agentName = req.query.agentName;
  const fromNumber = req.query.from;
  const customerInput = req.body.SpeechResult || req.body.Digits || '';

  try {
    // Get call history from database
    const callData = await getCallHistory(callSid);
    
    // Build conversation context
    const systemPrompt = buildSystemPrompt(agentName, callData);
    
    // Get Claude response
    const claudeResponse = await getClaudeResponse(
      systemPrompt,
      customerInput,
      callData.conversationHistory || []
    );
    
    // Parse response (structure: RESPONSE|EXTRACTED_DATA)
    const [voiceResponse, extractedData] = claudeResponse.split('|EXTRACTED_DATA|');
    
    // Update call data in database
    if (extractedData) {
      await updateCallData(callSid, JSON.parse(extractedData || '{}'));
    }
    
    // Get TTS audio from ElevenLabs
    const audioBuffer = await getElevenLabAudio(voiceResponse);
    
    if (audioBuffer) {
      // Play the audio
      twiml.play('data:audio/mpeg;base64,' + Buffer.from(audioBuffer).toString('base64'));
    } else {
      // Fallback if ElevenLabs fails
      twiml.say(voiceResponse, { voice: 'woman', language: 'en-US' });
    }
    
    // Check if conversation should end
    if (voiceResponse.toLowerCase().includes('team will follow up') || 
        voiceResponse.toLowerCase().includes('approval form')) {
      
      // Send SMS approval if tarping
      if (callData.serviceType === 'tarping') {
        await sendSmsApproval(fromNumber, callData);
      }
      
      // End call
      twiml.hangup();
    } else {
      // Continue conversation
      const gather = twiml.gather({
        numDigits: 1,
        action: `/conversation?callSid=${callSid}&agentName=${agentName}&from=${fromNumber}`,
        method: 'POST',
        timeout: 15,
        speechTimeout: 'auto'
      });
      
      // Get TTS for "I'm listening" prompt
      const listeningBuffer = await getElevenLabAudio('I\'m listening...');
      if (listeningBuffer) {
        gather.play('data:audio/mpeg;base64,' + Buffer.from(listeningBuffer).toString('base64'));
      } else {
        gather.say('I\'m listening...', { voice: 'woman' });
      }
    }
    
  } catch (error) {
    console.error('Error in /conversation:', error);
    twiml.say('We encountered an error processing your request. Our team will call you back shortly.');
    twiml.hangup();
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

/**
 * Build system prompt for Claude
 */
function buildSystemPrompt(agentName, callData) {
  return `You are ${agentName}, a confident, sexy, and energetic female voice representative for Warm Home Inc., a fully licensed and insured emergency services company.

Your personality:
- Confident, charismatic, and engaging - people WANT to talk to you
- Professional but with genuine warmth and personality
- Fast-paced, energetic delivery - no awkward pauses
- Sexy charm without being inappropriate - think confident professional energy
- Use customer's name and title (Mr./Ms./Mx.) throughout conversation
- Always prioritize customer safety with confidence
- Make customers feel comfortable and heard

CURRENT CALL STATUS:
- Customer Name: ${callData.customerName || 'Unknown'}
- Customer Title: ${callData.customerTitle || 'Not determined'}
- Service Type: ${callData.serviceType || 'Not determined'}

RULES:
1. If service is TARPING:
   - Use complete tarping knowledge base with confidence
   - Ask for: name, title, address, roof details (sqft, pitch, material), damage, insurance status, claim number, urgency
   - Answer all FAQ questions with enthusiasm and certainty
   - Quote price using satellite measurement (provide range $2.24-$5.06/sqft)
   - Send SMS approval form
   - ALWAYS include: |EXTRACTED_DATA|{...} at end with collected data

2. If service is NOT TARPING:
   - Route customer professionally and confidently
   - Collect: name, title, phone, address, service description, urgency
   - Tell them: "Our team will contact you within 24 hours with a detailed estimate"
   - ALWAYS include: |EXTRACTED_DATA|{...} at end with collected data

3. TONE - Be SHORT, PUNCHY, ENERGETIC:
   - Keep responses under 30 seconds of speech
   - Ask ONE question at a time
   - No awkward silences
   - Sound confident, not hesitant
   - Quick delivery

4. End responses with extracted data in this format:
   Voice response...
   |EXTRACTED_DATA|{"customerName": "...", "customerTitle": "...", ...}

IMPORTANT: Keep it BRIEF and ENERGETIC! No long monologues!`;
}

/**
 * Get Claude Response
 */
async function getClaudeResponse(systemPrompt, userMessage, conversationHistory) {
  const messages = [
    ...conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    })),
    {
      role: 'user',
      content: userMessage
    }
  ];

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-1',
    max_tokens: 500,  // Keep responses SHORT
    system: systemPrompt,
    messages: messages
  });

  return response.content[0].text;
}

/**
 * Store call metadata in Supabase
 */
async function storeCallMetadata(callSid, agentName, fromNumber) {
  const { error } = await supabase
    .from('emergency_jobs')
    .insert({
      call_id: callSid,
      agent_name: agentName,
      customer_phone: fromNumber,
      job_status: 'pending',
      created_at: new Date()
    });

  if (error) console.error('Error storing call metadata:', error);
}

/**
 * Get call history and data
 */
async function getCallHistory(callSid) {
  const { data, error } = await supabase
    .from('emergency_jobs')
    .select('*')
    .eq('call_id', callSid)
    .single();

  if (error && error.code !== 'PGRST116') console.error('Error fetching call history:', error);
  return data || {};
}

/**
 * Update call data in Supabase
 */
async function updateCallData(callSid, extractedData) {
  const { error } = await supabase
    .from('emergency_jobs')
    .update({
      customer_name: extractedData.customerName,
      customer_title: extractedData.customerTitle,
      customer_phone: extractedData.customerPhone,
      property_address: extractedData.address,
      service_type: extractedData.serviceType,
      damage_description: extractedData.damageDescription,
      is_insurance_job: extractedData.isInsuranceJob,
      quoted_price: extractedData.quotedPrice,
      updated_at: new Date()
    })
    .eq('call_id', callSid);

  if (error) console.error('Error updating call data:', error);
}

/**
 * Send SMS approval form
 */
async function sendSmsApproval(toNumber, callData) {
  try {
    const approvalLink = `https://warm-home.com/approve/${callData.call_id}`;
    
    const message = await twilioClient.messages.create({
      body: `Hi ${callData.customer_name || 'there'}! Ready to get your roof fixed? Click here: ${approvalLink}. Reply YES to confirm!`,
      from: process.env.TWILIO_PHONE_FROM,
      to: toNumber
    });

    console.log('SMS sent:', message.sid);
  } catch (error) {
    console.error('Error sending SMS:', error);
  }
}

/**
 * Health check endpoint
 */
app.get('/', (req, res) => {
  res.json({ 
    status: 'Warm Home Voice Agent v4 - ElevenLabs PREMIUM VOICES',
    agent_type: 'Hybrid (Tarping + 8 Services)',
    voice: 'ElevenLabs - Real Human Quality',
    timestamp: new Date()
  });
});

/**
 * Start server
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Warm Home Voice Agent v4 (ELEVENLAB) running on port ${PORT}`);
  console.log(`🎙️ Voice: ElevenLabs Premium - Real, Professional, Natural`);
  console.log(`✅ Tarping: 100% Autonomous`);
  console.log(`✅ Other Services: Basic Routing + Collection`);
});

module.exports = app;
