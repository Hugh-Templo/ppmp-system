var CONFIG = {
  OFFICE_REGISTRY_ID: 'REPLACE_WITH_REGISTRY_SHEET_ID',
  SUBMISSION_STATUS_ID: 'REPLACE_WITH_SUBMISSION_STATUS_SHEET_ID',
  FISCAL_YEAR: 2027,
  TABS: {
    HEADER: 'PPMP_Header',
    ITEMS_CSE: 'Items_CSE',
    ITEMS_NONCSE: 'Items_nonCSE',
    FORM_CSE: 'PPMP_CSE_Form',
    FORM_NONCSE: 'PPMP_nonCSE_Form',
    SIGNATORY: 'Signatory',
    AUDIT: 'Audit_Log'
  },

  // NGPA_PPMP.xlsx Column 2
  PROJECT_TYPES: [
    'Goods',
    'Infrastructure',
    'Consulting Services',
    'General Support Services'
  ],

  // NGPA_PPMP.xlsx Column 4 - Full list from NGPA_nonCSE-APP Dropdown tab
  PROCUREMENT_MODES: [
    'Competitive Bidding',
    'Limited Source Bidding',
    'Competitive Dialogue',
    'Unsolicited Offer with Bid Matching',
    'Direct Contracting',
    'Direct Acquisition',
    'Repeat Order',
    'Small Value Procurement',
    'Negotiated Procurement - Two Failed Bidding',
    'Negotiated Procurement - Emergency Cases',
    'Negotiated Procurement - Take Over of Contracts',
    'Negotiated Procurement - Adjacent or Contiguous',
    'Negotiated Procurement - Agency-to-Agency',
    'Negotiated Procurement - Scientific, Scholarly or Artistic Work, Exclusive Technology',
    'Negotiated Procurement - Highly Technical Consultants',
    'Negotiated Procurement - Defense Cooperation Agreements and Inventory-Based Items',
    'Negotiated Procurement - Lease of Real Property and Venue',
    'Negotiated Procurement - Non-Government Organization (NGO) Participation',
    'Negotiated Procurement - Community Participation',
    'Negotiated Procurement - United Nations (UN) Agencies, International Organizations',
    'Negotiated Procurement - Direct Retail Purchase of Petroleum Fuel, Oil and Lubricants',
    'Direct Sales',
    'Direct Procurement for Science, Technology, and Innovation'
  ],

  // NGPA_PPMP.xlsx Column 9
  FUND_SOURCES: [
    'GoP - Current Budget Year',
    'GoP - Continuing Fund',
    'Foreign',
    'Special Purpose Fund',
    'Corporate Budget',
    'Income',
    'Others, specify in Remarks'
  ]
};
