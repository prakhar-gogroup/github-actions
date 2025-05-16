const express = require("express");
const { body, validationResult } = require("express-validator");
const sgMail = require("@sendgrid/mail");
const path = require("path");
require("dotenv").config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.static("public"));

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

// Send email endpoint
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

  try {
    await sgMail.send(msg);
    res.status(200).json({ message: "Email sent successfully" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({
      error: "Failed to send email",
      details: error.response ? error.response.body : {}
    });
  }
});

module.exports = app;
