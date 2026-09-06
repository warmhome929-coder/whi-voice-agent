/**
 * AURORA COMPLETE KNOWLEDGE BASE
 * All 9 Services - Q&A, Insurance, Warranties, Objections, Pricing
 * Used by Claude to answer customer inquiries with industry-backed responses
 */

const AURORA_KNOWLEDGE_BASE = {
  
  // ============================================
  // SERVICE 1: ROOFING
  // ============================================
  roofing: {
    name: 'Roofing',
    category: 'Permanent repair & replacement',
    description: 'Professional roofing repairs and full roof replacements with warranty protection',

    commonQuestions: [
      {
        q: "How much does a roof replacement cost?",
        a: "Roof replacement costs vary based on roof size (measured in squares - 100 sq ft = 1 square), material type (asphalt shingles $3-5/sq ft, metal $8-12/sq ft, tile $10-15/sq ft), and local labor rates. For a 2,000 sq ft home, expect $8,000-$25,000. We provide free inspections and detailed quotes after measuring your specific roof."
      },
      {
        q: "What's the difference between roof repair and replacement?",
        a: "Repairs fix specific damaged areas - shingles, flashing, leaks - usually $300-$1,500. Replacement installs a completely new roof system when damage is extensive or roof is past its lifespan (typically 15-25 years depending on material). We'll inspect and recommend what makes sense for your situation."
      },
      {
        q: "How long does a roof last?",
        a: "Asphalt shingles: 15-20 years. Metal roofing: 40-70 years. Tile/slate: 50-100+ years. Lifespan depends on climate, maintenance, installation quality, and ventilation. Harsh weather (hail, high winds, UV) shortens lifespan. Regular inspections every 2-3 years help catch problems early."
      },
      {
        q: "Will my insurance cover roof damage?",
        a: "Most homeowner policies cover roof damage from sudden events (storms, hail, wind, falling trees) but NOT from poor maintenance or age-related deterioration. Deductibles typically range $500-$2,500. We handle insurance coordination - we'll document damage, work with adjusters, and maximize your coverage."
      },
      {
        q: "Do you offer financing?",
        a: "Yes! We work with multiple financing partners offering 0-12 month promotional rates, extended terms up to 84 months, and flexible payment plans. Insurance claims can be applied directly to reduce your out-of-pocket. We'll discuss all options after your inspection."
      }
    ],

    objectionHandlers: {
      price: {
        concern: "Your price is higher than competitor quotes",
        response: "I understand cost matters. Our pricing reflects: (1) Premium materials and workmanship with 10-year warranty, (2) Licensed, insured, bonded crews, (3) Proper ventilation/underlayment installation (most competitors skip this), (4) Complete insurance coordination handling, (5) References and proven track record. Cheapest price often means cutting corners that cost thousands later. Would you like to discuss what's included in our quote vs the other bid?"
      },
      timing: {
        concern: "We need it done faster",
        response: "We prioritize based on urgency. For emergency situations (active leak threatening interior), we can often schedule within 24-48 hours. Standard repairs/replacements typically take 1-3 weeks depending on weather and crew availability. We can discuss rush options. What's your timeline concern?"
      },
      trust: {
        concern: "How do I know you'll do quality work?",
        response: "Great question. We're licensed, insured, and bonded in [STATE]. We provide: (1) Detailed contracts with specifications, (2) 10-year workmanship warranty, (3) References from 100+ satisfied customers, (4) Before/after photos, (5) Transparent communication throughout. We'll connect you with recent customers who can speak to our quality. Would that help?"
      }
    },

    insuranceCoordination: {
      process: "1. Initial inspection & documentation of damage with photos 2. We estimate repair/replacement cost 3. You file claim with insurer and schedule adjuster inspection 4. We coordinate with adjuster, provide detailed scope of work 5. Claim approved - insurance pays their portion to us 6. You pay deductible directly to us 7. We complete work 8. Final inspection & warranty registration",
      documentation: "We photograph all damage, document measurements, provide detailed estimates, and write professional scope-of-work descriptions for insurance adjusters"
    },

    warranty: "10-year workmanship warranty on all labor. Material warranties vary: Asphalt shingles 15-25 years (manufacturer), Metal 40+ years, Tile/Slate 50+ years. Full warranty protection documented and registered."
  },

  // ============================================
  // SERVICE 2: TARPING (EMERGENCY)
  // ============================================
  tarping: {
    name: 'Tarping',
    category: 'Emergency temporary protection',
    description: 'Emergency tarping for storm damage, water damage prevention, and temporary roof protection',

    commonQuestions: [
      {
        q: "What's the cost of emergency tarping?",
        a: "Emergency tarping typically costs $500-$2,000 depending on roof size, accessibility, damage severity, and response time. We charge for labor + materials (heavy-duty tarps). Emergency after-hours calls (nights/weekends) have premium pricing. Exact price quoted after you describe the situation."
      },
      {
        q: "How quickly can you tarp a roof?",
        a: "For emergency situations with active water intrusion: 2-4 hours response time. Standard tarping: same day if called before 4 PM. We have dedicated emergency response teams with equipment ready 24/7. We ask for access confirmation then dispatch immediately."
      },
      {
        q: "Is tarping covered by insurance?",
        a: "Yes! Insurance typically covers emergency tarping as part of damage mitigation. We submit tarping cost directly to your claim, reducing your out-of-pocket. Most policies cover 100% of reasonable emergency mitigation costs. We handle the insurance paperwork."
      },
      {
        q: "How long does a tarp last?",
        a: "Quality tarp installation lasts 2-6 months depending on weather exposure (wind, UV, rain). We use heavy-duty marine-grade tarps (10-15 oz) that withstand most conditions. We inspect regularly and re-secure as needed. Tarping is temporary - plan permanent repairs within 2-3 months before tarp degrades."
      },
      {
        q: "Can you tarp in bad weather?",
        a: "We don't tarp during active severe weather (lightning, heavy winds) for safety. But we CAN typically tarp same-day even if light rain/drizzle. For severe ongoing storms, we tarp as soon as it's safe. If damage is active (water pouring in), we prioritize immediate temporary containment."
      }
    ],

    objectionHandlers: {
      price: {
        concern: "Tarping cost seems high for temporary solution",
        response: "I understand the concern. But consider: (1) Without tarping, water damage spreads through attic, insulation, drywall - adding $5,000-$15,000 to repair costs, (2) Tarping prevents mold growth which creates health hazards, (3) Insurance often covers tarping cost, reducing your out-of-pocket. Spending $1,000 to prevent $20,000 in water damage is smart protection. Let's discuss your specific situation?"
      },
      timing: {
        concern: "We want permanent fix now, not temporary tarp",
        response: "Permanent roof repairs often require parts (materials, permits, scheduling contractors). That takes days to weeks. Meanwhile, water damage accelerates hourly. Smart approach: tarp today to stop water damage, schedule permanent repair for next available opening. This protects your home and reduces total repair cost. Agree?"
      }
    },

    emergencyProtocol: "Upon call: Confirm emergency (active leak/water intrusion) → Assess roof accessibility & hazards → Obtain permission to enter property → Dispatch crew → Arrive within 2-4 hours → Secure tarp professionally → Document with photos → Provide temporary protection checklist → Schedule permanent repair consultation"
  },

  // ============================================
  // SERVICE 3: TREE REMOVAL
  // ============================================
  treeRemoval: {
    name: 'Tree Removal',
    category: 'Tree removal & stump grinding',
    description: 'Professional tree removal, stump grinding, and debris cleanup for hazardous or unwanted trees',

    commonQuestions: [
      {
        q: "How much does tree removal cost?",
        a: "Tree removal costs $500-$3,000+ depending on: tree size (height 30-100+ ft), tree condition (healthy/dead/diseased), location (near house/power lines increases complexity), and accessibility. Small trees: $400-$800. Medium: $800-$1,500. Large/hazardous: $1,500-$3,000+. Free assessment visit to provide accurate quote."
      },
      {
        q: "Do you remove stumps?",
        a: "Yes! Stump grinding is often recommended to prevent regrowth and new pest problems. Grinding a stump: $150-$400. We grind 4-12 inches below ground level, making area suitable for replanting or landscaping. Without grinding, stumps typically sprout new growth within weeks."
      },
      {
        q: "Is tree removal covered by insurance?",
        a: "Insurance covers tree removal if: tree is damaged (storm/disease/damage) AND damaged tree damaged your home/structure. Stand-alone tree removal not creating damage typically NOT covered. We assess and file claims when applicable. Hazard trees near your house may qualify."
      },
      {
        q: "How do you remove trees without damaging my house?",
        a: "We use: (1) Professional rigging to lower large sections safely, (2) Cranes for complex removals near structures, (3) Directional felling in open areas, (4) Hazard assessment before work starts, (5) Full insurance/bonding for any damage. We've removed 1,000+ trees - structural damage is rare when professionals handle it."
      }
    ],

    objectionHandlers: {
      price: {
        concern: "Tree removal quote is more than expected",
        response: "Tree removal is specialized, hazardous work. Cost reflects: (1) Professional arborist expertise to prevent damage, (2) Equipment rental (cranes, chippers, rigging), (3) Full insurance/liability protection, (4) Licensed, trained crews, (5) Safe disposal of debris. DIY or unlicensed removal risks serious injury and property damage. Our pricing includes all safety/insurance - you're protected. Questions about what's included?"
      },
      safety: {
        concern: "Worried about damage to house/property during removal",
        response: "Legitimate concern. We minimize risk through: (1) Pre-work hazard assessment & planning, (2) Professional rigging to control limb placement, (3) Crane rental for dangerous proximity situations, (4) Full liability insurance ($1-2M coverage), (5) Experienced crew (10+ years average). We inspect the area after work to ensure no hidden damage. References available from 100+ satisfied customers."
      }
    },

    hazardTreeIndicators: "Lean/tilt toward structure, large dead branches, disease signs (hollow areas, peeling bark), proximity to power lines, storm damage, multiple trunks at base, trunk cavities"
  },

  // ============================================
  // SERVICE 4: EXTERIOR
  // ============================================
  exterior: {
    name: 'Exterior',
    category: 'Siding, fascia, gutters, painting',
    description: 'Exterior renovation including siding replacement, gutter installation, fascia repair, and exterior painting',

    commonQuestions: [
      {
        q: "Should I replace siding or repair?",
        a: "Repair is better if: 1-3 damaged panels, damage localized, siding less than 15 years old. Replace if: widespread damage, siding 20+ years old, structural issues, energy efficiency goals. Cost: Repairs $300-$1,000. Replacement $6,000-$20,000 depending on material/home size. We inspect and recommend the right approach."
      },
      {
        q: "What siding materials do you install?",
        a: "We work with: (1) Vinyl - affordable, low-maintenance, $3-8/sq ft, (2) Fiber cement - durable, weather-resistant, $6-12/sq ft, (3) Metal - long-lasting, modern look, $8-15/sq ft, (4) Wood - classic, premium, $8-15/sq ft. Each has pros/cons we'll discuss. We recommend based on climate, maintenance tolerance, and budget."
      },
      {
        q: "Do you handle gutters?",
        a: "Yes! Full gutter services: (1) Installation of new gutters (K-style, half-round, seamless), (2) Gutter cleaning & maintenance, (3) Downspout installation & grading, (4) Leaf guards/protection systems, (5) Gutter repair. Gutters protect foundation/landscaping - critical maintenance. Cleaning 2x yearly prevents overflow damage."
      },
      {
        q: "How often should gutters be cleaned?",
        a: "Typically 2-3 times per year (fall leaf season, spring, early summer). More if you have trees nearby. Regular cleaning: $200-$400 per visit. Ignoring gutters causes: foundation damage, landscape erosion, basement flooding, wood rot - costing $2,000-$10,000+. Prevention is smart investment."
      }
    ],

    objectionHandlers: {
      price: {
        concern: "Siding replacement is expensive",
        response: "I understand. But consider: (1) New siding adds $5,000-$8,000 home value increase, (2) Improves energy efficiency 10-15% (lower heating/cooling), (3) Eliminates ongoing repair costs ($300-$500/year), (4) Gives 30-40 year lifespan (vs constant repairs), (5) Improves curb appeal & security. Amortized over time, replacement is actually cost-effective. Plus, we offer financing options. Want to discuss payment plans?"
      },
      timing: {
        concern: "Can we wait on siding work?",
        response: "Depends on damage severity. If siding is just cosmetic damage, waiting is fine. But if you have: water damage, gaps/cracks, peeling/rotting, insect damage - delay risks expensive structural issues. Water intrusion into walls costs $5,000-$15,000 to repair. Better to address now than after major damage. Can we schedule a free inspection to assess urgency?"
      }
    }
  },

  // ============================================
  // SERVICE 5: INTERIOR
  // ============================================
  interior: {
    name: 'Interior',
    category: 'Drywall, painting, flooring, water damage, mold',
    description: 'Interior restoration including water damage repair, mold remediation, drywall, painting, and flooring',

    commonQuestions: [
      {
        q: "How do you handle water damage and mold?",
        a: "Our process: (1) Assess damage extent - visual inspection + moisture meters, (2) Dry affected areas - dehumidifiers, fans, 24-72 hour drying, (3) Remove compromised materials (drywall, insulation, flooring), (4) Mold testing if needed (professional lab analysis), (5) Remediation - HEPA vacuuming, antimicrobial treatment, (6) Replacement - new drywall, insulation, flooring, paint. Most water damage takes 5-10 days to fully remediate."
      },
      {
        q: "Is water damage covered by insurance?",
        a: "Depends on cause: Sudden events (burst pipes, storm) - typically YES. Slow leaks/poor maintenance - typically NO. Mold coverage varies widely. We document everything professionally and work with adjusters to maximize your coverage. Average claim payout: $8,000-$15,000 for serious water damage."
      },
      {
        q: "What's the cost of water damage repair?",
        a: "Varies significantly by damage extent: Small (1 room, surface damage): $2,000-$5,000. Moderate (multiple rooms, drywall replacement): $5,000-$15,000. Severe (structural damage, mold remediation): $15,000-$50,000+. We provide detailed estimates after inspection. Insurance often covers 70-90% depending on deductible."
      },
      {
        q: "Do you paint and do flooring?",
        a: "Yes to both! Painting: interior/exterior, all finishes. Flooring: hardwood, laminate, vinyl, carpet, tile. We match existing finishes and provide professional installation with warranty. Painting interior: $2-5/sq ft. Flooring: $3-15/sq ft depending on material."
      }
    ],

    objectionHandlers: {
      mold_concern: {
        concern: "Worried about mold health effects",
        response: "Legitimate concern. Mold exposure can trigger allergies, asthma, respiratory issues. We take this seriously: (1) Professional assessment determines actual mold presence, (2) Proper remediation following EPA guidelines, (3) Certification of clearance after remediation, (4) Prevention measures to stop regrowth. Most mold situations are manageable with proper treatment. Let's get a professional assessment first."
      },
      cost: {
        concern: "Water damage repair is very expensive",
        response: "I understand. But delay makes it exponentially worse: Day 1-3 can dry successfully ($2,000-$5,000). Week 2-3 develops mold, structural damage ($15,000-$30,000). Month+ structural collapse, health hazards ($50,000+). Acting fast is cost-effective. Plus insurance often covers it. Prompt action = lower total cost. Ready to schedule inspection?"
      }
    }
  },

  // ============================================
  // SERVICE 6: WATERPROOFING
  // ============================================
  waterproofing: {
    name: 'Waterproofing',
    category: 'Basement, crawlspace, moisture control',
    description: 'Basement waterproofing, crawlspace encapsulation, and moisture control solutions',

    commonQuestions: [
      {
        q: "Why is my basement wet?",
        a: "Common causes: (1) Poor drainage - water pooling against foundation, (2) Cracks in foundation - water seeping through, (3) Gutters/downspouts directing water toward house, (4) High water table - groundwater pressure, (5) Humidity - condensation from wet soil. We diagnose the specific cause and recommend targeted solution."
      },
      {
        q: "What's the cost of basement waterproofing?",
        a: "Depends on scope: Interior sealant/paint: $1,500-$3,000. Interior drain system: $4,000-$8,000. Exterior foundation repair: $8,000-$15,000. Crawlspace encapsulation: $3,000-$8,000. We inspect, identify cause, and quote exact solution. Many situations qualify for insurance coverage."
      },
      {
        q: "What's the difference between waterproofing and dampproofing?",
        a: "Dampproofing: Reduces moisture/humidity (paint, sealers, dehumidifiers). Temporary - 5-10 years. Waterproofing: Blocks water intrusion through barriers and drainage systems. Long-term - 15-30+ years. For active water problems, waterproofing is necessary. For humidity, dampproofing works."
      },
      {
        q: "Do you do crawlspace encapsulation?",
        a: "Yes! Encapsulation involves: (1) Install plastic vapor barrier over ground, (2) Seal all vents/openings, (3) Insulate walls/rim joists, (4) Install dehumidifier system, (5) Create sealed, conditioned crawlspace. Benefits: Better energy efficiency, prevents mold, controls humidity, pest prevention. Cost: $3,000-$8,000 typically."
      }
    ],

    objectionHandlers: {
      prevention_belief: {
        concern: "A little moisture in basement is normal - we can live with it",
        response: "Actually, any basement moisture leads to problems: (1) Mold growth (health hazard), (2) Structural decay (foundation damage = $50,000+ repairs), (3) Pest attraction (rodents, insects), (4) Decreased home value, (5) HVAC system strain (higher energy costs). 'A little moisture' becomes major damage in 2-3 years. Prevention now saves thousands later. Worth addressing?"
      },
      cost: {
        concern: "Waterproofing cost seems high",
        response: "True, upfront cost is $4,000-$15,000. BUT consider: (1) Foundation damage costs $50,000-$100,000+ to repair, (2) Mold remediation: $15,000-$50,000, (3) Home value loss: 10-20% decrease, (4) Insurance claims (moisture damage often not covered). Waterproofing now = insurance against major future costs. Plus, we discuss financing options. It's actually protective financial decision."
      }
    }
  },

  // ============================================
  // SERVICE 7: ARMOR PLATING / POLYUREA COATINGS
  // ============================================
  armorPlating: {
    name: 'Armor Plating',
    category: 'Polyurea protective coatings',
    description: 'Durable polyurea coating protection for garage floors, decks, and exposed surfaces',

    commonQuestions: [
      {
        q: "What is polyurea armor plating?",
        a: "Polyurea is a heavy-duty protective coating (think industrial-grade paint) sprayed onto surfaces. Creates 1/8-1/4 inch flexible, waterproof, slip-resistant layer. Incredibly durable - resists: water, UV, chemicals, abrasion, temperature extremes. Lasts 10-15+ years. Used on garage floors, decks, pool decks, industrial floors."
      },
      {
        q: "What's the cost?",
        a: "Polyurea coating: $3-8 per sq ft depending on surface prep and coating thickness. Average garage (400 sq ft): $1,200-$3,200. Includes surface prep, priming, coating application, sealant. Cost is significant but durability justifies - won't crack/peel like paint."
      },
      {
        q: "How long does polyurea last?",
        a: "With proper maintenance: 10-15 years minimum. Top-of-line polyurea in ideal conditions: 20+ years. Far outlasts traditional epoxy (5-7 years) or paint (2-3 years). Resistant to moisture, chemicals, temperature swings that destroy other coatings. Minimal maintenance - regular cleaning only."
      },
      {
        q: "Is polyurea better than epoxy for my garage?",
        a: "Yes, in most cases. Polyurea advantages: (1) More flexible - handles temperature expansion without cracking, (2) Faster cure time (1-2 days vs epoxy's 5-7 days), (3) Better UV resistance - won't yellow, (4) More durable - resists chemicals/abrasion better, (5) Better moisture tolerance - works in humid climates. Epoxy is cheaper but less durable. Polyurea is worth the investment."
      }
    ],

    objectionHandlers: {
      price: {
        concern: "High cost for a garage floor coating",
        response: "True, upfront cost is $1,200-$3,200. But consider: (1) Traditional epoxy costs $800 now and needs replacement in 5-7 years (total $1,600-$2,400 over 10 years), (2) Polyurea lasts 10-15 years ($1-2 per year cost), (3) Bare concrete is prone to staining ($100-$500 to clean), oil damage, spalling - repair costs add up, (4) Your garage will have a protected, professional-looking floor lasting decades. It's actually cost-effective when amortized. Plus we offer financing for large jobs."
      },
      urgency: {
        concern: "Floor seems fine, we can wait",
        response: "Protecting now prevents damage: (1) Bare concrete absorbs moisture & chemicals, (2) Oil spills permanently stain bare concrete, (3) Concrete spalls/deteriorates without protection, (4) Coating surfaces that already have damage is harder/more expensive. Early coating protects your investment. Cost difference of $200-400 if applied to undamaged surface vs damaged surface. Worth discussing when works for your schedule?"
      }
    }
  },

  // ============================================
  // SERVICE 8: NEW BUILD / CONSTRUCTION
  // ============================================
  newBuild: {
    name: 'New Build',
    category: 'Construction, additions, renovations',
    description: 'New construction, room additions, and major renovation projects',

    commonQuestions: [
      {
        q: "Do you handle custom construction?",
        a: "Yes! We manage: (1) Room additions - bedroom, bathroom, kitchen, (2) Deck/patio construction, (3) Minor new build - rental units, garage conversions, (4) Full interior renovations. We work with your architect/plans or help develop scope. Process: Design → Permitting → Construction → Inspection → Completion."
      },
      {
        q: "What's the cost of a room addition?",
        a: "Depends on scope: Bedroom addition (12x14): $20,000-$35,000. Bathroom: $15,000-$25,000. Kitchen remodel: $25,000-$60,000. Pool addition: $30,000-$80,000. Cost depends on: materials (basic vs premium), labor, local rates, permits, complexity. We provide detailed estimates after reviewing plans."
      },
      {
        q: "How long does construction take?",
        a: "Small addition (room): 4-8 weeks. Major renovation: 8-16 weeks. Timeline depends on: project scope, permit delays, material availability, weather, inspections required. We provide detailed project timeline upfront. Construction is sequential - next phase starts after prior phase inspection/approval."
      },
      {
        q: "Do you handle permits?",
        a: "Yes! We manage: (1) Permit applications and fees, (2) Plan reviews with building department, (3) Schedule inspections (framing, electrical, plumbing, final), (4) Coordinate with inspectors. Permits typically add 2-4 weeks to timeline but are legally required. Cost: $500-$2,000 depending on project scope."
      }
    ],

    objectionHandlers: {
      cost: {
        concern: "Construction costs are very high",
        response: "True, but consider: (1) Room addition increases home value 50-80% of construction cost (20,000 addition = $10,000-$16,000 value increase), (2) Extra square footage = extra resale value, rental income potential, (3) Custom build ensures quality vs cheaper builder = future problems. Investment now pays back through home value appreciation. Plus we discuss payment schedules - paying as phases complete rather than upfront."
      },
      timeline: {
        concern: "Can you do this faster?",
        response: "Faster construction risks quality issues. Building codes require inspections between phases - can't skip. Material sourcing, weather delays are real. That said, we prioritize your project and work efficiently. What's your timeline need? We may be able to expedite certain phases or discuss options."
      }
    }
  },

  // ============================================
  // SERVICE 9: MILLWORK
  // ============================================
  millwork: {
    name: 'Millwork',
    category: 'Custom cabinets and interior trim',
    description: 'Custom cabinets from our NJ factory with premium finishes and professional installation',

    commonQuestions: [
      {
        q: "What is millwork?",
        a: "Millwork is custom woodworking - cabinets, trim, doors, shelving, built-ins. We manufacture in our NJ factory: kitchen cabinets, bathroom vanities, closet systems, library shelving, entertainment centers. All custom-built to your specifications with premium finishes."
      },
      {
        q: "What are the costs?",
        a: "Millwork is priced per linear foot or per cabinet: Basic kitchen cabinets: $100-200/linear foot. Premium: $200-400/linear foot. Custom island: $2,000-$8,000. Bathroom vanities: $1,500-$4,000. Full kitchen renovation with cabinets: $15,000-$40,000. Design consultation is free."
      },
      {
        q: "How long for custom cabinets?",
        a: "Process: Design/measurements (1 week) → Manufacturing (3-6 weeks depending on complexity & factory load) → Installation (3-5 days). Total: 4-8 weeks typically. Rush orders available (extra fee) for 2-3 week delivery."
      },
      {
        q: "What finishes are available?",
        a: "We offer: (1) Stained wood - cherry, oak, maple, walnut, etc., (2) Painted - any color, (3) Glazed finishes - vintage look, (4) Modern high-gloss, (5) Matte/flat finishes, (6) Custom combinations. We provide samples for your review and approval before manufacturing."
      }
    ],

    objectionHandlers: {
      cost: {
        concern: "Custom millwork is expensive vs off-the-shelf cabinets",
        response: "True, custom costs more upfront. But you get: (1) Exactly your design/specifications (not compromising), (2) Premium construction quality - built to last 20-30+ years, (3) Flexibility in finishes/hardware/configuration, (4) Professional installation ensuring perfect fit, (5) Home value increase - custom finishes are premium selling point. Off-the-shelf cabinets look cheap, wear poorly, create resale concerns. Custom is better long-term investment."
      },
      timeline: {
        concern: "Why does it take 4-8 weeks?",
        response: "Custom manufacturing takes time: (1) Design/approval process, (2) Material sourcing, (3) Precision manufacturing (doors, drawers, assembly), (4) Quality control inspections, (5) Finishing/staining, (6) Packing/shipping. Can't rush quality without defects. That said, we manage timeline closely and communicate updates. Rush orders available if needed (2-3 weeks, extra cost)."
      }
    }
  }
};

