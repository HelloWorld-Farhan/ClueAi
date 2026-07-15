// --- HTML Email Template Generator ---
function getEmailHtml(title, messageHtml, companyName, jobTitle, toName, date, time) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #09090b;">
  <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #09090b; color: #ffffff; padding: 30px 15px; max-width: 600px; margin: 0 auto; border-radius: 16px; border: 1px solid #1e293b; box-sizing: border-box; width: 100%;">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 25px;">
      <h1 style="color: #22d3ee; font-size: 28px; font-weight: 900; letter-spacing: 2px; margin: 0; text-shadow: 0 0 15px rgba(34, 211, 238, 0.3);">CLUE AI</h1>
      <p style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin-top: 8px; font-weight: bold;">Intelligent Interview Assistant</p>
    </div>

    <!-- Main Content Box -->
    <div style="background-color: #18181b; padding: 25px 20px; border-radius: 12px; border-left: 4px solid #22d3ee; box-shadow: inset 0 2px 10px rgba(0,0,0,0.2);">
      <h2 style="font-size: 20px; margin-top: 0; color: #ffffff; margin-bottom: 20px;">${title}</h2>
      <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6; margin-bottom: 20px;">Hello <strong style="color: #ffffff;">${toName}</strong>,</p>
      
      <!-- Dynamic Content Injection -->
      <div style="font-size: 14.5px; color: #cbd5e1; line-height: 1.7; margin-bottom: 30px;">
        ${messageHtml}
      </div>
      
      <!-- REDESIGNED Details Box (Mobile-Proof) -->
      <div style="background-color: #000000; padding: 20px; border-radius: 8px; border: 1px solid #27272a;">
        <h3 style="color: #22d3ee; font-size: 12px; text-transform: uppercase; margin-top: 0; margin-bottom: 15px; letter-spacing: 1.5px; border-bottom: 1px solid #27272a; padding-bottom: 10px;">Details</h3>
        
        ${companyName ? `
        <div style="margin-bottom: 15px;">
          <div style="color: #94a3b8; font-size: 12px; text-transform: uppercase; margin-bottom: 4px;">Target Company</div>
          <div style="color: #ffffff; font-size: 16px; font-weight: bold; word-break: break-word;">${companyName}</div>
        </div>` : ''}

        ${jobTitle ? `
        <div style="margin-bottom: 15px;">
          <div style="color: #94a3b8; font-size: 12px; text-transform: uppercase; margin-bottom: 4px;">Job Title</div>
          <div style="color: #ffffff; font-size: 16px; font-weight: bold; word-break: break-word;">${jobTitle}</div>
        </div>` : ''}

        <div>
          <div style="color: #94a3b8; font-size: 12px; text-transform: uppercase; margin-bottom: 4px;">Scheduled For</div>
          <div style="color: #ffffff; font-size: 16px; font-weight: bold; word-break: break-word;">${date} at ${time}</div>
        </div>
      </div>
    </div>

    <!-- Footer with Developer Portfolio Info -->
    <div style="margin-top: 35px; text-align: center; border-top: 1px solid #1e293b; padding-top: 30px;">
      <p style="color: #94a3b8; font-size: 13px; margin-bottom: 12px;">Discover more of my work:</p>
      <a href="https://farhan-khalid-portfolio.vercel.app/" style="color: #000000; text-decoration: none; font-weight: bold; font-size: 12px; background-color: #22d3ee; padding: 10px 24px; border-radius: 25px; display: inline-block; margin-bottom: 30px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 0 10px rgba(34,211,238,0.4);">View Developer Portfolio</a>
      
      <p style="color: #94a3b8; font-size: 13px; margin-bottom: 12px;">Need help? Contact us anytime:</p>
      <a href="mailto:farhankhalid17968@gmail.com" style="color: #22d3ee; text-decoration: none; font-weight: bold; font-size: 14px; background-color: #22d3ee15; padding: 8px 16px; border-radius: 20px; display: inline-block; margin-bottom: 30px; word-break: break-all;">farhankhalid17968@gmail.com</a>
      
      <p style="color: #64748b; font-size: 12px; line-height: 1.8;">
        Developed & Designed with passion by <strong style="color: #ffffff;">Farhan Khalid</strong>.<br>
        © ${new Date().getFullYear()} ClueAI. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

