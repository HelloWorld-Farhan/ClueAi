/**
 * =========================================================================
 * CLUE AI - Google Apps Script Backend (v5.7.8)
 * =========================================================================
 * Handles:
 *  1. Interview Reminders (Confirmation & scheduled alert)
 *  2. Interview Notes (Scheduled notes delivery)
 *  3. User Feedback & Bug Reports (Sent to Farhan Khalid & ClueAI Support)
 *  4. Universal 6-Digit Email OTP Verification
 *
 * Support Email: clueai.support@gmail.com
 * Developer: Farhan Khalid (https://farhan-khalid-portfolio.vercel.app/)
 * =========================================================================
 */

const SUPPORT_EMAIL = "clueai.support@gmail.com";
const DEVELOPER_EMAIL = "farhankhalid17968@gmail.com";
const PORTFOLIO_URL = "https://farhan-khalid-portfolio.vercel.app/";

/**
 * Clean, Simple & Modern ClueAI Email Layout Generator
 */
function getEmailLayout(title, subtitle, contentHtml, badgeColor) {
  const badge = badgeColor || "#2563eb";
  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ClueAI Notification</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
          
          <!-- Brand Header -->
          <tr>
            <td style="padding: 30px 36px 18px 36px; border-bottom: 1px solid #f1f5f9;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">ClueAI</span>
                    ${subtitle ? `<span style="display: inline-block; margin-left: 8px; font-size: 11px; font-weight: 700; color: ${badge}; background-color: #f1f5f9; padding: 3px 10px; border-radius: 9999px; text-transform: uppercase;">${subtitle}</span>` : ''}
                  </td>
                  <td align="right" style="font-size: 12px; color: #64748b;">
                    Official Alert
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Card -->
          <tr>
            <td style="padding: 28px 36px;">
              ${title ? `<h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #0f172a;">${title}</h2>` : ''}
              ${contentHtml}
            </td>
          </tr>

          <!-- Simple & Clean Developer Footer -->
          <tr>
            <td style="padding: 24px 36px; border-top: 1px solid #f1f5f9; background-color: #fafafa; text-align: center; font-size: 12px; color: #64748b;">
              <p style="margin: 0 0 6px 0;">
                Developer: <strong>Farhan Khalid</strong> · <a href="${PORTFOLIO_URL}" style="color: #2563eb; text-decoration: none; font-weight: 600;">Portfolio</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                Support: <a href="mailto:${SUPPORT_EMAIL}" style="color: #64748b; text-decoration: none;">${SUPPORT_EMAIL}</a> · ClueAI System © ${year}
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
 * Render Clean 6-Digit OTP Verification Email Layout
 */
function getOtpEmailHtml(otp, userName) {
  const content = `
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #475569; text-align: center;">
      Hello <strong>${userName || 'ClueAI User'}</strong>,<br>Use the 6-digit verification code below to verify your email address in ClueAI:
    </p>

    <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 18px 10px; margin: 20px auto; max-width: 360px; text-align: center;">
      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 6px;">
        Verification Code
      </div>
      <div style="font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #0f172a; font-family: monospace; padding-left: 10px;">
        ${otp}
      </div>
      <div style="font-size: 11px; color: #64748b; margin-top: 6px;">
        ⏱️ Valid for 10 minutes
      </div>
    </div>

    <div style="background-color: #f0fdf4; border-radius: 10px; border: 1px solid #bbf7d0; padding: 12px 16px; margin-top: 15px; text-align: left; font-size: 12.5px; color: #166534; line-height: 1.5;">
      <strong>Permanent Trust:</strong> Once verified, this email will never require OTP verification again across ClueAI feedback, interview reminders, and saved session notes.
    </div>
  `;

  return getEmailLayout(
    "Your Security Verification Code",
    "Security Verification",
    content,
    "#0284c7"
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
      const appVersion = data.app_version || "5.7.8";
      const timestamp = new Date().toLocaleString();
      const hasImage = Boolean(data.image_base64);

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
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">
                Attached Screenshot:
              </div>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
                <img src="cid:feedback_screenshot" alt="Screenshot" style="max-width: 100%; height: auto; border-radius: 6px; border: 1px solid #cbd5e1;" />
              </div>
            </div>
          `;
        } catch (imgErr) {
          console.warn("Failed to attach inline screenshot:", imgErr);
        }
      }

      // 1. Admin Email (Sent to Farhan Khalid & ClueAI Support)
      const adminContent = `
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 20px; font-size: 13px;">
          <tr>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; width: 30%;">User Email</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 600;"><a href="mailto:${userEmail}" style="color: #2563eb; text-decoration: none;">${userEmail}</a></td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Category</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #0f172a;">${category}</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Version</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: 600; color: #2563eb;">v${appVersion}</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; color: #64748b;">Timestamp</td>
            <td style="padding: 10px 14px; font-size: 12px; color: #64748b;">${timestamp}</td>
          </tr>
        </table>

        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">
          Reported Problem / Message:
        </div>
        <div style="background-color: #ffffff; border-left: 4px solid #2563eb; border: 1px solid #e2e8f0; border-left-width: 4px; border-radius: 8px; padding: 14px; color: #1e293b; font-size: 13.5px; line-height: 1.6; white-space: pre-wrap;">${description}</div>

        ${imageHtml}
      `;

      const adminHtml = getEmailLayout(
        "New Feedback Report Received",
        "Feedback Report",
        adminContent,
        "#2563eb"
      );

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
          <p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6; color: #475569;">
            Thank you for helping us improve ClueAI. Your feedback has been received and forwarded directly to our engineering team.
          </p>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin: 16px 0;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">
              Your Submission:
            </div>
            <div style="color: #64748b; font-size: 11px; margin-bottom: 2px;">Category:</div>
            <div style="color: #0f172a; font-weight: 600; font-size: 13px; margin-bottom: 8px;">${category}</div>
            <div style="color: #64748b; font-size: 11px; margin-bottom: 2px;">Details:</div>
            <div style="color: #334155; font-size: 13px; line-height: 1.6; white-space: pre-wrap; background-color: #ffffff; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;">${description}</div>
          </div>
          <p style="margin: 0; font-size: 12.5px; line-height: 1.6; color: #64748b;">
            If your submission requires technical troubleshooting, our team will review the log and reach back out to you.
          </p>
        `;

        const userHtml = getEmailLayout(
          "Thank You for Your Feedback",
          "Feedback Confirmation",
          userContent,
          "#059669"
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
      <p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6; color: #475569;">
        Hello <strong>${toName}</strong>, your automated interview reminder has been confirmed and scheduled in ClueAI.
      </p>

      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; margin: 16px 0; font-size: 13px;">
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; width: 35%;">Company</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 700;">${company}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Role</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${role}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; color: #64748b;">Scheduled Time</td>
          <td style="padding: 10px 14px; color: #2563eb; font-weight: 700;">${data.date} at ${data.time}</td>
        </tr>
      </table>

      <div style="font-size: 12.5px; color: #64748b; line-height: 1.6;">
        Ensure ClueAI is configured with your resumes and preferred AI model prior to the session.
      </div>
    `;

    const thanksHtml = getEmailLayout(
      "Interview Reminder Scheduled",
      "Reminder Confirmation",
      thanksContent,
      "#2563eb"
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
        <p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6; color: #475569;">
          Hello <strong>${toName}</strong>, your interview with <strong>${company}</strong> is starting now!
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin: 16px 0;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #2563eb; margin-bottom: 8px;">
            Pre-Interview Checklist:
          </div>
          <div style="font-size: 13px; color: #334155; line-height: 1.7;">
            ✓ Launch ClueAI desktop application<br>
            ✓ Verify microphone & speaker audio active<br>
            ✓ Press <code>Ctrl + Shift + Enter</code> or Start AI Interview for live assistance
          </div>
        </div>
      `;

      const reminderHtml = getEmailLayout(
        "Time for Your Interview!",
        "Interview Alert",
        reminderContent,
        "#dc2626"
      );

      MailApp.sendEmail({
        to: data.to_email,
        subject: `ClueAI Alert: It's time for your interview with ${company}!`,
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
        <p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6; color: #475569;">
          Here are your scheduled interview notes for <strong>${data.date} at ${data.time}</strong>:
        </p>
        <div style="background-color: #f8fafc; border-left: 4px solid #0d9488; border: 1px solid #e2e8f0; border-left-width: 4px; border-radius: 8px; padding: 16px; color: #0f172a; font-size: 13.5px; line-height: 1.7; white-space: pre-wrap;">${data.notes}</div>
      `;

      const noteHtml = getEmailLayout(
        "Your Scheduled Notes",
        "Saved Notes",
        noteContent,
        "#0d9488"
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
