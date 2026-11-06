/**
 * =========================================================================
 * CLUE AI - Google Apps Script Backend (v5.7.5)
 * =========================================================================
 * Handles:
 *  1. Interview Reminders (Immediate confirmation & scheduled alert)
 *  2. Interview Notes (Scheduled notes delivery)
 *  3. User Feedback & Bug Reports (Sent to Farhan Khalid & ClueAI Support)
 *
 * Support Email: clueai.support@gmail.com
 * Developer: Farhan Khalid (https://farhan-khalid-portfolio.vercel.app/)
 * =========================================================================
 */

const SUPPORT_EMAIL = "clueai.support@gmail.com";
const DEVELOPER_EMAIL = "farhankhalid17968@gmail.com";
const PORTFOLIO_URL = "https://farhan-khalid-portfolio.vercel.app/";

/**
 * Universal ClueAI Cyberpunk/Dark Email Layout Generator
 */
function getEmailLayout(title, subtitle, contentHtml, accentColor) {
  const accent = accentColor || "#06b6d4";
  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ClueAI Notification</title>
</head>
<body style="margin: 0; padding: 0; background-color: #05060b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #05060b; padding: 35px 15px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #090a12; border-radius: 20px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.8);">
          
          <!-- Top Neon Accent -->
          <tr>
            <td style="background: linear-gradient(90deg, ${accent}, #3b82f6, #6366f1); height: 5px;"></td>
          </tr>

          <!-- Brand Logo Header -->
          <tr>
            <td style="padding: 35px 35px 15px 35px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 900; letter-spacing: 2px; color: #22d3ee; text-shadow: 0 0 20px rgba(34, 211, 238, 0.4);">
                CLUE AI
              </h1>
              <p style="margin: 6px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2.5px; color: #94a3b8; font-weight: bold;">
                ${subtitle || "Intelligent Interview Assistant"}
              </p>
            </td>
          </tr>

          <!-- Main Content Card -->
          <tr>
            <td style="padding: 10px 35px 25px 35px;">
              <div style="background-color: #121422; border-radius: 16px; border: 1px solid #1e2640; border-left: 4px solid ${accent}; padding: 25px 25px 20px 25px;">
                <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 800; color: #ffffff;">
                  ${title}
                </h2>
                ${contentHtml}
              </div>
            </td>
          </tr>

          <!-- Official Support Section -->
          <tr>
            <td style="padding: 0 35px 25px 35px; text-align: center;">
              <div style="background-color: #0e101d; border-radius: 12px; border: 1px solid #1e2640; padding: 16px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8;">
                  Have questions, issues, or feedback? Contact Support:
                </p>
                <a href="mailto:${SUPPORT_EMAIL}" style="display: inline-block; background-color: rgba(34,211,238,0.1); border: 1px solid #22d3ee; color: #22d3ee; font-weight: bold; font-size: 13px; text-decoration: none; padding: 7px 18px; border-radius: 20px;">
                  ✉️ ${SUPPORT_EMAIL}
                </a>
              </div>
            </td>
          </tr>

          <!-- Developer Credits & Portfolio Footer -->
          <tr>
            <td style="padding: 25px 35px 35px 35px; border-top: 1px solid #171b2d; text-align: center; background-color: #07080e;">
              <p style="margin: 0 0 12px 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">
                Developed by Farhan Khalid
              </p>
              <a href="${PORTFOLIO_URL}" style="display: inline-block; background: linear-gradient(135deg, #06b6d4, #2563eb); color: #ffffff; font-size: 12px; font-weight: 900; text-decoration: none; padding: 10px 24px; border-radius: 25px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 0 20px rgba(6,182,212,0.4); margin-bottom: 20px;">
                ✨ View Developer Portfolio →
              </a>
              <p style="margin: 0; font-size: 11px; color: #475569; line-height: 1.6;">
                Engineered with passion for engineers, candidates & interviewees worldwide.<br>
                © ${year} ClueAI. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Helper to parse date ("DD-MM-YYYY") and time ("HH:MM AM/PM") into a Date object
 */
function parseTargetDate(dateStr, timeStr) {
  const dateParts = dateStr.split('-');
  const [timeVal, ampm] = timeStr.split(' ');
  const timeParts = timeVal.split(':');
  let hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);
  
  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  
  return new Date(dateParts[2], dateParts[1] - 1, dateParts[0], hours, minutes, 0);
}

