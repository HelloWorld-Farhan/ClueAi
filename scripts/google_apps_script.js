/**
 * =========================================================================
 * CLUE AI - Google Apps Script Cloud Webhook Backend (Dynamic Auto-Versioning)
 * =========================================================================
 * Handles:
 *  1. Universal 6-Digit Email OTP Verification (Dark Mode)
 *  2. First-Time Welcome Email Delivery
 *  3. Interview Reminders (Confirmation & scheduled live alerts)
 *  4. Interview Notes (Scheduled notes delivery)
 *  5. User Feedback & Bug Reports (Admin report + User thanks)
 *  6. User Registration & Release Update Broadcast Notifications
 *  7. Automated Real-Time Dynamic Versioning (Zero Manual Edits Needed)
 *
 * Support Email: clueai.support@gmail.com
 * Developer: Farhan Khalid (https://farhan-khalid-portfolio.vercel.app/)
 * =========================================================================
 */

const SUPPORT_EMAIL = "clueai.support@gmail.com";
const DEVELOPER_EMAIL = "farhankhalid17968@gmail.com";
const PORTFOLIO_URL = "https://farhan-khalid-portfolio.vercel.app/";
const BASE_FALLBACK_VERSION = "5.9.5";
const DEFAULT_VERSION = BASE_FALLBACK_VERSION;

/**
 * Dynamic Version Resolver
 * Automatically resolves the version without ever needing manual hardcoded edits:
 * 1. Checks if a version was passed in the request or function call (app_version / version)
 * 2. Checks persistent Google Apps Script cache (ScriptProperties "CLUEAI_LATEST_VERSION")
 * 3. Dynamically queries GitHub releases API for the latest release tag
 * 4. Falls back gracefully if offline or unreachable
 */
function getDynamicAppVersion(requestedVersion) {
  try {
    const props = PropertiesService.getScriptProperties();

    // 1. If explicit version was provided in payload, persist and return it
    if (requestedVersion && typeof requestedVersion === 'string' && requestedVersion.trim().length > 0) {
      const cleanVer = requestedVersion.trim().replace(/^v/i, '');
      try {
        props.setProperty("CLUEAI_LATEST_VERSION", cleanVer);
      } catch (e) {}
      return cleanVer;
    }

    // 2. Check persistent ScriptProperties cache
    try {
      const cached = props.getProperty("CLUEAI_LATEST_VERSION");
      if (cached && cached.trim().length > 0) {
        return cached.trim();
      }
    } catch (e) {}

    // 3. Dynamically fetch latest release tag from GitHub API
    try {
      const response = UrlFetchApp.fetch("https://api.github.com/repos/HelloWorld-Farhan/ClueAi/releases/latest", {
        muteHttpExceptions: true,
        headers: { "User-Agent": "ClueAI-AppsScript" }
      });
      if (response && response.getResponseCode() === 200) {
        const release = JSON.parse(response.getContentText());
        if (release && release.tag_name) {
          const liveTag = release.tag_name.replace(/^v/i, '').trim();
          props.setProperty("CLUEAI_LATEST_VERSION", liveTag);
          return liveTag;
        }
      }
    } catch (apiErr) {
      Logger.log("Dynamic GitHub version fetch notice: " + (apiErr ? apiErr.message : apiErr));
    }
  } catch (err) {
    Logger.log("getDynamicAppVersion notice: " + (err ? err.message : err));
  }

  return BASE_FALLBACK_VERSION;
}

/**
 * Zero-argument Test Runner for Google Apps Script IDE
 * Select this function and click "Run" in Apps Script editor to verify without errors.
 */
function testRun() {
  Logger.log("Testing Clue AI Google Apps Script Engine...");
  const dynamicVer = getDynamicAppVersion();
  Logger.log("Dynamically Resolved Version: " + dynamicVer);
  const users = getRegisteredUsers();
  Logger.log("Found " + users.length + " registered users: " + users.join(", "));
  const sampleLayout = getEmailLayout({ appVersion: dynamicVer });
  Logger.log("getEmailLayout() executed successfully. HTML length: " + sampleLayout.length);
  return { status: "OK", version: dynamicVer, userCount: users.length };
}

/**
 * Broadcast New Update to ALL Registered Clue AI Users (No Links, Pure Greeting Announcement)
 * Can be run directly from Google Apps Script Editor or triggered via Webhook POST.
 */
function broadcastNewUpdate(version, summary) {
  const appVersion = getDynamicAppVersion(version);
  const highlights = summary || "Performance optimizations, resilient 1-click update installations with live progress, zero-lag relaunch, and turbocharged startup speed.";
  const users = getRegisteredUsers();
  Logger.log("Broadcasting update V" + appVersion + " to " + users.length + " registered users: " + users.join(", "));
  let sentCount = 0;
  let sentEmails = [];

  users.forEach(uEmail => {
    try {
      const bodyHtml = getUpdateBroadcastEmailHtml("Clue AI User", appVersion, highlights);
      MailApp.sendEmail({
        to: uEmail,
        subject: "Clue AI V" + appVersion + " Update Announcement",
        htmlBody: bodyHtml,
        name: "Clue AI Updates"
      });
      sentCount++;
      sentEmails.push(uEmail);
      Logger.log("Dispatched update announcement to: " + uEmail);
    } catch(err) {
      Logger.log("Failed to send update to " + uEmail + ": " + (err ? err.message : err));
    }
  });

  return {
    sentCount: sentCount,
    sentEmails: sentEmails,
    message: "Broadcast sent to " + sentCount + " users: (" + sentEmails.join(", ") + ")"
  };
}


/**
 * Register User in Persistent Properties Storage for Update Broadcasts
 */
function registerUserEmail(email, userName) {
  try {
    if (!email || !email.includes("@")) return;
    const cleanEmail = email.trim().toLowerCase();
    const props = PropertiesService.getScriptProperties();
    let users = [];
    try {
      users = JSON.parse(props.getProperty("clueai_registered_users") || "[]");
    } catch (e) {
      users = [];
    }

    const exists = users.some(u => {
      const uEmail = (typeof u === "string" ? u : u.email || "").toLowerCase();
      return uEmail === cleanEmail;
    });

    if (!exists) {
      users.push({
        email: cleanEmail,
        name: userName || "ClueAI User",
        registeredAt: new Date().toISOString()
      });
      props.setProperty("clueai_registered_users", JSON.stringify(users));
    }
  } catch (err) {
    console.warn("User registration logging warning:", err);
  }
}

