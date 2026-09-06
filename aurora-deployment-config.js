/**
 * AURORA VOICE AGENT - COMPLETE DEPLOYMENT GUIDE
 * Environment configuration, team setup, deployment checklist
 */

// ============================================
// PART 1: ENVIRONMENT VARIABLES TEMPLATE
// ============================================
// Create a .env file with these variables:

/*
# TWILIO CONFIGURATION
TWILIO_ACCOUNT_SID=AC84994e5c9a72c3d34ac27941fe545af6
TWILIO_AUTH_TOKEN=e86e1d9d55a46db63814606c9ff9fc21
TWILIO_PHONE_FROM=+15043215552

# CLAUDE API
CLAUDE_API_KEY=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

# ELEVENLABS (Voice Provider)
ELEVENLABS_API_KEY=your_elevenlabs_key_here

# SUPABASE (Database)
SUPABASE_URL=https://yewwbuviugvbccociuby.supabase.co
SUPABASE_KEY=sb_publishable_1Fzht5-JA3MI417Dzz_i4g_2n4vnXj_

# SERVER CONFIGURATION
PORT=3000
NODE_ENV=production
APP_NAME=Aurora Voice Agent

# TEAM NOTIFICATION PHONES (for SMS alerts to team)
EMERGENCY_DISPATCH_PHONE=+15043215552
ROOFING_TEAM_PHONE=+15043215552
TARPING_TEAM_PHONE=+15043215552
TREE_TEAM_PHONE=+15043215552
EXTERIOR_TEAM_PHONE=+15043215552
INTERIOR_TEAM_PHONE=+15043215552
WATERPROOFING_TEAM_PHONE=+15043215552
*/

// ============================================
// PART 2: RENDER.COM DEPLOYMENT CONFIGURATION
// ============================================

const RENDER_DEPLOYMENT_CONFIG = {
  name: 'whi-voice-agent',
  runtime: 'node',
  buildCommand: 'npm install',
  startCommand: 'node aurora-main-agent.js',
  envVars: {
    TWILIO_ACCOUNT_SID: 'copy from .env',
    TWILIO_AUTH_TOKEN: 'copy from .env',
    TWILIO_PHONE_FROM: 'copy from .env',
    CLAUDE_API_KEY: 'copy from .env',
    ELEVENLABS_API_KEY: 'copy from .env',
    SUPABASE_URL: 'copy from .env',
    SUPABASE_KEY: 'copy from .env',
    NODE_ENV: 'production',
    PORT: '3000'
  },
  webhooks: {
    description: 'Configure in Twilio Console',
    voice: 'https://whi-voice-agent.onrender.com/voice',
    gatherResponse: 'https://whi-voice-agent.onrender.com/voice/gather-response'
  }
};

// ============================================
// PART 3: TWILIO WEBHOOK CONFIGURATION
// ============================================

const TWILIO_WEBHOOK_SETUP = {
  steps: [
    {
      step: 1,
      title: 'Log into Twilio Console',
      instructions: [
        'Go to: console.twilio.com',
        'Sign in with credentials provided'
      ]
    },
    {
      step: 2,
      title: 'Navigate to Phone Numbers',
      instructions: [
        'In left menu: "Phone Numbers"',
        'Click: "Manage Numbers" → "Active Numbers"',
        'Click on first emergency number (e.g., +15043215552)'
      ]
    },
    {
      step: 3,
      title: 'Configure Incoming Call Webhook',
      instructions: [
        'Scroll to "Incoming Calls" section',
        'Click dropdown: "Handle Calls with"',
        'Select: "Webhooks, TwiML Bins, Functions or Proxy"',
        'Enter Webhook URL: https://whi-voice-agent.onrender.com/voice',
        'Select Method: POST',
        'Click: "Save"'
      ]
    },
    {
      step: 4,
      title: 'Repeat for all 8 phone numbers',
      numbers: [
        '+15043215552 (LA)',
        '+15043215552 (TX)',
        '+15043215552 (GA)',
        '+15043215552 (FL)',
        '+15043215552 (NJ #1)',
        '+15043215552 (NJ #2)',
        '+15043215552 (NY)',
        '+15043215552 (CT)'
      ]
    }
  ],

  testingWebhook: {
    title: 'Test Webhook is Working',
    instructions: [
      'From Render dashboard, copy deployed URL: https://whi-voice-agent.onrender.com',
      'Add /health-check to URL',
      'In browser, navigate to: https://whi-voice-agent.onrender.com/health-check',
      'Should return: {"status": "Aurora Voice Agent LIVE"}'
    ]
  }
};