/**
 * Render 6-Digit OTP Verification Email Layout
 */
function getOtpEmailHtml(otp, userName) {
  const content = `
    <p style="margin: 0 0 16px 0; font-size: 14.5px; line-height: 1.6; color: #cbd5e1; text-align: center;">
      Hello <strong style="color: #ffffff;">${userName || 'ClueAI User'}</strong>, use the 6-digit verification code below to verify your email address:
    </p>

    <div style="background-color: #05060b; border: 2px solid #22d3ee; border-radius: 16px; padding: 20px 10px; margin: 25px auto; max-width: 360px; text-align: center; box-shadow: 0 0 35px rgba(34, 211, 238, 0.25);">
      <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #38bdf8; margin-bottom: 8px;">
        One-Time Passcode
      </div>
      <div style="font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #ffffff; font-family: 'Courier New', Courier, monospace; text-shadow: 0 0 15px rgba(34, 211, 238, 0.6); padding-left: 10px;">
        ${otp}
      </div>
      <div style="font-size: 11px; color: #94a3b8; margin-top: 8px; font-weight: 600;">
        ⏱️ Valid for 10 minutes
      </div>
    </div>

    <div style="background-color: #090b14; border-radius: 12px; border: 1px solid #1e2640; padding: 14px 18px; margin-top: 15px; text-align: left;">
      <div style="font-size: 12px; font-weight: bold; color: #10b981; margin-bottom: 4px;">
        🛡️ Permanent Cross-Feature Trust
      </div>
      <div style="font-size: 12.5px; color: #94a3b8; line-height: 1.5;">
        Once verified, this email will never require OTP verification again across Clue AI feedback, interview reminders, and saved session notes.
      </div>
    </div>
  `;

  return getEmailLayout(
    "Your Verification Code 🔐",
    "Email Security & Trust",
    content,
    "#06b6d4"
  );
}

