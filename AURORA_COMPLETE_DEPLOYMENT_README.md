# 🎤 AURORA VOICE AGENT - COMPLETE DEPLOYMENT GUIDE

**Status: READY TO DEPLOY**  
**Version:** 1.0.0  
**For:** Warm Home Inc. (Joseph Saade)  
**Created:** September 2026  

---

## 📋 TABLE OF CONTENTS

1. [Quick Overview](#quick-overview)
2. [What You're Getting](#what-youre-getting)
3. [Pre-Deployment Checklist](#pre-deployment-checklist)
4. [Step-by-Step Deployment](#step-by-step-deployment)
5. [Testing & Verification](#testing--verification)
6. [Team Training](#team-training)
7. [First Week Monitoring](#first-week-monitoring)
8. [Troubleshooting](#troubleshooting)
9. [Support & Next Steps](#support--next-steps)

---

## 🚀 QUICK OVERVIEW

**Aurora is a professional AI voice agent that:**
- ✅ Answers calls 24/7 on all 8 emergency numbers
- ✅ Greets customers professionally with warm, natural voice
- ✅ Listens and understands customer needs
- ✅ Asks clarifying questions to collect complete information
- ✅ Determines urgency level and service type
- ✅ Routes calls intelligently to appropriate teams
- ✅ Saves all customer data to Supabase database
- ✅ Sends SMS confirmations automatically
- ✅ Escalates emergencies immediately

**Technology Stack:**
- **Voice Platform:** Twilio (phone routing)
- **AI Engine:** Claude API (conversation intelligence)
- **Text-to-Speech:** ElevenLabs (natural voice - Bella)
- **Database:** Supabase (inquiry storage)
- **Hosting:** Render.com (Node.js server)
- **Code:** 5 JavaScript files + configuration

---

## 📦 WHAT YOU'RE GETTING

### CODE FILES (5 Total)

| File | Purpose |
|------|---------|
| `aurora-main-agent.js` | Core agent code (call handling, conversation flow, speech-to-text/text-to-speech) |
| `aurora-knowledge-base.js` | Complete Q&A for all 9 services (roofing, tarping, tree, exterior, interior, waterproofing, armor, newbuild, millwork) |
| `aurora-routing-crm.js` | Routing logic, Supabase integration, SMS/call escalation, data validation |
| `aurora-deployment-config.js` | Environment variables, Twilio setup, Supabase schema, team onboarding |
| `README.md` | This file - deployment guide |

### CONFIGURATION FILES

| File | Purpose |
|------|---------|
| `.env` | Your secrets (API keys, phone numbers, database credentials) |
| `package.json` | Node.js dependencies |

### DOCUMENTATION

| Document | Purpose |
|----------|---------|
| System Prompt | Aurora's exact persona and operational roles |
| Knowledge Base | Q&A for all 9 services |
| Routing Logic | How calls are directed to teams |
| Team Onboarding | Training materials for your staff |
| Deployment Checklist | Step-by-step verification |

---

## ✅ PRE-DEPLOYMENT CHECKLIST

### 1. CREDENTIALS VERIFICATION
```
☐ Twilio Account SID: AC84994e5c9a72c3d34ac27941fe545af6
☐ Twilio Auth Token: e86e1d9d55a46db63814606c9ff9fc21
☐ Twilio Phone Number: +15043215552 (from number)
☐ Claude API Key: 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
☐ ElevenLabs API Key: (your key from elevenlabs.io)
☐ Supabase URL: https://yewwbuviugvbccociuby.supabase.co
☐ Supabase Key: sb_publishable_1Fzht5-JA3MI417Dzz_i4g_2n4vnXj_
```

### 2. ACCOUNT SETUP
```
☐ Twilio account has phone credit ($20+ minimum)
☐ All 8 emergency numbers active and listed
☐ Claude API has available quota
☐ ElevenLabs account created with API key
☐ Supabase project "whi-homes-prod" is active
☐ Render.com account created
☐ GitHub account with repo access
```

### 3. INFRASTRUCTURE READY
```
☐ Render.com service created (whi-voice-agent)
☐ GitHub repo created (warmhome929-coder/whi-voice-agent)
☐ Code pushed to GitHub
☐ Supabase "inquiries" table created
☐ Environment variables configured in Render
```

---

## 🔧 STEP-BY-STEP DEPLOYMENT

### PHASE 1: LOCAL SETUP (30 minutes)

**Step 1.1:** Create project directory
```bash
mkdir aurora-voice-agent
cd aurora-voice-agent
```

**Step 1.2:** Initialize Node project
```bash
npm init -y
npm install express twilio axios dotenv
```

**Step 1.3:** Create files
```bash
# Copy these 5 files into your project directory:
# - aurora-main-agent.js
# - aurora-knowledge-base.js
# - aurora-routing-crm.js
# - aurora-deployment-config.js
# - package.json
```

**Step 1.4:** Create .env file
```
# Copy aurora-deployment-config.js environment section
# Create .env file with:
TWILIO_ACCOUNT_SID=AC84994e5c9a72c3d34ac27941fe545af6
TWILIO_AUTH_TOKEN=e86e1d9d55a46db63814606c9ff9fc21
TWILIO_PHONE_FROM=+15043215552
CLAUDE_API_KEY=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
ELEVENLABS_API_KEY=your_key_here
SUPABASE_URL=https://yewwbuviugvbccociuby.supabase.co
SUPABASE_KEY=sb_publishable_1Fzht5-JA3MI417Dzz_i4g_2n4vnXj_
PORT=3000
NODE_ENV=production
```

**Step 1.5:** Test locally
```bash
npm start
# Server should start on port 3000
# Open http://localhost:3000 in browser
# Should see: {"status": "Aurora Voice Agent LIVE"}
```

### PHASE 2: SUPABASE SETUP (15 minutes)

**Step 2.1:** Log into Supabase
```
Go to: supabase.com
Login → Project: whi-homes-prod
```

**Step 2.2:** Create inquiries table
```
Left menu → "SQL Editor"
Click "New Query"
Copy SQL from aurora-deployment-config.js → SUPABASE_TABLE_SCHEMA
Execute query
Verify table appears in "Tables" section
```

**Step 2.3:** Verify table structure
```
Click "inquiries" table
Should see columns:
- id, caller_name, caller_phone, service_type, urgency_level
- issue_description, property_address, routing_team
- timestamp, agent_name, call_status, notes
```

### PHASE 3: TWILIO WEBHOOK CONFIGURATION (20 minutes)

**Step 3.1:** Log into Twilio Console
```
Go to: console.twilio.com
Login with your credentials
```

**Step 3.2:** Configure first phone number
```
Left menu → "Phone Numbers" → "Manage Numbers" → "Active Numbers"
Click first number (e.g., +15043215552)
Scroll to "Incoming Calls"
Dropdown: "Handle Calls with"
Select: "Webhooks, TwiML Bins, Functions, or Proxy"
Webhook URL: https://whi-voice-agent.onrender.com/voice
Method: POST
Click "Save"
```

**Step 3.3:** Repeat for all 8 numbers
```
Repeat Step 3.2 for each of your 8 emergency numbers:
- +15043215552 (LA)
- +15043215552 (TX)
- +15043215552 (GA)
- +15043215552 (FL)
- +15043215552 (NJ #1)
- +15043215552 (NJ #2)
- +15043215552 (NY)
- +15043215552 (CT)
```

### PHASE 4: RENDER.COM DEPLOYMENT (10 minutes)

**Step 4.1:** Create Render service
```
Go to: render.com
Login → Dashboard
Click "New +" → "Web Service"
```

**Step 4.2:** Connect GitHub
```
Select "GitHub"
Authorize Render to access GitHub
Select repo: warmhome929-coder/whi-voice-agent
Select branch: main
```

**Step 4.3:** Configure service
```
Name: whi-voice-agent
Environment: Node
Build Command: npm install
Start Command: node aurora-main-agent.js
```

**Step 4.4:** Add environment variables
```
Click "Environment"
Add each variable from .env:
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_PHONE_FROM
- CLAUDE_API_KEY
- ELEVENLABS_API_KEY
- SUPABASE_URL
- SUPABASE_KEY
- NODE_ENV=production
Click "Create Web Service"
```

**Step 4.5:** Wait for deployment
```
Monitor "Logs" tab
Should see: "🎤 Aurora Voice Agent running on port 3000"
Status should show "Live" (green)
Copy deployment URL: https://whi-voice-agent.onrender.com
```

---

## ✅ TESTING & VERIFICATION

### TEST 1: Health Check
```
URL: https://whi-voice-agent.onrender.com
Expected Response: {"status": "Aurora Voice Agent LIVE", ...}
Status: ✅ PASS / ❌ FAIL
```

### TEST 2: Incoming Call to One Number
```
Pick one test phone number
Call from personal phone
Expected: Greeting plays ("Hello! Thank you for contacting Warm Home Inc...")
Expected: Agent asks "How may I assist you today?"
Expected: You can respond verbally
Status: ✅ PASS / ❌ FAIL
```

### TEST 3: Supabase Data Capture
```
Make a test call with complete information
End call normally
Go to Supabase → inquiries table
Expected: New row appears with your info
Expected: All fields populated (name, phone, service, urgency, address)
Status: ✅ PASS / ❌ FAIL
```

### TEST 4: SMS Confirmation
```
Make a test call
Expected: Receive SMS within 30 seconds
Expected: SMS says "Thank you for calling Warm Home Inc..."
Status: ✅ PASS / ❌ FAIL
```

### TEST 5: Routing Accuracy
```
Make test calls for different services:
- Roofing inquiry → Should route to "roofing_dispatch"
- Emergency tarping → Should route to "emergency_dispatch"
- Tree removal → Should route to "tree_removal_dispatch"
Go to Supabase and verify routing_team field
Status: ✅ PASS / ❌ FAIL
```

**If ANY test fails:**
1. Check error messages in Render logs
2. Verify Twilio webhook URL is correct
3. Verify API keys are valid
4. Check Supabase table exists
5. See TROUBLESHOOTING section below

---

## 👥 TEAM TRAINING

### TRAINING MODULE 1: Aurora Overview (30 minutes)

**Topics:**
- What is Aurora? (AI voice agent)
- How does it work? (Twilio → Claude → ElevenLabs)
- What does it do? (Answer calls, collect info, route to team)
- How do I access inquiry data? (Supabase dashboard)

**Demo:**
- Walk team through one example call
- Show how data appears in Supabase
- Explain their specific role

### TRAINING MODULE 2: Your Role & Responsibilities

**For Emergency Dispatch Team:**
```
✓ Receive EMERGENCY level inquiries (active leaks, hazards)
✓ Response time: 2-4 hours MAXIMUM
✓ Action: Call customer within 30 minutes
✓ Dispatch crew immediately for true emergencies
✓ Update Supabase status as you work
```

**For Roofing Scheduling Team:**
```
✓ Receive ROUTINE roofing inquiries
✓ Response time: Schedule inspection within 5 business days
✓ Action: Send inspection link to customer
✓ Track in Supabase when inspection scheduled
```

**For Tarping Team:**
```
✓ Receive EMERGENCY tarping calls
✓ Response time: 2-4 hours maximum
✓ Action: Dispatch crew immediately if storm damage confirmed
✓ Document with photos in Supabase
```

### TRAINING MODULE 3: Supabase Access

**Access Instructions:**
```
1. Go to supabase.com
2. Login with shared credentials
3. Select project: whi-homes-prod
4. Click "inquiries" table
5. Your inquiries appear automatically
6. Filter by: routing_team = your team name
7. Sort by: timestamp (newest first)
8. Click row to see full details
9. Update status as you work on it
```

**Key Fields You'll See:**
```
- caller_name: Customer name
- caller_phone: How to reach them
- service_type: What they need (roofing, tarping, etc)
- urgency_level: EMERGENCY / URGENT / ROUTINE
- issue_description: What's wrong
- property_address: Where to go
- routing_team: Which team it's for
- call_status: completed / in_progress / escalated
- timestamp: When call came in
```

### TRAINING MODULE 4: Quick Reference Card

Print and laminate for each team member:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AURORA QUICK REFERENCE - WARM HOME INC.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 SUPABASE ACCESS
URL: supabase.com → Project: whi-homes-prod → Table: inquiries

🔴 URGENCY LEVELS
- EMERGENCY: Respond 2-4 hours (active threat)
- URGENT: Respond 24 hours (important, not immediate)
- ROUTINE: Flexible scheduling

📱 YOUR RESPONSIBILITIES
1. Check Supabase daily for new inquiries
2. Call customer within response time
3. Update status as you work
4. Add notes to inquiry record
5. Mark complete when work dispatched/scheduled

🆘 ESCALATION
If customer needs live discussion: Call them immediately

❓ QUESTIONS?
Contact [MANAGER NAME] - [PHONE]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 📈 FIRST WEEK MONITORING

### DAILY CHECKLIST

**Every Morning:**
```
☐ Check Render status (should be green "Live")
☐ Review overnight calls in Supabase
☐ Check for any EMERGENCY level inquiries
☐ Verify teams received their notifications
☐ Read through first 3-5 calls for quality check
```

**Every Afternoon:**
```
☐ Monitor incoming calls
☐ Spot-check 5 inquiries for data accuracy
☐ Check SMS delivery (no bounces)
☐ Collect team feedback
```

**Every Evening:**
```
☐ Generate daily report:
  - Total calls: ___
  - Total inquiries: ___
  - Emergencies: ___
  - Roofing: ___ | Tarping: ___ | Tree: ___ | Other: ___
  - Issues encountered: ___
☐ Review any escalations
☐ Plan next day priorities
```

### WEEKLY METRICS

Track these numbers:

```
Week 1 Metrics:
┌─────────────────────────────────┬────────┐
│ Metric                          │ Target │
├─────────────────────────────────┼────────┤
│ Call Completion Rate            │ 95%+   │
│ Data Accuracy (% complete info) │ 99%+   │
│ SMS Delivery Rate               │ 98%+   │
│ Average Response Time           │ <5 min │
│ System Uptime                   │ 99%+   │
│ Customer Satisfaction Score     │ 4.5/5+ │
└─────────────────────────────────┴────────┘
```

### PERFORMANCE GOALS

**Week 1:**
- ✓ 95%+ of calls answered and processed
- ✓ 99%+ data accuracy
- ✓ All teams know how to use Supabase
- ✓ Zero critical issues

**Month 1:**
- ✓ Aurora handling 100% of intake
- ✓ Teams responding to inquiries within SLA
- ✓ Customer satisfaction 4.5/5+
- ✓ System running 99.5%+ uptime

---

## 🔧 TROUBLESHOOTING

### ISSUE: Calls not being answered

**Symptom:** Call rings but no greeting plays  
**Possible Causes:**
1. Twilio webhook URL incorrect
2. Render app not running (not "Live" status)
3. Claude API key invalid

**Fix:**
```
1. Check Render dashboard → Status should be "Live" (green)
2. If not live: Click "Manual Deploy" to redeploy
3. Check Twilio webhook URLs → Should be exactly:
   https://whi-voice-agent.onrender.com/voice
4. Test Claude API key: Call Anthropic support
5. Check logs: Render → Logs tab for error messages
```

### ISSUE: No SMS confirmations sent

**Symptom:** Customer doesn't receive SMS after call  
**Possible Causes:**
1. Twilio phone credit exhausted
2. Phone number not validated
3. SMS sending error in code

**Fix:**
```
1. Log into Twilio → Check phone credit balance
2. Add $20+ credit if needed
3. Verify recipient phone numbers are formatted correctly
4. Check Render logs for SMS errors
5. Test manually: Send test SMS from Twilio console
```

### ISSUE: Data not appearing in Supabase

**Symptom:** Call completed but no row in inquiries table  
**Possible Causes:**
1. Supabase key invalid
2. Table doesn't exist
3. Network error saving data

**Fix:**
```
1. Supabase → Check API key is correct in .env
2. Supabase → Verify "inquiries" table exists
3. Supabase → Check table columns match code
4. Render logs → Look for Supabase errors
5. Try manual test: Insert row directly in Supabase
```

### ISSUE: Voice sounds robotic/unnatural

**Symptom:** ElevenLabs voice doesn't sound professional  
**Possible Causes:**
1. Wrong ElevenLabs voice selected
2. Voice settings not optimal
3. Speech is too fast

**Fix:**
```
1. In aurora-main-agent.js, line ~45:
   voiceId: 'EXAVITQu4vr4xnSDxMaL' (currently Bella)
   
2. Try alternative voices:
   - Adam: 'pNInz6obpgDQGcFmaJgB'
   - Ava: 'EXAVITQu4vr4xnSDxMaL'
   - Chris: 'iP95p4xoKVk53GoZ5RcT'
   
3. Adjust stability: Change from 0.5 to 0.3 (more natural)
4. Adjust similarity_boost: Change from 0.75 to 0.5
5. Redeploy and test
```

### ISSUE: Claude giving wrong responses

**Symptom:** Aurora giving inaccurate answers about services  
**Possible Causes:**
1. System prompt not loaded
2. Knowledge base not included
3. Claude model outdated

**Fix:**
```
1. Verify AURORA_SYSTEM_PROMPT is defined in code
2. Verify aurora-knowledge-base.js is loaded
3. In claude-api call, ensure system prompt is passed
4. Test with simple questions first
5. Review call transcripts to identify pattern
6. Update system prompt or knowledge base as needed
```

### ISSUE: Routing incorrect (calls going to wrong team)

**Symptom:** Roofing call routed to emergency dispatch  
**Possible Causes:**
1. Service type not recognized
2. Urgency detection wrong
3. Routing rules misconfigured

**Fix:**
```
1. Check SERVICE_ROUTING in aurora-knowledge-base.js
2. Verify service names match: 'roofing', 'tarping', 'tree', etc.
3. Test urgency detection:
   - Use emergency keywords: "leak", "flooding", "immediate"
   - Use routine keywords: "estimate", "schedule", "quote"
4. Manual test: Make calls saying service name clearly
5. Monitor first 20 calls - look for patterns
```

### ISSUE: Render deploy failing

**Symptom:** Deploy shows error, app not running  
**Possible Causes:**
1. Code syntax error
2. Missing dependencies
3. Environment variables not set

**Fix:**
```
1. Check code for syntax errors: Use code editor validation
2. Run locally: npm start → Should work without errors
3. Check Render logs → Look for specific error messages
4. Verify all env vars in Render match your .env
5. Try manual deploy: Render dashboard → Manual Deploy
6. Last resort: Delete service and recreate
```

---

## 📞 SUPPORT & NEXT STEPS

### IF YOU NEED HELP

**For Technical Issues:**
- Check this README's TROUBLESHOOTING section
- Review error messages in Render logs
- Check code comments for explanations
- Contact Anthropic support for Claude API issues

**For Team Questions:**
- Use TEAM_ONBOARDING materials
- Print Quick Reference Cards for all staff
- Schedule brief training sessions
- Document FAQ for repeated questions

**For Improvements/Customization:**
Next steps to improve Aurora:

### 30-DAY IMPROVEMENTS

```
Week 1-2: Monitor & Stabilize
- Track all metrics
- Fix any issues
- Train all teams
- Verify data accuracy

Week 3-4: Optimize
- Refine Aurora prompts based on data
- Improve knowledge base with real Q&A
- Adjust urgency detection rules
- Customize team notifications

Month 2: Scale
- Add more services to knowledge base
- Implement SMS appointment reminders
- Add callback scheduling
- Create automated reports
```

### FUTURE ENHANCEMENTS

Consider these features for Phase 2:

```
1. Appointment Scheduling
   - Calendar integration
   - Automated confirmation SMS
   - Reminder texts 24hrs before

2. Insurance Claim Coordination
   - Automated adjuster contact
   - Damage photo submission
   - Claim status tracking

3. Advanced Analytics
   - Call quality scoring
   - Customer sentiment analysis
   - Team performance dashboards

4. Multi-Language Support
   - Spanish language option
   - Translation for incoming messages
   - Bilingual team members

5. Integration with Your Existing Systems
   - CRM integration (Salesforce, HubSpot)
   - Accounting system (QuickBooks)
   - Project management (Monday, Asana)
```

---

## ✅ FINAL DEPLOYMENT SIGN-OFF

When you've completed all steps above, you're ready to go live!

**Before going live, verify:**

```
✅ All code files in place
✅ Environment variables configured
✅ Supabase table created
✅ Twilio webhooks configured (all 8 numbers)
✅ Render deployment successful
✅ Health check endpoint working
✅ Test call successful
✅ SMS confirmation working
✅ Data appearing in Supabase
✅ Teams trained on Supabase
✅ Emergency procedures documented
✅ Support contact info distributed
✅ Monitoring processes established
```

**Go Live Checklist:**

```
Day 1 - Launch:
☐ Monitor first 10 calls closely
☐ Verify no critical errors
☐ Check team response times
☐ Collect team feedback

Days 2-3 - Observation:
☐ Monitor call patterns
☐ Review data accuracy
☐ Address any issues
☐ Document successes

Week 1 - Optimization:
☐ Implement improvements
☐ Refine processes
☐ Celebrate wins with team
☐ Plan month 2 enhancements
```

---

## 🎉 YOU'RE READY!

**Aurora is now LIVE for Warm Home Inc.**

- ✅ Professional 24/7 customer intake
- ✅ Intelligent call routing
- ✅ Complete data collection
- ✅ Automated team notifications
- ✅ Professional voice & tone

**Next step:** Call one of your 8 emergency numbers and hear Aurora answer!

---

## 📚 FILES REFERENCE

| File | Purpose | Key Functions |
|------|---------|----------------|
| aurora-main-agent.js | Main agent | Call handling, conversation, speech-to-speech |
| aurora-knowledge-base.js | Service Q&A | All 9 services, objections, insurance, pricing |
| aurora-routing-crm.js | Workflow engine | Routing, SMS, escalation, data validation |
| aurora-deployment-config.js | Configuration | Environment setup, team training, monitoring |

---

## 📞 CONTACT

**Questions about this deployment?**
- Review this README
- Check code comments
- Contact your implementation manager

**Emergency Issues?**
- Check Render logs first
- Contact your hosting provider (Render)
- Contact API providers (Twilio, Claude, ElevenLabs)

---

**Last Updated:** September 5, 2026  
**Status:** PRODUCTION READY  
**Version:** 1.0.0  

🚀 **Welcome to the Aurora era of Warm Home Inc.!**