// Helper to convert date and time strings into a Date object
function parseTargetDate(dateStr, timeStr) {
  const dateParts = dateStr.split('-');
  
  // Parse 12-hour time format with AM/PM
  const [timeVal, ampm] = timeStr.split(' ');
  const timeParts = timeVal.split(':');
  let hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);
  
  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  
  return new Date(dateParts[2], dateParts[1] - 1, dateParts[0], hours, minutes, 0);
}

// --- Main App Logic ---

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const type = data.type || 'reminder'; // Default to reminder if not provided
    
    // ==========================================
    // 1. NOTES LOGIC
    // ==========================================
    if (type === 'note') {
      // We do NOT send an immediate email for notes.
      // We just schedule the note to be sent at the requested date and time.
      const targetDate = parseTargetDate(data.date, data.time);
      
      const triggerId = Utilities.getUuid();
      PropertiesService.getUserProperties().setProperty(triggerId, JSON.stringify(data));
      
      const newTrigger = ScriptApp.newTrigger('sendScheduledNote')
        .timeBased()
        .at(targetDate)
        .create();
        
      PropertiesService.getUserProperties().setProperty('trigger_' + newTrigger.getUniqueId(), triggerId);
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Note scheduled for ' + targetDate })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ==========================================
    // 2. REMINDER LOGIC
    // ==========================================
    // --- MASSIVE CONTENT FOR THANKS EMAIL ---
    const thanksMessage = `
      <p>Thank you for trusting <strong>ClueAI</strong> to assist you with your upcoming interview. Your automated reminder has been securely logged into our cloud scheduling system.</p>
      
      <p>ClueAI is designed to run in complete stealth mode, acting as your ultimate secret weapon during live technical interviews. By leveraging cutting-edge, ultra-fast LLMs (like Groq and Gemini Flash) alongside real-time speech-to-text transcription, you will receive intelligent, context-aware answers instantly without ever breaking eye contact with your interviewer.</p>

      <p style="color: #22d3ee; margin-top: 25px; margin-bottom: 5px; font-weight: bold;">How to prepare:</p>
      <ul style="padding-left: 20px; margin-top: 0;">
        <li style="margin-bottom: 8px;">Ensure your Virtual Audio Cable or microphone is properly routed before the meeting begins.</li>
        <li style="margin-bottom: 8px;">Upload your resume and any relevant documentation into the ClueAI context settings to get perfectly tailored answers.</li>
        <li style="margin-bottom: 8px;">Keep the ClueAI dashboard on a secondary monitor or hidden away from screen-sharing windows.</li>
      </ul>

      <p>We will automatically send you another email at the exact date and time you requested below to ensure you are fully prepared and focused when it counts.</p>
    `;

    const thanksHtml = getEmailHtml(
      "Reminder Successfully Scheduled",
      thanksMessage,
      data.company_name,
      data.job_title,
      data.to_name,
      data.date,
      data.time
    );
    
    // Send Immediate Thanks Email
    MailApp.sendEmail({
      to: data.to_email,
      subject: `ClueAI: Your interview setup for ${data.company_name} is confirmed!`,
      htmlBody: thanksHtml,
      name: "ClueAI System"
    });
    
    // Schedule the Future Reminder Email
    const targetDate = parseTargetDate(data.date, data.time);
    
    const triggerId = Utilities.getUuid();
    PropertiesService.getUserProperties().setProperty(triggerId, JSON.stringify(data));
    
    const newTrigger = ScriptApp.newTrigger('sendScheduledReminder')
      .timeBased()
      .at(targetDate)
      .create();
      
    PropertiesService.getUserProperties().setProperty('trigger_' + newTrigger.getUniqueId(), triggerId);
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}