/**
 * Main Webhook Handler (HTTP POST)
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const type = data.type || (data.action === 'delete' ? 'delete' : 'reminder');

    // ----------------------------------------------------
    // ACTION: SEND OTP VERIFICATION CODE
    // ----------------------------------------------------
    if (type === 'send_otp' || type === 'otp') {
      const email = (data.email || data.user_email || '').trim();
      const otp = (data.otp || '').toString().trim();
      const userName = data.user_name || 'ClueAI User';

      if (!email || !otp) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Missing email or OTP" }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const otpHtml = getOtpEmailHtml(otp, userName);
      MailApp.sendEmail({
        to: email,
        subject: `ClueAI: Your Verification Code is ${otp}`,
        htmlBody: otpHtml,
        name: "ClueAI Verification"
      });

      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "OTP sent successfully" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ----------------------------------------------------
    // ACTION: DELETE SCHEDULED ITEM
    // ----------------------------------------------------
    if (data.action === 'delete' && data.id) {
      const triggers = ScriptApp.getProjectTriggers();
      for (let i = 0; i < triggers.length; i++) {
        const triggerKey = 'trigger_' + triggers[i].getUniqueId();
        const payloadId = PropertiesService.getUserProperties().getProperty(triggerKey);
        if (payloadId === data.id) {
          ScriptApp.deleteTrigger(triggers[i]);
          PropertiesService.getUserProperties().deleteProperty(triggerKey);
          PropertiesService.getUserProperties().deleteProperty(payloadId);
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Trigger deleted' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ----------------------------------------------------
    // TYPE 1: USER FEEDBACK & PROBLEM REPORT
    // ----------------------------------------------------
    if (type === 'feedback') {
      const userEmail = data.user_email || data.email || "Anonymous";
      const category = data.category || "General Feedback";
      const description = data.description || "No description provided.";
      const appVersion = data.app_version || "5.7.5";
      const timestamp = new Date().toLocaleString();
      const hasImage = Boolean(data.image_base64);

      // 1. Admin Email (Sent to Farhan Khalid & ClueAI Support)
      let imageHtml = "";
      let inlineImages = {};

      if (hasImage) {
        try {
          const base64Data = data.image_base64.replace(/^data:image\/\w+;base64,/, "");
          const decoded = Utilities.base64Decode(base64Data);
          const blob = Utilities.newBlob(decoded, "image/png", "screenshot.png");
          inlineImages["feedback_screenshot"] = blob;
          imageHtml = `
            <div style="margin-top: 20px;">
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; margin-bottom: 8px;">
                Attached Screenshot:
              </div>
              <div style="background-color: #080911; border-radius: 12px; border: 1px solid #1e2640; padding: 12px; text-align: center;">
                <img src="cid:feedback_screenshot" alt="Screenshot" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #1e293b;" />
              </div>
            </div>
          `;
        } catch (imgErr) {
          console.warn("Failed to attach inline screenshot:", imgErr);
        }
      }

      const adminContent = `
        <div style="background-color: #080911; border-radius: 12px; border: 1px solid #1e2640; padding: 16px; margin-bottom: 18px;">
          <table width="100%" border="0" cellspacing="0" cellpadding="4" style="font-size: 13.5px;">
            <tr>
              <td style="color: #64748b; width: 35%; font-size: 11px; text-transform: uppercase;">Category</td>
              <td><span style="background-color: rgba(6,182,212,0.15); border: 1px solid #06b6d4; color: #22d3ee; font-weight: bold; font-size: 11px; padding: 2px 10px; border-radius: 12px; text-transform: uppercase;">${category}</span></td>
            </tr>
            <tr>
              <td style="color: #64748b; font-size: 11px; text-transform: uppercase;">User Email</td>
              <td><a href="mailto:${userEmail}" style="color: #ffffff; font-weight: bold; text-decoration: none;">${userEmail}</a></td>
            </tr>
            <tr>
              <td style="color: #64748b; font-size: 11px; text-transform: uppercase;">Version</td>
              <td style="color: #22d3ee; font-family: monospace; font-weight: bold;">v${appVersion}</td>
            </tr>
            <tr>
              <td style="color: #64748b; font-size: 11px; text-transform: uppercase;">Received</td>
              <td style="color: #94a3b8; font-size: 12.5px;">${timestamp}</td>
            </tr>
          </table>
        </div>

        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; margin-bottom: 8px;">
          Reported Problem / Message:
        </div>
        <div style="background-color: #080911; border-radius: 12px; border: 1px solid #1e2640; padding: 18px; color: #f1f5f9; font-size: 14px; line-height: 1.7; white-space: pre-wrap;">${description}</div>

        ${imageHtml}
      `;

      const adminHtml = getEmailLayout(
        "New Feedback Report Received 💬",
        "User Feedback & Bug Dispatch",
        adminContent,
        "#38bdf8"
      );

      // Send to Farhan Khalid & ClueAI Support
      const adminEmailOptions = {
        to: `${DEVELOPER_EMAIL}, ${SUPPORT_EMAIL}`,
        subject: `[ClueAI Feedback] ${category} - from ${userEmail}`,
        htmlBody: adminHtml,
        name: "ClueAI Feedback System"
      };
      if (Object.keys(inlineImages).length > 0) {
        adminEmailOptions.inlineImages = inlineImages;
      }
      MailApp.sendEmail(adminEmailOptions);

      // 2. User Confirmation Email
      if (userEmail && userEmail.includes("@")) {
        const userContent = `
          <p style="margin: 0 0 16px 0; font-size: 14.5px; line-height: 1.6; color: #cbd5e1;">
            Thank you for helping us improve ClueAI. Your feedback report has been directly delivered to our engineering and support team.
          </p>
          <div style="background-color: #080911; border-radius: 12px; border: 1px solid #1e2640; padding: 16px; margin: 18px 0;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #38bdf8; margin-bottom: 10px;">
              Your Submission Details:
            </div>
            <div style="color: #64748b; font-size: 11px; text-transform: uppercase; margin-bottom: 3px;">Category:</div>
            <div style="color: #ffffff; font-weight: bold; font-size: 13.5px; margin-bottom: 10px;">${category}</div>
            <div style="color: #64748b; font-size: 11px; text-transform: uppercase; margin-bottom: 3px;">Message:</div>
            <div style="color: #cbd5e1; font-size: 13px; line-height: 1.6; white-space: pre-wrap;">${description}</div>
          </div>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #94a3b8;">
            If your submission requires technical troubleshooting, our team will review the log and reach back out to you at this address.
          </p>
        `;

        const userHtml = getEmailLayout(
          "We Received Your Feedback! 💡",
          "Feedback Confirmation",
          userContent,
          "#06b6d4"
        );

        MailApp.sendEmail({
          to: userEmail,
          subject: `ClueAI: We've received your feedback (${category})`,
          htmlBody: userHtml,
          name: "ClueAI Support"
        });
      }

      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Feedback sent' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ----------------------------------------------------
    // TYPE 2: INTERVIEW NOTES
    // ----------------------------------------------------
    if (type === 'note') {
      const targetDate = parseTargetDate(data.date, data.time);
      const triggerId = data.id || Utilities.getUuid();
      PropertiesService.getUserProperties().setProperty(triggerId, JSON.stringify(data));
      
      const newTrigger = ScriptApp.newTrigger('sendScheduledNote')
        .timeBased()
        .at(targetDate)
        .create();
        
      PropertiesService.getUserProperties().setProperty('trigger_' + newTrigger.getUniqueId(), triggerId);
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Note scheduled for ' + targetDate }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ----------------------------------------------------
    // TYPE 3: INTERVIEW REMINDER
    // ----------------------------------------------------
    const toName = data.to_name || "Candidate";
    const company = data.company_name || "Upcoming Interview";
    const role = data.job_title || "Technical Role";

    const thanksContent = `
      <p style="margin: 0 0 16px 0; font-size: 14.5px; line-height: 1.6; color: #cbd5e1;">
        Hello <strong style="color: #ffffff;">${toName}</strong>,
      </p>
      <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
        Your automated interview reminder has been confirmed and scheduled in ClueAI's cloud system.
      </p>

      <div style="background-color: #080911; border-radius: 12px; border: 1px solid #1e2640; padding: 16px; margin: 18px 0;">
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #22d3ee; border-bottom: 1px solid #1e2640; padding-bottom: 8px; margin-bottom: 10px;">
          Scheduled Session
        </div>
        <table width="100%" border="0" cellspacing="0" cellpadding="4" style="font-size: 13.5px;">
          <tr>
            <td style="color: #64748b; width: 40%; font-size: 11px; text-transform: uppercase;">Company</td>
            <td style="color: #ffffff; font-weight: bold;">${company}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-size: 11px; text-transform: uppercase;">Role</td>
            <td style="color: #38bdf8; font-weight: bold;">${role}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-size: 11px; text-transform: uppercase;">Date & Time</td>
            <td style="color: #22d3ee; font-weight: bold;">${data.date} at ${data.time}</td>
          </tr>
        </table>
      </div>

      <div style="margin-top: 15px;">
        <p style="margin: 0 0 6px 0; font-size: 12.5px; font-weight: bold; color: #38bdf8;">
          ⚡ Stealth Preparation Checklist:
        </p>
        <ul style="margin: 0; padding-left: 18px; font-size: 12.5px; color: #94a3b8; line-height: 1.7;">
          <li>Verify microphone audio is clear so ClueAI transcribes questions effortlessly.</li>
          <li>Turn on <strong>Stealth Mode</strong> before sharing screens on Zoom, Teams, or Meet.</li>
          <li>Use the Voice Scroll Teleprompter to read answers with automatic line blurring.</li>
        </ul>
      </div>
    `;

    const thanksHtml = getEmailLayout(
      "Reminder Successfully Scheduled 🎯",
      "Interview Confirmation",
      thanksContent,
      "#06b6d4"
    );

    // Send Immediate Confirmation
    MailApp.sendEmail({
      to: data.to_email,
      subject: `ClueAI: Your interview setup for ${company} is confirmed!`,
      htmlBody: thanksHtml,
      name: "ClueAI System"
    });

    // Schedule Future Trigger
    const targetDate = parseTargetDate(data.date, data.time);
    const triggerId = data.id || Utilities.getUuid();
    PropertiesService.getUserProperties().setProperty(triggerId, JSON.stringify(data));

    const newTrigger = ScriptApp.newTrigger('sendScheduledReminder')
      .timeBased()
      .at(targetDate)
      .create();

    PropertiesService.getUserProperties().setProperty('trigger_' + newTrigger.getUniqueId(), triggerId);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Scheduled Reminder Trigger Execution
 */