// ============================================
// PART 4: SUPABASE TABLE SETUP
// ============================================

const SUPABASE_TABLE_SCHEMA = {
  tableName: 'inquiries',
  columns: [
    {
      name: 'id',
      type: 'bigint',
      primaryKey: true,
      autoincrement: true,
      description: 'Unique inquiry ID'
    },
    {
      name: 'caller_name',
      type: 'varchar',
      nullable: false,
      description: 'Customer name'
    },
    {
      name: 'caller_phone',
      type: 'varchar',
      nullable: false,
      description: 'Customer phone number (formatted: +1XXXXXXXXXX)'
    },
    {
      name: 'caller_email',
      type: 'varchar',
      nullable: true,
      description: 'Customer email address'
    },
    {
      name: 'service_type',
      type: 'varchar',
      nullable: false,
      description: 'Service requested (roofing, tarping, tree, exterior, interior, waterproofing, armor, newbuild, millwork)'
    },
    {
      name: 'urgency_level',
      type: 'varchar',
      nullable: false,
      description: 'EMERGENCY, URGENT, or ROUTINE'
    },
    {
      name: 'issue_description',
      type: 'text',
      nullable: false,
      description: 'Customer description of issue'
    },
    {
      name: 'property_address',
      type: 'varchar',
      nullable: false,
      description: 'Property street address'
    },
    {
      name: 'property_city',
      type: 'varchar',
      nullable: true,
      description: 'Property city'
    },
    {
      name: 'property_state',
      type: 'varchar',
      nullable: true,
      description: 'Property state'
    },
    {
      name: 'property_zip',
      type: 'varchar',
      nullable: true,
      description: 'Property zip code'
    },
    {
      name: 'insurance_company',
      type: 'varchar',
      nullable: true,
      description: 'Insurance company name (if applicable)'
    },
    {
      name: 'insurance_claim_number',
      type: 'varchar',
      nullable: true,
      description: 'Insurance claim number'
    },
    {
      name: 'insurance_adjuster_name',
      type: 'varchar',
      nullable: true,
      description: 'Adjuster name'
    },
    {
      name: 'insurance_adjuster_phone',
      type: 'varchar',
      nullable: true,
      description: 'Adjuster phone'
    },
    {
      name: 'routing_team',
      type: 'varchar',
      nullable: false,
      description: 'Team responsible (emergency_dispatch, roofing_dispatch, etc.)'
    },
    {
      name: 'call_duration_seconds',
      type: 'integer',
      nullable: true,
      description: 'Duration of call in seconds'
    },
    {
      name: 'timestamp',
      type: 'timestamp',
      nullable: false,
      defaultValue: 'NOW()',
      description: 'When inquiry was received'
    },
    {
      name: 'agent_name',
      type: 'varchar',
      nullable: false,
      defaultValue: 'Aurora',
      description: 'Agent name (always Aurora)'
    },
    {
      name: 'call_status',
      type: 'varchar',
      nullable: false,
      defaultValue: 'completed',
      description: 'completed, in_progress, escalated'
    },
    {
      name: 'notes',
      type: 'text',
      nullable: true,
      description: 'Additional notes from call'
    },
    {
      name: 'from_phone',
      type: 'varchar',
      nullable: true,
      description: 'Warm Home phone number call came to'
    },
    {
      name: 'to_phone',
      type: 'varchar',
      nullable: true,
      description: 'Customer phone number'
    }
  ]
};

// ============================================
// PART 5: PACKAGE.JSON
// ============================================

