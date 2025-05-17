const express = require("express");
const { body, validationResult } = require("express-validator");
const sgMail = require("@sendgrid/mail");
const path = require("path");
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
const cookieParser = require('cookie-parser');
require("dotenv").config();

const app = express();

// Middleware
app.use(cookieParser()); // Required for CSRF
app.use(express.json({ limit: '10kb' })); // Limit request size
app.use(express.static("public"));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', limiter);

// CSRF protection
const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);

// Serve CSRF token
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// SendGrid configuration
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Serve the HTML form
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Email validation middleware
const validateEmail = [
  body("to").isEmail().withMessage("Invalid recipient email"),
  body("subject").notEmpty().trim().withMessage("Subject is required"),
  body("body").notEmpty().trim().withMessage("Email body is required")
];

// Send email endpoint with retry logic
app.post("/api/send-email", validateEmail, async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { to, subject, body } = req.body;

  const msg = {
    to,
    from: process.env.SENDER_EMAIL,
    subject,
    text: body
  };

  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await sgMail.send(msg);
      console.log(`Email sent successfully on attempt ${attempt}`);
      return res.status(200).json({ message: "Email sent successfully" });
    } catch (error) {
      lastError = error;
      console.error(`Error sending email (attempt ${attempt}/${maxRetries}):`, error);
      
      // If this is not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        continue;
      }
    }
  }

  // If we get here, all retries failed
  const errorDetails = lastError.response ? lastError.response.body : {};
  res.status(500).json({
    error: "Failed to send email after multiple attempts",
    details: errorDetails
  });
});

module.exports = app;