function sendScheduledReminder(e) {
  if (!e || !e.triggerUid) return;
  const triggerKey = 'trigger_' + e.triggerUid;
  const payloadId = PropertiesService.getUserProperties().getProperty(triggerKey);

  if (payloadId) {
    const dataStr = PropertiesService.getUserProperties().getProperty(payloadId);
    if (dataStr) {
      const data = JSON.parse(dataStr);
      const toName = data.to_name || "Candidate";
      const company = data.company_name || "Your Interview";

      const reminderContent = `
        <p style="margin: 0 0 16px 0; font-size: 14.5px; line-height: 1.6; color: #cbd5e1;">
          Hello <strong style="color: #ffffff;">${toName}</strong>, your interview with <strong style="color: #38bdf8;">${company}</strong> is starting now!
        </p>
        <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
          ClueAI is ready in the background to provide instant technical problem solutions and talking points.
        </p>

        <div style="background-color: #080911; border-radius: 12px; border: 1px solid #1e2640; padding: 16px; margin: 18px 0;">
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #10b981; border-bottom: 1px solid #1e2640; padding-bottom: 8px; margin-bottom: 10px;">
            Final Pre-Flight Checklist:
          </div>
          <ul style="margin: 0; padding-left: 18px; font-size: 12.5px; color: #e2e8f0; line-height: 1.8;">
            <li><strong>Audio Active:</strong> Ensure ClueAI detects your speaker and mic audio.</li>
            <li><strong>Stealth Shield ON:</strong> Verify the shield is green if screen sharing.</li>
            <li><strong>Hotkey Ready:</strong> Press <code style="background-color: #171b2d; padding: 2px 6px; border-radius: 5px; color: #22d3ee;">Ctrl + Shift + Enter</code> to trigger answers.</li>
          </ul>
        </div>
      `;

      const reminderHtml = getEmailLayout(
        "Time for your Interview! 🚀",
        "Live Stealth Alert",
        reminderContent,
        "#10b981"
      );

      MailApp.sendEmail({
        to: data.to_email,
        subject: `ClueAI Alert: It's time to crush your interview with ${company}!`,
        htmlBody: reminderHtml,
        name: "ClueAI System"
      });

      PropertiesService.getUserProperties().deleteProperty(payloadId);
    }
    PropertiesService.getUserProperties().deleteProperty(triggerKey);
  }

  // Trigger cleanup
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getUniqueId() === e.triggerUid) {
      ScriptApp.deleteTrigger(triggers[i]);
      break;
    }
  }
}