function sendScheduledNote(e) {
  if (!e || !e.triggerUid) return;
  
  const triggerKey = 'trigger_' + e.triggerUid;
  const payloadId = PropertiesService.getUserProperties().getProperty(triggerKey);
  
  if (payloadId) {
    const dataStr = PropertiesService.getUserProperties().getProperty(payloadId);
    if (dataStr) {
      const data = JSON.parse(dataStr);
      
      const noteMessage = `
        <p>Your notes have been securely saved to your ClueAI session.</p>
        <p style="color: #22d3ee; margin-top: 25px; margin-bottom: 5px; font-weight: bold;">Notes Detail:</p>
        <div style="background-color: #000000; padding: 15px; border-radius: 8px; border: 1px solid #27272a; color: #ffffff; white-space: pre-wrap;">${data.notes}</div>
      `;

      const noteHtml = getEmailHtml(
        "Interview Notes Saved",
        noteMessage,
        null, // No company name for notes
        null, // No job title for notes
        "User", // Default name for notes
        data.date,
        data.time
      );
      
      // Send the Note Email
      MailApp.sendEmail({
        to: data.email, // Using data.email as original logic specified
        subject: `ClueAI: Your Scheduled Interview Notes`,
        htmlBody: noteHtml,
        name: "ClueAI System"
      });
      
      PropertiesService.getUserProperties().deleteProperty(payloadId);
    }
    PropertiesService.getUserProperties().deleteProperty(triggerKey);
  }
  
  // Cleanup trigger
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getUniqueId() === e.triggerUid) {
      ScriptApp.deleteTrigger(triggers[i]);
      break;
    }
  }
}

function sendScheduledReminder(e) {
  if (!e || !e.triggerUid) return;
  
  const triggerKey = 'trigger_' + e.triggerUid;
  const payloadId = PropertiesService.getUserProperties().getProperty(triggerKey);
  
  if (payloadId) {
    const dataStr = PropertiesService.getUserProperties().getProperty(payloadId);
    if (dataStr) {
      const data = JSON.parse(dataStr);
      
      // --- MASSIVE CONTENT FOR THE FINAL REMINDER EMAIL ---
      const reminderMessage = `
        <p>This is your automated stealth alert! Your scheduled interview time is arriving shortly.</p>
        
        <p>Remember, the key to a successful interview is confidence. ClueAI is quietly running in the background to back you up with expert knowledge in milliseconds. Take a deep breath, relax, and let your natural skills shine—ClueAI will handle the heavy lifting when you need it.</p>
        
        <p style="color: #22d3ee; margin-top: 25px; margin-bottom: 5px; font-weight: bold;">Final Pre-Flight Checklist:</p>
        <ul style="padding-left: 20px; margin-top: 0;">
          <li style="margin-bottom: 8px;"><strong>Test your audio:</strong> Make sure ClueAI is actively picking up and transcribing your microphone or system audio.</li>
          <li style="margin-bottom: 8px;"><strong>Verify Stealth Mode:</strong> Ensure the UI opacity is lowered and <strong style="color: #22d3ee;">stealth mode is actively turned ON</strong> if you are sharing your screen.</li>
          <li style="margin-bottom: 8px;"><strong>Review shortcuts:</strong> Remember that pressing <code>7</code> or <code>Q</code> opens the transcript editor, and <code>0</code> changes the text color for better readability on bright backgrounds.</li>
        </ul>

        <p>You have everything you need to crush this interview. Fire up your dashboard and let's secure this job!</p>
      `;

      const reminderHtml = getEmailHtml(
        "Time for your Interview!",
        reminderMessage,
        data.company_name,
        data.job_title,
        data.to_name,
        data.date,
        data.time
      );
      
      // Send the Reminder Email
      MailApp.sendEmail({
        to: data.to_email,
        subject: `ClueAI Alert: It's time to crush your interview with ${data.company_name}!`,
        htmlBody: reminderHtml,
        name: "ClueAI System"
      });
      
      PropertiesService.getUserProperties().deleteProperty(payloadId);
    }
    PropertiesService.getUserProperties().deleteProperty(triggerKey);
  }
  
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getUniqueId() === e.triggerUid) {
      ScriptApp.deleteTrigger(triggers[i]);
      break;
    }
  }
}