// ============================================
// GENERAL SERVICE ROUTING MATRIX
// ============================================

const SERVICE_ROUTING = {
  'roofing': {
    team: 'roofing_dispatch',
    responseTime: {
      EMERGENCY: '2-4 hours',
      URGENT: '24-48 hours',
      ROUTINE: 'flexible'
    },
    requiresInsuranceCoordination: true,
    requiresPermit: true
  },
  'tarping': {
    team: 'emergency_dispatch',
    responseTime: {
      EMERGENCY: '2-4 hours',
      URGENT: '4-8 hours',
      ROUTINE: 'same-day'
    },
    requiresInsuranceCoordination: true,
    requiresPermit: false
  },
  'tree': {
    team: 'tree_removal_dispatch',
    responseTime: {
      EMERGENCY: '2-4 hours',
      URGENT: '24-48 hours',
      ROUTINE: 'flexible'
    },
    requiresInsuranceCoordination: true,
    requiresPermit: true
  },
  'exterior': {
    team: 'exterior_scheduling',
    responseTime: {
      EMERGENCY: '24-48 hours',
      URGENT: '3-5 days',
      ROUTINE: 'flexible'
    },
    requiresInsuranceCoordination: false,
    requiresPermit: false
  },
  'interior': {
    team: 'interior_restoration',
    responseTime: {
      EMERGENCY: '2-4 hours',
      URGENT: '24 hours',
      ROUTINE: 'flexible'
    },
    requiresInsuranceCoordination: true,
    requiresPermit: false
  },
  'waterproofing': {
    team: 'waterproofing_scheduling',
    responseTime: {
      EMERGENCY: '24-48 hours',
      URGENT: '3-5 days',
      ROUTINE: 'flexible'
    },
    requiresInsuranceCoordination: false,
    requiresPermit: false
  },
  'armor': {
    team: 'coating_scheduling',
    responseTime: {
      EMERGENCY: 'N/A',
      URGENT: '5-7 days',
      ROUTINE: '2-4 weeks'
    },
    requiresInsuranceCoordination: false,
    requiresPermit: false
  },
  'newbuild': {
    team: 'construction_division',
    responseTime: {
      EMERGENCY: 'N/A',
      URGENT: 'N/A',
      ROUTINE: 'project-based'
    },
    requiresInsuranceCoordination: false,
    requiresPermit: true
  },
  'millwork': {
    team: 'millwork_factory',
    responseTime: {
      EMERGENCY: 'N/A',
      URGENT: 'rush-order',
      ROUTINE: '4-8 weeks'
    },
    requiresInsuranceCoordination: false,
    requiresPermit: false
  }
};

module.exports = {
  AURORA_KNOWLEDGE_BASE,
  SERVICE_ROUTING
};