const PACKAGE_JSON = {
  name: 'aurora-voice-agent',
  version: '1.0.0',
  description: 'Aurora Voice Agent for Warm Home Inc.',
  main: 'aurora-main-agent.js',
  scripts: {
    start: 'node aurora-main-agent.js',
    dev: 'nodemon aurora-main-agent.js',
    test: 'echo "No tests yet"'
  },
  dependencies: {
    'express': '^4.18.2',
    'twilio': '^3.77.0',
    'axios': '^1.4.0',
    'dotenv': '^16.3.1'
  },
  devDependencies: {
    'nodemon': '^3.0.1'
  },
  engines: {
    node: '18.x'
  }
};

// ============================================
// PART 6: COMPLETE DEPLOYMENT CHECKLIST
// ============================================

const DEPLOYMENT_CHECKLIST = {
  preDeployment: {
    title: '✓ PRE-DEPLOYMENT CHECKS',
    tasks: [
      {
        task: 'Credentials Review',
        checks: [
          '☐ Twilio SID copied correctly',
          '☐ Twilio Auth Token copied correctly',
          '☐ Claude API Key is valid and active',
          '☐ ElevenLabs API Key generated and tested',
          '☐ Supabase URL and Key verified',
          '☐ All credentials stored securely'
        ]
      },
      {
        task: 'Code Preparation',
        checks: [
          '☐ All 5 JavaScript files created',
          '☐ Dependencies installed (npm install)',
          '☐ .env file created with all variables',
          '☐ aurora-main-agent.js tested locally',
          '☐ Knowledge base loaded correctly',
          '☐ Routing engine tested'
        ]
      },
      {
        task: 'Infrastructure Setup',
        checks: [
          '☐ Render.com account created',
          '☐ New service created in Render',
          '☐ Environment variables entered in Render',
          '☐ GitHub repo connected to Render (for auto-deploy)',
          '☐ Supabase "inquiries" table created with correct schema',
          '☐ Supabase access policies configured'
        ]
      },
      {
        task: 'Twilio Configuration',
        checks: [
          '☐ All 8 emergency numbers are active',
          '☐ Each number has webhook configured',
          '☐ Webhook URLs are correct (https://whi-voice-agent.onrender.com/voice)',
          '☐ Method is POST for each webhook',
          '☐ Test calls working to at least one number',
          '☐ Fallback handling configured'
        ]
      }
    ]
  },

  firstDayDeployment: {
    title: '✓ FIRST DAY DEPLOYMENT',
    tasks: [
      {
        task: 'Live Deployment',
        actions: [
          '1. Push all code to GitHub repo',
          '2. Render auto-deploys from GitHub',
          '3. Monitor Render logs for errors',
          '4. Verify health check endpoint working',
          '5. Test one incoming call to live system'
        ]
      },
      {
        task: 'Live Monitoring',
        actions: [
          '1. Have team standing by to monitor',
          '2. Document first 10 calls',
          '3. Check Supabase entries appearing correctly',
          '4. Monitor SMS confirmations sending',
          '5. Check Claude API responses quality',
          '6. Verify ElevenLabs voice quality'
        ]
      },
      {
        task: 'Issue Triage',
        actions: [
          '1. If calls not routing: check Twilio webhook logs',
          '2. If no SMS: check Twilio phone credit',
          '3. If Claude not responding: check API key validity',
          '4. If voice sounds robotic: verify ElevenLabs settings',
          '5. Document all issues in GitHub issues',
          '6. Prioritize critical blocker issues'
        ]
      }
    ]
  },

  firstWeekOptimization: {
    title: '✓ FIRST WEEK OPTIMIZATION',
    tasks: [
      {
        task: 'Performance Monitoring',
        metrics: [
          '- Track call completion rate (target: 95%+)',
          '- Track data collection accuracy (target: 99%+)',
          '- Track customer satisfaction (survey 5 customers)',
          '- Monitor system uptime',
          '- Check average call duration',
          '- Monitor Claude API response time'
        ]
      },
      {
        task: 'Routing Verification',
        actions: [
          '- Verify emergency calls route to emergency dispatch',
          '- Verify each service type routes to right team',
          '- Verify urgency levels are detected correctly',
          '- Check SMS notifications reaching teams',
          '- Verify Supabase data accurate'
        ]
      },
      {
        task: 'Team Training',
        actions: [
          '- Train each team on Aurora workflow',
          '- Teach teams to use Supabase inquiry lookup',
          '- Practice escalation procedures',
          '- Document feedback/improvements',
          '- Create team quick-reference guide'
        ]
      },
      {
        task: 'Refinement Based on Data',
        actions: [
          '- Review first 50 calls for patterns',
          '- Improve data extraction accuracy',
          '- Adjust urgency detection rules if needed',
          '- Fine-tune Aurora system prompt based on results',
          '- Optimize knowledge base responses'
        ]
      }
    ]
  }
};

