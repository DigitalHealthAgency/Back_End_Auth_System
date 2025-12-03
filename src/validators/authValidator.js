const Joi = require('joi');

// Password complexity: min 12 chars (SRS Requirement), upper, lower, number, special
const passwordComplexity = Joi.string()
  .min(12)  // ✅ FIXED: Changed from 8 to 12 characters (SRS Compliance)
  .max(64)
  .pattern(/[A-Z]/, 'uppercase')
  .pattern(/[a-z]/, 'lowercase')
  .pattern(/[0-9]/, 'number')
  .pattern(/[^A-Za-z0-9]/, 'special')
  .required()
  .messages({
    'string.pattern.name': 'Password must include at least one {#name} character',
    'string.min': 'Password must be at least {#limit} characters (SRS requirement)',
    'string.max': 'Password must be at most {#limit} characters'
  });

const phoneRegex = /^(\+254|0)[17]\d{8}$/; // Kenyan mobile format

const individualSchema = Joi.object({
  type: Joi.string().valid('individual').required(),
  username: Joi.string().alphanum().min(3).max(32).required(),
  firstName: Joi.string().max(64).required(),
  lastName: Joi.string().max(64).required(),
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  phone: Joi.string().pattern(phoneRegex).required().messages({
    'string.pattern.base': 'Phone must be a valid Kenyan mobile number'
  }),
  password: passwordComplexity,
  receiveSystemAlerts: Joi.boolean().optional()
});

const organizationSchema = Joi.object({
  type: Joi.string().valid('organization').required(),
  organizationName: Joi.string().max(128).required(),
  organizationType: Joi.string().valid(
    // Healthcare Facilities
    'HOSPITAL', 'CLINIC', 'HEALTH_CENTER', 'DISPENSARY', 'LABORATORY', 'PHARMACY',
    'DENTAL_CLINIC', 'IMAGING_CENTER', 'SPECIALIST_CLINIC', 'REHABILITATION_CENTER',
    // Digital Health Solutions
    'EMR_PROVIDER', 'EHR_PROVIDER', 'LIS_PROVIDER', 'PACS_PROVIDER', 'RIS_PROVIDER',
    'HMIS_PROVIDER', 'TELEMEDICINE', 'HEALTH_APP', 'HIE_PLATFORM',
    // Other Health Organizations
    'HEALTH_INSURANCE', 'PUBLIC_HEALTH', 'MEDICAL_RESEARCH', 'HEALTH_NGO', 'OTHER'
  ).required(),
  county: Joi.string().max(64).required(),
  subCounty: Joi.string().max(64).required(),
  organizationEmail: Joi.string().email({ tlds: { allow: false } }).required(),
  organizationPhone: Joi.string().pattern(phoneRegex).required().messages({
    'string.pattern.base': 'Organization phone must be a valid Kenyan mobile number'
  }),
  yearOfEstablishment: Joi.number().integer().min(1900).max(new Date().getFullYear()).required(),
  password: passwordComplexity,
  receiveSystemAlerts: Joi.boolean().optional(),
  captchaAnswer: Joi.string().optional(),
  captchaToken: Joi.string().optional()
});

const registerSchema = Joi.alternatives().try(individualSchema, organizationSchema);

const loginSchema = Joi.object({
  identifier: Joi.string().max(128).required(),
  password: Joi.string().min(8).max(64).required(),
  twoFactorCode: Joi.string().length(6).pattern(/^\d+$/).optional()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(8).max(64).required(),
  newPassword: passwordComplexity
});

const updateProfileSchema = Joi.object({
  firstName: Joi.string().max(64),
  lastName: Joi.string().max(64),
  phone: Joi.string().pattern(phoneRegex).messages({
    'string.pattern.base': 'Phone must be a valid Kenyan mobile number'
  }),
  email: Joi.string().email({ tlds: { allow: false } }), // Allow email update for individuals
  organizationEmail: Joi.string().email({ tlds: { allow: false } }), // Allow email update for organizations
  county: Joi.string().max(64),
  subCounty: Joi.string().max(64),
  organizationPhone: Joi.string().pattern(phoneRegex).messages({
    'string.pattern.base': 'Organization phone must be a valid Kenyan mobile number'
  }),
  // username and organizationName are intentionally omitted to prevent editing
}).min(1);

const terminateAccountSchema = Joi.object({
  password: Joi.string().min(8).max(64).required()
});

// First-time password setup schema
const setupPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Setup token is required'
  }),
  password: passwordComplexity,
  confirmPassword: Joi.string().required().valid(Joi.ref('password')).messages({
    'any.only': 'Confirm password must match password'
  })
});

// Board member user creation schema
const createBoardMemberUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Name must be at least 2 characters',
    'string.max': 'Name must not exceed 100 characters'
  }),
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  phone: Joi.string().pattern(phoneRegex).required().messages({
    'string.pattern.base': 'Phone must be a valid Kenyan mobile number'
  }),
  idNumber: Joi.string().min(5).max(20).required().messages({
    'string.min': 'ID number must be at least 5 characters',
    'string.max': 'ID number must not exceed 20 characters'
  }),
  address: Joi.object({
    physical: Joi.string().max(200).optional(),
    postal: Joi.string().max(50).optional(),
    city: Joi.string().max(50).optional(),
    county: Joi.string().max(50).optional()
  }).optional(),
  boardRole: Joi.string().valid(
    'Chairperson',
    'chairperson',
    'Vice_Chairperson',
    'vice_chairperson',
    'Secretary',
    'secretary',
    'Treasurer',
    'treasurer',
    'Member',
    'member',
    'Patron',
    'patron',
    'Advisor',
    'advisor',
    // New operational roles
    'project_manager',
    'Project_Manager',
    'field_officer',
    'Field_Officer',
    'm_and_e_officer',
    'M_and_E_Officer',
    'finance',
    'Finance',
    'donor',
    'Donor'
  ).required(),
  startDate: Joi.date().required().messages({
    'date.base': 'Start date must be a valid date'
  }),
  endDate: Joi.date().greater(Joi.ref('startDate')).required().messages({
    'date.greater': 'End date must be after start date'
  }),
  termLength: Joi.number().integer().min(1).max(10).required(),
  expertise: Joi.array().items(
    Joi.string().valid(
      'Finance',
      'Legal',
      'Management',
      'Marketing',
      'IT',
      'Healthcare',
      'Education',
      'Agriculture',
      'Environment',
      'Social Work',
      'Other'
    )
  ).optional(),
  qualifications: Joi.array().items(
    Joi.object({
      degree: Joi.string().max(100).required(),
      institution: Joi.string().max(100).required(),
      year: Joi.number().integer().min(1950).max(new Date().getFullYear()).required(),
      field: Joi.string().max(100).required()
    })
  ).optional(),
  experience: Joi.array().items(
    Joi.object({
      organization: Joi.string().max(100).required(),
      position: Joi.string().max(100).required(),
      startDate: Joi.date().required(),
      endDate: Joi.date().greater(Joi.ref('startDate')).optional(),
      description: Joi.string().max(500).optional(),
      current: Joi.boolean().default(false)
    })
  ).optional(),
  organizationRegistrationNumber: Joi.string().required().messages({
    'any.required': 'Organization registration number is required'
  }),
  boardMemberId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'Board member ID must be a valid ObjectId',
    'any.required': 'Board member ID is required'
  })
});

module.exports = {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
  terminateAccountSchema,
  setupPasswordSchema,
  createBoardMemberUserSchema
};