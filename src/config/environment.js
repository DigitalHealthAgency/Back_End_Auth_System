require('dotenv').config();

const config = {
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY,
    publicKey: process.env.PAYSTACK_PUBLIC_KEY,
    baseUrl: 'https://api.paystack.co'
  },
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3000'
  }
};

// Validate required environment variables
const requiredEnvVars = [
  'PAYSTACK_SECRET_KEY',
  'PAYSTACK_PUBLIC_KEY'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

module.exports = config;