/**
 * AURORA ROUTING ENGINE & CRM INTEGRATION
 * Intelligent routing based on urgency/service type
 * SMS/call escalation, data collection, Supabase storage
 */

const axios = require('axios');
const twilio = require('twilio');

// ============================================
// SUPABASE DATABASE INTEGRATION
// ============================================

class SupabaseManager {
  constructor(supabaseUrl, supabaseKey) {
    this.url = supabaseUrl;
    this.key = supabaseKey;
    this.headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Save complete inquiry to database
   */
  async saveInquiry(inquiryData) {
    try {
      const payload = {
        caller_name: inquiryData.callerName,
        caller_phone: inquiryData.callerPhone,
        caller_email: inquiryData.callerEmail || null,
        service_type: inquiryData.serviceType,
        urgency_level: inquiryData.urgencyLevel,
        issue_description: inquiryData.issueDescription,
        property_address: inquiryData.propertyAddress,
        property_city: inquiryData.propertyCity || null,
        property_state: inquiryData.propertyState || null,
        property_zip: inquiryData.propertyZip || null,
        insurance_company: inquiryData.insuranceCompany || null,
        insurance_claim_number: inquiryData.claimNumber || null,
        insurance_adjuster_name: inquiryData.adjusterName || null,
        insurance_adjuster_phone: inquiryData.adjusterPhone || null,
        routing_team: inquiryData.routingTeam,
        call_duration_seconds: inquiryData.callDuration || null,
        timestamp: new Date().toISOString(),
        agent_name: 'Aurora',
        call_status: inquiryData.status || 'completed',
        notes: inquiryData.notes || null,
        from_phone: inquiryData.fromPhone,
        to_phone: inquiryData.toPhone
      };

      const response = await axios.post(
        `${this.url}/rest/v1/inquiries`,
        payload,
        { headers: this.headers }
      );

      console.log('✅ Inquiry saved to Supabase:', response.data[0].id);
      return response.data[0];
    } catch (error) {
      console.error('❌ Supabase save error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Retrieve inquiry by ID
   */
  async getInquiry(inquiryId) {
    try {
      const response = await axios.get(
        `${this.url}/rest/v1/inquiries?id=eq.${inquiryId}`,
        { headers: this.headers }
      );
      return response.data[0] || null;
    } catch (error) {
      console.error('❌ Supabase retrieve error:', error);
      throw error;
    }
  }

  /**
   * Update inquiry status
   */
  async updateInquiry(inquiryId, updates) {
    try {
      const response = await axios.patch(
        `${this.url}/rest/v1/inquiries?id=eq.${inquiryId}`,
        updates,
        { headers: this.headers }
      );
      console.log('✅ Inquiry updated:', inquiryId);
      return response.data[0];
    } catch (error) {
      console.error('❌ Supabase update error:', error);
      throw error;
    }
  }

  /**
   * Get all inquiries for a team
   */
  async getTeamInquiries(team, limit = 10) {
    try {
      const response = await axios.get(
        `${this.url}/rest/v1/inquiries?routing_team=eq.${team}&order=timestamp.desc&limit=${limit}`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('❌ Supabase query error:', error);
      throw error;
    }
  }

  /**
   * Search inquiries by phone
   */
  async findInquiriesByPhone(phone) {
    try {
      const response = await axios.get(
        `${this.url}/rest/v1/inquiries?caller_phone=ilike.%${phone}%&order=timestamp.desc`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('❌ Supabase search error:', error);
      return [];
    }
  }
}

// ============================================
// INTELLIGENT ROUTING ENGINE
// ============================================

class RoutingEngine {
  constructor(serviceRouting) {
    this.serviceRouting = serviceRouting;
  }

  /**
   * Determine routing based on service type and urgency
   */
  determineRouting(serviceType, urgencyLevel) {
    const service = serviceType.toLowerCase();
    const routingConfig = this.serviceRouting[service];

    if (!routingConfig) {
      return {
        team: 'general_inquiries',
        priority: 'NORMAL',
        responseTime: 'flexible',
        requiresInsuranceCoordination: false,
        requiresPermit: false
      };
    }

    return {
      team: routingConfig.team,
      priority: urgencyLevel === 'EMERGENCY' ? 'IMMEDIATE' : urgencyLevel === 'URGENT' ? 'HIGH' : 'NORMAL',
      responseTime: routingConfig.responseTime[urgencyLevel] || 'flexible',
      requiresInsuranceCoordination: routingConfig.requiresInsuranceCoordination,
      requiresPermit: routingConfig.requiresPermit
    };
  }

  /**
   * Generate routing instructions for team
   */
  generateRoutingInstructions(routingDecision, inquiryData) {
    const instructions = {
      team: routingDecision.team,
      priority: routingDecision.priority,
      responseDeadline: this.calculateDeadline(routingDecision.responseTime),
      customerName: inquiryData.callerName,
      customerPhone: inquiryData.callerPhone,
      service: inquiryData.serviceType,
      description: inquiryData.issueDescription,
      address: inquiryData.propertyAddress,
      urgency: inquiryData.urgencyLevel,
      specialInstructions: this.generateSpecialInstructions(inquiryData, routingDecision)
    };

    return instructions;
  }

  /**
   * Generate special instructions based on routing
   */
  generateSpecialInstructions(inquiryData, routingDecision) {
    const instructions = [];

    if (routingDecision.requiresInsuranceCoordination) {
      instructions.push(`INSURANCE: Customer may have insurance claim - coordinate with adjuster`);
    }

    if (routingDecision.requiresPermit) {
      instructions.push(`PERMITS: Verify permit requirements before scheduling work`);
    }

    if (inquiryData.urgencyLevel === 'EMERGENCY') {
      instructions.push(`EMERGENCY: Prioritize scheduling within response window`);
      instructions.push(`SAFETY: Assess for immediate hazards during first contact`);
    }

    if (inquiryData.insuranceCompany) {
      instructions.push(`Insurance: ${inquiryData.insuranceCompany} - Claim: ${inquiryData.claimNumber}`);
    }

    return instructions;
  }

  /**
   * Calculate response deadline
   */
  calculateDeadline(responseTime) {
    const now = new Date();
    let deadline;

    if (responseTime.includes('hour')) {
      const hours = parseInt(responseTime);
      deadline = new Date(now.getTime() + hours * 60 * 60 * 1000);
    } else if (responseTime.includes('day')) {
      const days = parseInt(responseTime);
      deadline = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    } else if (responseTime === 'same-day') {
      deadline = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else {
      deadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // Default: 7 days
    }

    return deadline.toISOString();
  }
}

// ============================================
// SMS & CALL ESCALATION MANAGER
// ============================================

class EscalationManager {
  constructor(twilioAccountSid, twilioAuthToken, twilioPhone) {
    this.client = twilio(twilioAccountSid, twilioAuthToken);
    this.twilioPhone = twilioPhone;
  }

  /**
   * Send SMS confirmation after inquiry
   */
  async sendConfirmationSMS(inquiryData, routingDecision) {
    try {
      const message = `Hi ${inquiryData.callerName}! 👋 Thank you for contacting Warm Home Inc. We received your ${inquiryData.serviceType} inquiry. Our ${routingDecision.team} team will contact you within ${routingDecision.responseTime}. -Aurora`;

      const result = await this.client.messages.create({
        body: message,
        from: this.twilioPhone,
        to: inquiryData.callerPhone
      });

      console.log('✅ SMS confirmation sent:', result.sid);
      return result;
    } catch (error) {
      console.error('❌ SMS send error:', error);
      throw error;
    }
  }

  /**
   * Send SMS with inspection link
   */
  async sendInspectionLinkSMS(inquiryData) {
    try {
      const message = `${inquiryData.callerName}, schedule your free inspection here: [LINK]. -Warm Home Inc`;

      const result = await this.client.messages.create({
        body: message,
        from: this.twilioPhone,
        to: inquiryData.callerPhone
      });

      console.log('✅ Inspection link SMS sent:', result.sid);
      return result;
    } catch (error) {
      console.error('❌ SMS send error:', error);
      throw error;
    }
  }

  /**
   * Send SMS with appointment details
   */
  async sendAppointmentSMS(inquiryData, appointmentDetails) {
    try {
      const message = `${inquiryData.callerName}, your appointment is confirmed: ${appointmentDetails.date} at ${appointmentDetails.time}. Crew will arrive within a 2-hour window. Call us if questions. -Warm Home Inc`;

      const result = await this.client.messages.create({
        body: message,
        from: this.twilioPhone,
        to: inquiryData.callerPhone
      });

      console.log('✅ Appointment SMS sent:', result.sid);
      return result;
    } catch (error) {
      console.error('❌ SMS send error:', error);
      throw error;
    }
  }

  /**
   * Initiate callback to customer (escalation to live representative)
   */
  async initiateEscalationCall(customerPhone, routingInstructions) {
    try {
      // Call customer and queue to representative
      const call = await this.client.calls.create({
        url: 'https://demo.twilio.com/docs/voice.xml', // Queue URL to representative
        to: customerPhone,
        from: this.twilioPhone
      });

      console.log('✅ Escalation call initiated:', call.sid);
      return call;
    } catch (error) {
      console.error('❌ Escalation call error:', error);
      throw error;
    }
  }

  /**
   * Send team notification SMS about new inquiry
   */
  async sendTeamNotificationSMS(teamPhone, routingInstructions) {
    try {
      const message = `[NEW INQUIRY] ${routingInstructions.priority} - ${routingInstructions.service} - ${routingInstructions.customerName} (${routingInstructions.customerPhone}). Deadline: ${routingInstructions.responseDeadline}`;

      const result = await this.client.messages.create({
        body: message,
        from: this.twilioPhone,
        to: teamPhone
      });

      console.log('✅ Team notification sent:', result.sid);
      return result;
    } catch (error) {
      console.error('❌ Team notification error:', error);
      throw error;
    }
  }
}

// ============================================
// CRM DATA COLLECTION WORKFLOW
// ============================================

class DataCollectionWorkflow {
  /**
   * Validate collected data
   */
  static validateData(inquiryData) {
    const errors = [];

    if (!inquiryData.callerName || inquiryData.callerName.trim() === '') {
      errors.push('Caller name is required');
    }

    if (!inquiryData.callerPhone || inquiryData.callerPhone.trim() === '') {
      errors.push('Caller phone is required');
    }

    if (!inquiryData.serviceType || inquiryData.serviceType.trim() === '') {
      errors.push('Service type is required');
    }

    if (!inquiryData.urgencyLevel || !['EMERGENCY', 'URGENT', 'ROUTINE'].includes(inquiryData.urgencyLevel)) {
      errors.push('Valid urgency level required');
    }

    if (!inquiryData.issueDescription || inquiryData.issueDescription.trim() === '') {
      errors.push('Issue description is required');
    }

    if (!inquiryData.propertyAddress || inquiryData.propertyAddress.trim() === '') {
      errors.push('Property address is required');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Format phone number to standard format
   */
  static formatPhoneNumber(phone) {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length !== 10 && cleaned.length !== 11) return phone;
    
    const formatted = cleaned.length === 11 
      ? `+1${cleaned.slice(-10)}`
      : `+1${cleaned}`;
    
    return formatted;
  }

  /**
   * Normalize service type to match knowledge base keys
   */
  static normalizeServiceType(service) {
    const normalization = {
      'roof': 'roofing',
      'roofing': 'roofing',
      'tarp': 'tarping',
      'tarping': 'tarping',
      'tree': 'tree',
      'trees': 'tree',
      'removal': 'tree',
      'exterior': 'exterior',
      'siding': 'exterior',
      'gutter': 'exterior',
      'fascia': 'exterior',
      'interior': 'interior',
      'water damage': 'interior',
      'mold': 'interior',
      'drywall': 'interior',
      'waterproof': 'waterproofing',
      'waterproofing': 'waterproofing',
      'basement': 'waterproofing',
      'crawlspace': 'waterproofing',
      'armor': 'armor',
      'polyurea': 'armor',
      'coating': 'armor',
      'floor': 'armor',
      'construction': 'newbuild',
      'addition': 'newbuild',
      'new build': 'newbuild',
      'renovation': 'newbuild',
      'cabinet': 'millwork',
      'millwork': 'millwork',
      'custom': 'millwork'
    };

    const key = service.toLowerCase().trim();
    return normalization[key] || service.toLowerCase();
  }

  /**
   * Determine urgency from description
   */
  static determineUrgency(description) {
    const emergencyKeywords = [
      'emergency', 'urgent', 'immediately', 'asap', 'right now',
      'leak', 'flooding', 'water damage', 'mold', 'hazard',
      'tree falling', 'exposed to weather', 'hole in roof',
      'dangerous', 'children safety', 'pet safety'
    ];

    const urgentKeywords = [
      'soon', 'this week', 'hurry', 'quickly',
      'worsening', 'spreading', 'worrisome',
      'quote', 'schedule', 'inspection'
    ];

    const lowerDesc = description.toLowerCase();

    if (emergencyKeywords.some(keyword => lowerDesc.includes(keyword))) {
      return 'EMERGENCY';
    } else if (urgentKeywords.some(keyword => lowerDesc.includes(keyword))) {
      return 'URGENT';
    } else {
      return 'ROUTINE';
    }
  }
}

// ============================================
// COMPLETE WORKFLOW ORCHESTRATOR
// ============================================

class AuroraWorkflowOrchestrator {
  constructor(supabaseManager, routingEngine, escalationManager) {
    this.supabase = supabaseManager;
    this.routing = routingEngine;
    this.escalation = escalationManager;
  }

  /**
   * Complete workflow: Data validation → Routing → Storage → Notification → Escalation
   */
  async processInquiry(inquiryData) {
    console.log('🔄 Processing inquiry for:', inquiryData.callerName);

    try {
      // Step 1: Validate data
      const validation = DataCollectionWorkflow.validateData(inquiryData);
      if (!validation.isValid) {
        console.error('❌ Validation failed:', validation.errors);
        return { success: false, errors: validation.errors };
      }

      // Step 2: Normalize/format data
      inquiryData.callerPhone = DataCollectionWorkflow.formatPhoneNumber(inquiryData.callerPhone);
      inquiryData.serviceType = DataCollectionWorkflow.normalizeServiceType(inquiryData.serviceType);
      if (!inquiryData.urgencyLevel) {
        inquiryData.urgencyLevel = DataCollectionWorkflow.determineUrgency(inquiryData.issueDescription);
      }

      // Step 3: Determine routing
      const routingDecision = this.routing.determineRouting(
        inquiryData.serviceType,
        inquiryData.urgencyLevel
      );
      inquiryData.routingTeam = routingDecision.team;

      // Step 4: Save to database
      const savedInquiry = await this.supabase.saveInquiry(inquiryData);
      console.log('✅ Inquiry saved, ID:', savedInquiry.id);

      // Step 5: Generate routing instructions
      const routingInstructions = this.routing.generateRoutingInstructions(routingDecision, inquiryData);

      // Step 6: Send SMS confirmation
      await this.escalation.sendConfirmationSMS(inquiryData, routingDecision);

      // Step 7: Send team notification
      // (In production, this goes to specific team phone/email)
      console.log('📋 Team notification would go to:', routingInstructions.team);

      // Step 8: Determine if escalation needed
      if (inquiryData.urgencyLevel === 'EMERGENCY') {
        // For emergencies, may need immediate callback
        console.log('🚨 EMERGENCY - May initiate immediate callback');
      }

      return {
        success: true,
        inquiryId: savedInquiry.id,
        routing: routingDecision,
        instructions: routingInstructions
      };

    } catch (error) {
      console.error('❌ Workflow error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  SupabaseManager,
  RoutingEngine,
  EscalationManager,
  DataCollectionWorkflow,
  AuroraWorkflowOrchestrator
};