/**
 * Scheduled Note Trigger Execution
 */
function sendScheduledNote(e) {
  if (!e || !e.triggerUid) return;
  const triggerKey = 'trigger_' + e.triggerUid;
  const payloadId = PropertiesService.getUserProperties().getProperty(triggerKey);

  if (payloadId) {
    const dataStr = PropertiesService.getUserProperties().getProperty(payloadId);
    if (dataStr) {
      const data = JSON.parse(dataStr);

      const noteContent = `
        <p style="margin: 0 0 16px 0; font-size: 14.5px; line-height: 1.6; color: #cbd5e1;">
          Here are your scheduled interview notes for <strong style="color: #ffffff;">${data.date} at ${data.time}</strong>:
        </p>
        <div style="background-color: #080911; border-radius: 12px; border: 1px solid #1e2640; padding: 18px; color: #e2e8f0; font-size: 13.5px; line-height: 1.7; white-space: pre-wrap;">${data.notes}</div>
      `;

      const noteHtml = getEmailLayout(
        "Your Scheduled Interview Notes 📝",
        "Saved Notes Delivery",
        noteContent,
        "#a855f7"
      );

      MailApp.sendEmail({
        to: data.email,
        subject: `ClueAI: Your Scheduled Interview Notes`,
        htmlBody: noteHtml,
        name: "ClueAI System"
      });

      PropertiesService.getUserProperties().deleteProperty(payloadId);
    }
    PropertiesService.getUserProperties().deleteProperty(triggerKey);
  }

  // Trigger cleanup
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getUniqueId() === e.triggerUid) {
      ScriptApp.deleteTrigger(triggers[i]);
      break;
    }
  }
}