/**
 * Get All Registered User Emails
 */
function getRegisteredUsers() {
  try {
    const props = PropertiesService.getScriptProperties();
    const users = JSON.parse(props.getProperty("clueai_registered_users") || "[]");
    const emailList = [];
    users.forEach(u => {
      const e = typeof u === "string" ? u : u.email;
      if (e && !emailList.includes(e.toLowerCase())) emailList.push(e.toLowerCase());
    });
    if (!emailList.includes(SUPPORT_EMAIL.toLowerCase())) emailList.push(SUPPORT_EMAIL.toLowerCase());
    if (!emailList.includes(DEVELOPER_EMAIL.toLowerCase())) emailList.push(DEVELOPER_EMAIL.toLowerCase());
    return emailList;
  } catch (err) {
    return [DEVELOPER_EMAIL, SUPPORT_EMAIL];
  }
}

/**
 * Premium Dark-Mode Clue AI Master Layout Generator (Matching User's Claude System)
 */
function getEmailLayout(opts) {
  opts = opts || {};
  const version = getDynamicAppVersion(opts.appVersion);
  const year = new Date().getFullYear();
  const heroGradient = opts.heroGradient || "linear-gradient(135deg,#3b82f6 0%,#2563eb 50%,#1d4ed8 100%)";
  const accentGradient = opts.accentGradient || "linear-gradient(90deg,#22d3ee 0%,#3b82f6 55%,#2563eb 100%)";
  const heroChipBg = opts.heroChipBg || "rgba(255,255,255,.18)";
  const heroChip = opts.heroChip || "● Clue AI Notification";
  const headline = opts.headline || "Clue AI";
  const subheadline = opts.subheadline || "";
  const previewText = opts.previewText || headline;
  const centralBoxHtml = opts.centralBoxHtml || "";
  const messageCardHtml = opts.messageCardHtml || "";
  const detailsRowsHtml = opts.detailsRowsHtml || "";
  const extraHtml = opts.extraHtml || "";
  const buttonText = opts.buttonText || "";
  const buttonUrl = opts.buttonUrl || PORTFOLIO_URL;
  const showButton = opts.showButton === true; // Default to false: No redundant buttons on mobile or desktop
  const showPortfolioLink = opts.showPortfolioLink !== undefined ? opts.showPortfolioLink : true;
  const footerNote = opts.footerNote || "You received this email because of your Clue AI account settings.";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${headline} - Clue AI</title>
<style>
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
  img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none}
  body{margin:0!important;padding:0!important;width:100%!important;background:#f1f5f9}
  a{text-decoration:none}
  @media only screen and (max-width:620px){
    .container{width:100%!important}
    .px{padding-left:18px!important;padding-right:18px!important}
    .h1{font-size:25px!important;line-height:32px!important}
    .stack{display:block!important;width:100%!important}
    .btn-full{width:100%!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;">
 
<!-- hidden preview text -->
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:#070a10;">
  ${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
</div>
 
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f5f9" style="background-color:#f1f5f9;">
<tr><td align="center" style="padding:28px 12px;">
 
  <!-- ============ CONTAINER ============ -->
  <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden;">
 
    <!-- accent line -->
    <tr><td height="4" bgcolor="#22d3ee" style="height:4px;line-height:4px;font-size:0;background-color:#0284c7;background-image:${accentGradient};border-radius:24px 24px 0 0;">&nbsp;</td></tr>
 
    <!-- ============ HEADER ============ -->
    <tr>
      <td class="px" style="padding:22px 28px 18px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="left" valign="middle">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="38" height="38" align="center" valign="middle" style="width:38px;height:38px;padding:0;">
                    <img src="https://cdn.jsdelivr.net/gh/HelloWorld-Farhan/ClueAi@main/public/logo.png" width="38" height="38" alt="Clue AI Logo" style="display:block;width:38px;height:38px;border-radius:12px;object-fit:cover;border:1px solid #cbd5e1;box-shadow:0 2px 8px rgba(0,0,0,0.06);" />
                  </td>
                  <td style="padding-left:12px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:21px;font-weight:800;color:#0f172a;letter-spacing:.2px;">Clue <span style="color:#0284c7;">AI</span></td>
                </tr>
              </table>
            </td>
            <td align="right" valign="middle">
              <span style="display:inline-block;padding:5px 11px;border:1px solid #bfdbfe;border-radius:999px;background-color:#eff6ff;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;font-weight:700;letter-spacing:.6px;color:#1d4ed8;">V${version}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr><td style="padding:0 28px;" class="px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" bgcolor="#f1f5f9" style="height:1px;line-height:1px;font-size:0;background-color:#f1f5f9;">&nbsp;</td></tr></table></td></tr>
 
    <!-- ============ HERO CARD ============ -->
    <tr>
      <td class="px" style="padding:24px 28px 8px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#2563eb" style="background-color:#2563eb;background-image:${heroGradient};border-radius:20px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:30px 24px 30px 24px;">
 
              <!-- type chip -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td bgcolor="#3f74e8" style="background-color:${heroChipBg};border-radius:999px;padding:6px 14px;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#ffffff;">
                    ${heroChip}
                  </td>
                </tr>
              </table>
 
              <h1 class="h1" style="margin:18px 0 8px 0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:30px;line-height:38px;font-weight:800;color:#ffffff;">${headline}</h1>
              ${subheadline ? `<p style="margin:0 0 20px 0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:23px;color:#e0f2fe;">${subheadline}</p>` : ''}
 
              <!-- central block -->
              ${centralBoxHtml}
 
            </td>
          </tr>
        </table>
      </td>
    </tr>
 
    <!-- ============ MESSAGE CARD ============ -->
    ${messageCardHtml}
 
    <!-- ============ DETAILS CARD ============ -->
    ${detailsRowsHtml}

    <!-- ============ EXTRA HTML (e.g. Screenshot) ============ -->
    ${extraHtml}
 
    <!-- ============ BUTTON ============ -->
    ${showButton ? `<tr>
      <td align="center" class="px" style="padding:22px 28px 6px 28px;">
        <table role="presentation" class="btn-full" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
          <tr>
            <td align="center" bgcolor="#0ea5e9" style="border-radius:16px;background-color:#0ea5e9;background-image:linear-gradient(90deg,#06b6d4 0%,#0ea5e9 55%,#2563eb 100%);">
              <a href="${buttonUrl}" target="_blank" style="display:block;padding:15px 24px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:#ffffff;border-radius:16px;">&#9654;&nbsp;&nbsp;${buttonText}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>` : ''}
 
    <!-- ============ MADE BY CARD ============ -->
    <tr>
      <td class="px" style="padding:22px 28px 8px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:24px 20px;">
              <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:19px;font-weight:800;color:#0f172a;">Made by Farhan Khalid</div>
              <div style="margin-top:6px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:21px;color:#475569;">Developer &amp; Engineer<br>Development driven by real users &bull; Faster iteration on features</div>
              ${showPortfolioLink ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin-top:14px;">
                <tr>
                  <td align="center" bgcolor="#0284c7" style="background-color:#0284c7;background-image:linear-gradient(90deg,#0284c7 0%,#2563eb 100%);border-radius:999px;box-shadow:0 3px 12px rgba(2,132,199,0.3);">
                    <a href="https://farhan-khalid-portfolio.vercel.app/" target="_blank" style="display:inline-block;padding:10px 24px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;letter-spacing:0.3px;">&#127760;&nbsp;&nbsp;Visit Farhan's Portfolio &rarr;</a>
                  </td>
                </tr>
              </table>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
 
    <!-- ============ FOOTER ============ -->
    <tr>
      <td class="px" align="center" style="padding:20px 28px 28px 28px;">
        <div style="font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;line-height:19px;letter-spacing:.4px;color:#64748b;">
          ${footerNote}<br>
          If this wasn't you, you can safely ignore this message.
        </div>
        <div style="margin-top:12px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#475569;">
          &copy; ${year} Clue AI &nbsp;&bull;&nbsp; V${version}
        </div>
      </td>
    </tr>
 
  </table>
  <!-- ============ /CONTAINER ============ -->
 
</td></tr>
</table>
</body>
</html>`;
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
 * Render Dark-Mode 6-Digit OTP Verification Email
 */
function getOtpEmailHtml(otp, userName, targetEmail, appVersion) {
  const centralBox = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="#0f172a" style="background-color:#0f172a;border:1.5px solid rgba(255,255,255,0.25);border-radius:18px;">
      <tr>
        <td align="center" style="padding:16px 32px;">
          <div style="font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:38px;line-height:42px;font-weight:900;letter-spacing:12px;color:#38bdf8;padding-left:12px;">${otp}</div>
          <div style="margin-top:6px;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.5px;color:#ffffff;text-transform:uppercase;">⏱ Valid for 10 minutes</div>
        </td>
      </tr>
    </table>
  `;

  const messageCard = `
    <tr>
      <td class="px" style="padding:16px 28px 4px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
          <tr>
            <td width="5" bgcolor="#10b981" style="width:5px;background-color:#10b981;border-radius:20px 0 0 20px;font-size:0;line-height:0;">&nbsp;</td>
            <td style="padding:18px 20px;">
              <div style="margin:0 0 8px 0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#059669;">Permanent Cross-Feature Trust</div>
              <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14.5px;line-height:24px;color:#1e293b;">Once verified, this email is automatically trusted across your profile, interview reminders, feedback submissions, and saved notes with zero redundant verification.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  const detailsRows = `
    <tr>
      <td class="px" style="padding:12px 28px 4px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:6px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Target Email</td>
                  <td align="right" style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#0284c7;">${targetEmail}</td>
                </tr>
                <tr>
                  <td style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Action</td>
                  <td align="right" style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#0f172a;">Account &amp; Security Verification</td>
                </tr>
                <tr>
                  <td style="padding:13px 0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Security Status</td>
                  <td align="right" style="padding:13px 0;">
                    <span style="display:inline-block;padding:4px 11px;border:1px solid #86efac;border-radius:999px;background-color:#dcfce7;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;font-weight:800;letter-spacing:1px;color:#15803d;">ENCRYPTED</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return getEmailLayout({
    appVersion: appVersion,
    heroChip: "● Security Verification",
    headline: "Email Verification Code",
    subheadline: `Hi ${userName || 'ClueAI User'}, enter this 6-digit code in Clue AI to verify your address.`,
    previewText: `Your 6-digit Clue AI security verification code is ${otp}.`,
    centralBoxHtml: centralBox,
    messageCardHtml: messageCard,
    detailsRowsHtml: detailsRows,
    buttonText: "Open Clue AI",
    footerNote: "You received this code because your email address was entered in Clue AI."
  });
}

/**
 * Render Dark-Mode Welcome Email for Newly Onboarded Users
 */
function getWelcomeEmailHtml(userName, email, appVersion) {
  const centralBox = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="#0f172a" style="background-color:#0f172a;border:1.5px solid rgba(255,255,255,0.25);border-radius:18px;">
      <tr>
        <td align="center" style="padding:14px 28px;">
          <div style="font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:18px;font-weight:800;letter-spacing:1px;color:#38bdf8;">ACTIVE PRO PROFILE</div>
          <div style="margin-top:4px;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.4px;color:#ffffff;text-transform:uppercase;">Verified Address: ${email}</div>
        </td>
      </tr>
    </table>
  `;

  const messageCard = `
    <tr>
      <td class="px" style="padding:16px 28px 4px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
          <tr>
            <td width="5" bgcolor="#22d3ee" style="width:5px;background-color:#0284c7;border-radius:20px 0 0 20px;font-size:0;line-height:0;">&nbsp;</td>
            <td style="padding:18px 20px;">
              <div style="margin:0 0 8px 0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#0284c7;">What You Can Do With Clue AI</div>
              <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14.5px;line-height:24px;color:#1e293b;">
                &bull; <strong>Stealth Mode:</strong> Undetectable interview copilot with zero window capture.<br>
                &bull; <strong>Real-Time AI Streaming:</strong> Instant code solutions &amp; algorithmic explanations.<br>
                &bull; <strong>Offline Voice-Gated Teleprompter:</strong> Hands-free scrolling triggered by your voice.<br>
                &bull; <strong>Automated Reminders &amp; Notes:</strong> Timely dispatch to your verified inbox.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  const detailsRows = `
    <tr>
      <td class="px" style="padding:12px 28px 4px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:6px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Candidate Name</td>
                  <td align="right" style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#0f172a;">${userName}</td>
                </tr>
                <tr>
                  <td style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Verified Email</td>
                  <td align="right" style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#0284c7;">${email}</td>
                </tr>
                <tr>
                  <td style="padding:13px 0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Account Status</td>
                  <td align="right" style="padding:13px 0;">
                    <span style="display:inline-block;padding:4px 11px;border:1px solid #86efac;border-radius:999px;background-color:#dcfce7;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;font-weight:800;letter-spacing:1px;color:#15803d;">VERIFIED &amp; READY</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return getEmailLayout({
    appVersion: appVersion,
    heroChip: "● Welcome to the Future",
    headline: `Welcome, ${userName}!`,
    subheadline: "Your stealth AI interview assistant is fully configured and ready.",
    previewText: `Welcome to Clue AI, ${userName}! Your profile is verified.`,
    centralBoxHtml: centralBox,
    messageCardHtml: messageCard,
    detailsRowsHtml: detailsRows,
    buttonText: "Launch Clue AI Dashboard",
    footerNote: "You received this welcome message because you verified your email in Clue AI."
  });
}

/**
 * Render Dark-Mode Update Announcement Broadcast Email
 */
function getUpdateBroadcastEmailHtml(userName, appVersion) {
  const centralBox = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="#0f172a" style="background-color:#0f172a;border:1.5px solid rgba(255,255,255,0.25);border-radius:18px;">
      <tr>
        <td align="center" style="padding:14px 28px;">
          <div style="font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:24px;font-weight:900;letter-spacing:2px;color:#38bdf8;">VERSION ${appVersion}</div>
          <div style="margin-top:4px;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.5px;color:#ffffff;text-transform:uppercase;">Latest Stable Build</div>
        </td>
      </tr>
    </table>
  `;

  const messageCard = `
    <tr>
      <td class="px" style="padding:14px 28px 6px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
          <tr>
            <td width="5" bgcolor="#0284c7" style="width:5px;background-color:#0284c7;border-radius:20px 0 0 20px;font-size:0;line-height:0;">&nbsp;</td>
            <td style="padding:22px 24px;">
              <div style="margin:0 0 10px 0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:#0f172a;">Hello ${userName || 'Clue AI User'},</div>
              <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:24px;color:#1e293b;">
                A new official update (<strong>Version ${appVersion}</strong>) is now available for Clue AI.<br><br>
                To get the latest version, simply open Clue AI on your device and click the Update button to upgrade seamlessly.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return getEmailLayout({
    appVersion: appVersion,
    heroChip: "🚀 Official Update Announcement",
    heroChipBg: "rgba(59,130,246,.25)",
    heroGradient: "linear-gradient(135deg,#0284c7 0%,#2563eb 50%,#1d4ed8 100%)",
    accentGradient: "linear-gradient(90deg,#06b6d4 0%,#3b82f6 55%,#2563eb 100%)",
    headline: `Clue AI V${appVersion} is Here`,
    subheadline: `A new software release has arrived for your interview intelligence copilot.`,
    previewText: `Clue AI V${appVersion} update announcement.`,
    centralBoxHtml: centralBox,
    messageCardHtml: messageCard,
    detailsRowsHtml: "",
    showButton: false,
    showPortfolioLink: true,
    footerNote: "You received this greeting email because your email is registered in Clue AI."
  });
}

/**
 * Webhook Health Check and Status Handler (HTTP GET)
 * Returns status, dynamically resolved version, registered user count, and timestamp.
 */
function doGet(e) {
  try {
    const version = getDynamicAppVersion();
    const users = getRegisteredUsers();
    return ContentService.createTextOutput(JSON.stringify({
      status: "online",
      service: "Clue AI Google Apps Script Backend",
      version: version,
      registeredUsersCount: users.length,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Main Webhook Handler (HTTP POST)
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "No POST payload received. Clue AI webhook is online and operational."
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const data = JSON.parse(e.postData.contents);
    const type = data.type || (data.action === 'delete' ? 'delete' : 'reminder');
    const appVersion = getDynamicAppVersion(data.app_version || data.version);

    // ----------------------------------------------------
    // ACTION 1: SEND OTP VERIFICATION CODE
    // ----------------------------------------------------
    if (type === 'send_otp' || type === 'otp') {
      const email = (data.to_email || data.email || data.user_email || '').trim();
      const otp = (data.otp || '').toString().trim();
      const userName = (data.user_name || data.name || '').trim() || 'ClueAI User';

      if (!email || !otp) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Missing email or OTP" }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      registerUserEmail(email, userName);

      const otpHtml = getOtpEmailHtml(otp, userName, email, appVersion);
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
    // ACTION 2: SEND WELCOME EMAIL (ONBOARDING)
    // ----------------------------------------------------
    if (type === 'welcome') {
      const email = (data.to_email || data.email || data.user_email || '').trim();
      const userName = (data.user_name || data.name || '').trim() || 'ClueAI User';

      if (email && email.includes('@')) {
        registerUserEmail(email, userName);
        const welcomeHtml = getWelcomeEmailHtml(userName, email, appVersion);
        MailApp.sendEmail({
          to: email,
          subject: `Welcome to Clue AI, ${userName}! 🚀`,
          htmlBody: welcomeHtml,
          name: "ClueAI Team"
        });
      }

      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Welcome email sent" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ----------------------------------------------------
    // ACTION 3: BROADCAST UPDATE NOTIFICATION TO ALL USERS
    // ----------------------------------------------------
    if (type === 'broadcast_update') {
      const version = getDynamicAppVersion(data.version || data.app_version);
      const highlights = data.highlights || data.release_notes || data.summary || "Performance optimizations, resilient 1-click update installations with live progress, zero-lag relaunch, and turbocharged startup speed.";
      const res = broadcastNewUpdate(version, highlights);
      const msg = typeof res === 'object' ? res.message : res;
      const recipients = typeof res === 'object' ? res.sentEmails : [];
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: msg,
        recipients: recipients,
        sent_count: typeof res === 'object' ? res.sentCount : 0
      }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ----------------------------------------------------
    // ACTION 3.5: SESSION EXPORT REPORT DISPATCH
    // ----------------------------------------------------
    if (type === 'session_export') {
      const email = (data.to_email || data.email || data.user_email || '').trim();
      const userName = (data.user_name || data.name || '').trim() || 'Candidate';
      const sessionName = data.session_name || 'Interview Session';
      const sessionDate = data.session_date || new Date().toLocaleDateString();
      const sessionTime = data.session_time || new Date().toLocaleTimeString();
      const questionCount = data.question_count || (data.interactions ? data.interactions.length : 1);
      const sessionContentHtml = data.html_content || data.content || '<p>No transcript content recorded.</p>';
      const fullHtml = data.full_html || data.html_content || sessionContentHtml;

      if (!email || !email.includes('@')) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Missing valid recipient email' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      registerUserEmail(email, userName);

      const cleanSessionName = (sessionName || "ClueAI_Session").replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_");

      // 1. Generate standalone HTML and PDF attachments
      const htmlBlob = Utilities.newBlob(fullHtml, "text/html", `${cleanSessionName}.html`);
      let attachments = [];
      try {
        const pdfBlob = htmlBlob.getAs("application/pdf").setName(`${cleanSessionName}.pdf`);
        attachments.push(pdfBlob);
      } catch (pdfErr) {
        console.warn("PDF conversion notice:", pdfErr);
      }
      attachments.push(htmlBlob);

      // 2. Create Google Drive preview file if DriveApp is available
      let viewUrl = "";
      try {
        const driveFile = DriveApp.createFile(`${cleanSessionName}_Interactive_Report.html`, fullHtml, "text/html");
        driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        viewUrl = driveFile.getUrl();
      } catch (driveErr) {
        console.warn("DriveApp preview link non-fatal notice:", driveErr);
      }

      const centralBox = `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="#090d16" style="background-color:#090d16;border:2px solid #38bdf8;border-radius:18px;box-shadow:0 4px 14px rgba(0,0,0,0.4);">
          <tr>
            <td align="center" style="padding:16px 32px;background-color:#090d16;">
              <div style="font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:20px;font-weight:900;letter-spacing:1.5px;color:#38bdf8;text-transform:uppercase;">${questionCount} Questions &amp; Solutions</div>
              <div style="margin-top:6px;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:12px;font-weight:700;letter-spacing:1.4px;color:#ffffff;text-transform:uppercase;">Date: ${sessionDate} &bull; ${sessionTime}</div>
            </td>
          </tr>
        </table>
      `;

      const detailsRows = `
        <tr>
          <td class="px" style="padding:12px 28px 4px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
              <tr>
                <td style="padding:6px 20px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Candidate Name</td>
                      <td align="right" style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#0f172a;">${userName}</td>
                    </tr>
                    <tr>
                      <td style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Session Title</td>
                      <td align="right" style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#0f172a;">${sessionName}</td>
                    </tr>
                    <tr>
                      <td style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Export Attachments</td>
                      <td align="right" style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#0284c7;">${cleanSessionName}.pdf &bull; ${cleanSessionName}.html</td>
                    </tr>
                    <tr>
                      <td style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Exported To</td>
                      <td align="right" style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#0284c7;">${email}</td>
                    </tr>
                    <tr>
                      <td style="padding:13px 0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Status</td>
                      <td align="right" style="padding:13px 0;">
                        <span style="display:inline-block;padding:4px 11px;border:1px solid #86efac;border-radius:999px;background-color:#dcfce7;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;font-weight:800;letter-spacing:1px;color:#15803d;">EXPORT DELIVERED</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;

      const messageCard = `
        <tr>
          <td class="px" style="padding:16px 28px 4px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;">
              <tr>
                <td width="5" bgcolor="#0284c7" style="width:5px;background-color:#0284c7;border-radius:16px 0 0 16px;font-size:0;line-height:0;">&nbsp;</td>
                <td style="padding:16px 20px;">
                  <div style="margin:0 0 6px 0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#0284c7;">Session Export Complete</div>
                  <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#334155;">
                    Your interview session report has been generated. You can review your questions, AI solutions, and code snippets in the attached interactive HTML and PDF documents.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;

      const exportEmailHtml = getEmailLayout({
        appVersion: appVersion,
        heroChip: "● Interview Session Export",
        headline: sessionName,
        subheadline: `Hi ${userName}, here is your exported session report with AI solutions & code.`,
        previewText: `Your interview session export for ${sessionName} is ready with attached PDF & HTML.`,
        centralBoxHtml: centralBox,
        detailsRowsHtml: detailsRows,
        messageCardHtml: messageCard,
        showButton: true,
        buttonText: "Open Interactive Session HTML",
        buttonUrl: viewUrl || PORTFOLIO_URL,
        footerNote: "Your formatted PDF report and standalone HTML are attached directly to this email."
      });

      MailApp.sendEmail({
        to: email,
        subject: `ClueAI Session Export: ${sessionName}`,
        htmlBody: exportEmailHtml,
        name: "ClueAI Sessions",
        attachments: attachments
      });

      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Session exported to email successfully" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ----------------------------------------------------
    // ACTION 4: DELETE SCHEDULED ITEM
    // ----------------------------------------------------
    if (data.action === 'delete' && data.id) {
      const triggers = ScriptApp.getProjectTriggers();
      for (let i = 0; i < triggers.length; i++) {
        const triggerKey = 'trigger_' + triggers[i].getUniqueId();
        const payloadId = PropertiesService.getScriptProperties().getProperty(triggerKey);
        if (payloadId === data.id) {
          ScriptApp.deleteTrigger(triggers[i]);
          PropertiesService.getScriptProperties().deleteProperty(triggerKey);
          PropertiesService.getScriptProperties().deleteProperty(payloadId);
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Trigger deleted' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ----------------------------------------------------
    // ACTION 5: USER FEEDBACK & PROBLEM REPORT
    // ----------------------------------------------------
    if (type === 'feedback') {
      const userEmail = (data.user_email || data.email || data.to_email || "Anonymous").trim();
      const userName = (data.user_name || data.name || "").trim() || "User";
      const category = data.category || "General Feedback";
      const description = data.description || "No description provided.";
      const timestamp = new Date().toLocaleString();
      const hasImage = Boolean(data.image_base64);

      if (userEmail && userEmail.includes("@")) {
        registerUserEmail(userEmail, userName);
      }

      let screenshotSection = "";
      let inlineImages = {};

      if (hasImage) {
        try {
          const base64Data = data.image_base64.replace(/^data:image\/\w+;base64,/, "");
          const decoded = Utilities.base64Decode(base64Data);
          const blob = Utilities.newBlob(decoded, "image/png", "screenshot.png");
          inlineImages["feedback_screenshot"] = blob;
          screenshotSection = `
            <tr>
              <td class="px" style="padding:16px 28px 4px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <div style="margin:0 0 10px 0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#f59e0b;">Attached Screenshot</div>
                      <div style="background-color:#0b1626;border:1px solid #e2e8f0;border-radius:16px;padding:10px;text-align:center;">
                        <img src="cid:feedback_screenshot" alt="Screenshot" style="max-width:100%;height:auto;border-radius:12px;border:1px solid #155e75;" />
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          `;
        } catch (imgErr) {
          console.warn("Failed to attach inline screenshot:", imgErr);
        }
      }

      // 1. Admin Email (Sent ONLY to Farhan Khalid & ClueAI Support with full details and image)
      const adminDetailsRows = `
        <tr>
          <td class="px" style="padding:12px 28px 4px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
              <tr>
                <td style="padding:6px 20px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Candidate Name</td>
                      <td align="right" style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#0f172a;">${userName}</td>
                    </tr>
                    <tr>
                      <td style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">User Email</td>
                      <td align="right" style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#0284c7;"><a href="mailto:${userEmail}" style="color:#0284c7;text-decoration:none;">${userEmail}</a></td>
                    </tr>
                    <tr>
                      <td style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Category</td>
                      <td align="right" style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#0f172a;">${category}</td>
                    </tr>
                    <tr>
                      <td style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Timestamp</td>
                      <td align="right" style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:12px;color:#475569;">${timestamp}</td>
                    </tr>
                    <tr>
                      <td style="padding:13px 0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">App Version</td>
                      <td align="right" style="padding:13px 0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:12px;color:#059669;font-weight:700;">V${appVersion}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;

      const adminMessageCard = `
        <tr>
          <td class="px" style="padding:16px 28px 4px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
              <tr>
                <td width="5" bgcolor="#3b82f6" style="width:5px;background-color:#3b82f6;border-radius:20px 0 0 20px;font-size:0;line-height:0;">&nbsp;</td>
                <td style="padding:18px 20px;">
                  <div style="margin:0 0 8px 0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#60a5fa;">Reported Problem / Message:</div>
                  <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:25px;color:#1e293b;white-space:pre-wrap;">${description}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;

      const adminCentralBox = `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="#0f172a" style="background-color:#0f172a;border:1px solid rgba(255,255,255,.25);border-radius:18px;">
          <tr>
            <td align="center" style="padding:12px 28px;">
              <div style="font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:16px;font-weight:700;letter-spacing:1px;color:#38bdf8;">${category}</div>
              <div style="margin-top:4px;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.4px;color:#ffffff;text-transform:uppercase;">App Version: v${appVersion}</div>
            </td>
          </tr>
        </table>
      `;

      const adminHtml = getEmailLayout({
        appVersion: appVersion,
        heroChip: "● Engineering Diagnostic Report",
        headline: "New User Feedback Received",
        subheadline: `From ${userName} (${userEmail})`,
        previewText: `[Clue AI Admin] New ${category} report from ${userName}.`,
        centralBoxHtml: adminCentralBox,
        detailsRowsHtml: adminDetailsRows,
        messageCardHtml: adminMessageCard,
        extraHtml: screenshotSection,
        buttonText: `Reply to ${userName}`,
        buttonUrl: `mailto:${userEmail}`,
        footerNote: "Clue AI Automated System Alert • Restricted to Authorized Engineers"
      });

      const adminEmailOptions = {
        to: `${DEVELOPER_EMAIL}, ${SUPPORT_EMAIL}`,
        subject: `[ClueAI Feedback] ${category} - from ${userName} (${userEmail})`,
        htmlBody: adminHtml,
        name: "ClueAI Feedback System"
      };
      if (Object.keys(inlineImages).length > 0) {
        adminEmailOptions.inlineImages = inlineImages;
      }
      MailApp.sendEmail(adminEmailOptions);

      // 2. User Confirmation Email (Sent ONLY to user with their name, WITHOUT their problem details)
      if (userEmail && userEmail.includes("@")) {
        const userCentralBox = `
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="#090d16" style="background-color:#090d16;border:2px solid #38bdf8;border-radius:18px;box-shadow:0 4px 14px rgba(0,0,0,0.4);">
            <tr>
              <td align="center" style="padding:16px 32px;background-color:#090d16;">
                <div style="font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:24px;line-height:30px;font-weight:900;letter-spacing:1.5px;color:#38bdf8;text-transform:uppercase;">TICKET LOGGED</div>
                <div style="margin-top:6px;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:12px;font-weight:700;letter-spacing:1.4px;color:#ffffff;text-transform:uppercase;">Category: ${category}</div>
              </td>
            </tr>
          </table>
        `;

        const userMessageCard = `
          <tr>
            <td class="px" style="padding:16px 28px 4px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
                <tr>
                  <td width="5" bgcolor="#10b981" style="width:5px;background-color:#10b981;border-radius:20px 0 0 20px;font-size:0;line-height:0;">&nbsp;</td>
                  <td style="padding:18px 20px;">
                    <div style="margin:0 0 8px 0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#059669;">Direct Engineering Routing</div>
                    <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14.5px;line-height:24px;color:#1e293b;">
                      Your report has been forwarded directly to our engineering and support leads. Every submission directly influences upcoming feature rollouts and rapid patches. If additional troubleshooting is needed, our team will reach out directly to your verified email.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        `;

        const userDetailsRows = `
          <tr>
            <td class="px" style="padding:12px 28px 4px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
                <tr>
                  <td style="padding:6px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Submitted By</td>
                        <td align="right" style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#0f172a;">${userName}</td>
                      </tr>
                      <tr>
                        <td style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Category</td>
                        <td align="right" style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#0284c7;">${category}</td>
                      </tr>
                      <tr>
                        <td style="padding:13px 0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Routing Status</td>
                        <td align="right" style="padding:13px 0;">
                          <span style="display:inline-block;padding:4px 11px;border:1px solid #86efac;border-radius:999px;background-color:#dcfce7;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;font-weight:800;letter-spacing:1px;color:#15803d;">DELIVERED TO ENGINEERING</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        `;

        const userHtml = getEmailLayout({
          appVersion: appVersion,
          heroChip: "● Feedback Acknowledgment",
          headline: "We Received Your Feedback!",
          subheadline: `Hello ${userName}, thank you for helping us improve Clue AI.`,
          previewText: `Thank you for your feedback, ${userName}!`,
          centralBoxHtml: userCentralBox,
          messageCardHtml: userMessageCard,
          detailsRowsHtml: userDetailsRows,
          buttonText: "Return to Clue AI",
          footerNote: "You received this email because you submitted feedback in Clue AI."
        });

        MailApp.sendEmail({
          to: userEmail,
          subject: `ClueAI: Thank you for your feedback, ${userName}!`,
          htmlBody: userHtml,
          name: "ClueAI Support"
        });
      }

      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Feedback sent' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ----------------------------------------------------
    // ACTION 6: INTERVIEW NOTES
    // ----------------------------------------------------
    if (type === 'note') {
      if (data.email) registerUserEmail(data.email, data.to_name || 'Candidate');
      const targetDate = parseTargetDate(data.date, data.time);
      const triggerId = data.id || Utilities.getUuid();
      PropertiesService.getScriptProperties().setProperty(triggerId, JSON.stringify(data));

      const newTrigger = ScriptApp.newTrigger('sendScheduledNote')
        .timeBased()
        .at(targetDate)
        .create();

      PropertiesService.getScriptProperties().setProperty('trigger_' + newTrigger.getUniqueId(), triggerId);

      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Note scheduled for ' + targetDate }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ----------------------------------------------------
    // ACTION 7: INTERVIEW REMINDER
    // ----------------------------------------------------
    const toName = data.to_name || "Candidate";
    const reminderEmail = (data.to_email || data.email || '').trim();
    if (reminderEmail) registerUserEmail(reminderEmail, toName);
    const company = data.company_name || "Upcoming Interview";
    const role = data.job_title || "Technical Role";

    const reminderCentralBox = `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="#0f172a" style="background-color:#0f172a;border:1.5px solid rgba(255,255,255,0.25);border-radius:18px;">
        <tr>
          <td align="center" style="padding:14px 28px;">
            <div style="font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:34px;line-height:38px;font-weight:800;letter-spacing:1px;color:#38bdf8;">${data.time}</div>
            <div style="margin-top:4px;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:12px;letter-spacing:1.6px;color:#ffffff;">${data.date}</div>
          </td>
        </tr>
      </table>
    `;

    const reminderMessageCard = `
      <tr>
        <td class="px" style="padding:16px 28px 4px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
            <tr>
              <td width="5" bgcolor="#22d3ee" style="width:5px;background-color:#0284c7;border-radius:20px 0 0 20px;font-size:0;line-height:0;">&nbsp;</td>
              <td style="padding:18px 20px;">
                <div style="margin:0 0 8px 0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#0284c7;">Reminder Message</div>
                <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:25px;color:#1e293b;">Scheduled interview reminder for ${company} (${role}).</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;

    const reminderDetailsRows = `
      <tr>
        <td class="px" style="padding:12px 28px 4px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:6px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Company</td>
                    <td align="right" style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#0f172a;">${company}</td>
                  </tr>
                  <tr>
                    <td style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Role</td>
                    <td align="right" style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#0f172a;">${role}</td>
                  </tr>
                  <tr>
                    <td style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Date &amp; Time</td>
                    <td align="right" style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:13px;font-weight:600;color:#0284c7;">${data.date} &nbsp;&bull;&nbsp; ${data.time}</td>
                  </tr>
                  <tr>
                    <td style="padding:13px 0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Status</td>
                    <td align="right" style="padding:13px 0;">
                      <span style="display:inline-block;padding:4px 11px;border:1px solid #7dd3fc;border-radius:999px;background-color:#e0f2fe;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;font-weight:800;letter-spacing:1px;color:#0369a1;">SCHEDULED</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;

    const thanksHtml = getEmailLayout({
      appVersion: appVersion,
      heroChip: "● Interview & Notes Reminder",
      headline: company,
      subheadline: `Hi ${toName}, your interview reminder has been confirmed in Clue AI.`,
      previewText: `Your interview reminder for ${company} is scheduled for ${data.time} on ${data.date}.`,
      centralBoxHtml: reminderCentralBox,
      messageCardHtml: reminderMessageCard,
      detailsRowsHtml: reminderDetailsRows,
      buttonText: "Open Clue AI",
      footerNote: "You received this email because a reminder was created in Clue AI."
    });

    if (data.to_email && data.to_email.includes("@")) {
      registerUserEmail(data.to_email, toName);
      MailApp.sendEmail({
        to: data.to_email,
        subject: `ClueAI: Your interview setup for ${company} is confirmed!`,
        htmlBody: thanksHtml,
        name: "ClueAI System"
      });
    }

    // Schedule Future Trigger
    const targetDate = parseTargetDate(data.date, data.time);
    const triggerId = data.id || Utilities.getUuid();
    PropertiesService.getScriptProperties().setProperty(triggerId, JSON.stringify(data));

    const newTrigger = ScriptApp.newTrigger('sendScheduledReminder')
      .timeBased()
      .at(targetDate)
      .create();

    PropertiesService.getScriptProperties().setProperty('trigger_' + newTrigger.getUniqueId(), triggerId);

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
  const payloadId = PropertiesService.getScriptProperties().getProperty(triggerKey);

  if (payloadId) {
    const dataStr = PropertiesService.getScriptProperties().getProperty(payloadId);
    if (dataStr) {
      const data = JSON.parse(dataStr);
      const toName = data.to_name || "Candidate";
      const company = data.company_name || "Your Interview";
      const appVersion = getDynamicAppVersion(data.app_version || data.version);

      const alertCentralBox = `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="#450a0a" style="background-color:#450a0a;border:1.5px solid rgba(255,255,255,.25);border-radius:18px;">
          <tr>
            <td align="center" style="padding:14px 28px;">
              <div style="font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:34px;line-height:38px;font-weight:800;letter-spacing:1px;color:#fca5a5;">${data.time || 'NOW'}</div>
              <div style="margin-top:4px;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:12px;letter-spacing:1.6px;color:#ffffff;">${data.date || 'TODAY'}</div>
            </td>
          </tr>
        </table>
      `;

      const alertMessageCard = `
        <tr>
          <td class="px" style="padding:16px 28px 4px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
              <tr>
                <td width="5" bgcolor="#ef4444" style="width:5px;background-color:#ef4444;border-radius:20px 0 0 20px;font-size:0;line-height:0;">&nbsp;</td>
                <td style="padding:18px 20px;">
                  <div style="margin:0 0 8px 0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#f87171;">Pre-Interview Checklist</div>
                  <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14.5px;line-height:24px;color:#1e293b;">
                    &bull; Launch ClueAI desktop application<br>
                    &bull; Verify microphone &amp; audio source active<br>
                    &bull; Press <code>Ctrl + Shift + Enter</code> or Start AI Interview for live assistance
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;

      const alertDetailsRows = `
        <tr>
          <td class="px" style="padding:12px 28px 4px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
              <tr>
                <td style="padding:6px 20px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Company</td>
                      <td align="right" style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#0f172a;">${company}</td>
                    </tr>
                    <tr>
                      <td style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Status</td>
                      <td align="right" style="padding:13px 0;">
                        <span style="display:inline-block;padding:4px 11px;border:1px solid #86efac;border-radius:999px;background-color:#dcfce7;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;font-weight:800;letter-spacing:1px;color:#15803d;">STARTING NOW</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;

      const alertHtml = getEmailLayout({
        appVersion: appVersion,
        heroChip: "● Live Interview Alert",
        headline: company,
        subheadline: `Hi ${toName}, your scheduled interview is starting now!`,
        previewText: `ALERT: Your interview session ${company} is starting now!`,
        centralBoxHtml: alertCentralBox,
        messageCardHtml: alertMessageCard,
        detailsRowsHtml: alertDetailsRows,
        buttonText: "Launch Clue AI Copilot",
        heroGradient: "linear-gradient(135deg,#ef4444 0%,#dc2626 50%,#b91c1c 100%)",
        accentGradient: "linear-gradient(90deg,#ef4444 0%,#f59e0b 55%,#10b981 100%)",
        footerNote: "Good luck on your interview!"
      });

      MailApp.sendEmail({
        to: data.to_email,
        subject: `ClueAI Alert: It's time for your interview with ${company}!`,
        htmlBody: alertHtml,
        name: "ClueAI System"
      });

      PropertiesService.getScriptProperties().deleteProperty(payloadId);
    }
    PropertiesService.getScriptProperties().deleteProperty(triggerKey);
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
  const payloadId = PropertiesService.getScriptProperties().getProperty(triggerKey);

  if (payloadId) {
    const dataStr = PropertiesService.getScriptProperties().getProperty(payloadId);
    if (dataStr) {
      const data = JSON.parse(dataStr);
      const appVersion = getDynamicAppVersion(data.app_version || data.version);

      const noteCentralBox = `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="#0f172a" style="background-color:#0f172a;border:1.5px solid rgba(255,255,255,0.25);border-radius:18px;">
          <tr>
            <td align="center" style="padding:14px 28px;">
              <div style="font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:34px;line-height:38px;font-weight:800;letter-spacing:1px;color:#34d399;">${data.time}</div>
              <div style="margin-top:4px;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:12px;letter-spacing:1.6px;color:#ffffff;">${data.date}</div>
            </td>
          </tr>
        </table>
      `;

      const noteMessageCard = `
        <tr>
          <td class="px" style="padding:16px 28px 4px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
              <tr>
                <td width="5" bgcolor="#10b981" style="width:5px;background-color:#10b981;border-radius:20px 0 0 20px;font-size:0;line-height:0;">&nbsp;</td>
                <td style="padding:18px 20px;">
                  <div style="margin:0 0 8px 0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#059669;">Interview Notes &amp; Highlights</div>
                  <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:25px;color:#1e293b;white-space:pre-wrap;">${data.notes}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;

      const noteDetailsRows = `
        <tr>
          <td class="px" style="padding:12px 28px 4px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
              <tr>
                <td style="padding:6px 20px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Saved At</td>
                      <td align="right" style="padding:13px 0;border-bottom:1px solid #e2e8f0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:13px;font-weight:600;color:#0284c7;">${data.date} &nbsp;&bull;&nbsp; ${data.time}</td>
                    </tr>
                    <tr>
                      <td style="padding:13px 0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#475569;">Status</td>
                      <td align="right" style="padding:13px 0;">
                        <span style="display:inline-block;padding:4px 11px;border:1px solid #86efac;border-radius:999px;background-color:#dcfce7;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:11px;font-weight:800;letter-spacing:1px;color:#15803d;">ARCHIVED</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;

      const noteHtml = getEmailLayout({
        appVersion: appVersion,
        heroChip: "● Saved Interview Notes",
        headline: "Your Interview Notes",
        subheadline: "Here are your saved interview notes and revision points.",
        previewText: "Your saved interview notes from Clue AI.",
        centralBoxHtml: noteCentralBox,
        messageCardHtml: noteMessageCard,
        detailsRowsHtml: noteDetailsRows,
        buttonText: "Open Clue AI Notes",
        heroGradient: "linear-gradient(135deg,#10b981 0%,#059669 50%,#047857 100%)",
        accentGradient: "linear-gradient(90deg,#10b981 0%,#06b6d4 55%,#3b82f6 100%)",
        footerNote: "You received this email because you saved notes in Clue AI."
      });

      MailApp.sendEmail({
        to: data.email,
        subject: `ClueAI: Your Scheduled Interview Notes`,
        htmlBody: noteHtml,
        name: "ClueAI System"
      });

      PropertiesService.getScriptProperties().deleteProperty(payloadId);
    }
    PropertiesService.getScriptProperties().deleteProperty(triggerKey);
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
