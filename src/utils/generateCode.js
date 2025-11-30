// src/utils/generateCode.js
const generate4DigitCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString(); // ensures 4 digits
  };
  
  module.exports = generate4DigitCode;
  
// This function generates a random 4-digit code by creating a random number between 1000 and 9999. It converts the number to a string to ensure it is in the correct format for use in password reset requests.
// The code is exported as a module so it can be used in other parts of the application, such as when creating a password reset request.