// ============================================
// PART 7: TEAM ONBOARDING GUIDE
// ============================================

const TEAM_ONBOARDING = {
  trainingModules: [
    {
      module: 'Aurora System Overview',
      duration: '30 minutes',
      topics: [
        'What is Aurora? (AI voice agent for customer intake)',
        'How does Aurora work? (Twilio → Claude → ElevenLabs)',
        'What does Aurora do? (Greeting → Intake → Routing)',
        'Where does data go? (Saved to Supabase)',
        'How do I access inquiry data? (Supabase dashboard)'
      ]
    },
    {
      module: 'Inquiry Data Access & Management',
      duration: '45 minutes',
      topics: [
        'Log into Supabase',
        'Navigate to "inquiries" table',
        'Understand each column/field',
        'Filter by routing_team to see YOUR inquiries',
        'Sort by timestamp to see newest first',
        'Search by phone number or name',
        'Update inquiry status as you work on it',
        'Add notes to inquiry records'
      ]
    },
    {
      module: 'Your Role in Aurora Workflow',
      duration: '30 minutes by role',
      roleSpecific: {
        emergency_dispatch: [
          'You receive EMERGENCY level inquiries',
          'Response time: 2-4 hours maximum',
          'Typical scenarios: Active leaks, storm damage, safety hazards',
          'Your actions: Call customer, assess, dispatch crew immediately',
          'Update Supabase status to "in_progress" when you call',
          'Update to "completed" when crew dispatched',
          'Escalate to manager if customer needs live discussion'
        ],
        roofing_dispatch: [
          'You receive ROUTINE roofing inquiries',
          'Response time: Schedule inspection within 5 business days',
          'Send inspection link via SMS to customer',
          'Track inspection completion in Supabase',
          'Follow up after inspection with estimate'
        ],
        scheduling_coordinator: [
          'You manage appointment scheduling',
          'Check daily for new URGENT level inquiries',
          'Contact customers to confirm appointment time',
          'Send appointment confirmation SMS',
          'Update Supabase with scheduled time',
          'Day-before: Send reminder SMS to customer'
        ]
      }
    },
    {
      module: 'Handling Common Scenarios',
      duration: '20 minutes',
      scenarios: [
        {
          scenario: 'Customer has insurance claim',
          steps: [
            'Open inquiry in Supabase',
            'Check insurance fields (company, claim #, adjuster)',
            'Contact adjuster before starting work',
            'Coordinate inspection timing with insurer',
            'Document all damage photos for claim'
          ]
        },
        {
          scenario: 'Customer wants quote but not emergency',
          steps: [
            'Schedule free inspection',
            'Send inspection link to customer',
            'Provide estimate after inspection',
            'Document estimate in Supabase notes'
          ]
        },
        {
          scenario: 'Customer wants to escalate/talk to live person',
          steps: [
            'Call customer immediately',
            'Understand their specific concern',
            'Clarify any confusion from Aurora call',
            'Confirm inspection/appointment details',
            'End on positive note'
          ]
        }
      ]
    }
  ],

  quickReferenceGuide: {
    supabaseAccess: {
      url: 'https://supabase.com → Project: whi-homes-prod',
      table: 'inquiries',
      key_fields: ['caller_phone', 'service_type', 'urgency_level', 'routing_team', 'timestamp']
    },
    urgencyLevels: {
      EMERGENCY: 'Active threat - respond within 2-4 hours',
      URGENT: 'Important but not immediate - respond within 24 hours',
      ROUTINE: 'Standard inquiry - schedule flexibly'
    },
    serviceTypes: ['roofing', 'tarping', 'tree', 'exterior', 'interior', 'waterproofing', 'armor', 'newbuild', 'millwork'],
    statusUpdates: [
      'completed - Aurora call finished, data collected',
      'in_progress - Your team is actively working',
      'escalated - Escalated to manager or live representative'
    ]
  },

  frequentlyAskedByTeam: [
    {
      q: 'How do I know which inquiries are mine?',
      a: 'In Supabase, filter "routing_team" by your team name. Sort by timestamp (newest first).'
    },
    {
      q: 'What if customer info seems incomplete?',
      a: 'Call customer immediately - Aurora may have had trouble with speech recognition. Get missing details directly.'
    },
    {
      q: 'How do I update the inquiry in Supabase?',
      a: 'Click row → Edit → Update status field → Save. Keep notes updated as you work.'
    },
    {
      q: 'What if customer says they didn\'t call us?',
      a: 'Verify phone number (check Supabase from_phone and to_phone). Rare false positives - verify and mark incorrect if needed.'
    },
    {
      q: 'Can I delete inquiries?',
      a: 'No - never delete. If incorrect, add note "INVALID - [reason]" and update status accordingly.'
    },
    {
      q: 'Who do I contact if Aurora isn\'t answering calls?',
      a: 'Contact manager immediately. Check: Is Render app running? Are Twilio webhooks configured? Monitor logs.'
    }
  ]
};

