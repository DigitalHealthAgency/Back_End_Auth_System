// test_validation.js
const Joi = require('joi');
const { individualSchema } = require('./authValidator'); // <-- REPLACE THIS
const { passwordComplexity, phoneRegex } = require('./authValidator'); // <-- REPLACE THIS

// It seems you have some schemas that rely on other schemas, so we need to import them too.
// The easiest way to get everything is to just import the entire module.
// Assuming your validator file is named 'schemas.js'
const schemas = require('./authValidator'); // Change this to your actual file name

// Your provided JSON data
const payload = {
  "type": "individual",
  "username": "john_doe",
  "firstName": "John",
  "lastName": "Doe",
  "email": "ianndoli@outlook.com",
  "phone": "+254712345678",
  "password": "StrongPassword123!",
  "receiveSystemAlerts": true
};

// Now, let's validate this payload against the individualSchema
// and the alternatives schema to see the difference in errors.

console.log("--- Testing individualSchema directly ---");
const individualResult = schemas.individualSchema.validate(payload);
if (individualResult.error) {
  console.log("Validation Error (Individual Schema):");
  // Print the details of the error, which will be much more specific
  console.log(individualResult.error.details);
} else {
  console.log("Validation Successful!");
}

console.log("\n--- Testing registerSchema (alternatives) ---");
const alternativesResult = schemas.registerSchema.validate(payload);
if (alternativesResult.error) {
  console.log("Validation Error (Alternatives Schema):");
  console.log(alternativesResult.error.details);
} else {
  console.log("Validation Successful!");
}