# Kenya Digital Health Agency (DHA) - Auth System Installation Guide

## Prerequisites

- **Node.js** (v18 or newer recommended)
- **npm** (comes with Node.js)
- **MongoDB** (local or remote instance)

---

## Installation Steps

1. **Clone the repository**

   ```sh
   git clone <your-repo-url>
   cd DHA/Back_End_Auth_System
   ```

2. **Install dependencies**

   ```sh
   npm install
   ```

3. **Configure environment variables**

   - Copy `.env.example` to `.env` (if provided) or create a `.env` file.
   - Set your MongoDB URI and other secrets as needed.

   Example:
   ```
   MONGO_URI=mongodb://localhost:27017/kenya_dha_auth
   JWT_SECRET=your_jwt_secret
   CLOUDINARY_URL=your_cloudinary_url
   ```

4. **Start the server**

   - For development (with auto-restart):

     ```sh
     npm run dev
     ```

   - For production:

     ```sh
     npm start
     ```

---

## Base URL

All API endpoints are served from:

```
http://localhost:5000
```

---

## Running Tests

```sh
npm test
```

---

## Notes

- Make sure MongoDB is running before starting the server.
- API documentation and usage examples are available in the `/docs` folder (if provided).
- For any issues, check the logs in your terminaL"# Back_End_Auth_System" 