// ============================================
// PART 8: MONITORING & MAINTENANCE
// ============================================

const MONITORING_SETUP = {
  dailyChecks: {
    morning: [
      '✓ Verify Aurora answered all calls overnight (check call logs)',
      '✓ Review overnight emergencies in Supabase',
      '✓ Check Render app is running (green status)',
      '✓ Verify all teams received their inquiry notifications'
    ],
    afternoon: [
      '✓ Monitor incoming call queue',
      '✓ Check SMS delivery rates',
      '✓ Spot-check 3-5 inquiries for data accuracy',
      '✓ Review any escalations/issues'
    ],
    evening: [
      '✓ Generate daily report (# calls, # inquiries, routing breakdown)',
      '✓ Identify any patterns or issues',
      '✓ Check team feedback'
    ]
  },

  weeklyReview: {
    metrics: [
      'Total inquiries received',
      'Call completion rate %',
      'Data accuracy %',
      'Average response time by team',
      'Customer satisfaction score',
      'System uptime %',
      'Top services requested',
      'Emergency vs Urgent vs Routine split'
    ],
    improvements: [
      'Review call logs for improvement opportunities',
      'Identify training needs for teams',
      'Optimize routing if needed',
      'Refine Aurora prompts based on data',
      'Plan next week priorities'
    ]
  },

  alerts: {
    critical: [
      'Aurora not answering calls (response time > 5 min)',
      'Supabase not saving data',
      'SMS failing to send',
      'Claude API errors',
      'System downtime'
    ],
    notifications: [
      'Set up Render alerts for failed deploys',
      'Set up Twilio SMS delivery alerts',
      'Monitor Supabase query performance',
      'Set up Claude API quota alerts'
    ]
  }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  RENDER_DEPLOYMENT_CONFIG,
  TWILIO_WEBHOOK_SETUP,
  SUPABASE_TABLE_SCHEMA,
  PACKAGE_JSON,
  DEPLOYMENT_CHECKLIST,
  TEAM_ONBOARDING,
  MONITORING_SETUP
};

// ============================================
// QUICK START COMMAND
// ============================================

/*
QUICK START TO DEPLOYMENT:

1. Create .env file from environment template
2. Run: npm install
3. Test locally: npm run dev
4. Push to GitHub: git push origin main
5. Render auto-deploys
6. Configure Twilio webhooks (8 phone numbers)
7. Monitor first calls
8. Train teams using onboarding guide
9. Go live!

QUESTIONS?
- Check aurora-main-agent.js for code details
- Check aurora-knowledge-base.js for service info
- Check aurora-routing-crm.js for workflow logic
- Check TEAM_ONBOARDING for training materials
*/
