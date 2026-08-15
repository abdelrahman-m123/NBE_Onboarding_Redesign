import nodemailer from 'nodemailer'
import { logger } from './logger.js'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

export async function sendOtpEmail(toEmail, otpCode) {
  try {
    await transporter.sendMail({
      from: `"National Bank of Egypt" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: 'Your NBE Verification Code',
      html: `
        <div style="font-family: Arial, 'Segoe UI', Tahoma, sans-serif; text-align: center; padding: 30px; background-color: #f4f6f8;">
          <div style="max-width: 520px; margin: 0 auto; background: #ffffff; padding: 35px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            
            <h2 style="color: #006847; margin: 0 0 8px; font-size: 24px; font-weight: 700;">National Bank of Egypt</h2>
            <h3 style="color: #2d3748; margin: 0 0 16px; font-size: 18px; font-weight: 600;">Account Opening Verification</h3>
            <p style="color: #4a5568; font-size: 15px; margin: 0 0 20px; line-height: 1.5;">Use the one-time code below to verify your email address and continue your application.</p>
            
            <!-- OTP Badge -->
            <div style="background-color: #f0fdf4; border: 1.5px dashed #22c55e; border-radius: 8px; padding: 18px; margin: 24px 0;">
              <span style="color: #15803d; font-size: 32px; font-weight: 800; letter-spacing: 6px; font-family: monospace;">${otpCode}</span>
            </div>
            
            <p style="color: #718096; font-size: 13px; margin: 0 0 8px;">This code is valid for <strong>5 minutes</strong>.</p>
            <p style="color: #a0aec0; font-size: 12px; margin: 0;">Keep every code private. NBE employees will never ask you for this code.</p>
          </div>
        </div>
      `,
    })

    logger.info('OTP email sent successfully', { toEmail })
    return true
  } catch (error) {
    logger.error('Failed to send OTP email', { toEmail, error })
    throw error
  }
}