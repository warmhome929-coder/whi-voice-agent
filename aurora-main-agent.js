const twilio = require('twilio');
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.urlencoded({ extended: false }));

class AuroraAgent {
  async callClaude(message) {
    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-5-sonnet-latest',
          max_tokens: 1024,
          system: 'You are Aurora, a professional voice assistant for Warm Home Inc. Be helpful and warm.',
          messages: [{ role: 'user', content: message }]
        },
        {
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          }
        }
      );
      
      if (response.data && response.data.content && response.data.content[0]) {
        return response.data.content[0].text;
      }
      return 'I understand. Please tell me more.';
    } catch (error) {
      console.error('Claude error:', error.message);
      return 'I apologize. Could you please try again?';
    }
  }
}

exports.handleCall = async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  
  const gather = twiml.gather({
    numDigits: 0,
    timeout: 30,
    speechTimeout: 'auto',
    input: 'speech',
    action: '/voice/gather-response'
  });
  
  gather.say('Hello! Thank you for contacting Warm Home Inc. My name is Aurora. How may I assist you today?', { voice: 'woman' });
  
  res.type('text/xml');
  res.send(twiml.toString());
};

exports.handleGatherResponse = async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const userMessage = req.body.SpeechResult || '';
  
  if (!userMessage || userMessage.trim() === '') {
    const gather = twiml.gather({
      numDigits: 0,
      timeout: 30,
      speechTimeout: 'auto',
      input: 'speech',
      action: '/voice/gather-response'
    });
    gather.say('Sorry, I did not catch that. Could you please repeat?', { voice: 'woman' });
    res.type('text/xml');
    res.send(twiml.toString());
    return;
  }
  
  try {
    const agent = new AuroraAgent();
    const response = await agent.callClaude(userMessage);
    
    const gather = twiml.gather({
      numDigits: 0,
      timeout: 30,
      speechTimeout: 'auto',
      input: 'speech',
      action: '/voice/gather-response'
    });
    
    gather.say(response, { voice: 'woman' });
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Error:', error);
    twiml.say('We encountered an error. Please call back soon.', { voice: 'woman' });
    res.type('text/xml');
    res.send(twiml.toString());
  }
};

app.post('/voice', exports.handleCall);
app.post('/voice/gather-response', exports.handleGatherResponse);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Aurora Voice Agent running on port ' + PORT);
});

module.exports = { AuroraAgent, app };
